import { describe, expect, test } from "bun:test";
import {
  isCommandId,
  parseCommandAck,
  resolveAckStatus,
} from "./command-protocol";

const commandId = "123e4567-e89b-42d3-a456-426614174000";

describe("command acknowledgement protocol", () => {
  test("validates UUID command IDs", () => {
    expect(isCommandId(commandId)).toBe(true);
    expect(isCommandId("not-a-uuid")).toBe(false);
  });

  test("parses applied acknowledgements", () => {
    expect(
      parseCommandAck({
        commandId,
        status: "APPLIED",
        mode: "MANUAL",
        solenoid: "ON",
        relayPinLevel: 0,
      }),
    ).toEqual({
      commandId,
      status: "APPLIED",
      mode: "MANUAL",
      solenoid: "ON",
      relayPinLevel: 0,
    });
  });

  test("parses rejected acknowledgements", () => {
    expect(
      parseCommandAck({ commandId, status: "REJECTED", reason: "INVALID_PAYLOAD" }),
    ).toEqual({ commandId, status: "REJECTED", reason: "INVALID_PAYLOAD" });
  });

  test("rejects incomplete or malformed acknowledgements", () => {
    expect(parseCommandAck({ commandId, status: "APPLIED", mode: "AUTO" })).toBeNull();
    expect(parseCommandAck({ commandId, status: "REJECTED", reason: "" })).toBeNull();
    expect(parseCommandAck({ commandId: "bad", status: "REJECTED", reason: "x" })).toBeNull();
  });

  test("marks acknowledgements after timeout or publish failure as late", () => {
    expect(resolveAckStatus("TIMED_OUT", "APPLIED")).toBe("APPLIED_LATE");
    expect(resolveAckStatus("PUBLISH_FAILED", "REJECTED")).toBe("REJECTED_LATE");
    expect(resolveAckStatus("SENT", "APPLIED")).toBe("APPLIED");
  });
});
