import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const POND_ID = process.env.POND_ID || "1";
const INTERVAL_MS = 5000;

console.log(`[Simulator] Connecting to MQTT at ${MQTT_URL}...`);

const client = mqtt.connect(MQTT_URL, {
  reconnectPeriod: 3000,
  connectTimeout: 10000,
});

client.on("connect", () => {
  console.log(`[Simulator] Connected to MQTT broker`);
  console.log(
    `[Simulator] Publishing to pond/${POND_ID}/sensor every ${INTERVAL_MS / 1000}s`,
  );

  // Subscribe to control topic to log aerator commands
  client.subscribe(`pond/${POND_ID}/control`, (err) => {
    if (!err) {
      console.log(`[Simulator] Subscribed to pond/${POND_ID}/control`);
    }
  });

  setInterval(() => {
    // Temperature: 25-32°C
    const temperature = parseFloat((25 + Math.random() * 7).toFixed(2));

    // DO: mostly 3-8 mg/L, but ~20% chance of dropping below 3
    let doLevel: number;
    if (Math.random() < 0.2) {
      // Low DO scenario (1.0 - 2.9)
      doLevel = parseFloat((1 + Math.random() * 1.9).toFixed(2));
    } else {
      // Normal DO (3.0 - 8.0)
      doLevel = parseFloat((3 + Math.random() * 5).toFixed(2));
    }

    // pH: mostly 6.5-8.5, ~15% chance of dropping to 6.0-6.5
    let phLevel: number;
    if (Math.random() < 0.15) {
      // Low pH scenario (6.0 - 6.5)
      phLevel = parseFloat((6.0 + Math.random() * 0.5).toFixed(2));
    } else {
      // Normal pH (6.5 - 8.5)
      phLevel = parseFloat((6.5 + Math.random() * 2.0).toFixed(2));
    }

    const payload = JSON.stringify({
      temperature,
      do: doLevel,
      ph: phLevel,
    });

    const topic = `pond/${POND_ID}/sensor`;
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[Simulator] Publish error:`, err);
      } else {
        console.log(`[Simulator] Published to ${topic}: ${payload}`);
      }
    });
  }, INTERVAL_MS);
});

client.on("message", (topic, message) => {
  console.log(
    `[Simulator] Received control command on ${topic}: ${message.toString()}`,
  );
});

client.on("error", (err) => {
  console.error(`[Simulator] MQTT error:`, err);
});

client.on("reconnect", () => {
  console.log(`[Simulator] Reconnecting to MQTT...`);
});
