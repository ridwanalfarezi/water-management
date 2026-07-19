# ESP32 hardware integration

This firmware connects the existing pH sensor and relay to KolamPintar over MQTT. Automatic pH control remains on the ESP32, so it continues working if Wi-Fi or the server goes down.

## Prepare Arduino IDE

1. Install the ESP32 board package.
2. Install **PubSubClient**, **ArduinoJson**, and **LiquidCrystal I2C** from Library Manager.
3. Copy `secrets.example.h` to `secrets.h`.
4. Set the Wi-Fi credentials and the LAN IP of the computer running Docker in `secrets.h`.
5. Check the calibration voltages, relay polarity, and pins near the top of `esp32-kolampintar.ino`. No pond ID needs to be configured.
6. Select your ESP32 board and upload the sketch.

Use the server computer's LAN address for `MQTT_HOST`, not `localhost`. Both devices must be on the same network, and TCP port 1883 must be allowed through the server firewall.

## MQTT contract

- Telemetry topic: `device/{deviceUid}/sensor`
- Control topic: `device/{deviceUid}/control`
- Presence topic: `device/{deviceUid}/status`
- Acknowledgement topic: `device/{deviceUid}/ack`

`deviceUid` is a stable 12-character hexadecimal identifier generated from the ESP32 eFuse MAC. The backend assigns the device a permanent pond number when it first connects.

Telemetry sent every five seconds:

```json
{"ph":7.62,"solenoid":"ON","mode":"AUTO","rssi":-51}
```

Dashboard commands:

```json
{"commandId":"123e4567-e89b-42d3-a456-426614174000","mode":"AUTO"}
{"commandId":"123e4567-e89b-42d3-a456-426614174001","mode":"MANUAL","solenoid":"ON"}
{"commandId":"123e4567-e89b-42d3-a456-426614174002","mode":"MANUAL","solenoid":"OFF"}
```

Every command must contain a valid UUID `commandId`. After applying the state and reading back the GPIO output, firmware publishes a retained acknowledgement:

```json
{"commandId":"123e4567-e89b-42d3-a456-426614174001","status":"APPLIED","mode":"MANUAL","solenoid":"ON","relayPinLevel":0}
```

Invalid payloads with a valid ID receive `REJECTED`. A duplicate of the latest `commandId` is not executed again; the last acknowledgement is republished. This confirms firmware and relay-pin state only, not physical valve movement or liquid flow.

For safety, manual ON returns to automatic mode after 60 seconds. Boot, Wi-Fi failure, and MQTT failure do not disable the local automatic hysteresis. The relay starts OFF after every reset.

## Verify

Start the server stack from the repository root:

```powershell
docker compose up --build
docker compose logs -f worker
```

Open `http://localhost:3000`, choose the matching pond, and confirm that pH, solenoid state, mode, and signal strength update. Test **Open** only with a safe liquid or disconnected dosing line first.
