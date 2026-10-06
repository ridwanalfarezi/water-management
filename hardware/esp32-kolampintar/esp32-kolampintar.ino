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

#include <ctype.h>

#include <stdint.h>
#include <string.h>
#include <math.h>

// Expo-only sequence. No sensor input or chemical dosing control.
struct DemoSequence {
  enum Step { NORMAL, FOOD, DANGER, ACTIVE, RECOVERY, RESTORED, READY, STOPPED };
  Step step = NORMAL;
  bool paused = false;
  bool valve = false;
  float ph = 7.5f;
  uint32_t revision = 0;
  uint32_t enteredAt = 0;
  uint32_t pausedAt = 0;
  uint32_t sampledAt = 0;
  uint32_t randomState = 0x6d2b79f5;
  float drift = 0, noise = 0, ambient = 0, trend = 7.5f, startPH = 7.5f;
  static constexpr uint32_t VALVE_MS = 3000;
  static constexpr uint32_t RECOVERY_MS = 4000;

  const char* name() const {
    const char* names[] = {"NORMAL", "FOOD", "DANGER", "ACTIVE", "RECOVERY", "RESTORED", "READY", "STOPPED"};
    return names[step];
  }

  void enter(Step next, uint32_t now) {
    startPH = trend;
    step = next;
    enteredAt = now;
    valve = next == ACTIVE;
    if (next == NORMAL || next == STOPPED) {
      trend = startPH = ph = 7.5f;
      drift = noise = ambient = 0;
      sampledAt = now;
    }
    ++revision;
  }

  bool command(const char* action, uint32_t now) {
    if (!strcmp(action, "RESET") || !strcmp(action, "STOP")) {
      paused = false;
      enter(!strcmp(action, "RESET") ? NORMAL : STOPPED, now);
      return true;
    }
    if (!strcmp(action, "START")) {
      if (step != NORMAL && step != READY && step != STOPPED) return false;
      paused = false;
      enter(FOOD, now);
      return true;
    }
    if (!strcmp(action, "PAUSE")) {
      if (paused || step == STOPPED || step == READY) return false;
      // Never leave an open valve while the crew pauses the story.
      if (step == ACTIVE) enter(RECOVERY, now);
      valve = false;
      paused = true;
      pausedAt = now;
      ++revision;
      return true;
    }
    if (!strcmp(action, "RESUME")) {
      if (!paused) return false;
      enteredAt += now - pausedAt;
      sampledAt += now - pausedAt;
      paused = false;
      ++revision;
      return true;
    }
    if (strcmp(action, "NEXT") || paused) return false;
    switch (step) {
      case NORMAL: enter(FOOD, now); break;
      case FOOD: enter(DANGER, now); break;
      case DANGER: enter(ACTIVE, now); break;
      case ACTIVE: enter(RECOVERY, now); break;
      case RECOVERY: return false; // Recovery completes on the device timer.
      case RESTORED: enter(READY, now); break;
      default: return false;
    }
    return true;
  }

  void tick(uint32_t now) {
    if (paused) return;
    // Correlated drift plus much smaller measurement noise, at a fixed cadence.
    // Unlike a sine wave, samples do not repeat a visible periodic pattern.
    uint32_t samples = uint32_t(now - sampledAt) / 500;
    if (samples > 120) { samples = 120; sampledAt = now - samples * 500; }
    while (samples--) {
      sampledAt += 500;
      if (step == NORMAL || step == RESTORED || step == READY) {
        // Slow, irregular baseline movement inside the expo's normal envelope.
        ambient = ambient * 0.997f + randomUnit() * 0.008f;
        ambient = fmaxf(-0.24f, fminf(0.24f, ambient));
      }
      drift = drift * 0.94f + randomUnit() * 0.012f;
      drift = fmaxf(-0.045f, fminf(0.045f, drift));
      noise = randomUnit() * 0.006f;
    }
    const uint32_t elapsed = now - enteredAt;
    if (step == FOOD) trend = interpolate(startPH, 7.0f, elapsed, 6000);
    else if (step == DANGER) trend = interpolate(startPH, 6.0f, elapsed, 4000);
    else if (step == ACTIVE) trend = interpolate(startPH, 6.0f, elapsed, VALVE_MS);
    else if (step == RECOVERY) trend = interpolate(startPH, 7.5f + ambient, elapsed, RECOVERY_MS);
    else trend = 7.5f + ambient;
    if (step == ACTIVE && uint32_t(now - enteredAt) >= VALVE_MS) enter(RECOVERY, now);
    if (step == RECOVERY && uint32_t(now - enteredAt) >= RECOVERY_MS) enter(RESTORED, now);
    ph = trend + drift + noise;
  }

