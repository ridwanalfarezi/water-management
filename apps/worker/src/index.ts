import mqtt from "mqtt";
import pg from "pg";

const { Pool } = pg;

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://user:password@localhost:5432/waterdb";

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
): Promise<void> {
  const query = `
    INSERT INTO sensor_data (pond_id, temperature, do_level, created_at)
    VALUES ($1, $2, $3, NOW())
  `;
  await pool.query(query, [pondId, temperature, doLevel]);
  console.log(
    `[Worker] Saved: pond=${pondId} temp=${temperature} do=${doLevel}`,
  );
}

// Save control log
async function saveControlLog(
  pondId: number,
  aerator: string,
  source: string = "system",
): Promise<void> {
  const query = `
    INSERT INTO control_log (pond_id, aerator, source, created_at)
    VALUES ($1, $2, $3, NOW())
  `;
  await pool.query(query, [pondId, aerator, source]);
}

async function main(): Promise<void> {
  // Wait for database to be ready
  await waitForDatabase();

  console.log(`[Worker] Connecting to MQTT at ${MQTT_URL}...`);

  const client = mqtt.connect(MQTT_URL, {
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  });

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
      const { temperature, do: doLevel } = payload;

      if (typeof temperature !== "number" || typeof doLevel !== "number") {
        console.error("[Worker] Invalid payload:", payload);
        return;
      }

      // Save to database
      await saveSensorData(pondId, temperature, doLevel);

      // Automation: if DO < 3, turn on aerator
      if (doLevel < 3) {
        const controlTopic = `pond/${pondId}/control`;
        const controlPayload = JSON.stringify({ aerator: "ON" });

        client.publish(controlTopic, controlPayload, { qos: 1 }, (err) => {
          if (err) {
            console.error("[Worker] Control publish error:", err);
          } else {
            console.log(
              `[Worker] ⚠️  LOW DO (${doLevel}) - Aerator ON for pond ${pondId}`,
            );
          }
        });

        await saveControlLog(pondId, "ON", "system");
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
