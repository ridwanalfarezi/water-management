# KolamPintar

KolamPintar monitors pond pH from a physical ESP32 and controls an acid-dosing solenoid. Automatic hysteresis runs on the ESP32, so pH control continues if Wi-Fi, MQTT, or the web server becomes unavailable.

## Architecture

```text
ESP32 pH sensor
  ├─ local automatic solenoid control
  └─ MQTT telemetry ──> EMQX ──> worker ──> PostgreSQL ──> Next.js dashboard
                         ^                                  │
                         └──────── dashboard commands ──────┘
```

The ESP32 publishes every five seconds. The worker validates and stores the readings, while the dashboard displays pH, the applied solenoid state, control mode, Wi-Fi signal, and device availability.

## Services

| Service | Purpose | Host port |
|---|---|---:|
| PostgreSQL 15 | Sensor readings, control logs, and journal | `5432` |
| EMQX 5.8 | MQTT communication with ESP32 devices | `1883` |
| Worker | MQTT validation and database ingestion | — |
| Next.js | Dashboard and control API | `3000` |
| EMQX dashboard | Broker administration | `18083` |

## Start the server

Requirements: Docker Desktop with Docker Compose.

```powershell
docker compose up --build
```

Open:

- Dashboard: <http://localhost:3000>
- EMQX administration: <http://localhost:18083>

The pond list remains empty until a configured physical ESP32 publishes its first reading.

An optional Gemini key can be placed in `.env`:

```dotenv
GEMINI_API_KEY=your-key-here
```

Without it, the application uses its built-in rule-based pH insights.

## Connect the ESP32

The upload-ready sketch and detailed setup instructions are in [`hardware/esp32-kolampintar`](hardware/esp32-kolampintar/README.md).

In short:

1. Install the ESP32 board package, PubSubClient, ArduinoJson, and LiquidCrystal I2C in Arduino IDE.
2. Copy `hardware/esp32-kolampintar/secrets.example.h` to `secrets.h`.
3. Enter the Wi-Fi credentials and the server computer's LAN IP in `secrets.h`.
4. Verify the pH calibration voltages, pins, and relay polarity in the sketch. The device identity is generated automatically from the ESP32 eFuse MAC.
5. Upload the sketch and watch its Serial Monitor at 115200 baud.

Do not use `localhost` as `MQTT_HOST` on the ESP32. Both devices must be reachable on the same network, and TCP port 1883 must be allowed through the server firewall.

## MQTT contract

For pond 1:

| Direction | Topic |
|---|---|
| ESP32 to server | `device/{deviceUid}/sensor` |
| Dashboard to ESP32 | `device/{deviceUid}/control` |
| ESP32 availability | `device/{deviceUid}/status` |
| ESP32 command acknowledgement | `device/{deviceUid}/ack` |

Telemetry:

```json
{"ph":7.62,"solenoid":"ON","mode":"AUTO","rssi":-51}
```

Dashboard commands:

```json
{"commandId":"123e4567-e89b-42d3-a456-426614174000","mode":"AUTO"}
{"commandId":"123e4567-e89b-42d3-a456-426614174001","mode":"MANUAL","solenoid":"ON"}
{"commandId":"123e4567-e89b-42d3-a456-426614174002","mode":"MANUAL","solenoid":"OFF"}
```

Applied acknowledgement (retained):

```json
{"commandId":"123e4567-e89b-42d3-a456-426614174001","status":"APPLIED","mode":"MANUAL","solenoid":"ON","relayPinLevel":0}
```

The control API returns `202` with a `commandId`, and the dashboard polls its status for up to five seconds. An acknowledgement proves that firmware state and the GPIO relay level changed; it does not prove physical liquid flow. Verifying flow requires a separate sensor.

Temperature and dissolved oxygen fields remain optional if they are added to future hardware.

## Control behavior

- `AUTO`: solenoid opens above pH 7.5 and closes below pH 7.3.
- `MANUAL ON`: solenoid opens immediately, then returns to automatic mode after 60 seconds.
- `MANUAL OFF`: solenoid closes and remains in manual mode until `AUTO` is selected.
- Boot behavior: relay starts OFF.
- Network loss: local automatic control continues.

Test manual opening with the dosing line disconnected or using a harmless liquid before connecting acid. Confirm the relay polarity and normally-open/normally-closed plumbing behavior physically.

## Useful commands

```powershell
# Service status
docker compose ps

# Watch physical telemetry reach the database worker
docker compose logs -f worker

# Restart after source changes
docker compose up -d --build

# Stop services without deleting stored readings
docker compose down
```

See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for calibration, multi-pond setup, API commands, and troubleshooting.
