export type AckStatus = "APPLIED" | "REJECTED";

export type CommandStatus =
  | "LEGACY"
  | "PENDING"
  | "SENT"
  | "APPLIED"
  | "REJECTED"
  | "TIMED_OUT"
  | "APPLIED_LATE"
  | "REJECTED_LATE"
  | "PUBLISH_FAILED";

export type AppliedAck = {
  commandId: string;
  status: "APPLIED";
  mode: "AUTO" | "MANUAL";
  solenoid: "ON" | "OFF";
  relayPinLevel: 0 | 1;
};

export type RejectedAck = {
  commandId: string;
  status: "REJECTED";
  reason: string;
};

export type CommandAck = AppliedAck | RejectedAck;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCommandId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseCommandAck(value: unknown): CommandAck | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (!isCommandId(payload.commandId)) return null;

  if (payload.status === "APPLIED") {
    if (payload.mode !== "AUTO" && payload.mode !== "MANUAL") return null;
    if (payload.solenoid !== "ON" && payload.solenoid !== "OFF") return null;
    if (payload.relayPinLevel !== 0 && payload.relayPinLevel !== 1) return null;
    return {
      commandId: payload.commandId,
      status: "APPLIED",
      mode: payload.mode,
      solenoid: payload.solenoid,
      relayPinLevel: payload.relayPinLevel,
    };
  }

  if (payload.status === "REJECTED") {
    if (
      typeof payload.reason !== "string" ||
      payload.reason.trim().length === 0 ||
      payload.reason.length > 100
    ) {
      return null;
    }
    return {
      commandId: payload.commandId,
      status: "REJECTED",
      reason: payload.reason.trim(),
    };
  }

  return null;
}

export function resolveAckStatus(
  currentStatus: CommandStatus,
  ackStatus: AckStatus,
): CommandStatus {
  if (currentStatus === "TIMED_OUT" || currentStatus === "PUBLISH_FAILED") {
    return ackStatus === "APPLIED" ? "APPLIED_LATE" : "REJECTED_LATE";
  }
  return ackStatus;
}
