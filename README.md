# AquaMonitor — Intelligent Water Management for Fish Farming

Fish die silently. Oxygen levels drop in the middle of the night, temperatures shift during monsoon season, and by the time a farmer notices something is wrong, it's already too late. In Indonesia alone, aquaculture losses from poor water quality cost farmers millions annually — and most of these losses are preventable.

AquaMonitor is a monitoring and automation system that watches dissolved oxygen (DO) and temperature in fish ponds around the clock. When conditions deteriorate, it acts — activating aerators automatically and alerting farmers before fish start dying. It also uses AI to read sensor trends and provide plain-language recommendations, so farmers don't need to interpret raw numbers themselves.

The entire system runs from a single command: `docker compose up --build`.

---

## Why This Matters

Most small-scale fish farmers rely on manual observation. They check their ponds a few times a day, maybe test the water once a week. But water quality can change in minutes — a sudden algae bloom, a cloudy afternoon that reduces photosynthesis, or a hot night that spikes oxygen demand.

Existing solutions either cost too much (commercial monitoring rigs run thousands of dollars), require stable internet (which rural ponds rarely have), or produce data that's hard to interpret without technical training.

AquaMonitor is built for these constraints. It's designed around the reality that many aquaculture operations are in remote areas, on tight budgets, with unreliable connectivity. The system uses MQTT — a lightweight protocol originally built for oil pipeline monitoring over satellite links — specifically because it handles intermittent connections gracefully. And the dashboard is simple enough that you don't need to understand what "dissolved oxygen saturation percentage" means to know your fish are in trouble.

---

## Who It's For

This system is aimed at small to mid-scale fish farmers — the kind of operations running a handful of ponds, maybe a couple of hectares of water. People who can't afford a full-time water quality technician but can't afford to lose a harvest either.

It's also relevant for aquaculture cooperatives, agricultural extension programs, and university research groups studying pond ecosystems. Anyone who needs reliable, continuous water monitoring without enterprise pricing.

---

## Where and When It Operates

AquaMonitor is built for outdoor pond environments. The kind of places where you'd find catfish, tilapia, or shrimp farming — often in rural areas with inconsistent power and spotty cell coverage.

The system runs continuously. It collects sensor readings every 5 seconds, which matters because critical events (oxygen crashes, thermal stratification) can develop rapidly. The automation logic doesn't depend on a human being awake or nearby — if DO drops below 3 mg/L at 3 AM, the aerator kicks on regardless.

---

## How It Works

The data pipeline is straightforward, and that's intentional. Fewer moving parts means fewer things that break at 2 AM.

```
IoT Sensor → MQTT Broker → Worker → PostgreSQL → Dashboard
                                                  ↕
                                              Gemini AI
```

**1. Sensor devices** sit at the pond and measure temperature and dissolved oxygen. In this prototype, a simulator generates realistic data with occasional DO drops to mimic real-world stress events — about 20% of readings simulate low-oxygen conditions.

**2. MQTT broker (EMQX)** receives sensor data over structured topics like `pond/1/sensor`. MQTT was chosen over HTTP because it's built for unreliable networks — messages can queue when connectivity drops and deliver when it returns. The QoS guarantees matter when you're running on a 3G modem in a rice field.

**3. Worker service** subscribes to all pond sensor topics, parses incoming data, and writes it to PostgreSQL. It also runs the first layer of automation: if dissolved oxygen drops below 3 mg/L, it immediately publishes an aerator-ON command back through MQTT. No API call, no dashboard involvement — the decision happens at the edge of the pipeline.

**4. PostgreSQL** stores every sensor reading and every control action. Nothing fancy here — two tables, clean schemas, parameterized queries. The database runs an init script automatically on first boot so there's zero manual setup.

**5. Next.js dashboard** pulls the latest 20 readings every 5 seconds and renders them as interactive line charts. Farmers see temperature and DO trending over time, with a clear red reference line at the critical 3.0 mg/L threshold. Status cards show current values at a glance, and manual override buttons let farmers control the aerator directly.

**6. Gemini AI** analyzes the same sensor data and generates plain-language insights every 15 seconds. Instead of telling a farmer "DO is 2.7 mg/L with a negative first-derivative over the trailing window," it says something like: "Oxygen levels are dropping and may become unsafe soon. It is recommended to turn on the aerator to prevent stress on the fish." The AI uses Google's Gemini 2.5 Flash-Lite model, which is available on a free tier — no credit card or billing account needed.

If the Gemini API key isn't configured or the service is temporarily unreachable, the system falls back to rule-based analysis that computes trends locally. The AI is an enhancement, not a dependency.

---

## Key Features

**Real-time monitoring** — Sensor data streams in every 5 seconds. The dashboard auto-refreshes without page reloads, and a live indicator in the header confirms the connection is active.

**Automated aerator control** — When DO drops below 3 mg/L, the worker service publishes a control command through MQTT within the same processing cycle. No human intervention required. This is the feature that saves fish.

**AI-powered insights** — Gemini analyzes the last 20 readings and returns a short recommendation in farmer-friendly language. It detects declining trends before they hit critical levels, giving farmers time to act rather than react.

**Manual override** — Two buttons. Aerator ON, aerator OFF. Sometimes a farmer knows something the sensors don't — maybe they just fed the fish (which increases oxygen demand) or they're about to harvest. Manual control is always available.

**Alert system** — A prominent status panel shifts from green ("System Normal") to red ("Critical Oxygen Level") with a clear explanation of what's happening and what to do about it.

---

## Tech Stack

