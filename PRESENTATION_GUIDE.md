# 🏆 Aetheris Demo & Presentation Guide

Everything is configured and ready for your presentation!

---

### 🚀 1-Click Launch Command

When you open your project terminal, run:

```powershell
powershell -ExecutionPolicy Bypass -File ./start_presentation.ps1
```
*or*
```bash
npm run presentation
```

---

### 🌐 Network Presentation Modes

When prompted (or by passing `-Mode`), choose the mode that fits your presentation environment:

#### Mode 1: LAN / Mobile Hotspot Mode (Recommended for Demos on Same Network)
- **Use when**: Laptop and demo phones are connected to the **SAME Wi-Fi** or presenter's **Mobile Hotspot**.
- **Launch command**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File ./start_presentation.ps1 -Mode LAN
  ```

#### Mode 2: Global Public Tunnel Mode (For Cross-Network / Audience Cellular Data)
- **Use when**: Audience or evaluators are on **Cellular 5G/4G** or a **Different Wi-Fi network**.
- **Launch command**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File ./start_presentation.ps1 -Mode Tunnel
  ```
- Creates public HTTPS and Expo tunnel URLs so anyone anywhere on Earth can scan and open the app!

---

### 📱 How to Open the Mobile App on Any Phone

You have **two options** for mobile live demo:

#### Option A: Mobile Web App (Recommended - Works on ANY Phone instantly)
1. Ensure your phone is connected to the presentation network (or use Tunnel Mode).
2. Scan the **Mobile Web QR Code** printed in your terminal or open `http://<YOUR_LAN_IP>:3000/mobile` / Tunnel URL.
3. No app installation required! Works directly in Safari, Chrome, or default camera app.

#### Option B: Expo Go Native App
1. Open the **Expo Go** app on your phone.
2. Scan the **Expo Go QR Code** printed in your terminal or type `exp://<YOUR_LAN_IP>:8081` / Tunnel URL.

---

### 📌 Live Demo Cheatsheet

#### 1. Web Command Operations Center
- **URL**: [http://localhost:3000](http://localhost:3000) or `http://<YOUR_LAN_IP>:3000`
- **What to show**:
  - **Continuous 360° Live SOS Radar**.
  - **Bento Grid Triage Feed**.
  - **Poincaré Disk Hyperbolic Canvas** and **ACO Pheromone Engine Panel**.

#### 2. Mobile Victim & Helper App
- **What to show**:
  - Select or type a custom sender name (e.g. `Room 222 - Victim (Wall Blocked)`).
  - Tap **TRANSMIT SOS** button.
  - Highlight the instant **< 1 sec emergency sync** onto the Command Center radar.
  - Show the **Multi-Hop Room Path Telemetry**:
    $$\text{Room 222 (Victim)} \rightarrow \text{Room 322 (Relay)} \rightarrow \text{Room 422 (EOC Sink)}$$
  - Tap **CANCEL SOS** to show real-time alert resolution.

#### 3. FastAPI Routing Engine Docs
- **URL**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **What to show**:
  - `POST /api/v1/packets/route`: Demonstrates Hyperbolic metric distance calculation ($d_H$) & ACO pheromone decay ($\tau = \tau_0 \cdot e^{-\lambda t}$).

---

### 🖼️ Saved QR Code Image Files
PNG QR code images are saved in the `scripts/` folder if you want to insert them into presentation slides:
- `scripts/mobile_web_qr.png`
- `scripts/expo_go_qr.png`

Good luck with your presentation! 🚀

