# ◈ Aetheris: Offline-First Emergency Mesh & Disaster Intelligence System

[![Python Tests](https://img.shields.io/badge/Python%20Tests-33%20Passed-brightgreen)](backend/tests/)
[![TypeScript Tests](https://img.shields.io/badge/TypeScript%20Tests-9%20Passed-blue)](tests/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v2.0.0-009688)](backend/app/main.py)
[![Next.js](https://img.shields.io/badge/Next.js-v14.2-black)](dashboard/)
[![Security / Limitations](https://img.shields.io/badge/Security-LIMITATIONS.md-orange)](LIMITATIONS.md)

> **Aetheris** is an offline-first emergency mesh communication and disaster intelligence platform. When cellular towers collapse, power grids fail, or victims are trapped behind concrete rubble, Aetheris establishes phone-to-phone binary mesh relays to geolocate victims and route survival telemetry to emergency rescue teams.

---

## 🏛️ System Architecture

Aetheris utilizes a 4-layer modular mesh architecture, supporting both physical Bluetooth Low Energy (BLE) hardware radios on mobile devices and an emulated local LAN mesh for browser command demonstrations:

```mermaid
graph TD
    subgraph PhysicalBLE["Physical BLE Path (Native Mobile - React Native / Expo)"]
        A1["Victim Device (App.tsx)"] -->|BLE Advertising 0x00E0| B1["BLE Peripheral / Central GATT"]
        B1 -->|Radio Penetration +4dBm| C1["Intermediate Relay Node"]
        C1 -->|Serial / LAN Bridge| L["FastAPI Routing Engine (Port 8000)"]
    end

    subgraph SimulatedLAN["Simulated LAN Path (Browser Demo & Web EOC)"]
        A2["Mobile Helper Web UI (/mobile)"] -->|POST /api/sos (Proxy)| B2["Next.js API Gateway (Port 3000)"]
        B2 -->|Canonical REST Ingest| L
    end

    subgraph Layer3["Layer 3: Core Routing Intelligence (Single Source of Truth)"]
        L --> H["Poincaré Disk Hyperbolic Routing: r_disk = tanh(rho / 2), R=200m"]
        L --> I["ACO Scoring: Normalized [0, 1], lambda=0.005s^-1"]
        L --> D["60s Sliding-Window Dedup & 16-Bit Serial Wraparound"]
        L --> R["Ingest Rate Limiter per sender_hash (Max 10 / 5s)"]
        H -->|Cold-Start Path Selection| S["Next-Hop Selection & State Persistence"]
        I -->|Learned Pheromone Path| S
    end

    subgraph Layer4["Layer 4: Emergency Operations Center (Web EOC)"]
        S --> M["Next.js Web EOC Dashboard (SIMULATION MODE & BLE/LAN-sim Badges)"]
    end
```

---

## 📦 18-Byte Binary Packet Wire Layout

Every emergency beacon is serialized into a compact 18-byte big-endian binary struct designed to fit within standard 2.4 GHz BLE manufacturer advertisement frames (`0x00E0`):

| Offset (Bytes) | Field Name | Data Type | Encoding Details |
| :--- | :--- | :--- | :--- |
| `0 - 1` | Packet Sequence ID | `Uint16` | Big-endian sequence counter (`0` to `65535`) |
| `2` | Priority Level | `Uint8` | `0`=Routine, `1`=Medium, `2`=High, `3`=Critical SOS |
| `3 - 6` | Scaled Latitude | `Int32` | $\text{Latitude} \times 10^6$ (Big-endian signed integer) |
| `7 - 10` | Scaled Longitude | `Int32` | $\text{Longitude} \times 10^6$ (Big-endian signed integer) |
| `11` | Battery Percentage | `Uint8` | `0` to `100` percent battery remaining |
| `12` | Hop Count | `Uint8` | Incremented at each relay hop (`0` at origin) |
| `13 - 14` | Sender Identity Hash | `Uint16` | 32-bit FNV-1a hash truncated to 16 bits (`hash32 & 0xFFFF`) |
| `15` | Time-to-Live (TTL) | `Uint8` | Decremented at each relay hop; dropped when $\le 0$ |
| `16 - 17` | Fletcher-16 Checksum | `Uint16` | Big-endian CRC computed over bytes `0..15`; recomputed at relays |

---

## 🚀 Local Development & Execution

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **Package Managers**: `npm` and `python -m pip`

### Step 1: Clone Repository & Configure Environment
```bash
git clone https://github.com/your-username/aetheris.git
cd aetheris

# Copy environment configuration
cp .env.example .env
```

### Step 2: Install Dependencies
```bash
# Install root & dashboard JavaScript dependencies
npm install
cd dashboard && npm install && cd ..

# Install Python backend dependencies
python -m pip install -r backend/requirements.txt
```

### Step 3: Run the Services

**Terminal 1 — FastAPI Backend (Port 8000):**
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Next.js Command Dashboard (Port 3000):**
```bash
cd dashboard
npm run dev
# Or for production server: npm run build && npm run start
```

**Terminal 3 (Optional) — Mobile Expo Bundler (Port 8081):**
```bash
npx expo start
```

### Step 4: Run Automated Tests
```bash
# Run all Python backend unit tests (33 tests covering routing, dedup, rate limiting, and packet formats)
python -m unittest discover backend/tests

# Run all TypeScript protocol & rate limiting tests
node tests/test_binary_packet.test.mjs
node tests/test_dedup.test.mjs
node tests/test_rate_limiter.test.mjs

# Run the full Room 222 end-to-end integration flow
node tests/test_e2e_flow.mjs
```

---

## ☁️ Deployment Guide

### Deploying FastAPI Backend (Render / Railway / Heroku)

1. **Render Blueprint (`render.yaml`)**:
   - Connect your GitHub repository to [Render](https://render.com).
   - Select **New Blueprint Instance** and link your repo. Render automatically parses [render.yaml](render.yaml).
   - Alternatively, create a **Web Service**:
     - **Runtime**: `Python 3`
     - **Build Command**: `pip install -r backend/requirements.txt`
     - **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
     - **Environment Variables**:
       - `ALLOWED_ORIGINS`: `https://your-dashboard.vercel.app` (or `*` during development)
       - `AETHERIS_RATE_LIMIT_MAX_PACKETS`: `10`
       - `AETHERIS_RATE_LIMIT_WINDOW_SECS`: `5.0`

### Deploying Next.js Dashboard (Vercel)

1. Import the repository into [Vercel](https://vercel.com).
2. Configure project settings:
   - **Root Directory**: `dashboard` (or leave root with the included [vercel.json](vercel.json))
   - **Framework Preset**: `Next.js`
   - **Environment Variables**:
     - `NEXT_PUBLIC_API_URL`: `https://your-backend-app.onrender.com`
3. Click **Deploy**. Vercel will build and serve the production static & serverless assets.

---

## 🎬 "Room 222" Disaster Scenario Demo Walkthrough

The "Room 222" scenario demonstrates locating and rescuing a trapped victim when physical walls block direct line-of-sight communication:

```
[ Room 222 (Victim) ] ──(Concrete Wall Blocked)──x  [ Room 422 (Command Center) ]
         │                                                      ▲
         └──► [ Room 322 (Relay Node) ] ────────────────────────┘
```

1. **Open Mobile Simulation**:
   - Open [http://localhost:3000/mobile](http://localhost:3000/mobile) in your browser.
   - Note the header label: **`Transport: Simulated mesh over LAN (WebSocket/HTTP)`**.
   - Select the preset **`Room 222 - Victim (Wall Blocked)`**.
2. **Trigger Emergency SOS**:
   - Click the red pulsating **`TRANSMIT SOS`** button.
   - Scroll to the bottom and inspect the live **18-Byte Binary Packet Hex Dump** (36 hex characters) with verified Fletcher-16 CRC.
3. **Inspect Web Command Center**:
   - Navigate to [http://localhost:3000/](http://localhost:3000/).
   - Observe the amber **`SIMULATION MODE`** badge.
   - The **Continuous 360° Radar Scanner** flashes red with audio alerts.
   - The **Bento Triage Feed** populates with the Room 222 ticket, displaying **`Transport: LAN-sim`**, GPS coordinates, and the multi-hop trace:
     $$\text{Room 222 - Victim} \longrightarrow \text{Room 322 - Mesh Relay} \longrightarrow \text{Room 422 - Command Sink}$$
   - The **Poincaré Canvas** plots the victim's hyperbolic coordinates.
4. **Dispatch Rescue Team**:
   - Click **`DISPATCH RESCUE TEAM`** on the triage card.
   - The status updates to **`DISPATCHED`**, and an ACK directive reinforces the edge in the ACO pheromone matrix.
5. **Resolve Emergency**:
   - Return to `/mobile` and click **`CANCEL SOS`**.
   - Refresh or observe the dashboard feed instantly reset to **Clean Standby Mode** (0 active tickets).

---

## ⚠️ Known Limitations & Security Assumptions

For a detailed analysis of protocol vulnerabilities, physical RF boundaries, and cryptographic assumptions, review:

👉 **[LIMITATIONS.md](LIMITATIONS.md)**

Key points covered:
- **Checksum vs. Authentication**: Fletcher-16 detects transmission errors but provides no cryptographic resistance against spoofing.
- **Hash Collisions**: 16-bit FNV-1a truncation reaches a 50% collision probability at $\sim 300$ active nodes (Birthday Paradox). Suitable for single buildings, not municipal scale.
- **Physical BLE Constraints**: Severe RF attenuation (12–25 dB per concrete floor/wall) limits indoor single-hop range to 3–10 meters.
- **iOS Background Advertising**: iOS CoreBluetooth strips custom manufacturer data (`0x00E0`) when backgrounded.
- **Zero-Trust Roadmap**: Migration path to 24-byte frames featuring truncated HMAC-SHA256 and Ed25519 gateway signatures.

---

## 📄 License
This project is open-source under the MIT License.
