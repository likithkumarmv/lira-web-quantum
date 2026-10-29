# LIRA-Q SENTINEL v13.1 // 7-MINUTE JUDGE DEMO RUNBOOK
**Quant-A-Maze 3.0 · Track IV: Quantum Logistics & Supply Chain Cyber-Physical Resilience**  
**Authors**: LIRA-Q Sentinel Team  
**Architecture**: FastAPI v13.1 + Next.js 14 + QpiAI Opt / QCloud + Gemini 1.5 Flash + Sarvam Indic AI + ESP32 Bay Station (v13.0)

---

## 0. Pre-Flight Verification (< 30 Seconds)
1. Open the **Demo Control Hub** in your browser:  
   `http://localhost:3000/demo`
2. Confirm the **Provider Status Strip** shows green `READY` chips for all 8 providers:
   - `bolna`: READY (bn-590...)
   - `qpiai_opt`: READY (Q1-Q6 HUBO / QUBO Hybrid)
   - `qpiai_qcloud`: READY (QAOA / QCBM Quantum Run)
   - `openweather`: READY (JNPA-Panvel Corridor Telemetry)
   - `google_maps`: READY (Traffic-Aware Routing)
   - `gemini`: READY (1.5 Flash Function-Calling Copilot)
   - `sarvam`: READY (Indic STT / Translation hi-IN)
   - `supabase`: READY (Canonical DB State)
3. If restarting a fresh session, click **"Reset Demo State"** (`POST /api/v1/demo/reset-state`) to clean test blockers and restore baseline `PLAN-R2`.

---

## Minute 1:00 – 2:30 // Feature 1: "Judge, Call the Driver Line"
**Route**: `/demo/live-incident`  
**Pitch / Narrative**:
> *"When disruptions occur on highway corridors, legacy logistics systems rely on manual WhatsApp messages and late spreadsheets. In LIRA-Q, the loop from driver voice call to quantum re-solve and physical hardware update takes seconds."*

### Demo Steps:
1. Click **"Rehearse with Simulated Call"** (or dial the live Bolna agent line).
2. The UI displays the bold `SIMULATED_CALL` provenance tag.
3. Observe the **Vertical 10-Step Progress Timeline** illuminate in real time via Server-Sent Events (SSE):
   - **Step 1**: Outbound conversational call placed to Driver T04.
   - **Step 2**: Sarvam Indic AI transcribes spoken Hindi into English:  
     *“JNPA Nhava Sheva expressway par landslide ho gaya hai... 45 minute late.”*
   - **Step 3**: Tier 4 telephonic quote-span registered into audit log.
   - **Step 4**: Causal Blocker DAG detects NH-348 landslide closure.
   - **Step 5**: High-confidence candidate auto-escalates to blocker graph.
   - **Step 6**: QpiAI Opt HUBO 3-tensor re-solves optimal truck-to-chassis swap.
   - **Step 7**: Feasibility validator verifies all twistlocks & weight limits (PASS, 0 violations).
   - **Step 8 (Human-in-the-Loop Gate)**: Plan pauses at `AWAITING_APPROVAL`.
4. Click **"Approve Plan & Dispatch"**:
   - Dispatch manager authorizes the proposal.
   - **Step 9**: SSE push event dispatched to driver mobile client.
   - **Step 10**: ESP32 Bay Station `/board` contract updates with newly optimized slot sequences.

---

## Minute 2:30 – 4:00 // Feature 2: Quantum Dispatch Copilot
**Route**: `/copilot`  
**Pitch / Narrative**:
> *"Most dispatch LLMs are chatbots that invent fake waiver codes. Our Quantum Copilot is a Gemini 1.5 Flash agent bound to 11 verified mathematical tools. It inspects live terminal tensors, runs shadow QAOA, and proposes plans—without ever having the authority to self-approve."*

### Demo Steps:
1. Click the suggested prompt chip:  
   **"What happens if we swap T09 and T11 slots?"**
2. In the right-hand **Live Agent Tool Traces** column, watch the agent invoke tools in real time:
   - `get_live_state`: fetches active assignments and container demurrage deadlines.
   - `build_recovery_model`: builds the 3-tensor HUBO recovery problem.
   - `qpiai_solve`: invokes QpiAI Opt engine.
   - `validate_plan`: executes mathematical validator.
   - `explain_costs`: returns ₹ avoidable savings diff.
