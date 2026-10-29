# LIRA 3-Laptop Hotspot Operations Runbook
**Normative PRD v9.0 + Buttonless QpiAI Edge Addendum**

This runbook guides operators on connecting three distinct physical nodes across a single mobile hotspot or local Wi-Fi router for live judge evaluation.

```
       +-------------------------------------------------------------+
       |                  PORTABLE WI-FI HOTSPOT                     |
       |                SSID: LIRA-DEMO-AP / WPA2                    |
       |                   Subnet: 192.168.137.0/24                  |
       +-------------------------------------------------------------+
                   |                            |                    |
                   v                            v                    v
         [LAPTOP 1: HOST TOWER]      [LAPTOP 2: HARDWARE]     [LAPTOP 3: ANDROID]
         FastAPI (0.0.0.0:8000)      ESP32 DevKit V1 Bridge   Field Driver Client
         Next.js (0.0.0.0:3000)      ILI9341 320x240 Display  Kotlin/React Native
         QpiAI Opt Engine & DB       RC522 RFID Reader        Base URL: Host IP
```

---

## 1. Node Responsibilities

| Node | Physical Hardware | Running Process | Network Role |
| :--- | :--- | :--- | :--- |
| **Laptop 1: Web / Backend** | Windows / Linux / macOS | FastAPI (`:8000`), Next.js (`:3000`), SQLite/Postgres DB, QpiAI Opt engine | Central Gateway & Authoritative State |
| **Laptop 2: Hardware Gateway** | Windows / Linux + USB cable | ESP32 DevKit V1 + ILI9341 SPI Display + RC522 SPI RFID | Edge Cyber-Physical Terminal |
| **Laptop 3: Field Operations** | Android Device / Emulator / Laptop 3 | Driver Mobile App (or Android Dispatcher UI) | Mobile Task Execution & In-Cab Telematics |

---

## 2. Step-by-Step Setup

### Step A: Configure Mobile Hotspot on Laptop 1 (or Mobile Phone)
1. Enable Mobile Hotspot:
   - SSID: `LIRA-DEMO-AP`
   - Password: `lira-super-secret`
2. Connect Laptop 1, Laptop 2, and Laptop 3 to `LIRA-DEMO-AP`.
3. On Laptop 1, open PowerShell and discover your LAN IPv4 address:
   ```powershell
   ipconfig | findstr /i "IPv4"
   # Example output: 192.168.137.101
   ```
   *Record this host IP (e.g., `192.168.137.101`).*

---

### Step B: Launch Central Backend & Control Tower (Laptop 1)
1. **Start FastAPI Backend bound to `0.0.0.0`**:
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   *Verify from another device: `curl http://192.168.137.101:8000/api/v1/health` returns `{"status":"healthy"}`.*

2. **Start Next.js Control Tower bound to `0.0.0.0`**:
   ```powershell
   cd frontend
   npm run dev -- -H 0.0.0.0
   ```
   *Verify browser access on Laptop 1: `http://localhost:3000` or `http://192.168.137.101:3000`.*

---

### Step C: Configure ESP32 Microcontroller (Laptop 2)
The ESP32 firmware connects directly to the hotspot Wi-Fi and queries Laptop 1's backend.

1. In the ESP32 `config.h` file, set:
   ```c
   #define WIFI_SSID "LIRA-DEMO-AP"
   #define WIFI_PASS "lira-super-secret"
   #define BACKEND_BASE_URL "http://192.168.137.101:8000/api/v1"
   #define DEVICE_ID "ESP32-GATE-01"
   #define HMAC_SECRET "secure_edge_device_hmac_secret_key_gate01"
   ```
2. Flash the firmware via Arduino IDE or PlatformIO:
   - Baud Rate: `115200`
3. Verify ESP32 boot sequence:
   - ILI9341 displays `LIRA RESOURCELOCK` header.
   - Screen prompts: `SCAN RESOURCE RFID TAG`.

---

### Step D: Configure Android Field Client (Laptop 3)
1. In the Android App settings / `.env`:
   ```properties
   BASE_URL=http://192.168.137.101:8000/api/v1
   DEVICE_ID=ESP32-GATE-01
   ```
2. Launch app and log in as `DRV-101`.
3. Verify driver sees assigned Task `TSK-001` and Challenge Code `CHAL-4921`.

---

## 3. End-to-End Live Evaluation Protocol

```
[Driver on Laptop 3]     [Laptop 1: Web Tower]      [Laptop 2: ESP32 + Card]
         |                         |                           |
         |                         |--- 1. Create Work Order ->|
         |                         |    (Generates CHAL-4921)  | (TFT shows PROMPT)
         |                         |                           |
         |                         |                           |--- 2. Physical Tap
         |                         |<-- 3. SCAN_OBSERVED ------|    (TAG_07)
         |                         |    (Work order updated)   |
         |                         |                           | (TFT shows PENDING)
         |                         |--- 4. Human Dispatcher ---|
         |                         |    clicks [CONFIRM]       |
         |                         |    on Web UI              |
         |<-- 5. Gate Released ----|                           | (TFT shows COMMITTED)
```

