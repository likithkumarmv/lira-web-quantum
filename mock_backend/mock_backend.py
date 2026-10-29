"""
LIRA-Q Sentinel Mock Backend (Contracts C-2, C-3, & C-4)
Standalone lightweight server for ESP32 DevKit V1 (Firmware v13 Exact Protocol)
and Android Field App testing.
Dependencies: fastapi, uvicorn, pillow, python-multipart
"""

import argparse
import asyncio
import hashlib
import hmac
import io
import json
import os
import sys
import time
from typing import Dict, List, Optional, Tuple

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from PIL import Image, ImageDraw, ImageFont

app = FastAPI(
    title="LIRA-Q Sentinel Mock Backend",
    version="v13.0-mock",
    description="Standalone mock server providing C-2 (Android Driver API), C-3 (ESP32 Edge API v13), and C-4 (Interchange) contracts.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration & Keys (Default matches firmware v13 lab key)
DEVICE_KEY = os.getenv("EDGE_HMAC_KEY_EDGE_01", "lira-lab-device-key-change-me-32b")
CURRENT_SITE = "JNPT-BAY-04"
CURRENT_ROLE = "STAGING_BAY"
CURRENT_PLAN_VERSION = 2

# Anti-replay nonce store for hardware HMAC authentication
seen_nonces = set()

# Real hardware RFID cards (tested on ESP32 RC522 reader):
# F7B5FB03 -> Truck Card (T09)
# 32A3FF03 -> Truck Card (T11)
# 15B2FE03 -> Equipment Tag (R-03)
# 7226DA05 -> Equipment Tag (R-07)
# 1D46FB03 -> Container Tag (ONEU5519206)

# In-memory interchange session state
active_session = {
    "session_id": "SES-1029-01",
    "site_id": CURRENT_SITE,
    "truck_id": "T09",
    "truck_tag_ref": "F7B5FB03",
    "equipment_id": "R-03",
    "equipment_tag_ref": "15B2FE03",
    "container_no": "MSCU6619200",
    "state": "NOT_STARTED",
    "challenge_code": "CHAL-447",
    "local_decision": "MATCH_PREVIEW",
    "step1_at": None,
    "step2_at": None,
    "committed_at": None,
    "txn_id": None,
    "eir_no": None,
}


def verify_device_auth_opt(request: Request, body_bytes: bytes = b""):
    """
    Firmware v13 Device Auth Verification:
    If X-LIRA-Device header is present, enforce HMAC-SHA256 signature and nonce freshness.
    If header is absent, permit request for browser/curl exploratory testing.
    """
    device_id = request.headers.get("X-LIRA-Device")
    if not device_id:
        return

    nonce = request.headers.get("X-LIRA-Nonce")
    signature = request.headers.get("X-LIRA-Signature")

    if not nonce or not signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required authentication headers (X-LIRA-Nonce, X-LIRA-Signature)"
        )

    if nonce in seen_nonces:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nonce replayed"
        )

    method = request.method.upper()
    url_path = request.url.path
    body_hash = hashlib.sha256(body_bytes).hexdigest().lower()
    msg = f"{method}\n{url_path}\n{nonce}\n{body_hash}"
    key = DEVICE_KEY.encode("utf-8")
    expected_sig = hmac.new(key, msg.encode("utf-8"), hashlib.sha256).hexdigest().lower()

    if not hmac.compare_digest(signature.lower(), expected_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device signature"
        )

    seen_nonces.add(nonce)


# --------------------------------------------------------------------------
# Helper: Glyph Generator (Exact 312x32 1-bit monochrome bitmap, 1248 bytes)
# --------------------------------------------------------------------------
def render_glyph_bitmap(text: str, width: int = 312, height: int = 32) -> Tuple[bytes, int, int, int]:
    """
    Renders text to a 312x32 1-bit monochrome bitmap using Pillow.
    Returns (raw_packed_bytes, width, height, stride).
    Stride = 312 // 8 = 39 bytes. Total bytes = 39 * 32 = 1248 bytes.
    """
    font = None
    candidate_fonts = [
        "C:\\Windows\\Fonts\\Nirmala.ttc",
        "C:\\Windows\\Fonts\\arial.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
    ]
    for fp in candidate_fonts:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, 20)
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()

    img = Image.new("1", (width, height), 0)
    draw = ImageDraw.Draw(img)
    draw.text((4, 4), text, font=font, fill=1)

    stride = width // 8
    packed_bytes = img.tobytes()
    return packed_bytes, width, height, stride