  float randomUnit() {
    randomState ^= randomState << 13;
    randomState ^= randomState >> 17;
    randomState ^= randomState << 5;
    return float(randomState & 0xffff) / 32767.5f - 1.0f;
  }

  static float interpolate(float from, float to, uint32_t elapsed, uint32_t duration) {
    const float t = fminf(1.0f, float(elapsed) / duration);
    return from + (to - from) * t * t * (3.0f - 2.0f * t);
  }
};

// Portable parser also exercised by host tests. Values retain their original case.
struct SerialCommand {
  enum Kind { INVALID, HELP, STATUS, WIFI_SHOW, WIFI_SSID, WIFI_PASS, WIFI_CONNECT,
              MQTT_SHOW, MQTT_HOST, MQTT_PORT, MQTT_CONNECT };
  Kind kind = INVALID;
  const char* value = "";
  uint16_t port = 0;
  static bool matches(const char* text, const char* expected, bool prefix = false) {
    while (*expected) {
      if (toupper(static_cast<unsigned char>(*text++)) != *expected++) return false;
    }
    return prefix || *text == '\0';
  }
  static SerialCommand parse(const char* line) {
    SerialCommand result;
    const char* names[] = {"HELP", "STATUS", "WIFI SHOW", "WIFI CONNECT", "MQTT SHOW", "MQTT CONNECT"};
    const Kind kinds[] = {HELP, STATUS, WIFI_SHOW, WIFI_CONNECT, MQTT_SHOW, MQTT_CONNECT};
    for (unsigned i = 0; i < 6; ++i) if (matches(line, names[i])) { result.kind = kinds[i]; return result; }
    if (matches(line, "WIFI SSID ", true)) {
      result.value = line + 10;
      if (strlen(result.value) >= 1 && strlen(result.value) <= 32) result.kind = WIFI_SSID;
    } else if (matches(line, "WIFI PASS ", true)) {
      result.value = line + 10;
      size_t length = strlen(result.value);
      bool hex = length == 64;
      for (size_t i = 0; hex && i < length; ++i) hex = isxdigit(static_cast<unsigned char>(result.value[i]));
      if (!length || (length >= 8 && length <= 63) || hex) result.kind = WIFI_PASS;
    } else if (matches(line, "MQTT HOST ", true)) {
      result.value = line + 10;
      size_t length = strlen(result.value);
      bool valid = length >= 1 && length <= 253;
      for (size_t i = 0; valid && i < length; ++i) {
        char c = result.value[i];
        valid = isalnum(static_cast<unsigned char>(c)) || c == '.' || c == '-';
      }
      if (valid) result.kind = MQTT_HOST;
    } else if (matches(line, "MQTT PORT ", true)) {
      result.value = line + 10;
      uint32_t port = 0;
      bool valid = *result.value != '\0';
      for (const char* c = result.value; valid && *c; ++c) {
        valid = *c >= '0' && *c <= '9';
        if (valid) { port = port * 10 + (*c - '0'); valid = port <= 65535; }
      }
      if (valid && port > 0) { result.kind = MQTT_PORT; result.port = static_cast<uint16_t>(port); }
    }
    return result;
  }
};

