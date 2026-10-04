import mqtt from "mqtt";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

// MQTT test device backed by the C++ sequence, not a second JS implementation.
const uid = process.env.DEVICE_UID || "E0F000000001";
const session = randomBytes(8).toString("hex").toUpperCase();
const processStart = Date.now();
const bridge = Bun.spawn([resolve(import.meta.dir, "../../../hardware/esp32-kolampintar/tests/demo-bridge.exe")], { stdin: "pipe", stdout: "pipe", stderr: "inherit" });
const reader = bridge.stdout.getReader();
let buffered = "";
let state: { applied: boolean; ph: number; solenoid: string; demoStep: string; demoPaused: boolean; demoRevision: number };
let chain = Promise.resolve();
async function execute(action: string) {
  bridge.stdin.write(`${action} ${Date.now() - processStart}\n`);
  bridge.stdin.flush();
  while (!buffered.includes("\n")) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error("C++ demo bridge exited");
    buffered += new TextDecoder().decode(chunk.value);
  }
  const lineEnd = buffered.indexOf("\n");
  state = JSON.parse(buffered.slice(0, lineEnd));
  buffered = buffered.slice(lineEnd + 1);
  return state.applied;
}
const client = mqtt.connect(process.env.MQTT_URL || "mqtt://localhost:1883", {
  will: { topic: `device/${uid}/status`, payload: Buffer.from("offline"), qos: 1, retain: true },
});
function telemetry() {
  if (state) client.publish(`device/${uid}/sensor`, JSON.stringify({ ...state, mode: "MANUAL", rssi: -42, dataSource: "SIMULATION", demoSession: session }), { qos: 1 });
}
const acknowledgements = new Map<string, string>();
client.on("connect", () => {
  client.subscribe(`device/${uid}/control`, { qos: 1 });
  client.publish(`device/${uid}/status`, "online", { retain: true, qos: 1 });
  chain = chain.then(async () => { await execute("TICK"); telemetry(); console.log(`C++ demo test device ${uid} connected`); });
});
client.on("message", (_topic, buffer) => {
  chain = chain.then(async () => {
    const command = JSON.parse(buffer.toString());
    if (acknowledgements.has(command.commandId)) {
      client.publish(`device/${uid}/ack`, acknowledgements.get(command.commandId)!, { retain: true, qos: 1 });
      return;
    }
    const closing = command.demoAction === "RESET" || command.demoAction === "STOP";
    const stale = !closing && (command.demoSession !== session || command.demoRevision !== state.demoRevision);
    const applied = !stale && await execute(command.demoAction || "INVALID");
    const acknowledgement = JSON.stringify(applied
      ? { commandId: command.commandId, status: "APPLIED", mode: "MANUAL", solenoid: state.solenoid, relayPinLevel: state.solenoid === "ON" ? 0 : 1 }
      : { commandId: command.commandId, status: "REJECTED", reason: stale ? "STALE_DEMO_STATE" : "INVALID_DEMO_TRANSITION" });
    acknowledgements.set(command.commandId, acknowledgement);
    client.publish(`device/${uid}/ack`, acknowledgement, { retain: true, qos: 1 });
    telemetry();
  }).catch(console.error);
});
const timer = setInterval(() => { chain = chain.then(async () => { await execute("TICK"); telemetry(); }).catch(console.error); }, 500);
async function stop() {
  clearInterval(timer);
  await chain;
  await execute("STOP"); telemetry();
  client.publish(`device/${uid}/status`, "offline", { retain: true, qos: 1 }, () => { client.end(); bridge.kill(); });
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
