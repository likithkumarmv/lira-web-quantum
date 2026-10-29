# LIRA — Cross-Team `/api/v1` API Contract

Canonical contract between:
- **Friend 1:** Android Driver App (Kotlin + Jetpack Compose)
- **Friend 2 (Web & Backend):** Next.js Operations Dashboard + Central FastAPI Server
- **Project Owner:** ESP32 Hardware + 320x240 SPI TFT Staging Checkpoint

Base URL: `http://<SERVER_IP>:8000/api/v1`  
OpenAPI Documentation: `http://<SERVER_IP>:8000/docs`

---

## 1. Authentication & Health

### `GET /api/v1/health`
Returns system health, feature mode, and contract version.
```json
{
  "status": "ok",
  "mode": "DEMO",
  "version": "v5"
}
```

### `POST /api/v1/auth/demo-login`
Demo authentication endpoint for mobile driver and web dispatcher sessions.
- **Request:**
  ```json
  {"user_code": "DRIVER_T07"}
  ```
- **Response:**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 3600,
    "role": "DRIVER",
    "display_name": "Driver T07",
    "truck_id": "T07"
  }
  ```

---

## 2. Driver Mobile Endpoints (Friend 1 Android)

### `GET /api/v1/driver/assignments`
Returns active assigned jobs for the authenticated driver's truck.
```json
{
  "items": [{
    "assignment_id": "ASN-102-R2",
    "plan_id": "PLAN-R2",
    "container_id": "C102",
    "truck_id": "T07",
    "slot_id": "S1600",
    "slot_start": "2026-10-28T16:00:00+05:30",
    "slot_end": "2026-10-28T16:30:00+05:30",
    "checkpoint_id": "LIRA-EDGE-01",
    "status": "APPROVED",
    "driver_ack_state": "PENDING",
    "physical_state": "EXPECTED",
    "reason_code": "T04_ETA_CONFLICT",
    "reason_text": "Original driver cannot reach the confirmed slot",
    "customs_release": "CONFIRMED",
    "deadline": "2026-10-28T18:30:00+05:30",
    "projected_avoidable_cost_inr": 12000,
    "evidence_ids": ["EV-DOC-102", "EV-CALL-04"],
    "updated_at": "2026-10-28T15:30:00+05:30"
  }],
  "updated_at": "2026-10-28T15:30:00+05:30"
}
```

### `POST /api/v1/driver/assignments/{assignment_id}/ack`
Driver acknowledgment or cannot-comply signal.
- **Request:**
  ```json
  {"action": "ACKNOWLEDGE", "reason": null}
  ```
  *(or `{"action": "CANNOT_COMPLY", "reason": "TRUCK_BREAKDOWN"}`)*
- **Response:**
  ```json
  {
    "accepted": true,
    "assignment_id": "ASN-102-R2",
    "driver_ack_state": "ACKNOWLEDGED",
    "event_id": "EVT-120"
  }
  ```

### `POST /api/v1/driver/eta`
Driver live ETA self-report.
- **Request:**
  ```json
  {
    "truck_id": "T07",
    "eta": "2026-10-28T16:45:00+05:30",
    "reason": "TRAFFIC",
    "source": "DRIVER_SELF_REPORT"
  }
  ```
- **Response:**
  ```json
  {
    "accepted": true,
    "event_id": "EVT-121",
    "recovery_status": "QUEUED"
  }
  ```

### `GET /api/v1/driver/events?after=0`
Monotonically sequenced event stream for offline reconnection and live updates.
```json
{
  "items": [{
    "event_id": "EVT-122",
    "sequence": 122,
    "type": "PLAN_REPLACED",
    "assignment_id": "ASN-102-R2",
    "created_at": "2026-10-28T15:32:00+05:30",
    "payload": {
      "previous_plan_id": "PLAN-R1",
      "new_plan_id": "PLAN-R2",
      "reason": "PHYSICAL_NO_SHOW"
    }
  }],
  "next_sequence": 122
}
```

---

## 3. ESP32 Hardware Checkpoint Contract (Project Owner)

### `POST /api/v1/edge/events`
HMAC-SHA256 authenticated event ingestion from ESP32 staging gate.
- **Canonical String:** `device_id|event_type|observed_at|sequence|assignment_id`
- **Request:**
  ```json
  {
    "device_id": "LIRA-EDGE-01",
    "event_type": "PHYSICAL_NO_SHOW",
    "assignment_id": "ASN-102-R2",
    "container_id": "C102",
    "truck_id": "T07",
    "rfid_token": "TAG_07",
    "rfid_match": true,
    "bay_present": false,
    "observed_at": "2026-10-28T16:04:12+05:30",
    "sequence": 184,
    "signature": "c8f921a..."
  }
  ```

### `GET /api/v1/edge/{device_id}/state`
Ultra-compact payload for the 320x240 SPI TFT display:
```json
{
  "device_id": "LIRA-EDGE-01",
  "online": true,
  "assignment_id": "ASN-102-R2",
  "container_id": "C102",
  "truck_id": "T07",
  "slot_start": "2026-10-28T16:00:00+05:30",
  "free_time_deadline": "2026-10-28T18:30:00+05:30",
  "approval_state": "APPROVED",
  "customs_release": "CONFIRMED",
  "physical_state": "EXPECTED",
  "risk_label": "HIGH",
  "risk_reason": "HEAVY_RAIN_FORECAST",
  "qpiai_state": "PLAN_APPROVED",
  "run_id_suffix": "Q-4021",
  "last_event_at": "2026-10-28T15:32:00+05:30"
}
```