#ifndef KP_HOST_TEST
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <Wire.h>
#include <esp_timer.h>

// Empty defaults: configure once through Serial; no private credentials in source.
String wifiSsid;
String wifiPassword;
String mqttHost;
uint16_t mqttPort = 1883;
Preferences preferences;
char serialBuffer[320];
size_t serialIndex = 0;
bool serialOverflow = false;
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
  if (WiFi.status() == WL_CONNECTED || wifiSsid.isEmpty()) return;
  if (millis() - lastWifiAttemptAt < WIFI_RETRY_MS) return;

  lastWifiAttemptAt = millis();
  Serial.printf("Menghubungkan WiFi ke %s...\n", wifiSsid.c_str());
  WiFi.disconnect();
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
}

void connectMqttIfNeeded() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected() || mqttHost.isEmpty()) return;
  if (millis() - lastMqttAttemptAt < MQTT_RETRY_MS) return;

  lastMqttAttemptAt = millis();
  // PubSubClient keeps the hostname pointer; refresh it after config changes.
  mqttClient.setServer(mqttHost.c_str(), mqttPort);
  char clientId[40];
  snprintf(clientId, sizeof(clientId), "kolampintar-%s", deviceUid);

  Serial.printf("Menghubungkan MQTT ke %s:%u...\n", mqttHost.c_str(), mqttPort);
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


void printNetworkConfig() {
  Serial.printf("WiFi SSID: %s\nPassword: %s\nMQTT: %s:%u\n", wifiSsid.isEmpty() ? "(belum diatur)" : wifiSsid.c_str(), wifiPassword.isEmpty() ? "(jaringan terbuka)" : "********", mqttHost.isEmpty() ? "(belum diatur)" : mqttHost.c_str(), mqttPort);
}

void loadNetworkConfig() {
  if (preferences.begin("wifi-config", true)) {
    wifiSsid = preferences.getString("ssid", "");
    wifiPassword = preferences.getString("password", "");
    preferences.end();
  }
  if (preferences.begin("mqtt-config", true)) {
    mqttHost = preferences.getString("host", "");
    mqttPort = preferences.getUShort("port", 1883);
    preferences.end();
  }
  if (wifiSsid.length() > 32) wifiSsid = "";
  if (mqttHost.length() > 253) mqttHost = "";
  if (!mqttPort) mqttPort = 1883;
  printNetworkConfig();
}

// Close the physical output BEFORE flash writes or blocking network operations.
void stopForNetworkChange() {
  demo.command("STOP", millis());
  updateDemo();
  publishTelemetry();
}

bool saveNetworkValue(const char* space, const char* key, const char* value) {
  if (!preferences.begin(space, false)) return false;
  // An empty password removes its key; this avoids putString's ambiguous zero return.
  bool saved = *value ? preferences.putString(key, value) == strlen(value)
                      : (!preferences.isKey(key) || preferences.remove(key));
  preferences.end();
  return saved;
}

void disconnectMqtt() {
  if (mqttClient.connected()) {
    mqttClient.publish(statusTopic, "offline", true);
    mqttClient.disconnect();
  }
}

void printSerialHelp() {
  Serial.println("HELP | STATUS | WIFI SHOW | MQTT SHOW");
  Serial.println("WIFI SSID <ssid> | WIFI PASS <password> | WIFI CONNECT");
  Serial.println("MQTT HOST <hostname/IP> | MQTT PORT <1-65535> | MQTT CONNECT");
  Serial.println("WIFI PASS followed by one space clears the password for an open network.");
  Serial.println("Values are saved in NVS. Run CONNECT to apply. Network changes stop the demo.");
  Serial.println("Demo/valve actions use the staff dashboard, not direct Serial ON/OFF.");
}

