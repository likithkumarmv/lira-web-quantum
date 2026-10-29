import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_cases_c1_c6_list_and_detail():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. List cases
        res = await ac.get("/api/v1/cases")
        assert res.status_code == 200
        data = res.json()
        assert data["count"] == 6
        cases = data["cases"]
        case_ids = [c["case_id"] for c in cases]
        assert "C1_CUSTOMS_REGULATORY" in case_ids
        assert "C2_CARRIER_FREIGHT_RELEASE" in case_ids
        assert "C3_WEATHER_BUNCHING" in case_ids
        assert "C4_CHASSIS_SLOT_DEFICIT" in case_ids
        assert "C5_DRIVER_BREAKDOWN" in case_ids
        assert "C6_EMPTY_DETENTION" in case_ids

        # 2. Get C1 detail
        c1_res = await ac.get("/api/v1/cases/C1_CUSTOMS_REGULATORY")
        assert c1_res.status_code == 200
        c1_data = c1_res.json()
        assert c1_data["container_id"] == "C101"
        assert c1_data["bl_number"] == "MEDU9482104"
        assert "evidence_document" in c1_data
        assert "AEO-T2" in c1_data["evidence_document"]["quote"]

        # 3. Recalculate C1 in LAB_FIXTURE mode
        recalc_res = await ac.post(
            "/api/v1/cases/C1_CUSTOMS_REGULATORY/recalculate",
            json={"delay_minutes": 60, "rate_multiplier": 1.1}
        )
        assert recalc_res.status_code == 200
        recalc = recalc_res.json()
        assert recalc["case_id"] == "C1_CUSTOMS_REGULATORY"
        assert recalc["simulated_delay_minutes"] == 60
        assert recalc["avoidable_savings_inr"] > 0
        assert recalc["origin"] == "LAB_FIXTURE_INTERACTIVE_SIMULATION"


@pytest.mark.asyncio
async def test_calling_agent_health_and_start():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Check health
        h_res = await ac.get("/api/v1/calls/health")
        assert h_res.status_code == 200
        h_data = h_res.json()
        assert h_data["status"] in ["READY", "NOT_CONFIGURED", "FAILED"]

        # 2. Start authorized verification call
        call_res = await ac.post(
            "/api/v1/calls/start",
            json={
                "incident_id": "INC-C102",
                "truck_id": "T07",
                "phone_number": "+919820119420",
                "recipient_name": "Driver DRV-102",
                "purpose_question": "Can backup Truck T07 accept container C102 by 16:30?",
                "consent_reference": "CONSENT-TEST-442"
            }
        )
        assert call_res.status_code == 200
        call_data = call_res.json()
        assert "call_id" in call_data
        assert "***" in call_data["recipient_masked"]
        assert call_data["recipient_masked"].endswith("420")
        assert call_data["trust_tier"] == "T4_UNVERIFIED"
        assert call_data["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_qpiai_six_decision_modes():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Unified Decision Modes matrix
        matrix_res = await ac.get("/api/v1/qpiai/decision-modes")
        assert matrix_res.status_code == 200
        matrix_data = matrix_res.json()
        assert len(matrix_data["decision_modes"]) == 6
        mode_ids = [m["mode_id"] for m in matrix_data["decision_modes"]]
        assert mode_ids == ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"]
        assert matrix_data["quantum_classical_comparator"]["optimality_gap"] == "0.0%"

        # 2. Q4 Multi-container exchange
        q4_res = await ac.get("/api/v1/qpiai/modes/q4-exchange")
        assert q4_res.status_code == 200
        q4_data = q4_res.json()
        assert q4_data["mode"] == "Q4_MULTI_CONTAINER_EXCHANGE"
        assert q4_data["conflict_free_verified"] is True
        assert len(q4_data["assignments"]) >= 4

        # 3. Q5 Rolling horizon
        q5_res = await ac.get("/api/v1/qpiai/modes/q5-horizon?horizon_hours=48")
        assert q5_res.status_code == 200
        q5_data = q5_res.json()
        assert q5_data["mode"] == "Q5_ROLLING_HORIZON_FUTURE_PROOFING"
        assert "tomorrow_reserve_buffer" in q5_data
        assert q5_data["net_robustness_advantage_inr"] > 0

        # 4. Q6 QCloud reality experiment
        q6_res = await ac.get("/api/v1/qpiai/modes/q6-qcloud")
        assert q6_res.status_code == 200
        q6_data = q6_res.json()
        assert q6_data["mode"] == "Q6_QCLOUD_REALITY_EXPERIMENT"
        assert q6_data["qubits_used"] == 4
        assert q6_data["subspace_feasibility_ratio"] >= 0.95
        assert q6_data["optimality_gap_percent"] == 0.0


@pytest.mark.asyncio
async def test_system_v11_health_with_providers():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["version"] == "v11.0"
        assert data["bolna_agent_status"] in ["READY", "NOT_CONFIGURED"]
        assert data["qpiai_opt_status"] == "READY"
        assert data["qpiai_qcloud_status"] == "READY"
        assert "providers" in data
        assert "bolna" in data["providers"]
        assert "qpiai_opt" in data["providers"]