# --------------------------------------------------------------------------
# Root & Health
# --------------------------------------------------------------------------
@app.get("/")
def get_root():
    return {
        "service": "LIRA-Q Sentinel Mock Backend",
        "contracts": ["C-2 (Driver API)", "C-3 (Edge ESP32 API v13)", "C-4 (Interchange)"],
        "version": "v13.0",
        "docs_url": "/docs",
        "server_time": int(time.time()),
    }


@app.get("/health")
@app.get("/api/v1/health")
def get_health(request: Request):
    verify_device_auth_opt(request)
    now = int(time.time())
    return {
        "status": "ok",
        "schema": "v13.0",
        "server_unix": now,
        "mode": "LIVE",
        # Backward-compatible fields
        "version": "v13.0",
        "server_time": now,
        "edge_device": "EDGE-01",
        "active_site": CURRENT_SITE,
        "site_role": CURRENT_ROLE,
        "providers": {
            "qpiai": {"status": "MOCK_READY", "mode": "Q1-Q6"},
            "bolna": {"status": "MOCK_READY", "agent": "READY"},
            "sarvam": {"status": "MOCK_READY", "models": ["saaras:v2.5", "bulbul:v1"]},
        },
    }


# --------------------------------------------------------------------------
# Contract C-3: Edge API (ESP32 DevKit V1 Firmware v13)
# --------------------------------------------------------------------------
@app.get("/edge/EDGE-01/state")
@app.get("/api/v1/edge/EDGE-01/state")
def get_edge_state(request: Request):
    verify_device_auth_opt(request)
    now = int(time.time())
    return {
        "device_id": "EDGE-01",
        "site_id": CURRENT_SITE,
        "site_role": CURRENT_ROLE,
        "plan_version": CURRENT_PLAN_VERSION,
        "resource_state": "INSPECTED_AVAILABLE",
        "reoptimization": {
            "required": False,
            "device_may_request": False,
            "request_id": "",
        },
        "active_interchange": {
            "session_id": active_session["session_id"],
            "state": active_session["state"],
            "challenge_code": active_session["challenge_code"] or "",
            "txn_id": active_session["txn_id"],
            "eir_no": active_session["eir_no"],
        },
        # Hardware display compatibility
        "device_type": "ESP32_TFT_RC522",
        "network_mode": "ONLINE",
        "display_header": f"LIRA BAY [{CURRENT_SITE}]",
        "display_lines": [
            f"SITE: {CURRENT_SITE} ({CURRENT_ROLE})",
            f"INTERCHANGE: {active_session['state']}",
            f"TRUCK: {active_session['truck_id']} [TAG: {active_session['truck_tag_ref']}]",
            f"CHASSIS: {active_session['equipment_id']} [TAG: {active_session['equipment_tag_ref']}]",
            f"CHALLENGE: {active_session['challenge_code'] or 'N/A'}",
        ],
        "prompt_tag": "F7B5FB03" if active_session["state"] == "NOT_STARTED" else "15B2FE03",
        "tag_observed": active_session["truck_tag_ref"] if active_session["step1_at"] else None,
        "awaiting_web_confirmation": (active_session["state"] == "AWAITING_CUSTODIAN"),
        "active_work_order_id": "WO-20261029-447",
        "server_time": now,
    }


