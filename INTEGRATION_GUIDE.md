# Integration Guide — AquaMonitor Water Management System

This guide is for integrating a physical prototype (IoT sensor hardware) with this project. By the end, your hardware will be publishing real sensor data into the dashboard instead of the built-in simulators.

---

## Table of Contents

1. [What You Need](#1-what-you-need)
2. [Cloning the Repository](#2-cloning-the-repository)
3. [Environment Setup](#3-environment-setup)
4. [Running the Application](#4-running-the-application)
5. [Understanding the Architecture](#5-understanding-the-architecture)
6. [How to Integrate Your Prototype](#6-how-to-integrate-your-prototype)
7. [Switching from Simulators to Real Hardware](#7-switching-from-simulators-to-real-hardware)
8. [API Reference](#8-api-reference)
9. [Database Schema](#9-database-schema)
10. [Verifying Your Integration](#10-verifying-your-integration)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. What You Need

### Required Software

| Tool | Version | Purpose | Download |
|------|---------|---------|----------|
| **Git** | Any recent | Clone the repo | https://git-scm.com/downloads |
| **Docker Desktop** | 4.x+ | Run all services | https://www.docker.com/products/docker-desktop |
| **Docker Compose** | Included in Docker Desktop | Orchestrate containers | (bundled with Docker Desktop) |

> **Note:** Docker Desktop already includes Docker Compose. You do **not** need to install them separately.

### Optional (for local development outside Docker)

| Tool | Purpose | Download |
|------|---------|----------|
| **Bun** | Run worker/simulator locally | https://bun.sh |
| **Node.js 20+** | Run the web app locally | https://nodejs.org |
| **DBeaver / pgAdmin** | Browse the PostgreSQL database | https://dbeaver.io |
| **MQTTX** | Debug MQTT messages visually | https://mqttx.app |

### For Your Prototype Hardware

Your device (ESP32, Raspberry Pi, Arduino + WiFi, etc.) must be able to:

- Connect to a WiFi/LAN network
- Publish MQTT messages (most microcontrollers support this via a library)

---

## 2. Cloning the Repository

Open a terminal (PowerShell, Command Prompt, or Terminal) and run:

```bash
git clone https://github.com/ridwanalfarezi/water-management.git
cd water-management
```

Your folder structure will look like this:

```
water-management/
├── apps/
│   ├── web/          ← Next.js dashboard + API
│   └── worker/       ← MQTT subscriber + automation logic
├── services/
│   └── simulator/    ← Fake IoT sensor (replace with your hardware)
├── docker/
│   └── init.sql      ← Database schema (auto-applied on first run)
├── docker-compose.yml
├── .env.example
└── .env              ← You'll create this in the next step
```

---

## 3. Environment Setup

### 3.1 Create your `.env` file

Copy the example file:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Mac / Linux
cp .env.example .env
```

### 3.2 Edit `.env`

Open `.env` in any text editor. It looks like this:

```env
# Google Gemini API (Optional — for AI insights on the dashboard)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite
```

- `GEMINI_API_KEY` is **optional**. The dashboard will show rule-based analysis if you leave it blank. If you want AI-powered insights, get a free key at https://aistudio.google.com/apikey and paste it here.
- `GEMINI_MODEL` — leave as-is unless you want to change the model.

### 3.3 Database credentials

The database credentials are already configured in `docker-compose.yml` and do not need to be changed for local use:

| Setting | Value |
|---------|-------|
| Host | `localhost:5432` (from host) / `postgres:5432` (between containers) |
| Database | `waterdb` |
| Username | `user` |
| Password | `password` |

---

## 4. Running the Application

### First run (builds Docker images — takes a few minutes)

```bash
docker compose up --build
```

### Subsequent runs

```bash
docker compose up
```

### Stop everything

```bash
docker compose down
```

### Check logs for a specific service

```bash
docker compose logs -f worker      # Watch the automation worker
docker compose logs -f web         # Watch the web dashboard
docker compose logs -f simulator   # Watch simulated sensor data
```

### Access the running application

| Interface | URL | Purpose |
|-----------|-----|---------|
| **Dashboard** | http://localhost:3000 | Main monitoring UI |
| **EMQX Admin Panel** | http://localhost:18083 | View MQTT broker activity (login: `admin` / `public`) |
| **PostgreSQL** | `localhost:5432` | Connect with DBeaver/pgAdmin if needed |

---

## 5. Understanding the Architecture

```
Your Hardware / Prototype
        │
        │  MQTT publish
        │  Topic: pond/{id}/sensor
        │  Payload: {"temperature": 28.5, "do": 5.2, "ph": 7.1}
        ▼
┌─────────────────────────────────────────┐
│        EMQX MQTT Broker :1883           │  ← Message bus
└─────────────────────────────────────────┘
        │                    │
        │ subscribe          │ subscribe
        ▼                    ▼
┌──────────────┐    ┌──────────────────────┐
│   Worker     │    │  Web Dashboard API   │
│  (Bun)       │    │  (Next.js)           │
│              │    │                      │
│ 1. Save to   │    │ Serves browser UI    │
│    database  │    │ and REST API         │
│ 2. Auto lime │    └──────────────────────┘
│    control   │              │
└──────────────┘              │ SQL
        │                     │
        │ SQL                 ▼
        ▼          ┌──────────────────────┐
        └─────────►│   PostgreSQL :5432   │
                   │   (waterdb)          │
                   └──────────────────────┘
                              │
                              │ REST API fetch
                              ▼
                   ┌──────────────────────┐
                   │   Browser / React    │
                   │   Live Dashboard     │
                   └──────────────────────┘
```

**Data flow in plain English:**

1. Your hardware reads pH, temperature, and dissolved oxygen (DO) from sensors
2. It publishes a JSON message to the MQTT broker running on port `1883`
3. The **worker** picks up the message, saves it to the database, and triggers automatic lime control if pH is low
4. The **web dashboard** polls the database every 5 seconds and displays live charts

---

## 6. How to Integrate Your Prototype

### 6.1 What your device must do

Your hardware needs to publish an MQTT message to this topic:

```
pond/{pondId}/sensor
```

Where `{pondId}` is a number representing which pond the sensor is for (e.g., `1`, `2`, or `3`).

**Payload format (JSON):**

```json
{
  "temperature": 28.45,
  "do": 5.32,
  "ph": 7.15
}
```

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `temperature` | float | °C | Water temperature |
| `do` | float | mg/L | Dissolved oxygen level |
| `ph` | float | — | pH level (0–14 scale) |

### 6.2 Connecting to the MQTT broker

The MQTT broker (EMQX) runs on port `1883` of the machine running Docker.

| Setting | Value |
|---------|-------|
| **Host** | IP address of the computer running Docker (e.g., `192.168.1.100`) |
| **Port** | `1883` |
| **Protocol** | MQTT v3.1.1 (no TLS for local use) |
| **Username** | *(none required)* |
| **Password** | *(none required)* |
| **QoS** | 1 (recommended) |

> **Finding your computer's IP:** Run `ipconfig` (Windows) or `ifconfig` / `ip a` (Linux/Mac) and look for your LAN IP address (usually starts with `192.168.` or `10.`).

### 6.3 Example code for common platforms

#### ESP32 / ESP8266 (Arduino IDE)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// IP of the computer running Docker
const char* mqttServer = "192.168.1.100";
const int mqttPort = 1883;
const int pondId = 1;  // Change per pond

WiFiClient espClient;
PubSubClient client(espClient);

void connectMQTT() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    if (client.connect("esp32-pond-1")) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.println(client.state());
      delay(3000);
    }
  }
}

void publishSensorData(float temperature, float doLevel, float ph) {
  StaticJsonDocument<128> doc;
  doc["temperature"] = temperature;
  doc["do"] = doLevel;
  doc["ph"] = ph;

  char payload[128];
  serializeJson(doc, payload);

  char topic[32];
  snprintf(topic, sizeof(topic), "pond/%d/sensor", pondId);

  client.publish(topic, payload, true);
  Serial.printf("Published: %s → %s\n", topic, payload);
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  client.setServer(mqttServer, mqttPort);
}

void loop() {
  if (!client.connected()) connectMQTT();
  client.loop();

  // Replace these with your actual sensor readings
  float temperature = readTemperatureSensor();
  float doLevel = readDOSensor();
  float ph = readPhSensor();

  publishSensorData(temperature, doLevel, ph);
  delay(5000);  // Publish every 5 seconds
}
```

#### Raspberry Pi (Python)

```python
import paho.mqtt.client as mqtt
import json
import time

MQTT_HOST = "192.168.1.100"  # IP of the computer running Docker
MQTT_PORT = 1883
POND_ID = 1

client = mqtt.Client()
client.connect(MQTT_HOST, MQTT_PORT)

def publish_sensor_data(temperature, do_level, ph):
    topic = f"pond/{POND_ID}/sensor"
    payload = json.dumps({
        "temperature": temperature,
        "do": do_level,
        "ph": ph
    })
    client.publish(topic, payload, qos=1)
    print(f"Published: {topic} → {payload}")

while True:
    # Replace with your actual sensor readings
    temperature = read_temperature_sensor()
    do_level = read_do_sensor()
    ph = read_ph_sensor()

    publish_sensor_data(temperature, do_level, ph)
    time.sleep(5)
```

### 6.4 Disabling the simulators (optional)

The project includes 3 simulator containers that generate fake data for ponds 1, 2, and 3. Once your hardware is publishing real data for a pond, you can disable its corresponding simulator so they don't conflict.

Open `docker-compose.yml` and comment out or remove the simulator services you no longer need:

```yaml
# Comment out or delete the simulator for your pond:
# simulator:
#   build: ./services/simulator
#   ...

# simulator-2:
#   ...

# simulator-3:
#   ...
```

Then restart:

```bash
docker compose down
docker compose up --build
```

### 6.5 Receiving control commands (optional)

The system automatically publishes lime control commands back to your device. If you want your hardware to respond to these commands (e.g., activate a lime pump), subscribe to:

```
pond/{pondId}/control
```

**Message payload:**

```json
{ "lime": "ON" }
```

or

```json
{ "lime": "OFF" }
```

The worker automatically sends `lime: ON` when pH drops below 6.5, and `lime: OFF` when it recovers. Manual controls from the dashboard also publish to this topic.

#### ESP32 example (subscribe to control):

```cpp
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<64> doc;
  deserializeJson(doc, payload, length);

  const char* limeState = doc["lime"];
  if (strcmp(limeState, "ON") == 0) {
    digitalWrite(LIME_PUMP_PIN, HIGH);  // Activate lime pump
  } else {
    digitalWrite(LIME_PUMP_PIN, LOW);   // Deactivate
  }
}

void connectMQTT() {
  while (!client.connected()) {
    if (client.connect("esp32-pond-1")) {
      char controlTopic[32];
      snprintf(controlTopic, sizeof(controlTopic), "pond/%d/control", pondId);
      client.subscribe(controlTopic);
    }
  }
}
```

---

## 7. Switching from Simulators to Real Hardware

The project ships with three simulator containers (`simulator`, `simulator-2`, `simulator-3`) that generate fake sensor data for ponds 1, 2, and 3. When your real device is ready, you need to stop the simulator for that pond so they don't publish conflicting data to the same topic.

### 7.1 Understand what's running

Before making changes, check which containers are active:

```bash
docker compose ps
```

You'll see something like:

```
NAME              IMAGE         STATUS
wm-postgres       postgres:15   Up (healthy)
wm-emqx           emqx:5.8      Up (healthy)
wm-worker         wm-worker     Up
wm-web            wm-web        Up
wm-simulator      wm-simulator  Up   ← fake data for pond 1
wm-simulator-2    wm-simulator  Up   ← fake data for pond 2
wm-simulator-3    wm-simulator  Up   ← fake data for pond 3
```

### 7.2 Stop a simulator without restarting everything

If your hardware is already running and publishing data, you can stop just the conflicting simulator on the fly — no need to bring the whole stack down:

```bash
# Stop the simulator for pond 1 only
docker compose stop simulator

# Stop pond 2
docker compose stop simulator-2

# Stop pond 3
docker compose stop simulator-3

# Stop all three at once
docker compose stop simulator simulator-2 simulator-3
```

> This stops the container immediately. The rest of the stack (database, broker, worker, web) keeps running without interruption.

To bring a simulator back up (e.g., for testing):

```bash
docker compose start simulator
```

### 7.3 Permanently remove simulators from the stack

Once you've confirmed your hardware works, remove the simulator services from `docker-compose.yml` so they never start again.

Open `docker-compose.yml` and delete or comment out the simulator blocks. Here's what to remove:

```yaml
# DELETE or comment out these three blocks:

  simulator:
    build: ./services/simulator
    container_name: wm-simulator
    depends_on:
      emqx:
        condition: service_healthy
    environment:
      - MQTT_URL=mqtt://emqx:1883
      - POND_ID=1
    restart: on-failure
    networks:
      - waternet

  simulator-2:
    build: ./services/simulator
    container_name: wm-simulator-2
    depends_on:
      emqx:
        condition: service_healthy
    environment:
      - MQTT_URL=mqtt://emqx:1883
      - POND_ID=2
    restart: on-failure
    networks:
      - waternet

  simulator-3:
    build: ./services/simulator
    container_name: wm-simulator-3
    depends_on:
      emqx:
        condition: service_healthy
    environment:
      - MQTT_URL=mqtt://emqx:1883
      - POND_ID=3
    restart: on-failure
    networks:
      - waternet
```

Then apply the change:

```bash
docker compose down
docker compose up --build
```

The `simulator` image and source folder (`services/simulator/`) can stay — removing from `docker-compose.yml` is enough.

### 7.4 Partial replacement (some real, some simulated)

If you only have hardware for one or two ponds but still want to see data for the others, keep the simulators for the ponds without real devices and stop only the ones being replaced.

**Example — real device on pond 1, simulators on ponds 2 and 3:**

```bash
docker compose stop simulator   # stop fake pond 1
# simulator-2 and simulator-3 keep running
```

Your hardware publishes to `pond/1/sensor`, the simulators continue publishing to `pond/2/sensor` and `pond/3/sensor`. All three ponds remain visible on the dashboard.

### 7.5 Verify the transition

After stopping a simulator and connecting your hardware, confirm the real data is coming through:

```bash
# Watch the worker processing your hardware's messages
docker compose logs -f worker
```

You should see lines like:

```
[pond 1] Received: temp=28.5 do=5.2 ph=7.1
[pond 1] Saved to database
```

Then open http://localhost:3000 — the chart should show your real sensor readings updating live.

---

## 8. API Reference

If you need to push data or read data from outside Docker (e.g., from a separate backend service), the dashboard exposes REST endpoints on port `3000`.

### GET `/api/data?pondId={id}`

Returns the last 20 sensor readings for a pond.

```bash
curl http://localhost:3000/api/data?pondId=1
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "pond_id": 1,
      "temperature": 28.5,
      "do_level": 5.2,
      "ph_level": 7.1,
      "created_at": "2026-06-10T08:30:00.000Z"
    }
  ]
}
```

### GET `/api/ponds`

Returns the latest reading and status for all ponds.

```bash
curl http://localhost:3000/api/ponds
```

**Status logic:**

| Condition | Status |
|-----------|--------|
| DO < 3 mg/L OR pH < 6.0 | `kritis` (critical) |
| DO < 4 mg/L OR pH < 6.5 | `peringatan` (warning) |
| Otherwise | `normal` |

### POST `/api/control`

Manually trigger lime control from your code.

```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"pondId": 1, "lime": "ON"}'
```

**Body:**

```json
{
  "pondId": 1,
  "lime": "ON"
}
```

### POST `/api/journal`

Add a journal entry for a pond (feeding, liming events, etc.).

```bash
curl -X POST http://localhost:3000/api/journal \
  -H "Content-Type: application/json" \
  -d '{"pondId": 1, "entryType": "pakan", "content": "Fed 2kg pellets"}'
```

**Entry types:** `pakan` (feeding), `pengapuran` (liming), `sampling`, `catatan` (notes)

---

## 9. Database Schema

The database is auto-created on first `docker compose up`. You can connect to it directly using DBeaver or psql:

```
Host:     localhost
Port:     5432
Database: waterdb
Username: user
Password: password
```

### `sensor_data`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `pond_id` | INTEGER | Pond identifier |
| `temperature` | REAL | Water temperature (°C) |
| `do_level` | REAL | Dissolved oxygen (mg/L) |
| `ph_level` | REAL | pH value |
| `created_at` | TIMESTAMP | Record time (UTC) |

### `control_log`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `pond_id` | INTEGER | Pond identifier |
| `action` | VARCHAR(20) | `LIME_ON` or `LIME_OFF` |
| `source` | VARCHAR(20) | `system` (auto) or `manual` (dashboard) |
| `created_at` | TIMESTAMP | Record time (UTC) |

### `pond_journal`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Auto-increment ID |
| `pond_id` | INTEGER | Pond identifier |
| `entry_type` | VARCHAR(20) | `pakan`, `pengapuran`, `sampling`, `catatan` |
| `content` | TEXT | Journal text |
| `created_at` | TIMESTAMP | Record time (UTC) |

---

## 10. Verifying Your Integration

### Step 1 — Confirm services are running

```bash
docker compose ps
```

All services should show `Up` or `healthy`.

### Step 2 — Test MQTT with MQTTX (desktop app)

1. Open MQTTX → New Connection
2. Host: `localhost`, Port: `1883`
3. Click **Connect**
4. Subscribe to `pond/+/sensor` to watch incoming sensor data
5. Publish a test message:
   - Topic: `pond/1/sensor`
   - Payload: `{"temperature": 28.5, "do": 5.2, "ph": 7.1}`
6. You should see the data appear on the dashboard at http://localhost:3000

### Step 3 — Check the database

```bash
docker compose exec postgres psql -U user -d waterdb -c "SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 5;"
```

You should see rows being inserted every few seconds.

### Step 4 — Open the dashboard

Go to http://localhost:3000 and check that:
- Charts update with new data
- The live indicator shows "Connected"
- Status badges change correctly when pH or DO drops

### Step 5 — Test control commands

On the Pond Detail page, click **Lime ON** and check:
- The EMQX dashboard at http://localhost:18083 shows a message published to `pond/1/control`
- The worker logs show the action: `docker compose logs -f worker`

---

## 11. Troubleshooting

### "Cannot connect to MQTT broker" from hardware

- Make sure Docker is running and you ran `docker compose up`
- Check that port `1883` is not blocked by your firewall:
  ```bash
  # Windows — allow inbound port 1883
  netsh advfirewall firewall add rule name="MQTT" protocol=TCP dir=in localport=1883 action=allow
  ```
- Use the correct IP address — not `localhost` from the hardware side; use your computer's LAN IP

### Dashboard shows no data

- Check worker logs: `docker compose logs worker`
- Verify the MQTT payload is valid JSON with the correct field names (`temperature`, `do`, `ph`)
- Confirm the topic format is exactly `pond/{number}/sensor`

### Database not initializing

- Run `docker compose down -v` (removes volumes) then `docker compose up --build` to start fresh
- **Warning:** This deletes all stored data

### Port conflicts

If port `3000`, `1883`, or `5432` is already in use on your machine:

Open `docker-compose.yml` and change the left side of the port mapping:

```yaml
ports:
  - "3001:3000"  # Use 3001 on host instead of 3000
```

### Worker keeps restarting

```bash
docker compose logs worker
```

Usually caused by a database connection issue on startup — the worker waits for PostgreSQL to be healthy before starting, but if it still fails, try:

```bash
docker compose restart worker
```

### "No space left on device" in Docker

```bash
docker system prune -f
```

---

## Quick Reference Card

```
# Start everything
docker compose up --build

# Watch logs
docker compose logs -f

# Stop
docker compose down

# Dashboard
http://localhost:3000

# EMQX Admin
http://localhost:18083  (admin / public)

# MQTT Broker
mqtt://localhost:1883

# Database
postgres://user:password@localhost:5432/waterdb

# Test publish (MQTTX or CLI)
Topic:   pond/1/sensor
Payload: {"temperature": 28.5, "do": 5.2, "ph": 7.1}

# Control topic (subscribe on your device)
pond/1/control  →  {"lime": "ON"} or {"lime": "OFF"}
```
