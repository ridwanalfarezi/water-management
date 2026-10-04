import mqtt from "mqtt";
import pg from "pg";
import type { PoolClient } from "pg";
import {
  type CommandAck,
  type CommandStatus,
  parseCommandAck,
  resolveAckStatus,
} from "./command-protocol";
import { parseDeviceTopic } from "./device-protocol";
import { parseDemoTelemetry, type DemoTelemetry } from "./demo-protocol";

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
  demo?: DemoTelemetry;
  // pH is optional: solenoid-only controllers (no pH probe) send heartbeats
  // with mode/solenoid/rssi only. Absent pH stores NULL (belum_ada_data).
  ph: number | null;
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
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS data_source VARCHAR(12);
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS demo_step VARCHAR(12);
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS demo_paused BOOLEAN;
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS demo_revision BIGINT;
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS demo_session VARCHAR(16);
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS command_id UUID;
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'LEGACY';
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS requested_mode VARCHAR(10);
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS requested_solenoid VARCHAR(3);
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS applied_mode VARCHAR(10);
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS applied_solenoid VARCHAR(3);
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS relay_pin_level SMALLINT;
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(100);
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
    ALTER TABLE control_log ADD COLUMN IF NOT EXISTS timed_out_at TIMESTAMPTZ;
    ALTER TABLE pond_journal ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);
    CREATE INDEX IF NOT EXISTS sensor_data_device_created_idx
      ON sensor_data (device_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS pond_journal_device_created_idx
      ON pond_journal (device_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS control_log_command_id_unique_idx
      ON control_log (command_id) WHERE command_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS control_log_one_inflight_per_device_idx
      ON control_log (device_id) WHERE status IN ('PENDING', 'SENT');
  `);
  console.log("[Worker] Database schema ready");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseSensorPayload(value: unknown): SensorPayload | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as Record<string, unknown>;
  const demo = parseDemoTelemetry(payload);
  if (payload.dataSource !== undefined && !demo) return null;
  // pH optional (solenoid-only controllers have no probe); when present it
  // must be a valid 0–14 reading.
  let ph: number | null = null;
  if (payload.ph !== undefined) {
    if (!isFiniteNumber(payload.ph) || payload.ph < 0 || payload.ph > 14) {
      return null;
    }
    ph = payload.ph;
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
    demo: demo ?? undefined,
    ph,
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
         (pond_id, device_id, temperature, do_level, ph_level, solenoid_state, control_mode, rssi,
          data_source, demo_step, demo_paused, demo_revision, demo_session, created_at)
       VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        pondId,
        payload.temperature ?? null,
        payload.do ?? null,
        payload.ph ?? null,
        payload.solenoid ?? null,
        payload.mode ?? null,
        payload.rssi ?? null,
        payload.demo?.dataSource ?? null,
        payload.demo?.demoStep ?? null,
        payload.demo?.demoPaused ?? null,
        payload.demo?.demoRevision ?? null,
        payload.demo?.demoSession ?? null,
      ],
    );
    await client.query("COMMIT");

    console.log(
      `[Worker] Saved device=${deviceUid} pond=${pondId} ph=${payload.ph === null ? "n/a" : payload.ph.toFixed(2)} solenoid=${payload.solenoid ?? "unknown"} mode=${payload.mode ?? "unknown"}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const FINAL_COMMAND_STATUSES = new Set<CommandStatus>([
  "APPLIED",
  "REJECTED",
  "APPLIED_LATE",
  "REJECTED_LATE",
]);

async function handleCommandAck(
  deviceUid: string,
  acknowledgement: CommandAck,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ status: CommandStatus }>(
      `SELECT cl.status
       FROM control_log cl
       JOIN devices d ON d.id = cl.device_id
       WHERE cl.command_id = $1 AND d.device_uid = $2
       FOR UPDATE OF cl`,
      [acknowledgement.commandId, deviceUid],
    );

    if (result.rows.length === 0) {
      const commandExists = await client.query(
        `SELECT 1 FROM control_log WHERE command_id = $1`,
        [acknowledgement.commandId],
      );
      await client.query("COMMIT");
      console.warn(
        commandExists.rows.length > 0
          ? `[Worker] Ignored ACK ${acknowledgement.commandId}: wrong device ${deviceUid}`
          : `[Worker] Ignored ACK ${acknowledgement.commandId}: unknown command`,
      );
      return;
    }

    const currentStatus = result.rows[0].status;
    if (FINAL_COMMAND_STATUSES.has(currentStatus)) {
      await client.query("COMMIT");
      console.log(
        `[Worker] Duplicate ACK ${acknowledgement.commandId} ignored (${currentStatus})`,
      );
      return;
    }

    const nextStatus = resolveAckStatus(
      currentStatus,
      acknowledgement.status,
    );
    if (acknowledgement.status === "APPLIED") {
      await client.query(
        `UPDATE control_log
         SET status = $2,
             applied_mode = $3,
             applied_solenoid = $4,
             relay_pin_level = $5,
             failure_reason = NULL,
             acknowledged_at = NOW()
         WHERE command_id = $1`,
        [
          acknowledgement.commandId,
          nextStatus,
          acknowledgement.mode,
          acknowledgement.solenoid,
          acknowledgement.relayPinLevel,
        ],
      );
    } else {
      await client.query(
        `UPDATE control_log
         SET status = $2,
             failure_reason = $3,
             acknowledged_at = NOW()
         WHERE command_id = $1`,
        [acknowledgement.commandId, nextStatus, acknowledgement.reason],
      );
    }
    await client.query("COMMIT");
    console.log(
      `[Worker] ACK ${acknowledgement.commandId} from ${deviceUid}: ${nextStatus}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function markTimedOutCommands(): Promise<void> {
  const result = await pool.query(
    `UPDATE control_log
     SET status = 'TIMED_OUT', timed_out_at = NOW()
     WHERE status IN ('PENDING', 'SENT')
       AND COALESCE(sent_at, created_at::timestamptz)
           <= NOW() - INTERVAL '5 seconds'
     RETURNING command_id`,
  );
  if (result.rowCount && result.rowCount > 0) {
    console.warn(`[Worker] Timed out ${result.rowCount} command(s)`);
  }
}

async function main(): Promise<void> {
  await waitForDatabase();
  await migrateDatabase();
  await markTimedOutCommands();
  setInterval(() => {
    markTimedOutCommands().catch((error) =>
      console.error("[Worker] Command timeout sweep failed:", error),
    );
  }, 1000);

  console.log(`[Worker] Connecting to MQTT at ${MQTT_URL}...`);
  const client = mqtt.connect(MQTT_URL, {
    // Unique per process start: sharing an ID with another client makes the
    // broker kick one session off, which surfaces as flapping online status.
    clientId: `kolampintar-worker-${process.pid}-${Math.random().toString(16).slice(2, 10)}`,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  });

  client.on("connect", () => {
    console.log("[Worker] Connected to MQTT broker");
    client.subscribe(
      ["device/+/sensor", "device/+/status", "device/+/ack"],
      { qos: 1 },
      (err) => {
        if (err) console.error("[Worker] Subscribe error:", err);
        else console.log("[Worker] Subscribed to telemetry, presence, and ACKs");
      },
    );
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

      if (deviceTopic.kind === "ack") {
        const rawAcknowledgement = message.toString();
        if (!rawAcknowledgement) {
          console.error(`[Worker] Invalid command ACK on ${topic}`);
          return;
        }
        const acknowledgement = parseCommandAck(JSON.parse(rawAcknowledgement));
        if (!acknowledgement) {
          console.error(`[Worker] Invalid command ACK on ${topic}`);
          return;
        }
        await handleCommandAck(deviceTopic.deviceUid, acknowledgement);
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