@app.get("/edge/EDGE-01/decision-capsule")
@app.get("/api/v1/edge/EDGE-01/decision-capsule")
def get_decision_capsule(request: Request):
    verify_device_auth_opt(request)
    now = int(time.time())
    expires = now + 300

    # Canonical representations (Firmware v13 exact specification)
    branches_canonical = "B,TRUCK_SUBSTITUTE,32A3FF03,T11,R-03,1730190600,g_planb_hi,1730188800"
    tag_registry_canonical = (
        "15B2FE03,EQUIPMENT_TAG,R-03\n"
        "1D46FB03,CONTAINER_TAG,ONEU5519206\n"
        "32A3FF03,TRUCK_CARD,T11\n"
        "7226DA05,EQUIPMENT_TAG,R-07\n"
        "F7B5FB03,TRUCK_CARD,T09"
    )

    branches_digest = hashlib.sha256(branches_canonical.encode("utf-8")).hexdigest().lower()
    tag_registry_digest = hashlib.sha256(tag_registry_canonical.encode("utf-8")).hexdigest().lower()

    device_id = "EDGE-01"
    capsule_version = 13  # Integer per firmware v13 specification
    plan_version = CURRENT_PLAN_VERSION
    expected_tag_ref = "15B2FE03"
    work_order_id = "WO-20261029-447"
    resource_id = "R-03"
    snapshot_hash = "sha256-bay04-q4-approved"
    solver_run_id = "QOPT-C5-8f2c"
    validator_status = "PASS"

    signed_string = (
        f"{device_id}|{capsule_version}|{plan_version}|{expires}|{expected_tag_ref}|"
        f"{work_order_id}|{resource_id}|{snapshot_hash}|{solver_run_id}|"
        f"{validator_status}|{branches_digest}|{tag_registry_digest}"
    )

    capsule_mac = hmac.new(DEVICE_KEY.encode("utf-8"), signed_string.encode("utf-8"), hashlib.sha256).hexdigest().lower()

    return {
        "device_id": device_id,
        "capsule_version": capsule_version,
        "plan_version": plan_version,
        "expires_unix": expires,
        "expected_tag_ref": expected_tag_ref,
        "work_order_id": work_order_id,
        "resource_id": resource_id,
        "snapshot_hash": snapshot_hash,
        "solver_run_id": solver_run_id,
        "validator_status": validator_status,
        "branches_canonical": branches_canonical,
        "branches_digest": branches_digest,
        "tag_registry_canonical": tag_registry_canonical,
        "tag_registry_digest": tag_registry_digest,
        "capsule_mac": capsule_mac,
        # Backward compatibility
        "signed_string": signed_string,
        "signature": capsule_mac,
        "issued_at": now,
        "expires_at": expires,
    }


@app.get("/edge/EDGE-01/board")
@app.get("/api/v1/edge/EDGE-01/board")
def get_edge_board(request: Request):
    """Compact board (<= 2 KB, 3 rows, short container codes) for ILI9341 display."""
    verify_device_auth_opt(request)
    now = int(time.time())
    return {
        "plan_version": CURRENT_PLAN_VERSION,
        "solver_run_id": "QOPT-C5-8f2c",
        "validator": "PASS",
        "qaoa_shadow": "AGREES",
        "instruction_glyph_id": "g_planb_hi",
        "rows": [
            {
                "seq": 1,
                "truck_id": "T09",
                "container_short": "MSCU..920-0",
                "chassis_id": "R-03",
                "window_start_unix": now + 600,
                "status": "NEXT",
                "container_no": "MSCU6619200",
                "window_start": now + 600,
                "window_end": now + 2400,
            },
            {
                "seq": 2,
                "truck_id": "T11",
                "container_short": "MEDU..210-1",
                "chassis_id": "R-05",
                "window_start_unix": now + 2400,
                "status": "WAIT",
                "container_no": "MEDU9482101",
                "window_start": now + 2400,
                "window_end": now + 4200,
            },
            {
                "seq": 3,
                "truck_id": "T07",
                "container_short": "HLCU..194-0",
                "chassis_id": "R-07",
                "window_start_unix": now + 4200,
                "status": "WAIT",
                "container_no": "HLCU9201940",
                "window_start": now + 4200,
                "window_end": now + 6000,
            },
        ],
        "next_cliff": {
            "container_short": "MSCU..920-0",
            "kind": "PNR",
            "at_unix": now + 7200,
            "container_no": "MSCU6619200",
            "at": now + 7200,
        },
        "site_id": CURRENT_SITE,
        "generated_at": now,
    }


