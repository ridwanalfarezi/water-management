import mqtt from "mqtt";
import pg from "pg";
import type { PoolClient } from "pg";
import { parseDeviceTopic } from "./device-protocol";

const { Pool } = pg;

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://user:password@localhost:5432/waterdb";

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

type SolenoidState = "ON" | "OFF";
type ControlMode = "AUTO" | "MANUAL";

interface SensorPayload {
  ph: number;
  temperature?: number;
  do?: number;
  solenoid?: SolenoidState;
  mode?: ControlMode;
  rssi?: number;
}

async function waitForDatabase(retries = 10, delay = 3000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log("[Worker] Connected to PostgreSQL");
      return;
    } catch {
      console.log(
        `[Worker] Waiting for PostgreSQL... attempt ${i + 1}/${retries}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("[Worker] Could not connect to PostgreSQL after retries");
}

// Keep existing installations compatible with pH-only hardware telemetry.
async function migrateDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id SERIAL PRIMARY KEY,
      device_uid VARCHAR(12) UNIQUE NOT NULL,
      connection_state VARCHAR(7) NOT NULL DEFAULT 'offline',
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT devices_uid_format CHECK (device_uid ~ '^[0-9A-F]{12}$'),
      CONSTRAINT devices_connection_state CHECK (connection_state IN ('online', 'offline'))
    );
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'control_log' AND column_name = 'aerator'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'control_log' AND column_name = 'action'
      ) THEN
        ALTER TABLE control_log RENAME COLUMN aerator TO action;
      END IF;
    END$$;
    ALTER TABLE control_log ALTER COLUMN action TYPE VARCHAR(20);
    ALTER TABLE sensor_data ALTER COLUMN temperature DROP NOT NULL;
    ALTER TABLE sensor_data ALTER COLUMN do_level DROP NOT NULL;
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS solenoid_state VARCHAR(3);
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS control_mode VARCHAR(10);
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS rssi INTEGER;
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);
    ALTER TABLE pond_journal ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);
    CREATE INDEX IF NOT EXISTS sensor_data_device_created_idx
      ON sensor_data (device_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS pond_journal_device_created_idx
      ON pond_journal (device_id, created_at DESC);
  `);
  console.log("[Worker] Database schema ready");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseSensorPayload(value: unknown): SensorPayload | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as Record<string, unknown>;
  if (!isFiniteNumber(payload.ph) || payload.ph < 0 || payload.ph > 14) {
    return null;
  }
  if (
    payload.temperature !== undefined &&
    !isFiniteNumber(payload.temperature)
  ) {
    return null;
  }
  if (payload.do !== undefined && !isFiniteNumber(payload.do)) return null;

  const solenoid =
    payload.solenoid === "ON" || payload.solenoid === "OFF"
      ? payload.solenoid
      : undefined;
  const mode =
    payload.mode === "AUTO" || payload.mode === "MANUAL"
      ? payload.mode
      : undefined;

  return {
    ph: payload.ph,
    temperature: payload.temperature as number | undefined,
    do: payload.do as number | undefined,
    solenoid,
    mode,
    rssi: isFiniteNumber(payload.rssi) ? Math.round(payload.rssi) : undefined,
  };
}

async function registerDevice(
  client: PoolClient,
  deviceUid: string,
): Promise<number> {
  // Serialize registration messages for the same UID. This prevents a
  // simultaneous retained presence + telemetry packet from consuming extra
  // sequence values before the unique constraint resolves the conflict.
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [deviceUid]);

  const existing = await client.query<{ id: number }>(
    `UPDATE devices
     SET connection_state = 'online', last_seen_at = NOW()
     WHERE device_uid = $1
     RETURNING id`,
    [deviceUid],
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO devices
       (device_uid, connection_state, first_seen_at, last_seen_at)
     VALUES ($1, 'online', NOW(), NOW())
     RETURNING id`,
    [deviceUid],
  );
  return inserted.rows[0].id;
}

async function updatePresence(
  deviceUid: string,
  state: "online" | "offline",
): Promise<void> {
  if (state === "offline") {
    await pool.query(
      `UPDATE devices
       SET connection_state = 'offline', last_seen_at = NOW()
       WHERE device_uid = $1`,
      [deviceUid],
    );
    console.log(`[Worker] Device ${deviceUid} offline`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pondId = await registerDevice(client, deviceUid);
    await client.query("COMMIT");
    console.log(`[Worker] Device ${deviceUid} online as pond=${pondId}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveSensorData(
  deviceUid: string,
  payload: SensorPayload,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pondId = await registerDevice(client, deviceUid);
    await client.query(
      `INSERT INTO sensor_data
         (pond_id, device_id, temperature, do_level, ph_level, solenoid_state, control_mode, rssi, created_at)
       VALUES ($1, $1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        pondId,
        payload.temperature ?? null,
        payload.do ?? null,
        payload.ph,
        payload.solenoid ?? null,
        payload.mode ?? null,
        payload.rssi ?? null,
      ],
    );
    await client.query("COMMIT");

    console.log(
      `[Worker] Saved device=${deviceUid} pond=${pondId} ph=${payload.ph.toFixed(2)} solenoid=${payload.solenoid ?? "unknown"} mode=${payload.mode ?? "unknown"}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  await waitForDatabase();
  await migrateDatabase();

  console.log(`[Worker] Connecting to MQTT at ${MQTT_URL}...`);
  const client = mqtt.connect(MQTT_URL, {
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  });

  client.on("connect", () => {
    console.log("[Worker] Connected to MQTT broker");
    client.subscribe(["device/+/sensor", "device/+/status"], { qos: 1 }, (err) => {
      if (err) console.error("[Worker] Subscribe error:", err);
      else console.log("[Worker] Subscribed to device telemetry and presence");
    });
  });

  client.on("message", async (topic: string, message: Buffer) => {
    try {
      const deviceTopic = parseDeviceTopic(topic);
      if (!deviceTopic) return;

      if (deviceTopic.kind === "status") {
        const state = message.toString();
        if (state !== "online" && state !== "offline") {
          console.error(`[Worker] Invalid presence payload on ${topic}`);
          return;
        }
        await updatePresence(deviceTopic.deviceUid, state);
        return;
      }

      const payload = parseSensorPayload(JSON.parse(message.toString()));
      if (!payload) {
        console.error(`[Worker] Invalid sensor payload on ${topic}`);
        return;
      }

      await saveSensorData(deviceTopic.deviceUid, payload);
    } catch (error) {
      console.error(`[Worker] Error processing ${topic}:`, error);
    }
  });

  client.on("error", (err) => console.error("[Worker] MQTT error:", err));
  client.on("reconnect", () =>
    console.log("[Worker] Reconnecting to MQTT..."),
  );
}

main().catch(console.error);
