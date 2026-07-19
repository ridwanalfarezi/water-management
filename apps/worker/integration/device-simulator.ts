import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const DEVICE_UID = process.env.DEVICE_UID || "BADDCAFE0001";
const ACK_MODE = process.env.ACK_MODE || "apply";
const ACK_DELAY_MS = Number(process.env.ACK_DELAY_MS || 800);

const client = mqtt.connect(MQTT_URL);
const sensorPayload = JSON.stringify({
  ph: 7,
  mode: "AUTO",
  solenoid: "OFF",
  rssi: -42,
});

function publishTelemetry() {
  client.publish(`device/${DEVICE_UID}/sensor`, sensorPayload, { qos: 1 });
}

client.on("connect", () => {
  client.subscribe(`device/${DEVICE_UID}/control`, { qos: 1 });
  client.publish(`device/${DEVICE_UID}/status`, "online", {
    qos: 1,
    retain: true,
  });
  publishTelemetry();
  console.log(`Simulator ${DEVICE_UID} online (${ACK_MODE})`);
});

client.on("message", (_topic, buffer) => {
  const command = JSON.parse(buffer.toString()) as {
    commandId?: string;
    mode?: "AUTO" | "MANUAL";
    solenoid?: "ON" | "OFF";
  };
  if (!command.commandId || ACK_MODE === "ignore") return;

  setTimeout(() => {
    const acknowledgement =
      ACK_MODE === "reject"
        ? {
            commandId: command.commandId,
            status: "REJECTED",
            reason: "SIMULATED_REJECTION",
          }
        : {
            commandId: command.commandId,
            status: "APPLIED",
            mode: command.mode,
            solenoid: command.mode === "AUTO" ? "OFF" : command.solenoid,
            relayPinLevel:
              command.mode === "MANUAL" && command.solenoid === "ON" ? 0 : 1,
          };
    client.publish(
      `device/${DEVICE_UID}/ack`,
      JSON.stringify(acknowledgement),
      { qos: 1, retain: true },
    );
  }, ACK_DELAY_MS);
});

setInterval(publishTelemetry, 5_000);
