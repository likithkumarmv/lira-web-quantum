import pytest
import datetime
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.evidence.parsers import parse_eml_content, parse_csv_content, parse_pdf_content
from app.services.evidence.validate import validate_extraction_results
from app.services.blockers.rules import evaluate_expanded_blockers
from app.services.eligibility.rules import check_assignment_eligibility
from app.db.session import engine, Base, AsyncSessionLocal, ensure_db_schema
from app.seed.live_demo import seed_live_demo_data


# Database initialization is handled cleanly in conftest.py async fixture


def test_multi_format_parsers():
    # 1. Test EML Parser
    eml_raw = b"""From: agent@hapag-lloyd.com\r\nTo: dispatch@lira.in\r\nSubject: DO Expiry Warning\r\nDate: Wed, 28 Oct 2026 10:00:00 +0530\r\n\r\nContainer C105 delivery order expired. DO validity lapsed 12:00 IST."""
    eml_text, headers = parse_eml_content(eml_raw)
    assert "DO Expiry Warning" in eml_text
    assert "DO validity lapsed" in eml_text
    assert headers["from"] == "agent@hapag-lloyd.com"

    # 2. Test CSV Parser
    csv_raw = b"container_id,gross_weight,status\nC105,26000,TRI_AXLE_MANDATE\nC107,16800,CLEARED"
    csv_text, meta = parse_csv_content(csv_raw)
    assert "C105" in csv_text
    assert "26000" in csv_text
    assert meta["row_count"] == 2

    # 3. Test PDF Stream Parser
    pdf_dummy = b"%PDF-1.4\n1 0 obj\n<< /Length 45 >>\nstream\n(Container C102 Out of Charge pending) Tj\nendstream\nendobj"
    pdf_text, pdf_meta = parse_pdf_content(pdf_dummy)
    assert "Container C102 Out of Charge pending" in pdf_text


def test_authority_gating_rules():
    text = "Container C102 customs clearance is pending. Out of Charge (OoC) not issued on ICEGATE."
    
    # Candidate trying to clear customs with T2 authority (Invalid: non-T1 cannot confirm customs clearance)
    candidates = [
        {
            "type": "CUSTOMS_HOLD",
            "claim": "Customs released according to freight forwarder",
            "quote": "Out of Charge (OoC) not issued",
            "start_char": text.find("Out of Charge (OoC) not issued"),
            "end_char": text.find("Out of Charge (OoC) not issued") + len("Out of Charge (OoC) not issued"),
            "authority_tier": "T2",
            "status": "CLEARED"
        }
    ]
    validated, errors = validate_extraction_results(text, candidates)
    # Status should be demoted to NEEDS_VERIFICATION
    assert validated[0]["status"] == "NEEDS_VERIFICATION"
    assert any("non-T1" in e for e in errors)

    # T5 AI interpretation cannot independently mandate HARD_BLOCKER
    t5_candidate = [
        {
            "type": "DRIVER_DELAY",
            "claim": "AI predicts driver will be late",
            "quote": "customs clearance is pending",
            "start_char": text.find("customs clearance is pending"),
            "end_char": text.find("customs clearance is pending") + len("customs clearance is pending"),
            "authority_tier": "T5",
            "status": "HARD_BLOCKER"
        }
    ]
    validated_t5, errors_t5 = validate_extraction_results(text, t5_candidate)
    assert validated_t5[0]["status"] == "NEEDS_VERIFICATION"


