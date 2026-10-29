"""
LIRA Demo Seed Dataset — PRD v7.0 Normative Implementation
Seeds:
1. Flagship C102: AEO-T2 Certified, RMS-Facilitated Import Reefer Container (OOC Confirmed)
   facing 48-Hour DPD Evacuation Cliff, Bank UTR Reconciliation Lag, 26,400 kg Tri-Axle + Genset APU,
   and NH-348 Monsoon Delay.
2. Yard Marshal Staging Bay Terminal (Pre-Gate Last-500m RFID + Touch Attestation).
3. Monotonically sequenced driver events and cryptographic edge devices.
"""

import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import (
    UserModel, TruckModel, ContainerModel, SlotModel, ShipmentModel,
    EvidenceRecordModel, IncidentModel, BlockerNodeModel, DependencyEdgeModel,
    ExternalEventModel, RecoveryPlanModel, AssignmentModel, DriverEventModel,
    EdgeDeviceModel, EdgeEventModel, AuditEventModel, GoldLabelModel,
    ResourceRegistryModel, ResourceWorkOrderModel
)
from app.services.metrics.gold_labels import GOLD_DATASET


async def seed_live_demo_data(db: AsyncSession):
    # 0. Always ensure Resource Registry is populated and clean
    from app.db.models import ResourceWorkOrderModel, ResourceLeaseModel
    res_chk = await db.execute(select(ResourceRegistryModel).where(ResourceRegistryModel.resource_id == "RES-CHASSIS-40-01"))
    if not res_chk.scalars().first():
        resources = [
            ResourceRegistryModel(
                resource_id="RES-CHASSIS-40-01",
                resource_type="CHASSIS_40FT",
                name="40ft Tri-Axle Skeletal Chassis #01",
                tag_ref="TAG_07",
                status="INSPECTED_AVAILABLE",
                location="JNPA Pre-Gate Bay 01",
                specs={"tare_weight_kg": 4200, "payload_capacity_kg": 32000, "axles": 3, "twistlocks": 4}
            ),
            ResourceRegistryModel(
                resource_id="RES-CHASSIS-40-02",
                resource_type="CHASSIS_40FT",
                name="40ft Tri-Axle Skeletal Chassis #02",
                tag_ref="TAG_09",
                status="INSPECTED_AVAILABLE",
                location="JNPA Pre-Gate Bay 02",
                specs={"tare_weight_kg": 4150, "payload_capacity_kg": 32000, "axles": 3, "twistlocks": 4}
            ),
            ResourceRegistryModel(
                resource_id="RES-GENSET-04",
                resource_type="REEFER_GENSET",
                name="Carrier Transicold APU Genset #04",
                tag_ref="TAG_GENSET_04",
                status="INSPECTED_AVAILABLE",
                location="JNPA Equipment Yard B",
                specs={"output_kw": 18.5, "fuel_tank_liters": 120, "voltage": 460}
            ),
            ResourceRegistryModel(
                resource_id="RES-CHASSIS-QUAR",
                resource_type="CHASSIS_40FT",
                name="Damaged Twistlock Chassis #09",
                tag_ref="TAG_QUARANTINE_09",
                status="QUARANTINED",
                location="JNPA Maintenance Quarantine Lane 4",
                specs={"defect": "Rear left twistlock cracked; do not dispatch"}
            )
        ]
        db.add_all(resources)
        await db.commit()
    else:
        # Reset test resources to clean state for tests/demo
        all_res_q = await db.execute(select(ResourceRegistryModel))
        for r in all_res_q.scalars().all():
            if r.resource_id in ["RES-CHASSIS-40-01", "RES-CHASSIS-40-02", "RES-GENSET-04"]:
                r.status = "INSPECTED_AVAILABLE"
                r.current_holder_user_id = None
            elif r.resource_id == "RES-CHASSIS-QUAR":
                r.status = "QUARANTINED"
        # Cancel any dangling active work orders for clean demo
        wos = await db.execute(select(ResourceWorkOrderModel).where(
            ResourceWorkOrderModel.status.in_(["ISSUED", "TAG_OBSERVED"])
        ))
        for wo in wos.scalars().all():
            wo.status = "CANCELLED"
        await db.commit()

    # Check if containers already seeded
    res = await db.execute(select(ContainerModel).where(ContainerModel.container_id == "C102"))
    if res.scalars().first():
        return  # already seeded

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    free_deadline_c102 = "2026-10-28T18:30:00+05:30"
    delivery_deadline_c102 = "2026-10-28T22:00:00+05:30"

    # 1. Edge Device — Yard Marshal Staging Terminal
    device = EdgeDeviceModel(
        device_id="LIRA-EDGE-01",
        name="Yard Marshal Staging Bay Terminal (Pre-Gate Last-500m RFID + Touch Attestation — Complements Macro NLDS LDB / ULIP Highway Tracking)",
        location="JNPA Terminal Bay 01 Staging Checkpoint",
        hmac_key="edge_hmac_secret_key_lira_01",
        is_online=True,
        last_heartbeat=now_iso,
        last_sequence=183
    )
    db.add(device)

    # 2. Users
    users = [
        UserModel(id="USR-T07", user_code="DRIVER_T07", role="DRIVER", display_name="Driver T07", truck_id="T07"),
        UserModel(id="USR-T04", user_code="DRIVER_T04", role="DRIVER", display_name="Driver T04", truck_id="T04"),
        UserModel(id="USR-T09", user_code="DRIVER_T09", role="DRIVER", display_name="Driver T09", truck_id="T09"),
        UserModel(id="USR-DISP", user_code="DISPATCHER_01", role="DISPATCHER", display_name="Chief Port Dispatcher"),
        UserModel(id="USR-MGR", user_code="OPS_MANAGER_01", role="OPS_MANAGER", display_name="Port Logistics Director"),
    ]
    db.add_all(users)

    # 3. Trucks
    trucks = [
        TruckModel(
            truck_id="T07",
            driver_id="USR-T07",
            capacity_teu=2,
            payload_capacity_kg=28000.0,
            driver_hours_used=3.5,
            driver_hours_max=10.0,
            location_lat=18.945,
            location_lng=72.952,
            location_eta="2026-10-28T15:45:00+05:30",
            availability="AVAILABLE"
        ),
        TruckModel(
            truck_id="T04",
            driver_id="USR-T04",
            capacity_teu=2,
            payload_capacity_kg=28000.0,
            driver_hours_used=5.5,
            driver_hours_max=10.0,
            location_lat=18.910,
            location_lng=73.010,
            location_eta="2026-10-28T16:45:00+05:30",
            availability="DELAYED"
        ),
        TruckModel(
            truck_id="T09",
            driver_id="USR-T09",
            capacity_teu=2,
            payload_capacity_kg=30000.0,
            driver_hours_used=2.0,
            driver_hours_max=10.0,
            location_lat=18.960,
            location_lng=72.940,
            location_eta="2026-10-28T16:15:00+05:30",
            availability="AVAILABLE"
        ),
    ]
    db.add_all(trucks)

    # 4. Containers — Grounded Indian Customs & Terminal Attributes
    containers = [
        ContainerModel(
            container_id="C102",
            size_ft=40,
            cargo_type="PERISHABLE_REEFER",
            weight_kg=26400.0,
            special_handling="AEO_T2_RMS_FACILITATED",
            release_state="CONFIRMED",
            free_time_deadline=free_deadline_c102,
            delivery_deadline=delivery_deadline_c102,
            demurrage_rate_per_hr=4500,
            late_delivery_penalty_per_hr=7000
        ),
        ContainerModel(
            container_id="C105",
            size_ft=40,
            cargo_type="AUTO_COMPONENTS",
            weight_kg=26000.0,
            special_handling="HEAVY",
            release_state="NEEDS_VERIFICATION",
            free_time_deadline="2026-10-28T19:30:00+05:30",
            delivery_deadline="2026-10-28T23:30:00+05:30",
            demurrage_rate_per_hr=3500,
            late_delivery_penalty_per_hr=6000
        ),
        ContainerModel(
            container_id="C107",
            size_ft=20,
            cargo_type="ELECTRONICS",
            weight_kg=16800.0,
            special_handling="HIGH_VALUE",
            release_state="CONFIRMED",
            free_time_deadline="2026-10-28T17:45:00+05:30",
            delivery_deadline="2026-10-28T21:00:00+05:30",
            demurrage_rate_per_hr=4000,
            late_delivery_penalty_per_hr=7000
        ),
        ContainerModel(
            container_id="C208",
            size_ft=40,
            cargo_type="GENERAL_DRY_CARGO",
            weight_kg=18500.0,
            special_handling="STANDARD",
            release_state="CONFIRMED",
            free_time_deadline="2026-10-31T18:00:00+05:30",  # 72h free time remaining, ₹0 demurrage today
            delivery_deadline="2026-11-01T12:00:00+05:30",
            demurrage_rate_per_hr=0,
            late_delivery_penalty_per_hr=0,
            assigned_slot_id="S1700",
            slot_yield_rebate_inr=3000
        )
    ]
    db.add_all(containers)

    # 5. Slots
    slots = [
        SlotModel(slot_id="S1600", bay_number="BAY-01", start_at="2026-10-28T16:00:00+05:30", end_at="2026-10-28T16:30:00+05:30", bay_capacity=1, eligible_equipment="CHASSIS_40FT_TRI_AXLE", confirmed_status="CONFIRMED"),
        SlotModel(slot_id="S1630", bay_number="BAY-02", start_at="2026-10-28T16:30:00+05:30", end_at="2026-10-28T17:00:00+05:30", bay_capacity=1, eligible_equipment="CHASSIS_40FT_TRI_AXLE", confirmed_status="CONFIRMED"),
        SlotModel(slot_id="S1700", bay_number="BAY-01", start_at="2026-10-28T17:00:00+05:30", end_at="2026-10-28T17:30:00+05:30", bay_capacity=1, eligible_equipment="CHASSIS_40FT_TRI_AXLE", confirmed_status="CONFIRMED"),
        SlotModel(slot_id="S1730", bay_number="BAY-02", start_at="2026-10-28T17:30:00+05:30", end_at="2026-10-28T18:00:00+05:30", bay_capacity=1, eligible_equipment="CHASSIS_40FT_TRI_AXLE", confirmed_status="CONFIRMED"),
    ]
    db.add_all(slots)

    # 6. Shipments
    shipments = [
        ShipmentModel(shipment_id="SHP-C102", container_id="C102", bill_of_lading_alias="BL-MAEU-98214", importer_name="Bajaj Logistics Ltd (AEO-T2)", customs_broker="Omega Freight Brokerage"),
        ShipmentModel(shipment_id="SHP-C105", container_id="C105", bill_of_lading_alias="BL-MSCU-44102", importer_name="Mahindra Auto Components", customs_broker="TransIndia Clearing"),
        ShipmentModel(shipment_id="SHP-C107", container_id="C107", bill_of_lading_alias="BL-CMA-77319", importer_name="Foxconn Electronics Mumbai", customs_broker="Apex CHA Logistics"),
        ShipmentModel(shipment_id="SHP-C208", container_id="C208", bill_of_lading_alias="BL-HLCU-88201", importer_name="Tata Consumer Products (Dry Grains)", customs_broker="TransIndia Clearing")
    ]
    db.add_all(shipments)

    # 7. Initial Flagship Incident C102 (PRD v7.0 Normative)
    incident = IncidentModel(
        incident_id="INC-C102",
        container_id="C102",
        title="AEO-T2 RMS Reefer Exception: 48h DPD Evacuation Cliff vs e-DO Hold & Heavy-Haul",
        severity="CRITICAL",
        status="OPEN",
        root_blocker_code="PAYMENT_RECONCILIATION_DELAY",
        owner_role="SHIPPING_LINE_AGENT",
        action_deadline="2026-10-28T18:30:00+05:30",
        projected_avoidable_cost_inr=38000,
        do_nothing_cost_inr=48500
    )
    db.add(incident)

    # 8. Blocker Nodes & Edges
    node1 = BlockerNodeModel(
        node_id="NODE-102-1",
        incident_id="INC-C102",
        container_id="C102",
        code="DPD_EVACUATION_CLIFF",
        claim="AEO-T2 Certified, RMS-Facilitated Import Reefer: T1 Customs OOC is CONFIRMED; facing strict 48-Hour DPD Evacuation Cliff before forced CFS transfer spike",
        quote="AEO-T2 certified RMS-facilitated Out-of-Charge confirmed. DPD 48h evacuation deadline 18:30 IST",
        start_char=10,
        end_char=104,
        authority_tier="T1",
        status="HARD_BLOCKER",
        responsible_role="CUSTOMS_BROKER",
        evidence_id="EV-DOC-102"
    )
    node2 = BlockerNodeModel(
        node_id="NODE-102-2",
        incident_id="INC-C102",
        container_id="C102",
        code="PAYMENT_RECONCILIATION_DELAY",
        claim="Shipping line e-DO withheld due to Bank UTR reconciliation lag ahead of 16:30 IST counter cutoff",
        quote="e-DO hold: Bank UTR settlement pending counter ledger reconciliation before 16:30 cutoff",
        start_char=110,
        end_char=198,
        authority_tier="T2",
        status="NEEDS_VERIFICATION",
        responsible_role="SHIPPING_LINE_AGENT",
        evidence_id="EV-DOC-102"
    )
    node3 = BlockerNodeModel(
        node_id="NODE-102-3",
        incident_id="INC-C102",
        container_id="C102",
        code="TRI_AXLE_REQUIRED",
        claim="Gross payload 26,400 kg mandates heavy-haul 3-Axle Prime Mover + Active Reefer Genset APU",
        quote="Gross payload: 26,400 kg. Tri-axle prime mover with clip-on genset APU required",
        start_char=205,
        end_char=284,
        authority_tier="T1",
        status="HARD_BLOCKER",
        responsible_role="DISPATCHER",
        evidence_id="EV-DOC-102"
    )
    node4 = BlockerNodeModel(
        node_id="NODE-102-4",
        incident_id="INC-C102",
        container_id="C102",
        code="T04_ETA_CONFLICT",
        claim="NH-348 monsoon congestion delaying designated Truck T04 (ETA 16:45) beyond terminal slot S1600",
        quote="Driver T04 ETA: 16:45 due to NH-348 waterlogging",
        start_char=45,
        end_char=93,
        authority_tier="T3",
        status="NEEDS_VERIFICATION",
        responsible_role="DISPATCHER",
        evidence_id="EV-CALL-04"
    )
    db.add_all([node1, node2, node3, node4])

    edge1 = DependencyEdgeModel(edge_id="EDGE-102-1", incident_id="INC-C102", source_node_id="NODE-102-1", target_node_id="NODE-102-2", relationship_type="BLOCKS")
    edge2 = DependencyEdgeModel(edge_id="EDGE-102-2", incident_id="INC-C102", source_node_id="NODE-102-2", target_node_id="NODE-102-3", relationship_type="BLOCKS")
    edge3 = DependencyEdgeModel(edge_id="EDGE-102-3", incident_id="INC-C102", source_node_id="NODE-102-3", target_node_id="NODE-102-4", relationship_type="BLOCKS")
    db.add_all([edge1, edge2, edge3])

    # 9. Evidence Records
    ev1 = EvidenceRecordModel(
        evidence_id="EV-DOC-102",
        container_id="C102",
        source_id="ICEGATE-OOC-8910",
        source_type="EDI",
        tier="T1",
        quote="AEO-T2 certified RMS-facilitated Out-of-Charge confirmed. DPD 48h evacuation deadline 18:30 IST",
        start_char=10,
        end_char=104,
        raw_source_text="Customs: AEO-T2 certified RMS-facilitated Out-of-Charge confirmed. DPD 48h evacuation deadline 18:30 IST. Carrier Notice: e-DO hold: Bank UTR settlement pending counter ledger reconciliation before 16:30 cutoff. Equipment: Gross payload: 26,400 kg. Tri-axle prime mover with clip-on genset APU required.",
        freshness_minutes=10
    )
    ev2 = EvidenceRecordModel(
        evidence_id="EV-CALL-04",
        container_id="C102",
        source_id="CALL-BOLNA-T04",
        source_type="PHONE_CONFIRMATION",
        tier="T3",
        quote="Driver T04 ETA: 16:45 due to NH-348 waterlogging",
        start_char=45,
        end_char=93,
        raw_source_text="Voice verification with Driver T04. Status: Driver T04 ETA: 16:45 due to NH-348 waterlogging near Jasai bypass.",
        freshness_minutes=5
    )
    db.add_all([ev1, ev2])

    # 10. External Event — Monsoon Arterial Delay
    ext_event = ExternalEventModel(
        event_id="EXT-01",
        type="HEAVY_RAIN",
        trust_state="FORECAST_RISK",
        severity="HIGH",
        title="Monsoon Waterlogging on NH-348 Arterial Approach",
        source_label="OpenWeather / IMD Radar Feed",
        geography="Nhava Sheva NH-348 Corridor",
        starts_at="2026-10-28T15:00:00+05:30",
        ends_at="2026-10-28T19:00:00+05:30",
        affected_trucks=["T04"],
        affected_slots=[],
        is_simulated=True
    )
    db.add(ext_event)

    # 11. Initial Recovery Plan (Plan A)
    plan = RecoveryPlanModel(
        plan_id="PLAN-R2",
        incident_id="INC-C102",
        wave=1,
        plan_code="PLAN-A",
        status="APPROVED",
        solver_source="QPIAI_QCLOUD_QAOA",
        avoidable_cost_inr=38000,
        net_cost_inr=10500,
        feasibility_score=1.0,
        constraint_violations=[],
        strategy_summary="Reassign to 3-axle prime mover T07 with active Genset APU at Bay 01 Slot S1600; clear UTR fast-track queue to beat 18:30 DPD cliff.",
        approved_by="DISPATCHER_01",
        approved_at=now_iso,
        approval_reason="Optimal quantum recovery saving Rs 38,000 in avoided CFS transfer and demurrage penalty"
    )
    db.add(plan)

    # 12. Initial Assignment
    assignment = AssignmentModel(
        assignment_id="ASN-102-R2",
        plan_id="PLAN-R2",
        container_id="C102",
        truck_id="T07",
        slot_id="S1600",
        slot_start="2026-10-28T16:00:00+05:30",
        slot_end="2026-10-28T16:30:00+05:30",
        checkpoint_id="LIRA-EDGE-01",
        status="APPROVED",
        driver_ack_state="ACKNOWLEDGED",
        physical_state="EXPECTED",
        reason_code="T04_ETA_CONFLICT",
        reason_text="Assigned 3-axle reefer truck T07 to avoid NH-348 delay",
        customs_release="CONFIRMED",
        deadline=free_deadline_c102,
        projected_avoidable_cost_inr=38000,
        evidence_ids=["EV-DOC-102", "EV-CALL-04"],
        updated_at="2026-10-28T15:30:00+05:30"
    )
    db.add(assignment)

    # 13. Driver Event
    drv_evt = DriverEventModel(
        event_id="EVT-122",
        sequence=122,
        truck_id="T07",
        assignment_id="ASN-102-R2",
        type="ASSIGNMENT_READY",
        payload={
            "plan_id": "PLAN-R2",
            "slot_id": "S1600",
            "bay": "BAY-01",
            "checkpoint": "Yard Marshal Staging Bay Terminal"
        },
        created_at="2026-10-28T15:32:00+05:30"
    )
    db.add(drv_evt)

    # 14. Initial Audit Event
    audit = AuditEventModel(
        audit_id="AUD-INIT-01",
        correlation_id="INC-C102",
        event_type="INCIDENT_INITIALIZED",
        entity_type="INCIDENT",
        entity_id="INC-C102",
        actor="SYSTEM",
        description="LIRA Core initialized container C102 (AEO-T2 RMS Reefer) with 4-node causal DAG and approved Plan A.",
        details={"plan_id": "PLAN-R2", "savings": 38000}
    )
    db.add(audit)

    # 15. Seed Gold Labels
    for g in GOLD_DATASET:
        label = GoldLabelModel(
            label_id=g["label_id"],
            document_name=g["document_name"],
            text_snippet=g["text_snippet"],
            has_blocker=g["has_blocker"],
            blocker_type=g["blocker_type"],
            is_distractor=g["is_distractor"],
            is_stale=g["is_stale"],
            expected_status=g["expected_status"],
            ground_truth_quote=g["ground_truth_quote"]
        )
        db.add(label)

    await db.commit()
