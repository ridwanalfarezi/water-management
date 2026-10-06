# ESP32 expo firmware

Upload **`esp32-kolampintar.ino` only**. The demo sequence and Serial configuration are included in this file; `secrets.h` and `demo-sequence.h` are no longer needed. Any old local `secrets.h` is ignored by this firmware.

This branch uses simulated pH and a physical relay/valve. It does not read a pH probe or perform chemical dosing. Relay: GPIO 26, active-low. LCD: I2C address `0x27`, 16×2.

## Upload and configure

1. Select your ESP32 board in Arduino IDE. Install **PubSubClient**, **ArduinoJson**, and **LiquidCrystal I2C**. Preferences is included in the ESP32 core.
2. Upload the `.ino`, then open Serial Monitor at **115200 baud**, with **Newline** or **Both NL & CR**.
3. Enter these commands, replacing the example values:

```text
WIFI SSID Booth Network
WIFI PASS your-password
MQTT HOST 192.168.1.100
MQTT PORT 1883
WIFI CONNECT
STATUS
```

Use the server computer's LAN address, not `localhost` or a URL such as `mqtt://...`. The device and server must share a reachable network; allow TCP port 1883 through the server firewall.

Values are stored in ESP32 NVS and loaded after reboot. Wi-Fi uses namespace `wifi-config` with keys `ssid` and `password`; MQTT uses `mqtt-config` with keys `host` and `port`. These match the old KP-Demo firmware's existing Wi-Fi/host storage. An absent port defaults to 1883. A new device has no embedded SSID, password, or broker host.

After changing Wi-Fi, run `WIFI CONNECT`. After changing MQTT host/port, run `MQTT CONNECT`. Automatic reconnection also uses the latest saved values. Network-changing commands first stop the demo and close the valve; restart the demo from the staff dashboard after reconnecting.

## Serial commands

| Command | Result |
|---|---|
| `HELP` | List commands |
| `STATUS` | Device UID, connection status, LAN IP, demo stage, pH, and valve |
| `WIFI SHOW` / `MQTT SHOW` | Show saved runtime configuration; password masked |
| `WIFI SSID <ssid>` | Save SSID, 1–32 bytes |
| `WIFI PASS <password>` | Save password: 8–63 bytes or 64 hex characters |
| `WIFI PASS ` | A trailing space with an empty value clears the password for an open network |
| `WIFI CONNECT` | Reconnect Wi-Fi and MQTT using the saved configuration |
| `MQTT HOST <hostname/IP>` | Save hostname or IPv4 address, up to 253 characters |
| `MQTT PORT <port>` | Save port, 1–65535 |
| `MQTT CONNECT` | Reconnect MQTT; Wi-Fi must be connected |

Command words are case-insensitive. SSID/password values preserve case and spaces. Passwords are never echoed by firmware. Invalid or oversized input is rejected, without applying a partial command. NVS persistence does not encrypt credentials by itself.

There are no direct Serial `ON`, `OFF`, or `AUTO` commands. Use the staff dashboard for demo transitions so pH, stage, and valve remain consistent.

## MQTT contract and valve behavior

Topics stay `device/{deviceUid}/sensor`, `/control`, `/status`, and `/ack`. UID is the ESP32 eFuse MAC formatted as 12 uppercase hexadecimal characters; the server assigns the pond number.

Telemetry every 500 ms includes `ph`, `solenoid`, `mode`, `rssi`, `dataSource: "SIMULATION"`, `demoStep`, `demoPaused`, `demoRevision`, and `demoSession`.

Dashboard commands contain a UUID `commandId`, `demoAction`, and current `demoSession`/`demoRevision`. Actions are `START`, `NEXT`, `PAUSE`, `RESUME`, `RESET`, and `STOP`. Reset/stop can override stale session/revision. ACKs preserve the existing applied/rejected contract and latest-command duplicate protection.

Valve opens only in ACTIVE and closes after at most 3 seconds via an independent ESP timer, including when networking blocks. Pause, reset, stop, and network configuration changes close it. Boot starts with valve OFF. ACK confirms GPIO state, not physical movement or water flow.

Before use, test wiring, relay polarity, physical valve closure, speaker audio, reboot persistence, and network changes on your ESP32 with an isolated plain-water demo setup.

## Host checks

The host tests include the same `.ino` with `KP_HOST_TEST`, excluding Arduino hardware APIs. They exercise the demo sequence and Serial value parser; they do not emulate NVS flash, Wi-Fi, or physical GPIO.

```powershell
$env:PATH = "C:/msys64/ucrt64/bin;" + $env:PATH
g++ -std=c++11 tests/demo-sequence.cpp -o tests/demo-sequence-test.exe
./tests/demo-sequence-test.exe
g++ -std=c++11 tests/serial-config.cpp -o tests/serial-config-test.exe
./tests/serial-config-test.exe
g++ -std=c++11 tests/demo-bridge.cpp -o tests/demo-bridge.exe
```

Run these commands from `hardware/esp32-kolampintar`. The bridge remains available to `apps/worker/integration/expo-device.ts` for MQTT integration tests.
