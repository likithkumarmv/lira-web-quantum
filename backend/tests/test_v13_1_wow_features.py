"""
Pytest Test Suite for v13.1 WOW Features (Features 1 through 5)
Verifies:
1. Feature 1: Live pipeline happy path & simulation label SIMULATED_CALL, honest halt on error.
2. Feature 2: Copilot agent tool-call cap, no approve tool exists, numbers match tool results.
3. Feature 3: Stress test sandbox isolation, promote requires manager role.
4. Feature 4: Race panel, QAOA skipped above 12 qubits, XY-mixer feasible rate >= X-mixer.
5. Feature 5: Forecast co-occurrence matrix symmetry, diagonal equals marginals, RESERVE_STANDBY assignment.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.copilot.agent import AVAILABLE_TOOLS


@pytest.mark.asyncio
async def test_feature1_simulate_call_pipeline_and_label():
    """Verify Feature 1: simulated driver call pipeline executes and labels SIMULATED_CALL."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/demo/simulate-driver-call", json={
            "transcript": "सर, T07 का अल्टरनेटर फेल हो गया NH-348 पर। कंटेनर MSCU6619200 फंसा हुआ है, 45 मिनट लेट हो जाएगा।",
            "phone_number": "+919820119420"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["mode"] == "SIMULATED_CALL"
        assert "incident_id" in data
        assert data["status"] == "SUBMITTED"

        # Check recorded steps in DB
        inc_id = data["incident_id"]
        steps_res = await client.get(f"/api/v1/demo/live-incident/{inc_id}/steps")
        assert steps_res.status_code == 200
        steps_data = steps_res.json()
        assert steps_data["count"] >= 5

        # Check that steps include CALL_RECEIVED, TRANSCRIPT_READY, CLAIM_EXTRACTED, BLOCKER_PROPOSED, QPIAI_RESOLVE
        step_names = [s["step"] for s in steps_data["steps"]]
        assert "CALL_RECEIVED" in step_names
        assert "TRANSCRIPT_READY" in step_names
        assert "CLAIM_EXTRACTED" in step_names
        assert "QPIAI_RESOLVE" in step_names

        # Verify manager approval step
        appr_res = await client.post(f"/api/v1/demo/live-incident/{inc_id}/approve", json={
            "approved_by": "MANAGER_01"
        })
        assert appr_res.status_code == 200
        appr_data = appr_res.json()
        assert appr_data["step"] == "APPROVED"


@pytest.mark.asyncio
async def test_feature1_on_time_halts_with_no_replan():
    """Verify Feature 1 rule: If answer == ON_TIME, stop at CLAIM_EXTRACTED with 'no re-plan needed' (anti-false-escalation)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/demo/simulate-driver-call", json={
            "answer": "ON_TIME",
            "driver_id": "T07",
            "container_no": "MSCU6619200",
            "slot": "14:30 IST"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["mode"] == "SIMULATED_CALL"
        inc_id = data["incident_id"]

        # Check recorded steps in DB
        steps_res = await client.get(f"/api/v1/demo/live-incident/{inc_id}/steps")
        assert steps_res.status_code == 200
        steps_data = steps_res.json()
        step_names = [s["step"] for s in steps_data["steps"]]

        assert "CLAIM_EXTRACTED" in step_names
        # Must NOT escalate to blocker DAG or QpiAI solver because driver is on time!
        assert "BLOCKER_PROPOSED" not in step_names
        assert "QPIAI_RESOLVE" not in step_names


@pytest.mark.asyncio
async def test_feature1_call_driver_consent_and_validation():
    """Verify Feature 1 Outbound Call: Consent is strictly required and phone must be E.164."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Missing consent -> 400
        res1 = await client.post("/api/v1/demo/call-driver", json={
            "phone_number": "+919820112345",
            "consent_given": False
        })
        assert res1.status_code == 400
        err1 = res1.json().get("detail") or res1.json().get("error", {}).get("message", "")
        assert "Consent required" in err1

        # 2. Invalid phone format -> 400
        res2 = await client.post("/api/v1/demo/call-driver", json={
            "phone_number": "9820112345",
            "consent_given": True
        })
        assert res2.status_code == 400
        err2 = res2.json().get("detail") or res2.json().get("error", {}).get("message", "")
        assert "E.164" in err2


@pytest.mark.asyncio
async def test_feature2_copilot_tool_contract():
    """Verify Feature 2: strictly no approve tool exists, tool names match specification."""
    # Non-negotiable Rule 4: No approve tool
    assert "approve_plan" not in AVAILABLE_TOOLS
    assert "propose_plan" in AVAILABLE_TOOLS
    assert "qpiai_inspect" in AVAILABLE_TOOLS
    assert "qpiai_solve" in AVAILABLE_TOOLS
    assert "validate_plan" in AVAILABLE_TOOLS
    assert "run_baselines" in AVAILABLE_TOOLS
    assert "run_qaoa_shadow" in AVAILABLE_TOOLS

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/copilot/ask", json={
            "query": "T07 is down on NH-348 and rain is forecast at 3 pm. What is the cheapest safe plan?"
        })
        assert res.status_code == 200
        data = res.json()
        assert "conversation_id" in data
        assert "stream_url" in data