def test_expanded_freight_blocker_rules():
    # 1. Tri-axle heavy-haul rule
    heavy_container = {
        "container_id": "C105",
        "weight_kg": 26000.0,
        "size_ft": 40
    }
    tandem_truck = {
        "truck_id": "T01",
        "payload_capacity_kg": 28000.0,
        "chassis_type": "STANDARD_TANDEM"
    }
    slot = {"slot_id": "S1600", "confirmed_status": "CONFIRMED"}
    eligible, violations = check_assignment_eligibility(heavy_container, tandem_truck, slot)
    assert not eligible
    assert any("tri-axle" in v.lower() for v in violations)

    # 2. Reefer genset constraint
    reefer_container = {
        "container_id": "C108",
        "weight_kg": 18000.0,
        "size_ft": 40,
        "cargo_type": "PERISHABLE_REEFER",
        "release_state": "CONFIRMED"
    }
    truck_no_genset = {
        "truck_id": "T02",
        "payload_capacity_kg": 25000.0,
        "capacity_teu": 2,
        "has_genset": False
    }
    eligible_reefer, violations_reefer = check_assignment_eligibility(reefer_container, truck_no_genset, slot)
    assert not eligible_reefer
    assert any("genset" in v.lower() for v in violations_reefer)

    # 3. Weather forecast does NOT close port (only confirmed disruption does)
    standard_container = {
        "container_id": "C107",
        "weight_kg": 15000.0,
        "size_ft": 20,
        "release_state": "CONFIRMED"
    }
    standard_truck = {
        "truck_id": "T07",
        "payload_capacity_kg": 28000.0,
        "capacity_teu": 2
    }
    forecast_event = [{
        "event_id": "EVT-RAIN-01",
        "type": "PORT_CLOSURE",
        "trust_state": "FORECAST_RISK",
        "affected_slots": ["S1600"]
    }]
    eligible_forecast, _ = check_assignment_eligibility(standard_container, standard_truck, slot, forecast_event)
    assert eligible_forecast is True

    confirmed_event = [{
        "event_id": "EVT-STRIKE-01",
        "type": "PORT_CLOSURE",
        "trust_state": "CONFIRMED_DISRUPTION",
        "affected_slots": ["S1600"]
    }]
    eligible_confirmed, violations_confirmed = check_assignment_eligibility(standard_container, standard_truck, slot, confirmed_event)
    assert eligible_confirmed is False
    assert any("Port Operational Closure" in v for v in violations_confirmed)


@pytest.mark.asyncio
async def test_verification_task_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create verification task
        create_res = await client.post("/api/v1/verification/tasks", json={
            "incident_id": "INC-C102",
            "container_id": "C102",
            "blocker_code": "DOCUMENT_MISMATCH",
            "question": "Verify gross weight declaration difference between invoice and packing list.",
            "target_role": "CUSTOMS_BROKER",
            "deadline_minutes": 45
        })
        assert create_res.status_code == 200
        task_id = create_res.json()["task_id"]

        # List tasks
        list_res = await client.get("/api/v1/verification/tasks?incident_id=INC-C102")
        assert list_res.status_code == 200
        tasks = list_res.json()
        assert any(t["task_id"] == task_id for t in tasks)

        # Resolve task
        resolve_res = await client.post(f"/api/v1/verification/tasks/{task_id}/resolve", json={
            "resolved_claim": "Customs broker confirmed invoice amendment completed under Section 149.",
            "verified_by_role": "CUSTOMS_BROKER",
            "evidence_tier": "T1",
            "clear_blocker": True
        })
        assert resolve_res.status_code == 200
        assert resolve_res.json()["status"] == "RESOLVED"


@pytest.mark.asyncio
async def test_voice_calling_and_history():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Start voice call
        call_res = await client.post("/api/v1/calls/start", json={
            "incident_id": "INC-C102",
            "truck_id": "T04",
            "phone_number": "+919876543210",
            "recipient_name": "Driver T04"
        })
        assert call_res.status_code == 200
        data = call_res.json()
        assert "call_id" in data
        assert data["status"] in ["INITIATED", "COMPLETED"]

        # Check call history
        hist_res = await client.get("/api/v1/calls/history")
        assert hist_res.status_code == 200
        calls = hist_res.json().get("calls", [])
        assert len(calls) > 0
        assert any(c["call_id"] == data["call_id"] for c in calls)




