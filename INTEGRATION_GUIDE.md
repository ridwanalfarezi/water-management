# Physical ESP32 Integration Guide

This guide connects the KolamPintar ESP32 pH controller directly to the web application through MQTT.

## 1. Data flow

```text
pH probe -> ESP32 -> device/{uid}/sensor -> EMQX -> worker -> PostgreSQL -> dashboard
                      device/{uid}/control <- EMQX <- control API <- dashboard
                      device/{uid}/ack ----> EMQX -> worker -> command status
```

The ESP32 owns automatic pH control. The server stores telemetry and sends explicit operator commands; it does not duplicate the automatic dosing decision.

## 2. Start the server stack

From the repository root:

```powershell
docker compose up --build
docker compose ps
```

The following services should be running:

- `wm-postgres`
- `wm-emqx`
- `wm-worker`
- `wm-web`

Open the dashboard at <http://localhost:3000>.

## 3. Find the server's LAN address

On the computer running Docker:

```powershell
ipconfig
```

Use the active Wi-Fi or Ethernet adapter's IPv4 address, usually `192.168.x.x` or `10.x.x.x`. This address goes in the ESP32's `MQTT_HOST`; `localhost` would point back to the ESP32 itself.

Both the ESP32 and server must be mutually reachable. Allow inbound TCP port 1883 in the operating-system firewall. Keep this unauthenticated development broker on a trusted local network only.

## 4. Prepare the firmware

Open [`hardware/esp32-kolampintar/esp32-kolampintar.ino`](hardware/esp32-kolampintar/esp32-kolampintar.ino) in Arduino IDE.

Install:

- ESP32 board support
- PubSubClient by Nick O'Leary
- ArduinoJson by Benoit Blanchon
- LiquidCrystal I2C by Frank de Brabander

Copy:

```text
hardware/esp32-kolampintar/secrets.example.h
```

to:

```text
hardware/esp32-kolampintar/secrets.h
```

Then configure:

```cpp
const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASSWORD = "your-password";
const char* MQTT_HOST = "192.168.1.100";
const uint16_t MQTT_PORT = 1883;
```

`secrets.h` is ignored by Git.

## 5. Verify the hardware configuration

Near the top of the sketch, check:

```cpp
constexpr int PH_PIN = 34;
constexpr int RELAY_PIN = 26;
constexpr bool RELAY_ACTIVE_LOW = true;
constexpr float PH_MAX_ON = 7.5F;
constexpr float PH_MAX_OFF = 7.3F;
```

Set `RELAY_ACTIVE_LOW` to `false` if the relay activates on a HIGH signal. During boot, the firmware always commands the relay OFF.

The expected plumbing behavior is:

- relay/solenoid OFF: acid flow stopped
- relay/solenoid ON: acid flow enabled

Verify this without acid before commissioning.

## 6. Calibrate the pH probe

The sketch uses two-point calibration:

```cpp
constexpr float PH_7_VOLTAGE = 2.4F;
constexpr float PH_4_VOLTAGE = 2.9F;
```

Measure the ESP32 ADC input voltage while the probe is in fresh pH 7 and pH 4 buffer solutions, then replace these constants. Ensure the conditioned sensor voltage never exceeds the ESP32 ADC input range.

Rinse the probe with distilled water between buffers and wait for each reading to stabilize. Calibration quality directly affects automatic dosing safety.

## 7. Upload and verify telemetry

Upload the firmware and open Serial Monitor at 115200 baud. Expected messages include:

```text
Device UID: A1B2C3D4E5F6
MQTT terhubung, subscribe device/A1B2C3D4E5F6/control
Telemetri device/A1B2C3D4E5F6/sensor -> {"ph":7.62,"solenoid":"ON","mode":"AUTO","rssi":-51}
```

On the server, watch the worker:

```powershell
docker compose logs -f worker
```

Expected ingestion output:

```text
[Worker] Saved device=A1B2C3D4E5F6 pond=1 ph=7.62 solenoid=ON mode=AUTO
```

The dashboard should show the pond within five seconds and mark the device offline if no new telemetry arrives for approximately 15 seconds.

## 8. MQTT message contract

### Telemetry

Topic:

```text
device/{deviceUid}/sensor
```

Payload:

