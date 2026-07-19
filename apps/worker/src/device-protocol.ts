export type DeviceTopicKind = "sensor" | "status";

const DEVICE_TOPIC_PATTERN =
  /^device\/([0-9a-f]{12})\/(sensor|status)$/i;

export function normalizeDeviceUid(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^[0-9A-F]{12}$/.test(normalized) ? normalized : null;
}

export function parseDeviceTopic(
  topic: string,
): { deviceUid: string; kind: DeviceTopicKind } | null {
  const match = topic.match(DEVICE_TOPIC_PATTERN);
  if (!match) return null;

  const deviceUid = normalizeDeviceUid(match[1]);
  if (!deviceUid) return null;

  return {
    deviceUid,
    kind: match[2].toLowerCase() as DeviceTopicKind,
  };
}