@app.get("/edge/EDGE-01/glyph/{glyph_id}")
@app.get("/api/v1/edge/EDGE-01/glyph/{glyph_id}")
def get_glyph(glyph_id: str, request: Request):
    """Serve exact 312x32 1-bit monochrome bitmap (1248 bytes) for ILI9341 display."""
    verify_device_auth_opt(request)
    glyph_texts = {
        "g_planb_hi": "चेसिस R-03 लें",
        "GLYPH-B": "चेसिस R-03 लें",
        "g_t09_hi": "ट्रक T09 बे 4",
        "GLYPH-T09": "ट्रक T09 बे 4",
        "g_confirm_hi": "पुष्टि करें CHAL-447",
        "GLYPH-CONFIRM": "पुष्टि करें CHAL-447",
        "g_committed_hi": "गेट पास जारी",
        "GLYPH-COMMITTED": "गेट पास जारी",
    }
    text = glyph_texts.get(glyph_id, f"GLYPH: {glyph_id}")
    raw_bytes, w, h, stride = render_glyph_bitmap(text, width=312, height=32)

    return Response(
        content=raw_bytes,
        media_type="application/octet-stream",
        headers={
            "X-Glyph-Id": glyph_id,
            "X-Glyph-Width": str(w),
            "X-Glyph-Height": str(h),
            "X-Glyph-Stride": str(stride),
            "X-Glyph-Lang": "hi",
            "Content-Length": str(len(raw_bytes)),
        },
    )


@app.post("/edge/events")
@app.post("/api/v1/edge/events")
async def post_edge_event(request: Request):
    """C-4 Interchange state machine event receiver (supports real cards & legacy tags)."""
    raw_body = await request.body()
    verify_device_auth_opt(request, raw_body)

    body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    event_id = body.get("event_id", f"EVT-{int(time.time()*1000)}")
    event_type = body.get("event_type", "SCAN_OBSERVED")
    tag_ref = (body.get("tag_ref") or body.get("raw_payload") or "F7B5FB03").strip().upper()
    now = time.strftime("%Y-%m-%dT%H:%M:%S+05:30")

    # Step 1: Truck observed (Real RC522 cards F7B5FB03 / 32A3FF03, or legacy tags)
    if tag_ref in ["F7B5FB03", "32A3FF03", "TAG_07", "TAG_09", "TAG_11", "TAG_04"]:
        active_session["state"] = "TRUCK_OBSERVED"
        active_session["truck_tag_ref"] = tag_ref
        active_session["truck_id"] = "T09" if tag_ref == "F7B5FB03" else ("T11" if tag_ref == "32A3FF03" else "T07")
        active_session["step1_at"] = now
        return {
            "event_id": event_id,
            "status": "RECORDED",
            "session_id": active_session["session_id"],
            "state": active_session["state"],
            "interchange": {
                "state": active_session["state"],
                "challenge_code": active_session["challenge_code"],
                "txn_id": active_session["txn_id"],
                "eir_no": active_session["eir_no"],
            },
            "tag_ref": tag_ref,
            "message": "Step 1 complete: Truck card recognized. Present chassis equipment tag within 30s.",
        }

    # Step 2: Equipment/Container observed (Real RC522 cards 15B2FE03 / 7226DA05 / 1D46FB03)
    if tag_ref in ["15B2FE03", "7226DA05", "1D46FB03", "TAG_R03", "TAG_CONT_01", "TAG_R05"]:
        active_session["state"] = "AWAITING_CUSTODIAN"
        active_session["equipment_tag_ref"] = tag_ref
        active_session["equipment_id"] = "R-03" if tag_ref == "15B2FE03" else ("R-07" if tag_ref == "7226DA05" else "R-03")
        active_session["step2_at"] = now
        active_session["challenge_code"] = "CHAL-447"
        return {
            "event_id": event_id,
            "status": "RECORDED",
            "session_id": active_session["session_id"],
            "state": active_session["state"],
            "local_decision": "MATCH_PREVIEW",
            "challenge_code": active_session["challenge_code"],
            "interchange": {
                "state": active_session["state"],
                "challenge_code": active_session["challenge_code"],
                "txn_id": active_session["txn_id"],
                "eir_no": active_session["eir_no"],
            },
            "message": "Interchange match preview verified. Awaiting custodian challenge confirmation on website.",
        }

    return {
        "event_id": event_id,
        "status": "RECORDED",
        "event_type": event_type,
        "tag_ref": tag_ref,
        "interchange": {
            "state": active_session["state"],
            "challenge_code": active_session["challenge_code"],
            "txn_id": active_session["txn_id"],
            "eir_no": active_session["eir_no"],
        },
    }


