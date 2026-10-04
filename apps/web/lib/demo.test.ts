import { expect, test } from "bun:test";
import { parseDemoCommand } from "./demo";
test("story commands require firmware session and revision", () => {
  expect(parseDemoCommand({ demoAction: "NEXT" })).toBeNull();
  expect(parseDemoCommand({ demoAction: "NEXT", demoSession: "0123456789ABCDEF", demoRevision: 2 })).toEqual({ demoAction: "NEXT", demoSession: "0123456789ABCDEF", demoRevision: 2 });
  expect(parseDemoCommand({ demoAction: "NEXT", demoSession: "0123456789ABCDEF", demoRevision: -1 })).toBeNull();
  expect(parseDemoCommand({ solenoid: "ON", mode: "MANUAL" })).toBeNull();
});
test("closing commands work even if the displayed session is stale", () => {
  expect(parseDemoCommand({ demoAction: "STOP" })).toEqual({ demoAction: "STOP" });
  expect(parseDemoCommand({ demoAction: "RESET" })).toEqual({ demoAction: "RESET" });
});
