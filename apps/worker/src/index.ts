import mqtt from "mqtt";
import pg from "pg";

const { Pool } = pg;

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://user:password@localhost:5432/waterdb";
const PH_LIME_THRESHOLD = 6.5;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test DB connection with retry
async function waitForDatabase(retries = 10, delay = 3000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log("[Worker] Connected to PostgreSQL");
      client.release();
      return;
    } catch (err) {
      console.log(
        `[Worker] Waiting for PostgreSQL... attempt ${i + 1}/${retries}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("[Worker] Could not connect to PostgreSQL after retries");
}

// Save sensor data to database
async function saveSensorData(
  pondId: number,
  temperature: number,
  doLevel: number,
  phLevel: number | null,
): Promise<void> {
  const query = `
    INSERT INTO sensor_data (pond_id, temperature, do_level, ph_level, created_at)
    VALUES ($1, $2, $3, $4, NOW())
  `;
  await pool.query(query, [pondId, temperature, doLevel, phLevel]);
  console.log(
    `[Worker] Saved: pond=${pondId} temp=${temperature} do=${doLevel} ph=${phLevel}`,
  );
}

// Save control log
async function saveControlLog(
  pondId: number,
  action: string,
  source: string = "system",
): Promise<void> {
  const query = `
    INSERT INTO control_log (pond_id, action, source, created_at)
    VALUES ($1, $2, $3, NOW())
  `;

  try {
    await pool.query(query, [pondId, action, source]);
  } catch (err: unknown) {
    // Backward compatibility for existing DBs that still use `aerator` column.
    const pgErr = err as { code?: string };
    if (pgErr?.code === "42703") {
      await pool.query(
        `INSERT INTO control_log (pond_id, aerator, source, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [pondId, action, source],
      );
      return;
    }
    throw err;
  }
}

async function main(): Promise<void> {
  // Wait for database to be ready
  await waitForDatabase();

  console.log(`[Worker] Connecting to MQTT at ${MQTT_URL}...`);

  const client = mqtt.connect(MQTT_URL, {
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  });
  const limeStateByPond = new Map<number, "ON" | "OFF">();

  client.on("connect", () => {
    console.log("[Worker] Connected to MQTT broker");

    // Subscribe to all pond sensor topics
    client.subscribe("pond/+/sensor", { qos: 1 }, (err) => {
      if (err) {
        console.error("[Worker] Subscribe error:", err);
      } else {
        console.log("[Worker] Subscribed to pond/+/sensor");
      }
    });
  });

  client.on("message", async (topic: string, message: Buffer) => {
    try {
      // Parse topic: pond/{pondId}/sensor
      const parts = topic.split("/");
      const pondId = parseInt(parts[1], 10);

      if (isNaN(pondId)) {
        console.error(`[Worker] Invalid pondId in topic: ${topic}`);
        return;
      }

      const payload = JSON.parse(message.toString());
      const { temperature, do: doLevel, ph: phLevel } = payload;

      if (typeof temperature !== "number" || typeof doLevel !== "number") {
        console.error("[Worker] Invalid payload:", payload);
        return;
      }

      // Save to database (ph may be null for backward compatibility)
      await saveSensorData(pondId, temperature, doLevel, phLevel ?? null);

      // Closed-loop pH control: lime ON below threshold, OFF when recovered.
      if (typeof phLevel === "number") {
        const currentLimeState = limeStateByPond.get(pondId) ?? "OFF";
        const nextLimeState: "ON" | "OFF" =
          phLevel < PH_LIME_THRESHOLD ? "ON" : "OFF";

        if (currentLimeState !== nextLimeState) {
          const controlTopic = `pond/${pondId}/control`;
          const controlPayload = JSON.stringify({ lime: nextLimeState });

          client.publish(controlTopic, controlPayload, { qos: 1 }, (err) => {
            if (err) {
              console.error("[Worker] Lime publish error:", err);
            } else {
              console.log(
                `[Worker] pH ${phLevel.toFixed(2)} -> Lime ${nextLimeState} for pond ${pondId}`,
              );
            }
          });

          await saveControlLog(pondId, `LIME_${nextLimeState}`, "system");
          limeStateByPond.set(pondId, nextLimeState);
        }
      }
    } catch (err) {
      console.error("[Worker] Error processing message:", err);
    }
  });

  client.on("error", (err) => {
    console.error("[Worker] MQTT error:", err);
  });

  client.on("reconnect", () => {
    console.log("[Worker] Reconnecting to MQTT...");
  });
}

main().catch(console.error);
