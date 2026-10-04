/*
   KOLAMPINTAR - Expo firmware: simulated pH, physical valve

   MQTT telemetry: device/{deviceUid}/sensor
   MQTT commands:  device/{deviceUid}/control
   MQTT presence:  device/{deviceUid}/status
   MQTT command ACK: device/{deviceUid}/ack

   Required Arduino libraries:
   - PubSubClient by Nick O'Leary
   - ArduinoJson by Benoit Blanchon
   - LiquidCrystal I2C by Frank de Brabander
*/

#include <ArduinoJson.h>
#include <ctype.h>
#include <LiquidCrystal_I2C.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <Wire.h>
#include <esp_timer.h>
#include "secrets.h"
#include "demo-sequence.h"

// ---------- Device configuration ----------
constexpr int RELAY_PIN = 26;
constexpr bool RELAY_ACTIVE_LOW = true;

constexpr unsigned long LCD_INTERVAL_MS = 1000;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 500;
constexpr unsigned long WIFI_RETRY_MS = 5000;
constexpr unsigned long MQTT_RETRY_MS = 10000;

enum ControlMode { AUTO_MODE, MANUAL_MODE };

LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

ControlMode controlMode = MANUAL_MODE;
DemoSequence demo;
char demoSession[17];
bool relayState = false;
float latestPH = 7.5F;
esp_timer_handle_t valveTimer;
unsigned long lastLcdAt = 0;
unsigned long lastTelemetryAt = 0;
unsigned long lastWifiAttemptAt = 0;
unsigned long lastMqttAttemptAt = 0;

char deviceUid[13];
char sensorTopic[40];
char controlTopic[40];
char statusTopic[40];
char ackTopic[40];
char lastCommandId[37] = "";
char lastAckPayload[320] = "";

void setRelay(bool on) {
  if (on == relayState) return;
  if (on) {
    // The independent ESP timer closes the GPIO even during a blocked MQTT call.
    if (esp_timer_start_once(valveTimer, DemoSequence::VALVE_MS * 1000ULL) != ESP_OK) {
      demo.command("STOP", millis());
      return;
    }
  } else if (valveTimer) {
    esp_timer_stop(valveTimer);
  }
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? (on ? LOW : HIGH)
                                           : (on ? HIGH : LOW));
  relayState = on;
}

void closeValve(void*) {
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
}

void updateDemo() {
  demo.tick(millis());
  latestPH = demo.ph;
  setRelay(demo.valve);
}

void publishTelemetry();

bool isValidCommandId(const char* commandId) {
  if (commandId == nullptr || strlen(commandId) != 36) return false;
  for (int i = 0; i < 36; i++) {
    const bool isHyphen = i == 8 || i == 13 || i == 18 || i == 23;
    if (isHyphen ? commandId[i] != '-' : !isxdigit(commandId[i])) return false;
  }
  return true;
}

void rememberAndPublishAck(const char* commandId,
                           const JsonDocument& document) {
  strncpy(lastCommandId, commandId, sizeof(lastCommandId) - 1);
  lastCommandId[sizeof(lastCommandId) - 1] = '\0';
  serializeJson(document, lastAckPayload, sizeof(lastAckPayload));
  if (mqttClient.connected()) {
    mqttClient.publish(ackTopic, lastAckPayload, true);
  }
  Serial.printf("ACK %s -> %s\n", ackTopic, lastAckPayload);
}

void publishLastAck() {
  if (mqttClient.connected() && lastAckPayload[0] != '\0') {
    mqttClient.publish(ackTopic, lastAckPayload, true);
  }
}

void publishAppliedAck(const char* commandId) {
  StaticJsonDocument<256> acknowledgement;
  acknowledgement["commandId"] = commandId;
  acknowledgement["status"] = "APPLIED";
  acknowledgement["mode"] = controlMode == AUTO_MODE ? "AUTO" : "MANUAL";
  acknowledgement["solenoid"] = relayState ? "ON" : "OFF";
  acknowledgement["relayPinLevel"] = digitalRead(RELAY_PIN) == HIGH ? 1 : 0;
  rememberAndPublishAck(commandId, acknowledgement);
}

void publishRejectedAck(const char* commandId, const char* reason) {
  StaticJsonDocument<192> acknowledgement;
  acknowledgement["commandId"] = commandId;
  acknowledgement["status"] = "REJECTED";
  acknowledgement["reason"] = reason;
  rememberAndPublishAck(commandId, acknowledgement);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<512> document;
  const DeserializationError error =
      deserializeJson(document, payload, length);
  if (error) {
    Serial.printf("Perintah MQTT tidak valid: %s\n", error.c_str());
    return;
  }

  const char* commandId = document["commandId"] | "";
  if (!isValidCommandId(commandId)) {
    Serial.println("Perintah ditolak: commandId tidak valid");
    return;
  }

  if (strcmp(commandId, lastCommandId) == 0) {
    Serial.printf("Duplikat commandId %s -> kirim ulang ACK\n", commandId);
    publishLastAck();
    return;
  }

  const char* action = document["demoAction"] | "";
  const bool closing = !strcmp(action, "RESET") || !strcmp(action, "STOP");
  const char* session = document["demoSession"] | "";
  if (!closing && (strcmp(session, demoSession) ||
      !document["demoRevision"].is<unsigned long>() ||
      document["demoRevision"].as<unsigned long>() != demo.revision)) {
    publishRejectedAck(commandId, "STALE_DEMO_STATE");
    return;
  }
  if (!demo.command(action, millis())) {
    publishRejectedAck(commandId, "INVALID_DEMO_TRANSITION");
    return;
  }
  updateDemo();
  publishAppliedAck(commandId);
  publishTelemetry();
}

void connectWifiIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiAttemptAt < WIFI_RETRY_MS) return;

  lastWifiAttemptAt = millis();
  Serial.printf("Menghubungkan WiFi ke %s...\n", WIFI_SSID);
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void connectMqttIfNeeded() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) return;
  if (millis() - lastMqttAttemptAt < MQTT_RETRY_MS) return;

  lastMqttAttemptAt = millis();
  char clientId[40];
  snprintf(clientId, sizeof(clientId), "kolampintar-%s", deviceUid);

  Serial.printf("Menghubungkan MQTT ke %s:%u...\n", MQTT_HOST, MQTT_PORT);
  if (mqttClient.connect(clientId, statusTopic, 1, true, "offline")) {
    mqttClient.subscribe(controlTopic, 1);
    mqttClient.publish(statusTopic, "online", true);
    publishLastAck();
    publishTelemetry();
    Serial.printf("MQTT terhubung, subscribe %s\n", controlTopic);
  } else {
    Serial.printf("MQTT gagal, rc=%d\n", mqttClient.state());
  }
}

void publishTelemetry() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<384> document;
  document["ph"] = roundf(latestPH * 100.0F) / 100.0F;
  document["solenoid"] = relayState ? "ON" : "OFF";
  document["mode"] = controlMode == AUTO_MODE ? "AUTO" : "MANUAL";
  document["rssi"] = WiFi.RSSI();
  document["dataSource"] = "SIMULATION";
  document["demoStep"] = demo.name();
  document["demoPaused"] = demo.paused;
  document["demoRevision"] = demo.revision;
  document["demoSession"] = demoSession;

  char message[384];
  serializeJson(document, message, sizeof(message));
  mqttClient.publish(sensorTopic, message, false);
  Serial.printf("Telemetri %s -> %s\n", sensorTopic, message);
}

void updateLcd() {
  lcd.setCursor(0, 0);
  lcd.print("pH: ");
  lcd.print(latestPH, 2);
  lcd.print("       ");

  lcd.setCursor(0, 1);
  lcd.print(relayState ? "Sol:ON " : "Sol:OFF");
  lcd.print(" DEMO ");
}

void setup() {
  Serial.begin(115200);
  snprintf(demoSession, sizeof(demoSession), "%08X%08X", esp_random(), esp_random());
  demo.randomState = esp_random() | 1U;
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  esp_timer_create_args_t timerArgs = {};
  timerArgs.callback = closeValve;
  timerArgs.name = "valve-off";
  if (esp_timer_create(&timerArgs, &valveTimer) != ESP_OK) {
    Serial.println("Valve timer unavailable: keep valve OFF");
    while (true) delay(1000);
  }

  lcd.init();
  lcd.backlight();
  lcd.print("KolamPintar");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");

  const uint64_t chipId = ESP.getEfuseMac();
  snprintf(deviceUid, sizeof(deviceUid), "%04X%08X",
           static_cast<uint16_t>(chipId >> 32),
           static_cast<uint32_t>(chipId));
  snprintf(sensorTopic, sizeof(sensorTopic), "device/%s/sensor", deviceUid);
  snprintf(controlTopic, sizeof(controlTopic), "device/%s/control", deviceUid);
  snprintf(statusTopic, sizeof(statusTopic), "device/%s/status", deviceUid);
  snprintf(ackTopic, sizeof(ackTopic), "device/%s/ack", deviceUid);
  Serial.printf("Device UID: %s\n", deviceUid);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);
  mqttClient.setSocketTimeout(2);

  // Allow the first connection attempts immediately.
  lastWifiAttemptAt = millis() - WIFI_RETRY_MS;
  lastMqttAttemptAt = millis() - MQTT_RETRY_MS;
  delay(1500);
  lcd.clear();
}

void loop() {
  // Avoid blocking reconnects while the physical valve is open.
  updateDemo();

  if (!relayState) {
    connectWifiIfNeeded();
    connectMqttIfNeeded();
  }
  mqttClient.loop();
  updateDemo();

  const unsigned long now = millis();
  if (now - lastLcdAt >= LCD_INTERVAL_MS) {
    lastLcdAt = now;
    updateLcd();
  }
  if (now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = now;
    publishTelemetry();
  }
}
