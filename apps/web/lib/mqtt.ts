import mqtt, { MqttClient } from "mqtt";

let client: MqttClient | null = null;

function newClientId(): string {
  return `kolampintar-web-${Math.random().toString(16).slice(2, 10)}`;
}

export function getMqttClient(): MqttClient {
  // Reuse the client while it is connected OR still establishing its first
  // connection. Without the second condition, concurrent API calls during
  // startup would each dial a new connection (a connection storm), and any
  // reused/shared ID would make the broker kick the previous session off.
  if (client && !client.disconnected) {
    return client;
  }

  const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
  client = mqtt.connect(MQTT_URL, {
    clientId: newClientId(),
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  });

  client.on("connect", () => {
    console.log("[Web] Connected to MQTT broker");
  });

  client.on("error", (err) => {
    console.error("[Web] MQTT error:", err);
  });

  return client;
}