void handleSerialCommand(const char* line) {
  SerialCommand command = SerialCommand::parse(line);
  switch (command.kind) {
    case SerialCommand::HELP: printSerialHelp(); return;
    case SerialCommand::WIFI_SHOW:
    case SerialCommand::MQTT_SHOW: printNetworkConfig(); return;
    case SerialCommand::STATUS:
      printNetworkConfig();
      Serial.printf("UID: %s | WiFi: %s | MQTT: %s | Demo: %s | pH: %.2f | Valve: %s\n", deviceUid, WiFi.status() == WL_CONNECTED ? "online" : "offline", mqttClient.connected() ? "online" : "offline", demo.name(), latestPH, relayState ? "ON" : "OFF");
      if (WiFi.status() == WL_CONNECTED) Serial.println(WiFi.localIP());
      return;
    case SerialCommand::INVALID:
      Serial.println("Invalid command/value. Type HELP. SSID: 1-32 bytes; password: empty, 8-63 bytes, or 64 hex; host: hostname/IPv4.");
      return;
    default: break;
  }
  stopForNetworkChange();
  switch (command.kind) {
    case SerialCommand::WIFI_SSID:
      if (!saveNetworkValue("wifi-config", "ssid", command.value)) break;
      wifiSsid = command.value;
      Serial.println("SSID saved. Run WIFI CONNECT."); return;
    case SerialCommand::WIFI_PASS:
      if (!saveNetworkValue("wifi-config", "password", command.value)) break;
      wifiPassword = command.value;
      Serial.println("Password saved (hidden). Run WIFI CONNECT."); return;
    case SerialCommand::MQTT_HOST:
      if (!saveNetworkValue("mqtt-config", "host", command.value)) break;
      mqttHost = command.value;
      Serial.println("MQTT host saved. Run MQTT CONNECT."); return;
    case SerialCommand::MQTT_PORT: {
      if (!preferences.begin("mqtt-config", false)) break;
      bool saved = preferences.putUShort("port", command.port) == sizeof(uint16_t);
      preferences.end();
      if (!saved) break;
      mqttPort = command.port;
      Serial.println("MQTT port saved. Run MQTT CONNECT."); return;
    }
    case SerialCommand::WIFI_CONNECT:
      disconnectMqtt();
      WiFi.disconnect();
      mqttClient.setServer(mqttHost.c_str(), mqttPort);
      lastWifiAttemptAt = millis() - WIFI_RETRY_MS;
      lastMqttAttemptAt = millis() - MQTT_RETRY_MS;
      connectWifiIfNeeded();
      Serial.println("WiFi reconnect requested. Type STATUS to check."); return;
    case SerialCommand::MQTT_CONNECT:
      disconnectMqtt();
      mqttClient.setServer(mqttHost.c_str(), mqttPort);
      lastMqttAttemptAt = millis() - MQTT_RETRY_MS;
      connectMqttIfNeeded();
      Serial.println("MQTT reconnect requested. Type STATUS to check."); return;
    default: return;
  }
  Serial.println("NVS write failed; active configuration unchanged.");
}

void handleSerialControl() {
  // Bounded work keeps demo timers and MQTT serviced even with continuous input.
  unsigned budget = 64;
  while (budget-- && Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialOverflow) Serial.println("Serial line too long; command discarded.");
      else if (serialIndex) { serialBuffer[serialIndex] = '\0'; handleSerialCommand(serialBuffer); }
      memset(serialBuffer, 0, sizeof(serialBuffer));
      serialIndex = 0; serialOverflow = false;
    } else if (!serialOverflow) {
      if (serialIndex < sizeof(serialBuffer) - 1) serialBuffer[serialIndex++] = c;
      else serialOverflow = true;
    }
  }
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

  loadNetworkConfig();
  printSerialHelp();

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
  mqttClient.setServer(mqttHost.c_str(), mqttPort);
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
  handleSerialControl();
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

#endif // KP_HOST_TEST
