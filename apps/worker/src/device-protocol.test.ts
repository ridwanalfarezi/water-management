import { describe, expect, test } from "bun:test";
import { normalizeDeviceUid, parseDeviceTopic } from "./device-protocol";

describe("device protocol", () => {
  test("normalizes a valid eFuse UID", () => {
    expect(normalizeDeviceUid("a1b2c3d4e5f6")).toBe("A1B2C3D4E5F6");
  });

  test("rejects malformed UIDs", () => {
    expect(normalizeDeviceUid("pond-1")).toBeNull();
    expect(normalizeDeviceUid("A1B2C3")).toBeNull();
  });

  test("parses sensor, status, and acknowledgement topics", () => {
    expect(parseDeviceTopic("device/a1b2c3d4e5f6/sensor")).toEqual({
      deviceUid: "A1B2C3D4E5F6",
      kind: "sensor",
    });
    expect(parseDeviceTopic("device/A1B2C3D4E5F6/status")).toEqual({
      deviceUid: "A1B2C3D4E5F6",
      kind: "status",
    });
    expect(parseDeviceTopic("device/A1B2C3D4E5F6/ack")).toEqual({
      deviceUid: "A1B2C3D4E5F6",
      kind: "ack",
    });
  });

  test("rejects legacy and command topics", () => {
    expect(parseDeviceTopic("pond/1/sensor")).toBeNull();
    expect(parseDeviceTopic("device/A1B2C3D4E5F6/control")).toBeNull();
  });
});