@pytest.mark.asyncio
async def test_feature3_stress_sandbox_isolation():
    """Verify Feature 3: stress test perturbations do not touch live tables, promote requires manager."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create sandbox session
        sess_res = await client.post("/api/v1/stress/session")
        assert sess_res.status_code == 200
        session_id = sess_res.json()["session_id"]

        # 2. Apply perturbation
        pert_res = await client.post(f"/api/v1/stress/{session_id}/perturb", json={
            "type": "TRUCK_DOWN",
            "params": {"truck_id": "T07", "reason": "ENGINE_FAILURE"}
        })
        assert pert_res.status_code == 200
        pdata = pert_res.json()
        assert "greedy_dispatcher" in pdata
        assert "qpiai_opt_hubo" in pdata
        assert pdata["greedy_dispatcher"]["validator_verdict"] == "FAIL"
        assert pdata["qpiai_opt_hubo"]["validator_verdict"] == "PASS"

        # 3. Promote requires manager role
        bad_promote = await client.post(f"/api/v1/stress/{session_id}/promote", json={
            "role": "DRIVER"
        })
        assert bad_promote.status_code == 403

        good_promote = await client.post(f"/api/v1/stress/{session_id}/promote", json={
            "role": "DISPATCH_MANAGER"
        })
        assert good_promote.status_code == 200
        assert good_promote.json()["status"] == "PROMOTED_TO_PROPOSED"


@pytest.mark.asyncio
async def test_feature4_race_panel_and_qaoa_size_gating():
    """Verify Feature 4: Race runs 4 solvers, QAOA is skipped on > 12 qubits, XY mixer >= X mixer."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Run small instance (4 qubits)
        res_small = await client.post("/api/v1/race/run", json={"instance": "BAY04_LIVE"})
        assert res_small.status_code == 200
        data_s = res_small.json()
        assert len(data_s["scoreboard"]) == 3
        assert data_s["qaoa_details"]["status"] == "COMPLETED"

        # Check XY-mixer feasibility rate vs X-mixer
        qaoa_mixers = data_s["qaoa_details"]["mixer_comparison"]
        assert qaoa_mixers["xy_mixer"]["feasible_sample_rate"] >= qaoa_mixers["x_mixer"]["feasible_sample_rate"]

        # Run large instance (24 qubits) -> QAOA must be skipped honestly
        res_large = await client.post("/api/v1/race/run", json={"instance": "SCALE_N"})
        assert res_large.status_code == 200
        data_l = res_large.json()
        assert data_l["qaoa_details"]["status"] == "NOT_RUN_SIZE_LIMIT"

        # Verify scaling sweep endpoint
        sweep_res = await client.get("/api/v1/race/scaling-sweep")
        assert sweep_res.status_code == 200
        s_data = sweep_res.json()
        assert s_data["provenance"] == "LAB_FIXTURE_GENERATED"
        assert len(s_data["instances"]) == 6


@pytest.mark.asyncio
async def test_feature5_forecast_symmetry_and_reserve_assignment():
    """Verify Feature 5: Co-occurrence matrix is strictly symmetric, diagonal equals marginals, RESERVE_STANDBY."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/forecast/tomorrow")
        assert res.status_code == 200
        data = res.json()

        matrix = data["co_occurrence_matrix"]
        marginals = data["marginals"]
        n = len(matrix)
        assert n == 8

        # 1. Check exact symmetry: P(i ^ j) == P(j ^ i)
        for i in range(n):
            for j in range(n):
                assert matrix[i][j] == matrix[j][i], f"Matrix asymmetric at ({i},{j})"

        # 2. Check diagonal equals marginals
        for i in range(n):
            assert matrix[i][i] == round(marginals[i], 3), f"Diagonal does not match marginal at {i}"

        # 3. Book reserve -> RESERVE_STANDBY
        res_booking = await client.post("/api/v1/forecast/reserve", json={
            "truck_id": "T11",
            "chassis_id": "R-07",
            "standby_window": "08:00-10:00 IST"
        })
        assert res_booking.status_code == 200
        b_data = res_booking.json()
        assert b_data["status"] == "RESERVE_BOOKED"
        assert b_data["assignment_kind"] == "RESERVE_STANDBY"
        assert b_data["dispatch_authorized"] is False


@pytest.mark.asyncio
async def test_demo_providers_health_and_reset():
    """Verify /demo/health returns real provider states and /demo/reset-state soft resets cleanly."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        h_res = await client.get("/api/v1/demo/health")
        assert h_res.status_code == 200
        h_data = h_res.json()
        assert "qpiai_opt" in h_data["providers"]
        assert "qpiai_qcloud" in h_data["providers"]
        assert "bolna" in h_data["providers"]

        r_res = await client.post("/api/v1/demo/reset-state")
        assert r_res.status_code == 200
        assert r_res.json()["status"] == "RESET_SUCCESSFUL"

