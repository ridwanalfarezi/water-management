# Physical ESP32 Integration Guide

This guide connects the KolamPintar ESP32 pH controller directly to the web application through MQTT.

## 1. Data flow

```text
pH probe -> ESP32 -> pond/{id}/sensor -> EMQX -> worker -> PostgreSQL -> dashboard
                      pond/{id}/control <- EMQX <- control API <- dashboard
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
constexpr int POND_ID = 1;
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
MQTT terhubung, subscribe pond/1/control
Telemetri pond/1/sensor -> {"ph":7.62,"solenoid":"ON","mode":"AUTO","rssi":-51}
```

On the server, watch the worker:

```powershell
docker compose logs -f worker
```

Expected ingestion output:

```text
[Worker] Saved pond=1 ph=7.62 solenoid=ON mode=AUTO
```

The dashboard should show the pond within five seconds and mark the device offline if no new telemetry arrives for approximately 15 seconds.

## 8. MQTT message contract

### Telemetry

Topic:

```text
pond/{pondId}/sensor
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
pond/{pondId}/control
```

Payloads:

```json
{"mode":"AUTO"}
{"mode":"MANUAL","solenoid":"ON"}
{"mode":"MANUAL","solenoid":"OFF"}
```

The device reports the applied state in its next telemetry message. Dashboard state is therefore based on device confirmation, not only on the requested command.

### Availability

Topic:

```text
pond/{pondId}/status
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

## 10. Multiple ponds

Give each physical controller a unique positive `POND_ID`. Pond 2, for example, automatically uses:

```text
pond/2/sensor
pond/2/control
pond/2/status
```

Each board should use its own calibrated voltages and relay configuration. A pond appears in the selector after its first accepted telemetry message.

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

Confirm the topic is exactly `pond/{positive-number}/sensor` and the payload contains numeric `ph` between 0 and 14.

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
