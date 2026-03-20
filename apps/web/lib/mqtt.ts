import mqtt, { MqttClient } from "mqtt";

let client: MqttClient | null = null;

export function getMqttClient(): MqttClient {
  if (!client || !client.connected) {
    const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
    client = mqtt.connect(MQTT_URL, {
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    });

    client.on("connect", () => {
      console.log("[Web] Connected to MQTT broker");
    });

    client.on("error", (err) => {
      console.error("[Web] MQTT error:", err);
    });
  }

  return client;
}