1. **Dispatcher on Web UI (`http://192.168.137.101:3000/edge`)**:
   - Observes Resource `RES-CHASSIS-40-01` in `INSPECTED_AVAILABLE` status.
   - Creates new work order for Driver `DRV-101`.
   - Web UI assigns `CHAL-4921` and prompts driver.
2. **ESP32 ILI9341 Display**:
   - Automatically polls `GET /api/v1/edge/ESP32-GATE-01/state`.
   - Displays `PROMPT: PRESENT TAG_07`.
3. **Physical Scan at Gate**:
   - Operator taps physical RC522 RFID Card (`TAG_07`).
   - ESP32 posts `POST /api/v1/edge/events` with `{ "event_type": "SCAN_OBSERVED", "tag_ref": "TAG_07" }`.
4. **Website Confirmation (Strict Buttonless Enforcement)**:
   - Web UI changes badge to `TAG OBSERVED / PENDING WEB CONFIRMATION`.
   - Custodian enters authorization challenge `CHAL-4921`.
   - Dispatcher presses **`[CONFIRM CHECKOUT ON WEBSITE]`**.
   - Backend commits transaction atomically (`version` increments, state transitions to `CHECKED_OUT`).
5. **Display & Mobile Sync**:
   - ESP32 TFT updates to: `LEASE COMMITTED - DISPATCH PERMITTED`.
   - Android App displays green gate checkout pass.
   - Audit trail records cryptographic hash across all 3 nodes.

---

## 4. Troubleshooting Network Isolation

- **If curl from Laptop 2/3 fails**:
  - Run Windows Firewall command on Laptop 1:
    ```powershell
    netsh advfirewall firewall add rule name="LIRA Backend 8000" dir=in action=allow protocol=TCP localport=8000
    netsh advfirewall firewall add rule name="LIRA Frontend 3000" dir=in action=allow protocol=TCP localport=3000
    ```
- **If ESP32 shows `WIFI CONNECT FAILED`**:
  - Verify hotspot is set to `2.4 GHz band` (ESP32 does not support 5 GHz Wi-Fi).

---

## 5. 3-Person Integration Checklist & v10 Demo Flow

```
[UNSEEN FREIGHT EMAIL / DOCS]
              |
              v
[LAPTOP 1: EVIDENCE ASSISTANT RAG] ---> Verified quote-span grounding (ICEGATE OoC / e-DO 16:30 cutoff)
              |
              v
[LAPTOP 1: LIVE RISK ENGINE] ---------> OpenWeather monsoon rain + Google Routes NH-348 (+30m congestion)
              |
              v
[LAPTOP 1: QPIAI INVESTIGATION DIR] --> Solves action selection QUBO (K=2) -> Prioritizes Physical Chassis Check
              |
              v
[LAPTOP 2: ESP32 TFT TERMINAL] -------> Displays: "QPIAI REQUEST: VERIFY CHASSIS #01 (PRESENT TAG_07)"
              |
              v (Physical RC522 tap)
[LAPTOP 2: SCAN OBSERVED] ------------> ESP32 posts SCAN_OBSERVED; display shows: "PENDING WEB CONFIRMATION"
              |
              v
[LAPTOP 1: WEB CONTROL TOWER] --------> Dispatcher enters CHAL-4921 & clicks [CONFIRM CHECKOUT ON WEBSITE]
              |                         Atomic version lock commits lease -> resource transitions to CHECKED_OUT
              v
[LAPTOP 1: MANAGER APPROVAL] ---------> Operations manager approves validated recovery plan
              |
              v
[LAPTOP 3: ANDROID DRIVER APP] -------> Driver DRV-101 syncs approved plan version 2 with green gate pass
```

### Team Integration Role Checklist
- [x] **Friend 1 (Hardware / ESP32 Owner):**
  - Connects to hotspot `LIRA-DEMO-AP`.
  - ESP32 boots with display-only firmware; polls `GET /api/v1/edge/ESP32-GATE-01/state`.
  - Holds physical RC522 RFID Card (`TAG_07`).
  - Observes screen prompt: `QPIAI REQUEST / VERIFY TOKEN TAG_07`.
  - Taps physical card to trigger `SCAN_OBSERVED`.

- [x] **Friend 2 (Web / Backend / QpiAI Owner):**
  - Runs FastAPI on `0.0.0.0:8000` and Next.js on `0.0.0.0:3000`.
  - Queries Evidence Assistant RAG at `/incidents/INC-C102` to prove zero-hallucination document citations.
  - Monitors live weather and highway corridor risk strip.
  - Executes QpiAI Investigation Director to prioritize verification actions before 15:45 cutoff.
  - Clicks `[CONFIRM CHECKOUT ON WEBSITE]` with challenge `CHAL-4921` to commit chassis checkout atomically.

- [x] **Friend 3 (Android / Field Driver Owner):**
  - Configures app with `BASE_URL=http://<host-ip>:8000/api/v1`.
  - Logs in as Driver `DRV-101` and retrieves active task `TSK-001`.
  - Observes real-time plan status updating to `APPROVED` once web custodian commits transaction.


