import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_driver_assignments_and_ack():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login as DRIVER_T07
        login_res = await ac.post("/api/v1/auth/demo-login", json={"user_code": "DRIVER_T07"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Get assignments
        resp = await ac.get("/api/v1/driver/assignments", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert len(data["items"]) >= 1

        first_asgn = data["items"][0]
        assert first_asgn["truck_id"] == "T07"
        assert first_asgn["status"] in ["APPROVED", "ACKNOWLEDGED", "PHYSICAL_NO_SHOW"]
        asgn_id = first_asgn["assignment_id"]

        # 3. Acknowledge assignment
        ack_res = await ac.post(
            f"/api/v1/driver/assignments/{asgn_id}/ack",
            headers=headers,
            json={"action": "ACKNOWLEDGE", "reason": None}
        )
        assert ack_res.status_code == 200
        ack_data = ack_res.json()
        assert ack_data["accepted"] is True
        assert ack_data["driver_ack_state"] == "ACKNOWLEDGED"

        # 4. Checkpoint status
        cp_res = await ac.get(f"/api/v1/driver/checkpoint-status?assignment_id={asgn_id}", headers=headers)
        assert cp_res.status_code == 200
        cp_data = cp_res.json()
        assert cp_data["assignment_id"] == asgn_id
        assert "state" in cp_data