@app.post("/api/v1/resource-lock/commit")
def commit_resource_lock(payload: Dict):
    """Atomic confirmation of interchange session."""
    challenge_code = payload.get("challenge_code")
    if challenge_code != active_session.get("challenge_code"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid challenge code. Expected {active_session.get('challenge_code')}",
        )

    active_session["state"] = "COMMITTED"
    active_session["committed_at"] = time.strftime("%Y-%m-%dT%H:%M:%S+05:30")
    active_session["txn_id"] = "TXN-20261029-4478"
    active_session["eir_no"] = "EIR-JNPT-2026-447"

    return {
        "status": "COMMITTED",
        "session_id": active_session["session_id"],
        "txn_id": active_session["txn_id"],
        "eir_no": active_session["eir_no"],
        "committed_at": active_session["committed_at"],
        "message": "Physical interchange committed atomically. Gate pass released.",
    }


@app.put("/api/v1/edge/EDGE-01/site")
def switch_edge_site(payload: Dict):
    """Switch station site role between STAGING_BAY and EMPTY_DEPOT."""
    global CURRENT_SITE, CURRENT_ROLE
    new_site = payload.get("site_id", "DEPOT-DRONAGIRI-02")
    if new_site == "DEPOT-DRONAGIRI-02":
        CURRENT_SITE = "DEPOT-DRONAGIRI-02"
        CURRENT_ROLE = "EMPTY_DEPOT"
    else:
        CURRENT_SITE = "JNPT-BAY-04"
        CURRENT_ROLE = "STAGING_BAY"
    return {"status": "UPDATED", "site_id": CURRENT_SITE, "site_role": CURRENT_ROLE}


# --------------------------------------------------------------------------
# Contract C-2: Driver API (Android App)
# --------------------------------------------------------------------------
@app.get("/driver/assignments")
@app.get("/api/v1/driver/assignments")
def get_driver_assignments(driver_id: str = "DRV-102"):
    now = time.strftime("%Y-%m-%dT%H:%M:%S+05:30")
    return {
        "server_time": now,
        "assignments": [
            {
                "assignment_id": "ASG-C5-T09-3",
                "plan_id": "PLAN-C5",
                "plan_version": CURRENT_PLAN_VERSION,
                "status": "APPROVED_ACTIVE",
                "superseded_by": None,
                "active_branch": None,
                "driver_id": driver_id,
                "truck_id": "T09",
                "container": {
                    "container_no": "MSCU6619200",
                    "bl_no": "MEDUJN2610447",
                    "size_type": "40HC",
                    "gross_kg": 24800,
                },
                "freight_case": {
                    "case_code": "C5",
                    "blocker_type": "TRUCK_BREAKDOWN",
                    "driver_status": "ACTION_REQUIRED",
                    "owner_role": "CARRIER_DISPATCH",
                    "action_due": "2026-10-29T14:20:00+05:30",
                    "hard_deadline": "2026-10-29T16:00:00+05:30",
                },
                "route": {
                    "from_label": "Kalamboli truck terminal",
                    "to_label": "JNPT pre-gate Bay 4",
                    "eta_minutes": 38,
                    "eta_source": "GOOGLE_ROUTES",
                    "eta_observed_at": now,
                    "label": "PREDICTED",
                },
                "bay": {
                    "site_id": CURRENT_SITE,
                    "queue_position": 1,
                    "window_start": "2026-10-29T14:30:00+05:30",
                    "window_end": "2026-10-29T15:00:00+05:30",
                    "chassis_id": "R-03",
                    "station_device_id": "EDGE-01",
                    "station_online": True,
                },
                "instruction": {
                    "lang": "hi",
                    "text": "बे 4 पर 14:30 तक पहुँचें, चेसिस R-03 लें",
                    "text_en": "Reach Bay 4 by 14:30, pick chassis R-03",
                    "source": "SARVAM_TRANSLATE",
                },
                "interchange": {
                    "session_id": active_session["session_id"],
                    "state": active_session["state"],
                    "txn_id": active_session["txn_id"],
                    "eir_no": active_session["eir_no"],
                },
                "cost_exposure": {
                    "currency": "INR",
                    "baseline": 32000,
                    "plan": 2650,
                    "avoidable": 29350,
                    "label": "MODELED",
                    "tariff_source_ids": ["TAR-JNPT-DPD-01"],
                },
                "provenance": {
                    "solver_runs": [
                        {
                            "run_id": "QOPT-8f2c",
                            "mode": "Q4_RECOVERY_EXCHANGE",
                            "engine": "QPIAI_OPT_HUBO",
                            "execution_mode": "local",
                            "job_id": None,
                            "validator": "PASS",
                        }
                    ],
                    "evidence_count": 4,
                },
                "issued_at": now,
            }
        ],
    }


