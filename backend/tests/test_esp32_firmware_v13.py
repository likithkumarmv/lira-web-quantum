"""
Tests for ESP32 Bay Station (Firmware v13 Exact Protocol)
Verifies:
- Public health schema v13 + integer server_unix + bolna_agent_id redaction
- Device HMAC auth (valid, bad signature -> 401, replay nonce -> 401)
- Tag registry (5 canonical physical cards, sorted, SHA-256 digest)
- State response (device_id, site_id, site_role, resource_state, reoptimization, active_interchange)
- Decision capsule v13 (branches=1, tags=5, canonical digests, HMAC-SHA256 MAC matching contract)
- Compact board <= 2 KB with board_rows=3 and container_short format
- 1-Bit TFT glyph rendering (width 312, height 32, exactly 1248 bytes)
- Two-tap interchange flow: Step 1 (TRUCK_CARD) -> Step 2 (EQUIPMENT_TAG) -> AWAITING_CUSTODIAN
- Custodian commit: state COMMITTED, txn_id RL-*, eir_no JNPT-B4-*, EIR PDF T2 evidence
- Lease conflict protection: second commit -> 409 LEASE_CONFLICT
- Site role toggle (JNPT-BAY-04 / STAGING_BAY <-> DEPOT-DRONAGIRI-02 / EMPTY_DEPOT)
"""

import hashlib
import hmac
import time
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, update
from app.db.session import AsyncSessionLocal
from app.db.models import ResourceLeaseModel, InterchangeSessionModel
from app.main import app
from app.core.config import settings
from app.services.edge.device_auth import compute_v13_signature


@pytest.mark.asyncio
async def test_health_v13_and_security_redaction():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["schema"] == "v13.0"
        assert data["mode"] == "LIVE"
        assert isinstance(data["server_unix"], int)
        assert data["server_unix"] > 1700000000

        # Security check: bolna_agent_id MUST NOT be leaked in public health
        assert "bolna_agent_id" not in data or data.get("bolna_agent_id") is None
        if "providers" in data and "bolna" in data["providers"]:
            assert "agent_id" not in data["providers"]["bolna"]


@pytest.mark.asyncio
async def test_device_auth_signature_and_replay_rejection():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        path = "/api/v1/health"
        nonce = f"nonce-{time.time()}-01"
        key = settings.EDGE_HMAC_KEY_EDGE_01

        # 1. Valid device signature
        valid_sig = compute_v13_signature(
            method="GET",
            path=path,
            nonce=nonce,
            body_bytes=b"",
            key_str=key
        )
        headers = {
            "X-LIRA-Device": "EDGE-01",
            "X-LIRA-Nonce": nonce,
            "X-LIRA-Signature": valid_sig
        }
        res_ok = await client.get(path, headers=headers)
        assert res_ok.status_code == 200

        # 2. Replayed nonce -> 401
        res_replay = await client.get(path, headers=headers)
        assert res_replay.status_code == 401
        assert "Replay detected" in res_replay.text

        # 3. Bad signature -> 401
        bad_headers = {
            "X-LIRA-Device": "EDGE-01",
            "X-LIRA-Nonce": f"nonce-{time.time()}-02",
            "X-LIRA-Signature": "deadbeef00112233445566778899aabbccddeeff"
        }
        res_bad = await client.get(path, headers=bad_headers)
        assert res_bad.status_code == 401


@pytest.mark.asyncio
async def test_edge_state_contract_v13():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/edge/EDGE-01/state")
        assert res.status_code == 200
        data = res.json()
        assert data["device_id"] == "EDGE-01"
        assert data["site_id"] in ["JNPT-BAY-04", "DEPOT-DRONAGIRI-02"]
        assert data["site_role"] in ["STAGING_BAY", "EMPTY_DEPOT"]
        assert isinstance(data["plan_version"], int)
        assert data["resource_state"] in ["INSPECTED_AVAILABLE", "RESERVED", "CHECKED_OUT", "QUARANTINED"]
        assert "reoptimization" in data
        assert isinstance(data["reoptimization"]["required"], bool)
        assert "active_interchange" in data
        assert "state" in data["active_interchange"]


@pytest.mark.asyncio
async def test_decision_capsule_v13_mac_and_canonical_digests():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/edge/EDGE-01/decision-capsule")
        assert res.status_code == 200
        cap = res.json()

        assert cap["device_id"] == "EDGE-01"
        assert cap["capsule_version"] == 13
        assert cap["expected_tag_ref"] == "15B2FE03"
        assert cap["validator_status"] == "PASS"

        # Verify tags=5
        tag_lines = cap["tag_registry_canonical"].strip().split("\n")
        assert len(tag_lines) == 5
        assert tag_lines == sorted(tag_lines)  # Must be sorted

        # Verify branches=1
        branch_lines = cap["branches_canonical"].strip().split("\n")
        assert len(branch_lines) == 1
        assert branch_lines[0].startswith("B,TRUCK_SUBSTITUTE")

        # Verify SHA-256 digests
        computed_b_digest = hashlib.sha256(cap["branches_canonical"].encode("utf-8")).hexdigest().lower()
        computed_t_digest = hashlib.sha256(cap["tag_registry_canonical"].encode("utf-8")).hexdigest().lower()
        assert cap["branches_digest"] == computed_b_digest
        assert cap["tag_registry_digest"] == computed_t_digest

        # Verify capsule_mac
        signed_str = (
            f"{cap['device_id']}|{cap['capsule_version']}|{cap['plan_version']}|{cap['expires_unix']}|"
            f"{cap['expected_tag_ref']}|{cap['work_order_id']}|{cap['resource_id']}|{cap['snapshot_hash']}|"
            f"{cap['solver_run_id']}|{cap['validator_status']}|{cap['branches_digest']}|{cap['tag_registry_digest']}"
        )
        key = settings.EDGE_HMAC_KEY_EDGE_01.encode("utf-8")
        computed_mac = hmac.new(key, signed_str.encode("utf-8"), hashlib.sha256).hexdigest().lower()
        assert cap["capsule_mac"] == computed_mac