@pytest.mark.asyncio
async def test_v7_hubo_and_xy_qaoa_telemetry():
    from app.services.qpiai.compiler import compile_recovery_qubo
    from app.services.qpiai.qcloud_adapter import run_qcloud_qaoa

    containers = [{
        "container_id": "C102",
        "size_ft": 40,
        "weight_kg": 26400.0,
        "cargo_type": "PERISHABLE_REEFER",
        "release_state": "CONFIRMED"
    }]
    trucks = [
        {"truck_id": "T07", "payload_capacity_kg": 28000.0, "capacity_teu": 2, "driver_hours_used": 3.0, "driver_hours_max": 10.0, "has_genset": True},
        {"truck_id": "T04", "payload_capacity_kg": 28000.0, "capacity_teu": 2, "driver_hours_used": 5.0, "driver_hours_max": 10.0, "has_genset": True, "availability": "DELAYED"},
        {"truck_id": "T01", "payload_capacity_kg": 22000.0, "capacity_teu": 2, "driver_hours_used": 2.0, "driver_hours_max": 10.0, "has_genset": False} # Ineligible: payload & genset
    ]
    slots = [
        {"slot_id": "S1600", "confirmed_status": "CONFIRMED"},
        {"slot_id": "S1630", "confirmed_status": "CONFIRMED"}
    ]

    hubo = compile_recovery_qubo(containers, trucks, slots)
    assert hubo.degree in [2, 3]
    assert hubo.pruned_triples_count > 0
    assert len(hubo.active_conflict_core) <= 8

    # Run XY-Mixer QAOA
    qcloud_res = await run_qcloud_qaoa(hubo, shots=500)
    assert qcloud_res.circuit_depth > 0
    assert qcloud_res.subspace_feasibility_ratio >= 0.90
    assert "gate_counts" in qcloud_res.raw_metadata or qcloud_res.gate_counts
    assert qcloud_res.fallback_status in ["LIVE_QCLOUD", "LOCAL_SIMULATOR", "CLASSICAL_FALLBACK"]


def test_v7_demurrage_invoice_statutory_gate():
    from app.services.evidence.validate import validate_extraction_results

    # 1. Deficient carrier invoice missing dispute contact & free-time start
    raw_text = "Carrier Invoice: Container C102 accrued demurrage charges ₹18,000. Rate: ₹3000/day. Lapsed: 2026-10-28 18:30."
    candidates = [{
        "type": "DEMURRAGE_INVOICE",
        "claim": "Carrier assessed ₹18,000 demurrage",
        "quote": "Container C102 accrued demurrage charges",
        "start_char": raw_text.find("Container C102 accrued demurrage charges"),
        "end_char": raw_text.find("Container C102 accrued demurrage charges") + len("Container C102 accrued demurrage charges"),
        "authority_tier": "T2",
        "status": "HARD_BLOCKER"
    }]
    validated, errors = validate_extraction_results(raw_text, candidates)
    assert validated[0]["status"] == "STATUTORILY_DEFICIENT_INVOICE"
    assert validated[0]["statutory_compliance"]["is_compliant"] is False
    assert any("46 CFR § 541.6" in e for e in errors)


def test_v7_edge_hmac_and_anti_false_escalation():
    from app.services.edge.hmac_verify import verify_edge_signature, generate_edge_signature

    device_id = "LIRA-EDGE-01"
    event_type = "RFID_TAG_OBSERVED"
    device_seq = 184
    assignment_id = "ASN-102-R2"
    nonce = "NONCE-99214A"

    # Generate v7 signature with nonce & device_seq (no RTC timestamp)
    sig = generate_edge_signature(
        device_id=device_id,
        event_type=event_type,
        sequence=device_seq,
        assignment_id=assignment_id,
        nonce=nonce
    )

    # Verify signature
    assert verify_edge_signature(
        device_id=device_id,
        event_type=event_type,
        sequence=device_seq,
        assignment_id=assignment_id,
        signature=sig,
        nonce=nonce
    ) is True

    # Bad signature rejected
    assert verify_edge_signature(
        device_id=device_id,
        event_type=event_type,
        sequence=device_seq,
        assignment_id=assignment_id,
        signature="bad_signature_hex",
        nonce=nonce
    ) is False


