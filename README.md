# KolamPintar

> **Branch `codex/expo-demo`: firmware menggunakan pH simulasi dan menggerakkan valve fisik melalui urutan demo.** Tidak ada pilihan mode expo. Gunakan [EXPO_DEMO.md](EXPO_DEMO.md) untuk menjalankan, meng-upload, dan menguji versi ini. Penjelasan kontrol sensor/asam di bawah adalah dokumentasi versi utama, bukan perilaku firmware branch expo.

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
2. Verify GPIO 26, active-low relay polarity, and the physical valve setup. This branch simulates pH; it does not read a sensor.
3. Upload only `hardware/esp32-kolampintar/esp32-kolampintar.ino`. No local header files are needed.
4. Open Serial Monitor at 115200 baud with a newline ending. Set `WIFI SSID <ssid>`, `WIFI PASS <password>`, and `MQTT HOST <server LAN IP>`, then run `WIFI CONNECT`.
5. Run `STATUS` to check connectivity. Configuration is stored in NVS and loaded on reboot; device identity comes from the ESP32 eFuse MAC.

Do not use `localhost` as the MQTT host on the ESP32. Both devices must be reachable on the same network, and TCP port 1883 must be allowed through the server firewall.

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
{"ph":7.50,"solenoid":"OFF","mode":"MANUAL","rssi":-51,"dataSource":"SIMULATION","demoStep":"NORMAL","demoPaused":false,"demoRevision":0,"demoSession":"0123456789ABCDEF"}
```

Dashboard commands on this expo branch:

```json
{"commandId":"123e4567-e89b-42d3-a456-426614174000","demoAction":"START","demoSession":"0123456789ABCDEF","demoRevision":0}
{"commandId":"123e4567-e89b-42d3-a456-426614174001","demoAction":"RESET"}
```

Session/revision values must match the latest telemetry. The staff dashboard supplies them. Legacy AUTO/MANUAL commands are not used on this branch.

Applied acknowledgement (retained):

```json
{"commandId":"123e4567-e89b-42d3-a456-426614174001","status":"APPLIED","mode":"MANUAL","solenoid":"ON","relayPinLevel":0}
```

The control API returns `202` with a `commandId`, and the dashboard polls its status for up to five seconds. An acknowledgement proves that firmware state and the GPIO relay level changed; it does not prove physical liquid flow. Verifying flow requires a separate sensor.

Temperature and dissolved oxygen fields remain optional if they are added to future hardware.

## Control behavior on the expo branch

- pH values are simulated; this firmware does not read the pH probe or dose chemicals.
- Staff controls the story with START, NEXT, PAUSE, RESUME, RESET, and STOP.
- Valve opens in ACTIVE for at most 3 seconds, then closes and the simulated pH recovers.
- Pause, reset, stop, and Serial network configuration changes close the valve.
- Boot starts with the valve OFF. Its independent timer closes it even during blocked networking.

Use a separate plain-water demonstration setup and verify relay polarity and physical valve closure. See [EXPO_DEMO.md](EXPO_DEMO.md) and the [firmware guide](hardware/esp32-kolampintar/README.md) for the current branch. The calibration guidance in INTEGRATION_GUIDE.md describes the sensor firmware, not this expo sketch.

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

See [EXPO_DEMO.md](EXPO_DEMO.md) for expo setup and current controls.