@pytest.mark.asyncio
async def test_compact_board_and_glyph_renderer():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Compact board
        board_res = await client.get("/api/v1/edge/EDGE-01/board")
        assert board_res.status_code == 200
        board = board_res.json()
        assert len(board_res.content) <= 2048  # Board <= 2 KB
        assert len(board["rows"]) == 3  # board_rows=3
        assert ".." in board["rows"][0]["container_short"]
        assert "next_cliff" in board

        # 2. 1-Bit TFT Glyph
        glyph_res = await client.get("/api/v1/edge/EDGE-01/glyph/g_planb_hi")
        assert glyph_res.status_code == 200
        assert glyph_res.headers["content-type"] == "application/octet-stream"
        assert glyph_res.headers["x-glyph-width"] == "312"
        assert glyph_res.headers["x-glyph-height"] == "32"
        # Length must be exactly (312 // 8) * 32 = 1248 bytes
        assert len(glyph_res.content) == 1248
        assert any(b != 0 for b in glyph_res.content)  # Non-empty ink


@pytest.mark.asyncio
async def test_two_tap_interchange_and_custodian_commit_flow():
    # Clean up any active lease on R-03 for idempotent test run
    async with AsyncSessionLocal() as db_sess:
        await db_sess.execute(
            update(ResourceLeaseModel).where(ResourceLeaseModel.resource_id == "R-03").values(status="RETURNED")
        )
        await db_sess.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Present Truck Card (F7B5FB03 for T09)
        tap1_res = await client.post("/api/v1/edge/events", json={
            "device_id": "EDGE-01",
            "event_type": "SCAN_OBSERVED",
            "tag_ref": "F7B5FB03",
            "event_id": f"EVT-TAP1-{int(time.time())}"
        })
        assert tap1_res.status_code == 200
        tap1_data = tap1_res.json()
        assert tap1_data["interchange"]["state"] == "TRUCK_OBSERVED"

        # Step 2: Present Equipment Tag (15B2FE03 for R-03)
        tap2_res = await client.post("/api/v1/edge/events", json={
            "device_id": "EDGE-01",
            "event_type": "SCAN_OBSERVED",
            "tag_ref": "15B2FE03",
            "event_id": f"EVT-TAP2-{int(time.time())}"
        })
        assert tap2_res.status_code == 200
        tap2_data = tap2_res.json()
        assert tap2_data["interchange"]["state"] == "AWAITING_CUSTODIAN"
        challenge_code = tap2_data["interchange"]["challenge_code"]
        assert challenge_code.startswith("CHAL-")

        # Step 3: Bad Challenge Commit Rejected
        bad_commit = await client.post("/api/v1/resource-lock/commit", json={
            "session_id": "SES-1029-01",
            "challenge_code": "CHAL-WRONG",
            "idempotency_key": "idemp-01"
        })
        assert bad_commit.status_code == 400

        # Step 4: Custodian Valid Commit
        commit_res = await client.post("/api/v1/resource-lock/commit", json={
            "session_id": "SES-1029-01",
            "challenge_code": challenge_code,
            "idempotency_key": "idemp-01"
        })
        assert commit_res.status_code == 200
        commit_data = commit_res.json()
        assert commit_data["status"] == "COMMITTED"
        assert commit_data["txn_id"].startswith("RL-")
        assert commit_data["eir_no"].startswith("JNPT-B4-")
        assert "evidence_id" in commit_data

        # Step 5: Duplicate Lease Check -> 409 LEASE_CONFLICT
        async with AsyncSessionLocal() as db_sess:
            conflict_session = InterchangeSessionModel(
                session_id=f"SES-CONFLICT-{int(time.time())}",
                site_id="JNPT-BAY-04",
                truck_id="T11",
                equipment_id="R-03",
                state="AWAITING_CUSTODIAN",
                challenge_code="CHAL-888"
            )
            db_sess.add(conflict_session)
            await db_sess.commit()

        conflict_res = await client.post("/api/v1/resource-lock/commit", json={
            "session_id": conflict_session.session_id,
            "challenge_code": "CHAL-888",
            "idempotency_key": "idemp-02"
        })
        assert conflict_res.status_code == 409
        assert "LEASE_CONFLICT" in conflict_res.text


@pytest.mark.asyncio
async def test_site_role_toggle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Toggle to EMPTY_DEPOT
        res1 = await client.put("/api/v1/edge/EDGE-01/site", json={
            "site_id": "DEPOT-DRONAGIRI-02"
        })
        assert res1.status_code == 200
        assert res1.json()["site_id"] == "DEPOT-DRONAGIRI-02"
        assert res1.json()["site_role"] == "EMPTY_DEPOT"

        # Toggle back to STAGING_BAY
        res2 = await client.put("/api/v1/edge/EDGE-01/site", json={
            "site_id": "JNPT-BAY-04"
        })
        assert res2.status_code == 200
        assert res2.json()["site_id"] == "JNPT-BAY-04"
        assert res2.json()["site_role"] == "STAGING_BAY"