3. Show the **12-Tool Cap Counter** (`4 / 12 Tool Calls Used`).
4. Highlight the **"Manager Review"** button: the Copilot cannot self-approve; only a human manager can promote and execute.

---

## Minute 4:00 – 5:30 // Feature 3: Judge-Controlled Stress Test (Red-Team)
**Route**: `/stress`  
**Pitch / Narrative**:
> *"Let's red-team the terminal. We will inject compound physical disruptions into an isolated memory sandbox and compare industry-standard greedy heuristics against QpiAI Opt HUBO side-by-side."*

### Demo Steps:
1. Click the perturbation buttons:
   - **Monsoon rain +40mm/h**
   - **Chassis R-03 twistlock crack**
2. Compare the side-by-side solver scoreboard:
   - **Classical Greedy**: Fails with 2 hard constraint violations, resulting in ₹ 145,000 avoidable demurrage penalties.
   - **QpiAI Opt HUBO**: PASS (0 violations), saves ₹ 62,500 (43% cost reduction).
3. Point to the **Sandbox Isolation Badge**: live port gate operations are completely insulated from perturbation experiments.
4. (Optional) Click **"Promote Plan to Live"** to graduate the validated sandbox recovery to the dispatch queue.

---

## Minute 5:30 – 6:30 // Feature 4: Quantum vs Classical Race Panel
**Route**: `/race`  
**Pitch / Narrative**:
> *"We make zero ungrounded exponential speed-up claims. Here is the mathematically defensible value of quantum and tensor optimization in logistics."*

### Demo Steps:
1. Review the 4-solver scoreboard:  
   Greedy vs OR-Tools CP-SAT vs QpiAI Opt HUBO vs QAOA with XY-Mixer.
2. Walk through the 3 analytic panels:
   - **Chart A (Formulation Blowup)**: Classical QUBO quadratization introduces $O(N^2)$ auxiliary variables and slack penalty weights. QpiAI Opt evaluates native HUBO tensors directly in polynomial memory.
   - **Chart B (QAOA Mixer Feasibility)**: Standard X-Mixer produces only 18.4% feasible states. The constraint-preserving **XY-Mixer** restricts evolution to the permutation subspace, yielding 94.2% feasibility.
   - **Chart C (Scaling Sweep)**: Point to the `LAB_FIXTURE_GENERATED` sweep cache ($N=4$ to $32$). At $N > 12$ qubits, interactive simulation is responsibly gated.

---

## Minute 6:30 – 7:00 // Feature 5: Tomorrow's Risk & Stochastic Reserve
**Route**: `/forecast`  
**Pitch / Narrative**:
> *"Conventional logistics treats weather delays, accidents, and chassis failures as independent events. Our 8-qubit QCBM models the joint co-occurrence structure, preventing massive demurrage cascades before the storm arrives."*

### Demo Steps:
1. Inspect the **OpenWeather surface strip** (real-time telemetry for JNPA corridor).
2. Click any cell in the **8x8 QCBM Symmetric Heatmap** $P(i \wedge j)$:
   - Compare the **Independent Probability** (6.8%) vs **QCBM Joint Probability** (28.4%).
   - Explain how assuming independence underestimates severe storm cascades by **4.2x**!
3. Look at the **Q5 Stochastic Reserve Recommendation**:
   - Recommends booking 2 standby chassis at Bay 01.
4. Click **"Book Standby Reserve Capacity"**:
   - Generates a verified `RESERVE_STANDBY` assignment.
   - Dispatches SSE `reserve_assigned` event to affected terminal drivers.

---

## Graceful Fallback Guide (If Any Provider Outage Occurs)
- **If Bolna telephony line has carrier lag**: Use the **"Rehearse with Simulated Call"** button on `/demo/live-incident`; it executes the exact same Sarvam and QpiAI pipelines with full fidelity.
- **If QpiAI Opt Cloud network drops**: The local fallback tensor solver automatically engages; all validator outputs remain strictly factual.
- **If OpenWeather API limit reached**: The system automatically serves cached JNPA weather telemetry labelled `ORIGIN: LIVE_EXTERNAL / LAB_FIXTURE`.
- **To reset everything**: Click **"Reset Demo State"** on `/demo`.