@pytest.mark.asyncio
async def test_v7_slot_swap_arbitrage_hubo():
    from app.services.qpiai.compiler import compile_recovery_qubo

    containers = [
        {
            "container_id": "C102",
            "size_ft": 40,
            "weight_kg": 26400.0,
            "cargo_type": "PERISHABLE_REEFER",
            "release_state": "CONFIRMED",
            "demurrage_rate_per_hr": 4500
        },
        {
            "container_id": "C208",
            "size_ft": 40,
            "weight_kg": 18500.0,
            "cargo_type": "GENERAL_DRY_CARGO",
            "release_state": "CONFIRMED",
            "demurrage_rate_per_hr": 0
        }
    ]
    trucks = [
        {"truck_id": "T07", "payload_capacity_kg": 28000.0, "capacity_teu": 2, "driver_hours_used": 3.0, "driver_hours_max": 10.0, "has_genset": True},
        {"truck_id": "T09", "payload_capacity_kg": 30000.0, "capacity_teu": 2, "driver_hours_used": 2.0, "driver_hours_max": 10.0, "has_genset": True}
    ]
    slots = [
        {"slot_id": "S1700", "confirmed_status": "CONFIRMED"},
        {"slot_id": "S1730", "confirmed_status": "CONFIRMED"}
    ]

    hubo = compile_recovery_qubo(containers, trucks, slots)
    assert hubo.degree == 3
    # Check that slot swap arbitrage ledger was populated
    assert len(hubo.slot_swap_ledger) > 0
    first_swap = hubo.slot_swap_ledger[0]
    assert first_swap["urgent_container"] == "C102"
    assert first_swap["donor_container"] == "C208"
    assert first_swap["rebate_awarded_inr"] == 3000
    assert first_swap["avoidable_demurrage_saved_inr"] == 48000
    assert first_swap["net_arbitrage_gain_inr"] == 45000

    # Verify cubic swap term in cubic_terms
    swap_terms = [t for t in hubo.cubic_terms if t.get("term_type") == "SLOT_SWAP_DEMURRAGE_ARBITRAGE"]
    assert len(swap_terms) > 0
    assert swap_terms[0]["weight"] == -45000.0


@pytest.mark.asyncio
async def test_v7_anti_clone_ratchet_and_statutory_demurrage_immunity():
    from app.services.tariff.cost_engine import generate_statutory_demurrage_immunity_dossier
    from app.services.edge.event_processor import process_edge_event
    from app.db.session import AsyncSessionLocal
    from app.db.models import EdgeDeviceModel

    # 1. Statutory Demurrage Immunity Dossier (46 CFR § 541.6 & JNPA Port Tariff)
    dossier = generate_statutory_demurrage_immunity_dossier(
        container_id="C102",
        proof_of_readiness_received_at="2026-10-28T16:04:12+05:30",
        slot_cutoff_time="2026-10-28T17:00:00+05:30",
        disruption_reason="YARD_STACK_DEPTH_DELAY",
        claimed_demurrage_inr=48000
    )
    assert dossier["status"] == "IMMUNITY_ESTABLISHED"
    assert dossier["fault_allocation"]["importer_fault_percent"] == 0.0
    assert dossier["fault_allocation"]["terminal_fault_percent"] == 100.0
    assert dossier["enforceable_demurrage_inr"] == 0
    assert dossier["voided_savings_inr"] == 48000
    assert any("46 CFR § 541.6" in rule for rule in dossier["statutory_basis"])

    # 2. Monotonic Anti-Clone Ratchet Counter Validation
    async with AsyncSessionLocal() as session:
        # Pre-set device ratchet to 100
        device = await session.get(EdgeDeviceModel, "LIRA-EDGE-01")
        if not device:
            device = EdgeDeviceModel(device_id="LIRA-EDGE-01", last_ratchet_counter=100)
            session.add(device)
            await session.commit()
        else:
            device.last_ratchet_counter = 100
            await session.commit()

        # Attack: Attacker presents cloned RFID card with older ratchet counter 85 < 100
        bad_payload = {
            "device_id": "LIRA-EDGE-01",
            "event_type": "RFID_TAG_OBSERVED",
            "rolling_ratchet_counter": 85,
            "device_seq": 9999
        }
        res = await process_edge_event(session, bad_payload, is_demo_injection=True)
        assert res["accepted"] is False
        assert res["cloned_tag_detected"] is True
        assert res["checkpoint_state"] == "CLONED_TAG_CRYPTO_REJECTED"