```json
{
  "ph": 7.62,
  "solenoid": "ON",
  "mode": "AUTO",
  "rssi": -51
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `ph` | yes | number | pH from 0 through 14 |
| `solenoid` | recommended | `ON` or `OFF` | Applied physical output |
| `mode` | recommended | `AUTO` or `MANUAL` | Active control mode |
| `rssi` | optional | integer | Wi-Fi signal strength in dBm |
| `temperature` | optional | number | Future water-temperature reading |
| `do` | optional | number | Future dissolved-oxygen reading |

### Control

Topic:

```text
device/{deviceUid}/control
```

Payloads:

```json
{"commandId":"123e4567-e89b-42d3-a456-426614174000","mode":"AUTO"}
{"commandId":"123e4567-e89b-42d3-a456-426614174001","mode":"MANUAL","solenoid":"ON"}
{"commandId":"123e4567-e89b-42d3-a456-426614174002","mode":"MANUAL","solenoid":"OFF"}
```

`commandId` is required and must be a UUID. Control messages are non-retained, so a broker reconnect does not replay an old dosing command.

### Command acknowledgement

Topic:

```text
device/{deviceUid}/ack
```

Payloads:

```json
{"commandId":"123e4567-e89b-42d3-a456-426614174001","status":"APPLIED","mode":"MANUAL","solenoid":"ON","relayPinLevel":0}
{"commandId":"123e4567-e89b-42d3-a456-426614174002","status":"REJECTED","reason":"INVALID_PAYLOAD"}
```

ACK messages are retained. The worker accepts them only when the command ID belongs to the same device UID. A repeated latest command ID is not executed again; firmware republishes the stored ACK. `APPLIED` confirms the firmware state and the electrical GPIO relay level, not physical valve travel or liquid flow.

### Availability

Topic:

```text
device/{deviceUid}/status
```

The ESP32 publishes retained `online` and configures MQTT Last Will as retained `offline`.

## 9. Dashboard control

The pond detail page provides:

- **Otomatis**: returns local control to pH hysteresis.
- **Buka**: opens the solenoid in manual mode.
- **Tutup**: closes the solenoid in manual mode.

Manual ON automatically expires after 60 seconds. If pH is still above the automatic threshold when AUTO resumes, the local controller may reopen the solenoid.

The same commands are available through the API:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/control `
  -ContentType application/json `
  -Body '{"pondId":1,"mode":"AUTO"}'
```

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/control `
  -ContentType application/json `
  -Body '{"pondId":1,"solenoid":"OFF"}'
```

`POST /api/control` returns HTTP `202` with `commandId` and status `SENT`. Read the correlated result with:

```powershell
Invoke-RestMethod -Method Get `
  -Uri http://localhost:3000/api/control/123e4567-e89b-42d3-a456-426614174001
```

The result moves through `PENDING`, `SENT`, then `APPLIED` or `REJECTED`. Without an ACK for five seconds it becomes `TIMED_OUT`; a later ACK is recorded as `APPLIED_LATE` or `REJECTED_LATE`. Only one `PENDING`/`SENT` command is allowed per device, and another request receives HTTP `409`. Offline devices also return `409`; broker publish failure returns `502` and `PUBLISH_FAILED`.

## 10. Multiple ponds and automatic assignment

Flash the same firmware to every controller; no `POND_ID` is required. Each ESP32 derives a stable `deviceUid` from its eFuse MAC. When a new UID first publishes retained `online` or valid telemetry, the worker atomically registers it as the next permanent pond number.

Each board still uses its own sensor calibration and relay configuration. A registered pond remains visible when disconnected and is marked offline after approximately 15 seconds without telemetry. Historical rows that are not linked to a registered device are not displayed.

## 11. Troubleshooting

### ESP32 cannot connect to Wi-Fi

- Confirm the ESP32 supports the selected 2.4 GHz network.
- Recheck `WIFI_SSID` and `WIFI_PASSWORD`.
- Move the device closer to the access point and inspect Serial Monitor.

### Wi-Fi works but MQTT does not connect

- Use the server's LAN IP, not `localhost` and not the Docker service name `emqx`.
- Confirm `docker compose ps` shows `wm-emqx` healthy.
- Confirm port 1883 is allowed through the server firewall.
- Check that client isolation is disabled on the Wi-Fi access point.

### Worker receives nothing

```powershell
docker compose logs worker
docker compose logs emqx
```

Confirm the topic is exactly `device/{12-hex-character-uid}/sensor` and the payload contains numeric `ph` between 0 and 14.

### Dashboard reports the device offline

- Check Serial Monitor for successful telemetry publication.
- Check worker logs for saved readings.
- Ensure the ESP32 publishes more frequently than the 15-second dashboard timeout.
- Check RSSI; values below roughly -75 dBm indicate a weak connection.

### Relay behavior is reversed

Change `RELAY_ACTIVE_LOW`, upload again, and verify with the dosing line disconnected.

### pH value is pinned at 0 or 14

- Measure the ADC input voltage with a multimeter.
- Recheck the voltage divider and common ground.
- Repeat pH 7/pH 4 calibration.
- Ensure the sensor output does not exceed the ADC range.

## 12. Database inspection

View the latest physical readings:

```powershell
docker compose exec postgres psql -U user -d waterdb -c "SELECT pond_id, ph_level, solenoid_state, control_mode, rssi, created_at FROM sensor_data ORDER BY created_at DESC LIMIT 10;"
```

Stored readings survive `docker compose down`. Do not use `docker compose down -v` unless you intentionally want to delete the PostgreSQL volume.