Every choice here was made for a reason.

| Component | Technology | Why |
|-----------|-----------|-----|
| Dashboard & API | **Next.js 16** (App Router) | Server-side rendering for fast first paint, API routes colocated with the frontend — one deployment instead of two |
| Database | **PostgreSQL 15** | Battle-tested, handles time-series sensor data well enough at this scale, zero configuration with Docker |
| Message broker | **EMQX 5.8** | Production-grade MQTT broker with built-in clustering, dashboard, and health monitoring |
| Worker & Simulator | **Bun + TypeScript** | Fast startup time matters in containers, native TypeScript execution without a build step |
| AI | **Google Gemini 2.5 Flash-Lite** | Free tier with 1,000 requests/day — enough for continuous monitoring without any cost |
| Charts | **Recharts** | Composable React components for the chart, plays well with Next.js and SSR |
| Infrastructure | **Docker Compose** | Single command deployment, consistent environments, no "works on my machine" problems |

The worker and simulator run on Bun for its fast cold-start time — when a container restarts, it's back up in under a second. The web dashboard uses Node.js (via Bun) for Next.js compatibility in production builds.

---

## Getting Started

You need Docker and Docker Compose installed. That's it.

**1. Clone and enter the project:**
```bash
git clone <repository-url>
cd water-management
```

**2. (Optional) Add your Gemini API key:**

Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), then create a `.env` file:

```
GEMINI_API_KEY=your-key-here
```

Without this, the AI insight card will show rule-based analysis instead of Gemini responses. Everything else works fine.

**3. Start the system:**
```bash
docker compose up --build
```

Five containers will start: PostgreSQL, EMQX, the worker, the simulator, and the web dashboard. Health checks ensure services come up in the right order.

**4. Open the dashboard:**

Navigate to [http://localhost:3000](http://localhost:3000). Data should appear within 10 seconds as the simulator begins publishing readings.

**For development with hot-reload:**
```bash
docker compose up --build --watch
```

Changes to source files will sync into running containers automatically.

---

## Demo Walkthrough

If you're presenting this system, here's a good flow to follow:

**Step 1 — Start the system.** Run `docker compose up --build` and open the dashboard. Point out that all five services start from a single command and connect automatically through Docker's internal network.

**Step 2 — Observe normal operation.** The chart will show temperature hovering around 25–32°C and DO fluctuating between 4–8 mg/L. The status panel is green. The AI insight card will report stable conditions. This is the baseline.

**Step 3 — Wait for a DO drop.** The simulator is configured to produce low-DO readings (below 3 mg/L) roughly 20% of the time. Within a minute or two, you'll see DO dip below the red reference line on the chart.

**Step 4 — Observe the automation.** When DO drops below 3, three things happen simultaneously: the alert banner turns red with an explanation, the aerator status card switches to "ON" with a spinning icon, and the worker logs will show the control command being published via MQTT.

**Step 5 — Check the AI insight.** The AI card will update within 15 seconds. Instead of stable conditions, it now warns about declining oxygen and recommends aerator activation. If you're using the Gemini API, the language will be more nuanced; the rule-based fallback is more formulaic but still accurate.

**Step 6 — Demonstrate manual control.** Click "Turn OFF" to override the aerator, then "Turn ON" again. Each command is published through the same MQTT pipeline as the automated controls and logged in the database.

---

## Project Structure

```
water-management/
├── docker-compose.yml          # Orchestrates all 5 services
├── docker/
│   └── init.sql                # PostgreSQL schema (auto-runs on first boot)
├── apps/
│   ├── web/                    # Next.js dashboard + API
│   │   ├── app/
│   │   │   ├── page.tsx        # Main dashboard (charts, cards, controls)
│   │   │   └── api/
│   │   │       ├── data/       # GET — latest 20 sensor readings
│   │   │       ├── control/    # POST — manual aerator commands
│   │   │       └── ai-insight/ # GET — Gemini-powered analysis
│   │   ├── components/         # Reusable UI components
│   │   └── lib/                # DB pool, MQTT client, utilities
│   └── worker/                 # MQTT subscriber + automation logic
│       └── src/index.ts
└── services/
    └── simulator/              # Simulated IoT sensor device
        └── src/index.ts
```

---

## Limitations and Future Improvements

This is a prototype, and it's honest about what it doesn't do yet.

**Current limitations:**

- The IoT device is simulated. Real deployment would require integrating with actual DO and temperature probes (something like an Atlas Scientific sensor kit connected to an ESP32).
- Only one pond is supported in the current UI. The backend already handles multi-pond topics (`pond/+/sensor`), but the dashboard is hardcoded to Pond 1.
- The AI insight refreshes on a timer rather than being triggered by events. A smarter approach would be to generate insights only when conditions change significantly.
- There's no authentication. Any user on the network can access the dashboard and control the aerator.
- Historical data is stored but not yet surfaced — there's no way to look at last week's trends or export data for analysis.

**What comes next:**

- **Multi-pond support** — Selector in the dashboard to switch between ponds, with per-pond alerting and control.
- **Predictive alerts** — Using the AI to forecast DO drops before they happen, based on temperature trends, time of day, and historical patterns.
- **Hardware integration** — A reference design for an ESP32-based sensor node with MQTT publishing, suitable for actual field deployment.
- **Mobile notifications** — Push alerts via LINE or WhatsApp when DO enters the danger zone, for farmers who aren't watching the dashboard.
- **Data export and reporting** — CSV export, daily/weekly summary reports, and longer-term trend visualization.

---

## License

MIT
