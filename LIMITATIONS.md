# ⚠️ Aetheris Mesh: System Limitations & Security Assumptions

This document outlines the known cryptographic, physical, protocol, and platform limitations of the current Aetheris emergency mesh implementation, along with the planned architectural roadmap.

---

## 1. Cryptographic Authentication vs. Transmission Integrity

### Current State: Fletcher-16 Checksum
- **Scope**: The 16-bit Fletcher-16 checksum (`bytes 16-17`) provides **error detection against transmission bit flips** and frame corruption across radio channels.
- **Vulnerability**: Fletcher-16 is **not a cryptographic signature or MAC**. It possesses zero preimage resistance and zero collision resistance against active adversaries.
- **Attack Vector**: Any malicious transmitter or rogue node can forge packets with arbitrary victim identities, fabricated GPS coordinates, or artificial criticality levels, computing the valid Fletcher-16 over bytes 0..15 in microseconds.
- **Operational Reality**: In disaster scenarios, availability and rapid zero-setup relaying take precedence over key negotiation, but the system currently operates under an **open-trust assumption** at the radio PHY layer.

---

## 2. 16-Bit Sender Hash Collision Bounds (Birthday Paradox)

### Current State: 32-bit FNV-1a Truncated to 16 Bits
- **Wire Representation**: Sender identities (e.g. `"Room 222 - Victim"`) are hashed via FNV-1a and truncated to 16 bits (`0x0000` to `0xFFFF`, $2^{16} = 65{,}536$ unique values) to conserve byte space in the 18-byte frame.
- **Collision Probability**: By the Birthday Paradox, the probability of at least one hash collision reaches:
  $$P(\text{collision}) \approx 1 - e^{-\frac{n^2}{2 \times 65536}}$$
  - At $n = 50$ active nodes: $P \approx 1.9\%$
  - At $n = 100$ active nodes: $P \approx 7.4\%$
  - At $n = 302$ active nodes: **$P \approx 50.0\%$**
- **Operational Scope**:
  - **Single Building / Local Facility (Suitable)**: A building collapse or evacuation with 20–100 active devices experiences negligible collision likelihood.
  - **City-Scale / Regional Inundation (Unsuitable)**: At municipal scale (>300 nodes), multiple independent victims will hash to identical 16-bit keys, causing packet deduplication caches to drop valid messages.

---

## 3. Physical BLE RF & Radio Constraints

- **Indoor Propagation & Line-of-Sight**:
  - BLE 2.4 GHz transmissions have an effective indoor free-space range of **10–30 meters**.
  - Solid reinforced concrete, brick elevator shafts, and fire doors attenuate 2.4 GHz RF by **12 to 25 dB per wall**, drastically shortening effective hop distances to 3–8 meters.
- **Channel Congestion & Contention**:
  - BLE advertising operates on three primary channels: 37, 38, and 39.
  - When dozens of nodes simultaneously advertise high-frequency SOS packets, packet collisions at the physical layer rise sharply, causing uncoordinated frame loss.
- **Subnet Bridge Fallback**:
  - Aetheris employs an opportunistic building LAN multicast/UDP fallback bridge (`192.168.0.255`), which relies on surviving local router infrastructure even when WAN access is down.

---

## 4. Operating System Platform Restrictions (iOS & Android)

### iOS Background Advertising Restrictions
- **No Background Manufacturer Data**:
  - CoreBluetooth on iOS **strips all custom manufacturer data (`0x00E0`) and custom service UUIDs** from outgoing BLE advertisements when an application enters the background or the screen locks.
  - An iOS device in the background cannot function as a visible autonomous binary mesh relay without user interaction.
- **Workarounds & Operational Requirements**:
  - In a real emergency, victim and relay devices must keep Aetheris in the foreground (with screen awake / high-brightness emergency mode).
  - Background state restoration (`CBStatePreservation`) and iOS-to-iOS paired peripheral GATT characteristics can be leveraged, but do not support zero-pairing broadcast advertising.

### Android Battery Optimizations (Doze Mode)
- Aggressive OEM battery saving (e.g. Xiaomi, Samsung, Huawei) terminates background BLE scanning after several minutes of screen-off unless the application is explicitly whitelisted from battery optimization.

---

## 5. Security & Protocol Roadmap

To elevate Aetheris from an open-trust emergency prototype to a hardened defense/first-responder protocol, the following upgrades are planned:

```
[ Current Implementation ]              [ Phase 2 Hardened Architecture ]
18-byte Frame + Fletcher-16     ───►    24-byte Frame + Truncated HMAC-SHA256
Open Radio Broadcast                     Pre-Shared Emergency Responder Keys
16-bit FNV-1a Truncation                 Ed25519 Gateway Signatures & Merkle Audit
```

1. **Truncated HMAC-SHA256 (32-Bit Authenticator Tag)**:
   - Expand the binary frame to 22–24 bytes to accommodate a 4-byte (32-bit) HMAC tag computed over the frame headers and payload.
   - First responders and emergency zones distribute a rotating daily zero-trust key (e.g. via QR code at evacuation checkpoints).
2. **Ed25519 Command Center Gateway Signatures**:
   - Responding rescue units and Command EOC sinks authenticate ACK/Dispatch directives using 64-byte Ed25519 digital signatures to prevent malicious route poisoning.
3. **Adaptive Frequency & Backoff Contention (CSMA/CA)**:
   - Implement randomized exponential backoff intervals on packet relaying to prevent broadcast storms when multiple relays hear the same SOS beacon.
4. **Hierarchical Routing Identifiers**:
   - Replace raw truncated FNV-1a with a 24-bit hierarchical prefix (`[Building-8b][Floor-4b][Room-12b]`) to eliminate collision ambiguity in multi-building operations.
