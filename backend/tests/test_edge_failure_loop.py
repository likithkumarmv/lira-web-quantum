import time
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.edge.hmac_verify import generate_edge_signature


@pytest.mark.asyncio
async def test_edge_failure_closed_loop():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Edge state verification
        tft_res = await ac.get("/api/v1/edge/LIRA-EDGE-01/state")
        assert tft_res.status_code == 200
        tft_data = tft_res.json()
        assert tft_data["device_id"] == "LIRA-EDGE-01"

        # 2. Simulate physical no-show event with HMAC signature and unique monotonic sequence
        observed_at = "2026-10-28T16:04:12+05:30"
        seq = 200 + int(time.time()) % 100000
        sig = generate_edge_signature(
            device_id="LIRA-EDGE-01",
            event_type="PHYSICAL_NO_SHOW",
            observed_at=observed_at,
            sequence=seq,
            assignment_id="ASN-102-R2"
        )

        edge_evt_res = await ac.post("/api/v1/edge/events", json={
            "device_id": "LIRA-EDGE-01",
            "event_type": "PHYSICAL_NO_SHOW",
            "assignment_id": "ASN-102-R2",
            "container_id": "C102",
            "truck_id": "T07",
            "rfid_token": "TAG_WRONG",
            "rfid_match": False,
            "bay_present": False,
            "observed_at": observed_at,
            "sequence": seq,
            "signature": sig
        })
        assert edge_evt_res.status_code == 200
        evt_data = edge_evt_res.json()
        assert evt_data["accepted"] is True
        assert evt_data["verified"] is True
        assert evt_data["action_triggered"] == "RECOVERY_WAVE_2_REQUIRED"

        # 3. Verify that assignment status is now PHYSICAL_NO_SHOW
        chk_res = await ac.get("/api/v1/driver/checkpoint-status?assignment_id=ASN-102-R2")
        assert chk_res.status_code == 200
        chk_data = chk_res.json()
        assert chk_data["state"] == "PHYSICAL_NO_SHOW"
