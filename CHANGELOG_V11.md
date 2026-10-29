# CHANGELOG V11.0 — LIRA-Q SENTINEL
**Quant-A-Maze 3.0 Track IV GENAI-01: Freight Exception Resolution Before Demurrage and Delivery Penalties**
*Release Date: 2026-10-29*

---

## 1. RETAIN
- **Unified Canonical State Architecture**: Authoritative FastAPI backend with SQLite/PostgreSQL single source of truth; Supabase Auth handling JWT bearer authentication.
- **Buttonless Cyber-Physical Edge Contract**: ESP32 DevKit V1 + ILI9341 320x240 LCD (display-only) + RC522 SPI RFID reader. Mutual-exclusion `ResourceLock` requiring web custodian authorization.
- **Genuine QpiAI Opt & QCloud Integration**: Higher-Order Unconstrained Binary Optimization (HUBO degree 3) and QAOA statevector/cloud Hamiltonian circuit execution with genuine SDK client integration (`qpiai_quantum`, `qpiai_opt`).
- **Deterministic Tariffs & Zero Fake Legal Waivers**: FMC 46 CFR § 541.6 and JNPA Scale of Rates Clause 3.2.4 strictly modeled as non-discretionary tariffs; no universal guaranteed waivers or manufactured ₹45,000 savings.
- **Document RAG & Unicode Quote-Span Grounding**: Ingest pipeline extracting exact Unicode character offsets with prompt-injection defense treating doc contents as inert untrusted data.
- **Field Driver Sync**: Authoritative mobile task dispatch contract for `com.lira.field` Android client.

---

## 2. CHANGED
- **Freight Exception Cases C1–C6 Exposed via API & UI**:
  - Implemented `backend/app/routers/cases.py` exposing `GET /api/v1/cases`, `GET /api/v1/cases/{case_id}`, and `POST /api/v1/cases/{case_id}/recalculate`.
  - Added interactive 6-step **CaseExplorer** component (`frontend/components/CaseExplorer.tsx`) embedded within Recovery Studio (`frontend/app/recoveries/page.tsx`):
    1. Fragmented source artifacts with exact Unicode quote spans and authority tier.
    2. Reconciled blocker DAG with customs vs TOS authority separation.
    3. Responsible owner countdown SLA with actionable verification task.
    4. Eligible truck-slot-chassis candidate bundles with QpiAI trace.
    5. Tariff basis & cost waterfall with interactive sliders for delay minutes and rate multipliers in `LAB_FIXTURE` mode.
    6. Mutual-exclusion ResourceLock commitment and Android consequence dispatch.
- **AI Calling Agent (Bolna AI Integration)**:
  - Enhanced `backend/app/services/calling/bolna_adapter.py` with real liveliness check `check_bolna_agent_health()` querying `https://api.bolna.dev/agent/{BOLNA_AGENT_ID}`.
  - Exposes agent health status `READY | NOT_CONFIGURED | CALLING | FAILED` across `/api/v1/calls/health` and `/api/v1/health`.
  - Authorized outbound calling with PII phone masking (e.g. `+91-982***420`), explicit consent references, purpose-specific questions, and `T4_UNVERIFIED` trust tier logging.
- **Unified Six QpiAI Capabilities (Q1–Q6)**:
  - Added `backend/app/services/qpiai/decision_modes.py` and router endpoints `/api/v1/qpiai/decision-modes` covering:
    - **Q1**: Investigation Director (Action Selection QUBO).
    - **Q2**: Red-Team Optimizer (Adversarial stress-testing QUBO).
    - **Q3**: QpiAI-Directed ESP32 Inquiry (`EDGE_SCAN_REQUEST` -> `SCAN_OBSERVED` -> ResourceLock).
    - **Q4**: Multi-Container Recovery Exchange (Joint conflict-free multi-box assignment).
    - **Q5**: Rolling Horizon Future-Proofing (Two-stage reserve buffer stochastic optimization).
    - **Q6**: QCloud Reality Experiment (4-qubit XY-QAOA Hamiltonian mapping evaluated on QCloud SDK).
  - Built unified **DecisionModesMatrix** card (`frontend/components/DecisionModesMatrix.tsx`) inside Solver Lab (`frontend/app/opt-lab/page.tsx`).
- **Complete Visual Re-Design — LIRA-Q SENTINEL**:
  - Implemented strict industrial CSS color tokens (`#F3F6FA` / `#FFFFFF` / `#102235` light; `#0B1420` / `#111F2E` / `#EAF3F8` dark) via CSS variables in `frontend/app/globals.css`.
  - Custom geometric line-symbol SVG logo authored for LIRA-Q (`frontend/app/icon.svg`, `frontend/components/LiraLogo.tsx`).
  - Single coherent Lucide icon system with `aria-label` across all 6 main sections.
  - Refocused sidebar navigation onto the Six Main Sections: Operations, Evidence & RAG, Recovery Studio, ResourceLock, Solver Lab, and Audit & Health.
- **Expanded Test Coverage**:
  - Added `backend/tests/test_v11_cases_calling_decision_modes.py` bringing total passing unit tests to **26/26**.

---

## 3. REMOVED
- **Removed 3D Port Animations**: Deprecated and unmounted `PortDigitalTwin3D` from `frontend/app/page.tsx` in favor of dense real-time telematics and incident feed.
- **Removed Touch & Biometric References**: Eliminated any legacy mention of XPT2046 touch pressure biometrics, 4 physical buttons, or ultrasonic truck presence sensors; replaced with buttonless display-only + RC522 RFID reader.
- **Removed Fake Waivers & Fixed Claims**: Removed any automatic 100% legal waiver claims, hardcoded ₹45,000 savings claims, or phantom carrier status feeds.
- **Removed Standalone Redundant Screens**: Integrated Bolna calling inside Evidence & Operations, and Decision Modes inside Solver Lab.

---

## 4. NOT_DONE (Intentional Non-Scope)
- **Automatic Carrier Slot Swapping**: By design, LIRA does not automatically trade third-party appointments without carrier consent.
- **Voice Statement as Statutory Clearance**: In compliance with maritime law, voice statements remain `T4_UNVERIFIED` until operator or customs clearance is officially attested.
- **Quantum Advantage Claims**: Kept scientific honesty regarding QCloud reality experiment latency vs classical exact branch-and-bound.

