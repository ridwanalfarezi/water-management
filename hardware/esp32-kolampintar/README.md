# ESP32 hardware integration

This firmware connects the existing pH sensor and relay to KolamPintar over MQTT. Automatic pH control remains on the ESP32, so it continues working if Wi-Fi or the server goes down.

## Prepare Arduino IDE

1. Install the ESP32 board package.
2. Install **PubSubClient**, **ArduinoJson**, and **LiquidCrystal I2C** from Library Manager.
3. Copy `secrets.example.h` to `secrets.h`.
4. Set the Wi-Fi credentials and the LAN IP of the computer running Docker in `secrets.h`.
5. Check `POND_ID`, calibration voltages, relay polarity, and pins near the top of `esp32-kolampintar.ino`.
6. Select your ESP32 board and upload the sketch.

Use the server computer's LAN address for `MQTT_HOST`, not `localhost`. Both devices must be on the same network, and TCP port 1883 must be allowed through the server firewall.

## MQTT contract

- Telemetry topic: `pond/{pondId}/sensor`
- Control topic: `pond/{pondId}/control`
- Presence topic: `pond/{pondId}/status`

Telemetry sent every five seconds:

```json
{"ph":7.62,"solenoid":"ON","mode":"AUTO","rssi":-51}
```

Dashboard commands:

```json
{"mode":"AUTO"}
{"mode":"MANUAL","solenoid":"ON"}
{"mode":"MANUAL","solenoid":"OFF"}
```

For safety, manual ON returns to automatic mode after 60 seconds. Boot, Wi-Fi failure, and MQTT failure do not disable the local automatic hysteresis. The relay starts OFF after every reset.

## Verify

Start the server stack from the repository root:

```powershell
docker compose up --build
docker compose logs -f worker
```

Open `http://localhost:3000`, choose the matching pond, and confirm that pH, solenoid state, mode, and signal strength update. Test **Open** only with a safe liquid or disconnected dosing line first.
