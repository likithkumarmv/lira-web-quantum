import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_qpiai_solve_and_approval():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Trigger QpiAI solve on incident C102
        solve_res = await ac.post("/api/v1/incidents/INC-C102/solve", json={"wave": 1, "prefer_quantum": True})
        assert solve_res.status_code == 200
        solve_data = solve_res.json()
        assert solve_data["status"] == "SOLVED"
        assert solve_data["alternatives_generated"] >= 1
        run_id = solve_data["run_id"]

        # 2. Check QpiAI solver telemetry
        run_res = await ac.get(f"/api/v1/qpiai/runs/{run_id}")
        assert run_res.status_code == 200
        run_data = run_res.json()
        assert run_data["run_id"] == run_id
        assert "qaoa_distribution" in run_data
        assert run_data["shots"] >= 100

        # 3. Check Recovery Alternatives
        alt_res = await ac.get("/api/v1/recoveries/INC-C102/alternatives")
        assert alt_res.status_code == 200
        alt_data = alt_res.json()
        assert len(alt_data["alternatives"]) >= 1

        plan_to_approve = alt_data["alternatives"][0]["plan_id"]

        # 4. Approve plan
        app_res = await ac.post(
            f"/api/v1/recoveries/{plan_to_approve}/approve",
            json={"reason": "Optimal quantum assignment avoiding demurrage cliff", "manager_role": "OPS_MANAGER"}
        )
        assert app_res.status_code == 200
        app_data = app_res.json()
        assert app_data["accepted"] is True
        assert app_data["driver_notified"] is True
        assert app_data["edge_notified"] is True