@app.post("/driver/assignments/{assignment_id}/ack")
def ack_assignment(assignment_id: str, payload: Dict):
    plan_version = payload.get("plan_version", 1)
    if plan_version < CURRENT_PLAN_VERSION:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "STALE_PLAN", "current_plan_version": CURRENT_PLAN_VERSION},
        )
    return {
        "status": "ACKNOWLEDGED",
        "assignment_id": assignment_id,
        "plan_version": plan_version,
        "action": payload.get("action", "ACK"),
    }


@app.post("/driver/assignments/{assignment_id}/eta")
def update_eta(assignment_id: str, payload: Dict):
    return {
        "status": "ETA_UPDATED",
        "assignment_id": assignment_id,
        "eta_minutes": payload.get("eta_minutes", 35),
        "source": "DRIVER_REPORTED",
    }


@app.post("/driver/assignments/{assignment_id}/voice-report")
async def upload_voice_report(
    assignment_id: str,
    audio: UploadFile = File(...),
    idempotency_key: str = Form(...),
    plan_version: int = Form(...),
    client_recorded_at: str = Form(...),
):
    """
    Multipart voice report upload endpoint.
    Requires python-multipart and pillow.
    """
    audio_bytes = await audio.read()
    return {
        "report_id": f"VR-20261029-{int(time.time()) % 10000:04d}",
        "status": "TRANSCRIBED",
        "bytes_received": len(audio_bytes),
        "filename": audio.filename,
        "language_detected": "hi-IN",
        "transcript_original": "गाड़ी में खराबी है, क्रेन डिले की वजह से 40 मिनट और लगेंगे",
        "transcript_en": "There is a vehicle breakdown, will take 40 more minutes due to crane delay",
        "interpretation": {
            "reason_code": "BREAKDOWN",
            "eta_minutes": 40,
            "confidence": 0.94,
        },
        "evidence_tier": "T4_DRIVER_STATEMENT",
        "provider": "SARVAM",
        "provider_request_id": "sarvam-mock-req-01",
    }


@app.post("/driver/voice-reports/{report_id}/confirm")
def confirm_voice_report(report_id: str, payload: Dict):
    return {
        "status": "CONFIRMED",
        "report_id": report_id,
        "accepted": payload.get("accepted", True),
    }


@app.get("/driver/calls")
def get_driver_calls():
    return [
        {
            "call_id": "CALL-20261029-01",
            "provider": "BOLNA",
            "execution_id": "exec-bolna-8821",
            "agent_id_masked": "bn-590...57f",
            "direction": "OUTBOUND",
            "language": "hi",
            "purpose": "DRIVER_ETA_CHECK",
            "question": "क्या आप 14:30 तक बे 4 पहुँच रहे हैं?",
            "status": "COMPLETED",
            "from_number_masked": "+91-98****1234",
            "started_at": "2026-10-29T13:45:00+05:30",
            "ended_at": "2026-10-29T13:46:12+05:30",
            "transcript_excerpt_original": "हाँ, मैं रास्ते में हूँ, 35 मिनट में पहुँच जाऊँगा",
            "transcript_excerpt_en": "Yes, I am on the way, will reach in 35 minutes",
            "extracted": {
                "answer": "YES",
                "eta_minutes": 35,
                "reason_code": None,
                "confidence": 0.96,
            },
            "verification": "CORROBORATED",
        }
    ]


