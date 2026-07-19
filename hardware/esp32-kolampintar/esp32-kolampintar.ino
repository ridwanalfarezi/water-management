/*
   KOLAMPINTAR - ESP32 pH monitor and acid solenoid controller

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
#include "secrets.h"

// ---------- Device configuration ----------
constexpr int PH_PIN = 34;
constexpr int RELAY_PIN = 26;
constexpr bool RELAY_ACTIVE_LOW = true;

// Acid dosing hysteresis: open above 7.5, close below 7.3.
constexpr float PH_MAX_ON = 7.5F;
constexpr float PH_MAX_OFF = 7.3F;

// Replace these values with your two-point calibration results.
constexpr float PH_7_VOLTAGE = 2.4F;
constexpr float PH_4_VOLTAGE = 2.9F;

constexpr unsigned long LCD_INTERVAL_MS = 1000;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 5000;
constexpr unsigned long WIFI_RETRY_MS = 5000;
constexpr unsigned long MQTT_RETRY_MS = 10000;

// Safety: a manual ON command returns to AUTO after one minute.
constexpr unsigned long MANUAL_ON_TIMEOUT_MS = 60000;

enum ControlMode { AUTO_MODE, MANUAL_MODE };

LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

ControlMode controlMode = AUTO_MODE;
bool relayState = false;
float latestPH = 7.0F;
unsigned long manualOnStartedAt = 0;
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
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? (on ? LOW : HIGH)
                                           : (on ? HIGH : LOW));
  relayState = on;
  if (!on) manualOnStartedAt = 0;
}

float readPH() {
  const int raw = analogRead(PH_PIN);
  const float voltage = raw * (3.3F / 4095.0F);
  float ph = 7.0F +
             ((voltage - PH_7_VOLTAGE) /
              (PH_7_VOLTAGE - PH_4_VOLTAGE) * 3.0F);
  return constrain(ph, 0.0F, 14.0F);
}

float readAveragePH(int samples = 10) {
  float total = 0.0F;
  for (int i = 0; i < samples; i++) {
    total += readPH();
    delay(30);
  }
  return total / samples;
}

void applyAutomaticControl() {
  if (controlMode != AUTO_MODE) return;

  if (latestPH > PH_MAX_ON && !relayState) {
    setRelay(true);
    Serial.println("pH tinggi -> solenoid ON");
  } else if (latestPH < PH_MAX_OFF && relayState) {
    setRelay(false);
    Serial.println("pH normal -> solenoid OFF");
  }
}

void applyManualSafetyTimeout() {
  if (controlMode == MANUAL_MODE && relayState && manualOnStartedAt != 0 &&
      millis() - manualOnStartedAt >= MANUAL_ON_TIMEOUT_MS) {
    Serial.println("Manual ON timeout -> kembali ke AUTO");
    setRelay(false);
    controlMode = AUTO_MODE;
    applyAutomaticControl();
  }
}

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
  StaticJsonDocument<256> document;
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

  const char* mode = document["mode"] | "";
  if (strcmp(mode, "AUTO") == 0) {
    controlMode = AUTO_MODE;
    setRelay(false);
    applyAutomaticControl();
    Serial.println("Mode -> AUTO");
    publishAppliedAck(commandId);
    return;
  }

  const char* solenoid = document["solenoid"] | "";
  if (strcmp(mode, "MANUAL") == 0 && strcmp(solenoid, "ON") == 0) {
    controlMode = MANUAL_MODE;
    setRelay(true);
    manualOnStartedAt = millis();
    Serial.println("Mode -> MANUAL, solenoid ON");
    publishAppliedAck(commandId);
  } else if (strcmp(mode, "MANUAL") == 0 && strcmp(solenoid, "OFF") == 0) {
    controlMode = MANUAL_MODE;
    setRelay(false);
    Serial.println("Mode -> MANUAL, solenoid OFF");
    publishAppliedAck(commandId);
  } else {
    Serial.println("Perintah ditolak: payload mode/solenoid tidak valid");
    publishRejectedAck(commandId, "INVALID_PAYLOAD");
  }
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
    Serial.printf("MQTT terhubung, subscribe %s\n", controlTopic);
  } else {
    Serial.printf("MQTT gagal, rc=%d\n", mqttClient.state());
  }
}

void publishTelemetry() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<192> document;
  document["ph"] = roundf(latestPH * 100.0F) / 100.0F;
  document["solenoid"] = relayState ? "ON" : "OFF";
  document["mode"] = controlMode == AUTO_MODE ? "AUTO" : "MANUAL";
  document["rssi"] = WiFi.RSSI();

  char message[192];
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
  lcd.print(controlMode == AUTO_MODE ? " AUTO " : " MAN  ");
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  setRelay(false);  // Fail safe: acid flow is OFF during boot.

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
  // Local control is always evaluated before any network reconnect attempt.
  latestPH = readAveragePH();
  applyAutomaticControl();
  applyManualSafetyTimeout();

  connectWifiIfNeeded();
  connectMqttIfNeeded();
  mqttClient.loop();

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