@pytest.mark.asyncio
async def test_v9_buttonless_resourcelock_atomic_commit():
    """
    Tests the PRD v9 Buttonless ResourceLock lifecycle:
    1. Issue work order with short-lived challenge code.
    2. Premature web commit rejected (TAG_NOT_YET_OBSERVED).
    3. Hardware RC522 scans matching tag (SCAN_OBSERVED -> TAG_OBSERVED).
    4. Custodian presses CONFIRM CHECKOUT ON WEBSITE -> atomic commitment, lease created, version incremented.
    5. Concurrent second commit fails (DOUBLE_CHECKOUT_PREVENTED / HTTP 400 or 409).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create work order
        create_res = await client.post("/api/v1/resource-work-orders", json={
            "resource_id": "RES-CHASSIS-40-01",
            "incident_id": "INC-C102",
            "plan_id": "PLAN-A",
            "plan_version": 1,
            "custodian_user_id": "USR-MGR",
            "target_device_id": "LIRA-EDGE-01"
        })
        assert create_res.status_code == 200
        wo_data = create_res.json()
        wo_id = wo_data["work_order_id"]
        challenge = wo_data["auth_challenge"]
        assert wo_data["status"] == "PENDING_SCAN"
        assert challenge.startswith("CHAL-")

        # 2. Premature commit without physical scan is rejected
        premature_res = await client.post(f"/api/v1/resource-work-orders/{wo_id}/commit", json={
            "auth_challenge": challenge,
            "operator_user_id": "USR-MGR",
            "notes": "Premature attempt"
        })
        assert premature_res.status_code == 400

        # 3. Simulate hardware RC522 physical scan of TAG_07
        scan_res = await client.post("/api/v1/edge/events", json={
            "device_id": "LIRA-EDGE-01",
            "event_type": "SCAN_OBSERVED",
            "tag_ref": "TAG_07",
            "work_order_id": wo_id
        })
        assert scan_res.status_code == 200
        scan_data = scan_res.json()
        assert scan_data["accepted"] is True
        assert scan_data["work_order_status"] == "TAG_OBSERVED"

        # 4. Authorized custodian presses CONFIRM CHECKOUT ON WEBSITE
        commit_res = await client.post(f"/api/v1/resource-work-orders/{wo_id}/commit", json={
            "auth_challenge": challenge,
            "operator_user_id": "USR-MGR",
            "notes": "Verified chassis roadworthiness on web portal."
        })
        assert commit_res.status_code == 200
        commit_data = commit_res.json()
        assert commit_data["status"] == "COMMITTED"
        assert commit_data["rule_code"] == "SUCCESS"
        assert commit_data["lease_id"].startswith("LSE-")

        # 5. Concurrent double-checkout attempt is rejected
        duplicate_res = await client.post(f"/api/v1/resource-work-orders/{wo_id}/commit", json={
            "auth_challenge": challenge,
            "operator_user_id": "USR-MGR"
        })
        assert duplicate_res.status_code in [400, 409]


@pytest.mark.asyncio
async def test_v9_decision_capsule_and_quarantine():
    """
    Tests:
    1. QpiAI Edge Decision Capsule endpoint (GET /api/v1/edge/{device_id}/decision-capsule)
       with snapshot hash, shortlist candidates, exclusion reasons, and HMAC signature.
    2. Inspection Failure Quarantine action (/inspect-quarantine).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test Decision Capsule
        capsule_res = await client.get("/api/v1/edge/LIRA-EDGE-01/decision-capsule")
        assert capsule_res.status_code == 200
        capsule = capsule_res.json()
        assert "snapshot_hash" in capsule
        assert capsule["capsule_status"] == "QPIAI_OPT_VALIDATED"
        assert len(capsule["shortlist_candidates"]) >= 2
        assert "T01" in capsule["exclusion_reasons"]
        assert len(capsule["signature"]) > 10

        # 2. Test Quarantine Action
        # Issue work order for chassis 02
        wo_res = await client.post("/api/v1/resource-work-orders", json={
            "resource_id": "RES-CHASSIS-40-02",
            "incident_id": "INC-C102",
            "custodian_user_id": "USR-MGR"
        })
        assert wo_res.status_code == 200
        wo_id = wo_res.json()["work_order_id"]

        # Custodian fails inspection and quarantines
        quar_res = await client.post(f"/api/v1/resource-work-orders/{wo_id}/inspect-quarantine", json={
            "defect_notes": "Rear twistlock pin sheered; unsafe for highway dispatch",
            "inspector_id": "USR-MGR"
        })
        assert quar_res.status_code == 200
        quar_data = quar_res.json()
        assert quar_data["status"] == "QUARANTINED"
        assert quar_data["resource_id"] == "RES-CHASSIS-40-02"

        # Verify resource is locked in registry
        check_res = await client.get("/api/v1/resources/RES-CHASSIS-40-02")
        assert check_res.status_code == 200
        assert check_res.json()["status"] == "QUARANTINED"


