# LIRA — Security & Credentials Architecture

## 1. Zero-Trust API Secrets Policy

**Rule 1: Private Provider Secrets Reside ONLY in `backend/.env`**
- `GEMINI_API_KEY`: Server-side extraction adapter (`app/services/evidence/extract.py`).
- `QPIAI_OPT_API_KEY`: Server-side global QUBO solver (`app/services/qpiai/opt_adapter.py`).
- `QPIAI_QCLOUD_API_KEY`: Server-side QAOA circuit execution (`app/services/qpiai/qcloud_adapter.py`).
- `BOLNA_API_KEY`: Server-side conversational voice calling (`app/services/calling/bolna_adapter.py`).
- `SARVAM_API_KEY`: Server-side Indic speech translation (`app/services/calling/sarvam_adapter.py`).

**Rule 2: Zero Private Secrets on Frontend Clients, Android, or Firmware**
- The Next.js web application (`frontend/`) contains **ONLY public endpoints** (`NEXT_PUBLIC_API_BASE_URL`).
- The Android driver application consumes authenticated `/api/v1/driver/*` APIs and has zero access to provider keys.
- ESP32 hardware carries only its own isolated device key for HMAC event signing.

---

## 2. Hardware HMAC-SHA256 Authentication

Each edge device (e.g. `LIRA-EDGE-01`) possesses a distinct pre-shared key (`EDGE_HMAC_KEY_EDGE_01`).
When submitting sensor scans or staging observations:
1. ESP32 builds canonical string: `device_id|event_type|observed_at|sequence|assignment_id`
2. ESP32 computes HMAC-SHA256 hex digest using its device key.
3. Server verifies signature in constant time using `hmac.compare_digest` to prevent timing attacks.
4. Monotonic sequence counter rejects replayed packets.