@app.get("/driver/bay-board")
def get_driver_bay_board(site_id: str = "JNPT-BAY-04", request: Request = None):
    return get_edge_board(request or Request({"type": "http", "headers": []}))


@app.get("/driver/interchanges")
def get_driver_interchanges():
    return [
        {
            "session_id": active_session["session_id"],
            "site_id": CURRENT_SITE,
            "truck_id": active_session["truck_id"],
            "truck_tag_ref_masked": "TAG_**",
            "equipment_id": active_session["equipment_id"],
            "state": active_session["state"],
            "local_decision": active_session["local_decision"],
            "reason_code": "NORMAL_STAGING",
            "challenge_code": active_session["challenge_code"],
            "txn_id": active_session["txn_id"],
            "eir_no": active_session["eir_no"],
            "observed_at": active_session["step1_at"],
            "committed_at": active_session["committed_at"],
            "branch_id_applied": None,
        }
    ]


@app.get("/driver/assignments/{assignment_id}/why")
def get_assignment_why(assignment_id: str):
    return {
        "assignment_id": assignment_id,
        "evidence": [
            {
                "document_id": "DOC-C5-BOE-01",
                "title": "Bill of Entry ICEGATE Out-of-Charge",
                "source_type": "PDF",
                "authority_tier": "T1",
                "quote": "OoC granted under Section 47 Customs Act 1962",
                "quote_start": 120,
                "quote_end": 165,
                "observed_at": "2026-10-29T11:00:00+05:30",
            }
        ],
        "solver_runs": [
            {
                "run_id": "QOPT-8f2c",
                "mode": "Q4_RECOVERY_EXCHANGE",
                "engine": "QPIAI_OPT_HUBO",
                "execution_mode": "local",
                "validator": "PASS",
            }
        ],
        "cost_breakdown": [
            {"component": "Demurrage", "amount": 0, "label": "INVOICE_VERIFIED", "source_id": "TAR-JNPT-01"},
            {"component": "Detention Avoided", "amount": 29350, "label": "MODELED", "source_id": "TAR-MSCU-01"},
        ],
        "insufficient_evidence": False,
    }


@app.put("/driver/profile")
def update_driver_profile(payload: Dict):
    return {"status": "UPDATED", "language": payload.get("language", "hi")}


@app.get("/driver/stream")
async def driver_event_stream():
    """Server-Sent Events for Android driver app."""
    async def event_generator():
        yield f"data: {json.dumps({'type': 'connected', 'plan_version': CURRENT_PLAN_VERSION, 'at': int(time.time())})}\n\n"
        while True:
            await asyncio.sleep(15)
            yield f": heartbeat {int(time.time())}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/driver/health")
def get_driver_health():
    return {"status": "ok", "schema": "v13.0", "server_time": int(time.time())}


# --------------------------------------------------------------------------
# CLI Runner
# --------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser(description="Run LIRA Mock Backend")
    parser.add_argument("--host", default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8001")), help="Port number (default: 8001)")
    args = parser.parse_args()

    print(f"\n=======================================================")
    print(f"  LIRA-Q Sentinel Standalone Mock Backend v13.0")
    print(f"  Listening on http://{args.host}:{args.port}")
    print(f"  Contract C-2 (Driver API): http://{args.host}:{args.port}/driver/assignments")
    print(f"  Contract C-3 (Edge ESP32): http://{args.host}:{args.port}/edge/EDGE-01/state")
    print(f"  TFT Glyph Renderer:       http://{args.host}:{args.port}/edge/EDGE-01/glyph/g_planb_hi")
    print(f"=======================================================\n")

    uvicorn.run(app, host=args.host, port=args.port)
