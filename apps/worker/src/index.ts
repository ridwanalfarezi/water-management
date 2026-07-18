import mqtt from "mqtt";
import pg from "pg";

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
    ALTER TABLE sensor_data ALTER COLUMN temperature DROP NOT NULL;
    ALTER TABLE sensor_data ALTER COLUMN do_level DROP NOT NULL;
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS solenoid_state VARCHAR(3);
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS control_mode VARCHAR(10);
    ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS rssi INTEGER;
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

async function saveSensorData(
  pondId: number,
  payload: SensorPayload,
): Promise<void> {
  await pool.query(
    `INSERT INTO sensor_data
       (pond_id, temperature, do_level, ph_level, solenoid_state, control_mode, rssi, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
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

  console.log(
    `[Worker] Saved pond=${pondId} ph=${payload.ph.toFixed(2)} solenoid=${payload.solenoid ?? "unknown"} mode=${payload.mode ?? "unknown"}`,
  );
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
    client.subscribe("pond/+/sensor", { qos: 1 }, (err) => {
      if (err) console.error("[Worker] Subscribe error:", err);
      else console.log("[Worker] Subscribed to pond/+/sensor");
    });
  });

  client.on("message", async (topic: string, message: Buffer) => {
    try {
      const match = topic.match(/^pond\/(\d+)\/sensor$/);
      if (!match) return;

      const pondId = Number.parseInt(match[1], 10);
      if (pondId <= 0) return;
      const payload = parseSensorPayload(JSON.parse(message.toString()));
      if (!payload) {
        console.error(`[Worker] Invalid sensor payload on ${topic}`);
        return;
      }

      await saveSensorData(pondId, payload);
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
