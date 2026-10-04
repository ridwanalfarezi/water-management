import { expect, test } from "bun:test";
import { parseDemoTelemetry } from "./demo-protocol";
const valid = { dataSource: "SIMULATION", demoStep: "NORMAL", demoPaused: false, demoRevision: 0, demoSession: "0123456789ABCDEF" };
test("accept firmware telemetry and reject incomplete or malformed simulation", () => {
  expect(parseDemoTelemetry(valid)?.demoStep).toBe("NORMAL");
  for (const invalid of [{ demoStep: "UNKNOWN" }, { demoPaused: "false" }, { demoRevision: -1 }, { demoRevision: 0x100000000 }, { demoSession: "bad" }, { dataSource: "SENSOR" }]) {
    expect(parseDemoTelemetry({ ...valid, ...invalid })).toBeNull();
  }
  expect(parseDemoTelemetry({ ph: 7 })).toBeNull();
});
