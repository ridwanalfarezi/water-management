import mqtt, { type MqttClient } from "mqtt";
import pg from "pg";
import { randomUUID } from "node:crypto";

const { Pool } = pg;

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://user:password@localhost:5432/waterdb";
const API_URL = process.env.API_URL || "http://localhost:3000";
const DEVICE_UID = "ACCE55000001";
const WRONG_DEVICE_UID = "ACCE55000002";
const DEMO_SESSION = "0123456789ABCDEF";

type AckBehavior = "apply" | "ignore" | "wrong-device";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitFor<T>(
  operation: () => Promise<T | null>,
  timeoutMs = 10_000,
  intervalMs = 100,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await operation();
    if (result !== null) return result;
    await Bun.sleep(intervalMs);
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

function connectMqtt(): Promise<MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_URL, {
      reconnectPeriod: 0,
      connectTimeout: 5_000,
    });
    client.once("connect", () => resolve(client));
    client.once("error", reject);
  });
}

function publish(
  client: MqttClient,
  topic: string,
  payload: string,
  retain = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1, retain }, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

async function postControl(body: Record<string, unknown>) {
  const response = await fetch(`${API_URL}/api/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ demoSession: DEMO_SESSION, demoRevision: 0, ...body }),
  });
  return { response, json: await response.json() };
}

async function getCommand(commandId: string) {
  const response = await fetch(`${API_URL}/api/control/${commandId}`, {
    cache: "no-store",
  });
  const json = await response.json();
  assert(response.ok && json.success, `GET command failed: ${JSON.stringify(json)}`);
  return json.data as {
    status: string;
    applied: { mode: string; solenoid: string; relayPinLevel: number } | null;
  };
}

async function main() {
  const database = new Pool({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 5_000,
  });
  const mqttClient = await connectMqtt();
  let pondId: number | null = null;
  let behavior: AckBehavior = "apply";
  const acknowledgements = new Map<string, string>();

  const cleanup = async () => {
    await publish(mqttClient, `device/${DEVICE_UID}/status`, "", true).catch(() => {});
    await publish(mqttClient, `device/${DEVICE_UID}/ack`, "", true).catch(() => {});
    await publish(mqttClient, `device/${WRONG_DEVICE_UID}/ack`, "", true).catch(() => {});
    const device = await database.query<{ id: number }>(
      `SELECT id FROM devices WHERE device_uid = $1`,
      [DEVICE_UID],
    );
    if (device.rows[0]) {
      const id = device.rows[0].id;
      await database.query(`DELETE FROM control_log WHERE device_id = $1`, [id]);
      await database.query(`DELETE FROM pond_journal WHERE device_id = $1`, [id]);
      await database.query(`DELETE FROM sensor_data WHERE device_id = $1`, [id]);
      await database.query(`DELETE FROM devices WHERE id = $1`, [id]);
    }
  };

  try {
    await cleanup();
    await new Promise<void>((resolve, reject) => {
      mqttClient.subscribe(`device/${DEVICE_UID}/control`, { qos: 1 }, (error) =>
        error ? reject(error) : resolve(),
      );
    });

    mqttClient.on("message", (topic, buffer) => {
      if (topic !== `device/${DEVICE_UID}/control`) return;
      void (async () => {
        const command = JSON.parse(buffer.toString()) as {
          commandId?: string;
          demoAction?: string;
        };
        if (!command.commandId) return;
        const previous = acknowledgements.get(command.commandId);
        if (previous) {
          await publish(mqttClient, `device/${DEVICE_UID}/ack`, previous, true);
          return;
        }
        if (behavior === "ignore") return;

        const mode = "MANUAL";
        const solenoid = command.demoAction === "NEXT" ? "ON" : "OFF";
        const acknowledgement = JSON.stringify({
          commandId: command.commandId,
          status: "APPLIED",
          mode,
          solenoid,
          relayPinLevel: solenoid === "ON" ? 0 : 1,
        });
        acknowledgements.set(command.commandId, acknowledgement);
        const uid = behavior === "wrong-device" ? WRONG_DEVICE_UID : DEVICE_UID;
        await publish(mqttClient, `device/${uid}/ack`, acknowledgement, true);
      })().catch((error) => console.error("Simulator error:", error));
    });

    await publish(mqttClient, `device/${DEVICE_UID}/status`, "online", true);
    await publish(
      mqttClient,
      `device/${DEVICE_UID}/sensor`,
      JSON.stringify({ ph: 7, mode: "MANUAL", solenoid: "OFF", rssi: -40,
        dataSource: "SIMULATION", demoStep: "NORMAL", demoPaused: false,
        demoRevision: 0, demoSession: DEMO_SESSION }),
    );
    pondId = await waitFor(async () => {
      const result = await database.query<{ id: number }>(
        `SELECT id FROM devices WHERE device_uid = $1`,
        [DEVICE_UID],
      );
      return result.rows[0]?.id ?? null;
    });

    behavior = "apply";
    const appliedPost = await postControl({ pondId, demoAction: "NEXT" });
    assert(appliedPost.response.status === 202, "valid command must return 202");
    const applied = await waitFor(async () => {
      const state = await getCommand(appliedPost.json.commandId);
      return state.status === "APPLIED" ? state : null;
    });
    assert(applied.applied?.solenoid === "ON", "applied solenoid must be ON");
    assert(applied.applied?.relayPinLevel === 0, "active-low ON must report GPIO 0");
    const duplicateAck = acknowledgements.get(appliedPost.json.commandId);
    assert(duplicateAck, "simulator must retain the ACK");
    await publish(mqttClient, `device/${DEVICE_UID}/ack`, duplicateAck, true);
    assert((await getCommand(appliedPost.json.commandId)).status === "APPLIED", "duplicate ACK changed final status");
    console.log("PASS applied and duplicate ACK");

    behavior = "wrong-device";
    const wrongUidPost = await postControl({ pondId, demoAction: "PAUSE" });
    assert(wrongUidPost.response.status === 202, "wrong-UID test command must return 202");
    await Bun.sleep(750);
    assert((await getCommand(wrongUidPost.json.commandId)).status === "SENT", "wrong UID ACK was accepted");
    const correctAck = acknowledgements.get(wrongUidPost.json.commandId);
    assert(correctAck, "wrong-UID ACK payload missing");
    await publish(mqttClient, `device/${DEVICE_UID}/ack`, correctAck, true);
    await waitFor(async () =>
      (await getCommand(wrongUidPost.json.commandId)).status === "APPLIED" ? true : null,
    );
    await publish(
      mqttClient,
      `device/${DEVICE_UID}/ack`,
      JSON.stringify({
        commandId: randomUUID(),
        status: "REJECTED",
        reason: "UNKNOWN_TEST",
      }),
      true,
    );
    console.log("PASS wrong UID and unknown ACK ignored");

    behavior = "ignore";
    const timeoutPost = await postControl({ pondId, demoAction: "START" });
    assert(timeoutPost.response.status === 202, "timeout test command must return 202");
    await waitFor(async () =>
      (await getCommand(timeoutPost.json.commandId)).status === "TIMED_OUT" ? true : null,
      8_000,
    );
    const lateAck = JSON.stringify({
      commandId: timeoutPost.json.commandId,
      status: "APPLIED",
      mode: "MANUAL",
      solenoid: "OFF",
      relayPinLevel: 1,
    });
    await publish(mqttClient, `device/${DEVICE_UID}/ack`, lateAck, true);
    await waitFor(async () =>
      (await getCommand(timeoutPost.json.commandId)).status === "APPLIED_LATE" ? true : null,
    );
    console.log("PASS timeout and late ACK");

    behavior = "ignore";
    const concurrent = await Promise.all([
      postControl({ pondId, demoAction: "NEXT" }),
      postControl({ pondId, demoAction: "PAUSE" }),
    ]);
    const statuses = concurrent.map(({ response }) => response.status).sort();
    assert(statuses[0] === 202 && statuses[1] === 409, `expected 202/409, got ${statuses}`);
    const active = concurrent.find(({ response }) => response.status === 202);
    assert(active, "no active concurrent command");
    await waitFor(async () =>
      (await getCommand(active.json.commandId)).status === "TIMED_OUT" ? true : null,
      8_000,
    );
    console.log("PASS concurrent command conflict");

    await publish(mqttClient, `device/${DEVICE_UID}/status`, "offline", true);
    await waitFor(async () => {
      const result = await database.query<{ connection_state: string }>(
        `SELECT connection_state FROM devices WHERE id = $1`,
        [pondId],
      );
      return result.rows[0]?.connection_state === "offline" ? true : null;
    });
    const offline = await postControl({ pondId, demoAction: "START" });
    assert(offline.response.status === 409, "offline device must return 409");
    console.log("PASS offline command rejected");
  } finally {
    try { await cleanup(); } finally {
      await database.end();
      mqttClient.end(true);
    }
  }
}

main()
  .then(() => console.log("All command acknowledgement integration checks passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
