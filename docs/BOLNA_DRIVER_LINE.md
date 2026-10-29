# Bolna Outbound Agent: "LIRA Driver Check" Configuration

## Overview
The **LIRA Driver Check** enables the dispatch manager to place an outbound verification phone call directly to drivers using the official Bolna AI platform (`POST https://api.bolna.ai/call`).

The call is conducted in Hindi or English using **Sarvam Indic STT** and **Sarvam Bulbul TTS**. It verifies whether the driver is on time for their allocated container and slot.
- If the driver answers **ON_TIME**: the pipeline stops immediately at `CLAIM_EXTRACTED` with `"no re-plan needed"`, mathematically proving anti-false-escalation.
- If the driver reports a **DELAYED** or **CANNOT_COMPLY** status: the pipeline ingests the quote as Tier-4 evidence, escalates a causal blocker in the DAG, re-solves optimal allocations via QpiAI Opt HUBO, and queues the validated plan for manager approval.

---

## 1. Outbound Agent Configuration
- **Agent Name**: `LIRA Driver Check (Outbound)`
- **Agent ID**: `7c439d93-81bf-447a-a2a7-cfb3fbc3a57f`
- **Speech-to-Text (STT)**: Sarvam AI (`saaras:v1`) Indic auto-detect
- **Text-to-Speech (TTS)**: Sarvam Bulbul (`bulbul:v1`)
- **API Endpoint**: `POST https://api.bolna.ai/call`
- **Execution Tracking**: Polling `GET https://api.bolna.ai/executions/{id}` until `status == "completed"`
- **Default Language**: `hi-IN` / `en-IN`

---

## 2. Conversational Flow (< 60 Seconds)
1. **Greeting & Context**: Greets as LIRA Terminal Dispatch, states driver's container (e.g. `MSCU6619200`) and target slot (e.g. `14:30 IST`).
2. **Primary Verification**: Asks: *"Are you on time for the 14:30 slot?"*
3. **Branch A (On Time)**:
   - Driver confirms on time.
   - Dispatch confirms: *"Understood, your slot remains reserved. Drive safely."*
   - Execution status completes with `answer: ON_TIME`.
4. **Branch B (Delayed / Exception)**:
   - Driver reports delay.
   - Dispatch asks what happened (breakdown, landslide, puncture), where, and how late.
   - Dispatch confirms back: *"Recorded delay of 45 minutes on NH-348. Recovery team is re-optimizing your appointment."*

---

## 3. Structured Data Extraction Schema
```json
{
  "answer": "ON_TIME | DELAYED | CANNOT_COMPLY",
  "issue_type": "TRUCK_BREAKDOWN | HIGHWAY_LANDSLIDE | NONE",
  "location_text": "NH-348 Panvel-JNPA Expressway",
  "eta_delay_minutes": 45,
  "confidence": 0.96
}
```

---

## 4. Free Fallback: Driver Line (Browser Mic)
- Labelled `VOICE_NOTE_FALLBACK` (never displayed as a phone call).
- Uses standard browser Web Audio API (`navigator.mediaDevices.getUserMedia` + `MediaRecorder`).
- Audio is posted to `/api/v1/demo/voice-note` and transcribed with Sarvam STT.
- The pipeline proceeds from Step 2 with identical verification, extraction, and solver logic.
