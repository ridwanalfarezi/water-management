const base = process.env.API_URL || "http://localhost:3000";
const uid = process.env.DEVICE_UID || "E0F000000001";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function device() {
  const result = await (await fetch(`${base}/api/ponds`)).json();
  const found = result.data?.find((item: any) => item.device_uid === uid);
  assert(found, "Start simulate:expo before this test");
  return found;
}
async function until(step: string, valve?: string, phBelow?: number) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const current = await device();
    if (current.demo_step === step && (!valve || current.solenoid_state === valve) && (phBelow === undefined || current.ph_level < phBelow)) return current;
    await Bun.sleep(100);
  }
  throw new Error(`Did not reach ${step}/${valve}`);
}
async function command(action: string, overrides = {}, expected = "APPLIED") {
  const current = await device();
  const response = await fetch(`${base}/api/control`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pondId: current.pond_id, demoAction: action, demoSession: current.demo_session, demoRevision: Number(current.demo_revision), ...overrides }) });
  const result = await response.json();
  assert(response.status === 202, `${action}: ${JSON.stringify(result)}`);
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const ack = await (await fetch(`${base}/api/control/${result.commandId}`)).json();
    if (ack.data.status === expected) return ack.data;
    assert(!["REJECTED", "TIMED_OUT", "PUBLISH_FAILED"].includes(ack.data.status), `Unexpected ACK ${ack.data.status}`);
    await Bun.sleep(100);
  }
  throw new Error(`No ${expected} ACK for ${action}`);
}
const rounds = Number(process.env.EXPO_ROUNDS || 10);
assert(Number.isInteger(rounds) && rounds > 0 && rounds <= 100, "Invalid EXPO_ROUNDS");
await command("RESET"); await until("NORMAL", "OFF");
const liveSamples = new Set<string>();
for (let sample = 0; sample < 10; sample++) {
  const current = await device();
  assert(current.ph_level >= 7.2 && current.ph_level <= 7.8, "Normal simulated pH exceeded 7.2–7.8");
  assert(current.water_status === "normal", "Normal pH must not produce a high-pH warning");
  liveSamples.add(Number(current.ph_level).toFixed(2));
  await Bun.sleep(500);
}
assert(liveSamples.size >= 3, "Live pH samples must change over MQTT");
console.log(`PASS live pH telemetry (${liveSamples.size} distinct displayed readings)`);
for (let round = 0; round < rounds; round++) {
  await command("RESET"); await until("NORMAL", "OFF");
  await command("START"); await until("FOOD", "OFF");
  await command("NEXT"); await until("DANGER", "OFF", 6.5);
  await command("NEXT"); await until("ACTIVE", "ON");
  await until("RECOVERY", "OFF");
  const restored = await until("RESTORED", "OFF"); assert(restored.ph_level >= 7.2 && restored.ph_level <= 7.8, "Recovery must return to 7.2–7.8");
  await command("NEXT"); await until("READY", "OFF");
  console.log(`PASS demo round ${round + 1}/${rounds}`);
}
await command("RESET"); await until("NORMAL", "OFF");
await command("START", { demoRevision: 999999 }, "REJECTED");
assert((await device()).demo_step === "NORMAL", "Stale command changed device");
console.log("PASS stale command rejected without opening valve");
for (const action of ["PAUSE", "STOP", "RESET"]) {
  await command("RESET"); await until("NORMAL", "OFF");
  await command("START"); await until("FOOD", "OFF");
  await command("NEXT"); await until("DANGER", "OFF");
  await command("NEXT"); await until("ACTIVE", "ON");
  await command(action);
  await until(action === "PAUSE" ? "RECOVERY" : action === "STOP" ? "STOPPED" : "NORMAL", "OFF");
  if (action === "PAUSE") {
    await Bun.sleep(4500);
    assert((await device()).demo_paused, "Pause must persist");
    await command("RESUME"); await until("RESTORED", "OFF");
  }
  console.log(`PASS ${action} closes active valve`);
}
await command("RESET"); await until("NORMAL", "OFF");
console.log("Expo flow integration passed (C++ sequence over MQTT, no physical valve).");
