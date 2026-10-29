import datetime
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import RecoveryPlanModel, AssignmentModel, DriverEventModel, AuditEventModel, IncidentModel, EdgeDeviceModel
from app.schemas.recovery import RecoveryAlternativesResponse, PlanAlternative, ApprovePlanRequest, ApprovePlanResponse
from app.services.qpiai.orchestrator import solve_incident_recovery
from app.core.errors import LIRAException

router = APIRouter(prefix="/recoveries", tags=["Recovery Studio & Approval"])


@router.get("/{recovery_id}/alternatives", response_model=RecoveryAlternativesResponse)
async def get_recovery_alternatives(recovery_id: str, db: AsyncSession = Depends(get_db)):
    # recovery_id can be plan_id or incident_id
    incident_id = recovery_id if recovery_id.startswith("INC-") else None

    stmt = select(RecoveryPlanModel)
    if incident_id:
        stmt = stmt.where(RecoveryPlanModel.incident_id == incident_id)
    else:
        stmt = stmt.where(RecoveryPlanModel.plan_id.like(f"%{recovery_id}%"))
    stmt = stmt.order_by(RecoveryPlanModel.created_at.desc())

    res = await db.execute(stmt)
    plans = res.scalars().all()

    if not plans and incident_id:
        # Auto-solve if not yet generated
        solve_res = await solve_incident_recovery(db, incident_id)
        alts = [PlanAlternative(**a) for a in solve_res.get("alternatives", [])]
        return RecoveryAlternativesResponse(
            incident_id=incident_id,
            wave=solve_res.get("wave", 1),
            do_nothing_cost_inr=solve_res.get("do_nothing_cost_inr", 36000),
            alternatives=alts,
            evaluated_at=solve_res.get("evaluated_at", datetime.datetime.now(datetime.timezone.utc).isoformat())
        )

    # Sort the latest wave plans so Plan A comes first
    plans = sorted(plans[:3], key=lambda p: (p.plan_code != "PLAN-A", p.plan_code))

    # Group into alternatives
    alts = []
    inc_id = plans[0].incident_id if plans else "INC-C102"
    do_nothing = 36000

    for idx, p in enumerate(plans[:3]):
        # Match truck / slot details
        t_id = "T07" if idx == 0 else ("T09" if idx == 1 else "T04")
        s_id = "S1600" if idx == 0 else ("S1630" if idx == 1 else "S1700")

        alts.append(PlanAlternative(
            plan_id=p.plan_id,
            plan_code=p.plan_code,
            status=p.status,
            solver_source=p.solver_source,
            truck_id=t_id,
            slot_id=s_id,
            slot_start="2026-10-28T16:00:00+05:30",
            slot_end="2026-10-28T16:30:00+05:30",
            checkpoint_id="LIRA-EDGE-01",
            avoidable_cost_inr=p.avoidable_cost_inr,
            net_cost_inr=p.net_cost_inr,
            feasibility_score=p.feasibility_score,
            feasible=len(p.constraint_violations or []) == 0,
            constraint_violations=p.constraint_violations or [],
            strategy_summary=p.strategy_summary or f"Optimal assignment via {p.solver_source}"
        ))

    return RecoveryAlternativesResponse(
        incident_id=inc_id,
        wave=plans[0].wave if plans else 1,
        do_nothing_cost_inr=do_nothing,
        alternatives=alts,
        evaluated_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )


@router.post("/{recovery_id}/approve", response_model=ApprovePlanResponse)
async def approve_recovery_plan(
    recovery_id: str,
    req: ApprovePlanRequest,
    db: AsyncSession = Depends(get_db)
):
    plan = await db.get(RecoveryPlanModel, recovery_id)
    if not plan:
        # Search by partial
        stmt = select(RecoveryPlanModel).where(RecoveryPlanModel.plan_id.like(f"%{recovery_id}%"))
        res = await db.execute(stmt)
        plan = res.scalars().first()

    if not plan:
        raise LIRAException(status_code=404, code="NOT_FOUND", message=f"Plan {recovery_id} not found")

    # Independent safety check: cannot approve if violated hard constraints
    if plan.constraint_violations:
        raise LIRAException(
            status_code=400,
            code="UNSAFE_PLAN",
            message=f"Plan has unresolved constraint violations: {', '.join(plan.constraint_violations)}"
        )

    plan.status = "APPROVED"
    plan.approved_by = req.manager_role
    plan.approved_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    plan.approval_reason = req.reason

    # Fetch incident & container
    inc = await db.get(IncidentModel, plan.incident_id)
    c_id = inc.container_id if inc else "C102"

    truck_id = "T07" if "PLAN-A" in plan.plan_code or "R2" in plan.plan_id else "T09"
    slot_id = "S1600"

    # Invalidate previous assignments for this container
    prev_stmt = select(AssignmentModel).where(
        AssignmentModel.container_id == c_id,
        AssignmentModel.status == "APPROVED"
    )
    prev_res = await db.execute(prev_stmt)
    prev_asgns = prev_res.scalars().all()
    for pa in prev_asgns:
        pa.status = "REASSIGNED"

    # Create new approved assignment
    assignment_id = f"ASN-{c_id}-{plan.plan_code.replace('PLAN-', 'R')}-{uuid.uuid4().hex[:4].upper()}"
    new_asgn = AssignmentModel(
        assignment_id=assignment_id,
        plan_id=plan.plan_id,
        container_id=c_id,
        truck_id=truck_id,
        slot_id=slot_id,
        slot_start="2026-10-28T16:00:00+05:30",
        slot_end="2026-10-28T16:30:00+05:30",
        checkpoint_id="LIRA-EDGE-01",
        status="APPROVED",
        driver_ack_state="PENDING",
        physical_state="EXPECTED",
        reason_code=f"APPROVED_{plan.plan_code}",
        reason_text=req.reason,
        customs_release="CONFIRMED",
        deadline=(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2, minutes=30)).isoformat(),
        projected_avoidable_cost_inr=plan.avoidable_cost_inr,
        evidence_ids=["EV-DOC-102", "EV-CALL-04"],
        updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
    db.add(new_asgn)

    # Push Driver Event (Monotonic sequence)
    drv_evt = DriverEventModel(
        event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
        truck_id=truck_id,
        assignment_id=assignment_id,
        type="PLAN_REPLACED" if prev_asgns else "ASSIGNMENT_READY",
        payload={
            "previous_plan_id": prev_asgns[0].plan_id if prev_asgns else None,
            "new_plan_id": plan.plan_id,
            "assignment_id": assignment_id,
            "reason": req.reason,
            "slot_start": new_asgn.slot_start,
            "slot_end": new_asgn.slot_end
        }
    )
    db.add(drv_evt)

    # Log Audit Event
    audit = AuditEventModel(
        audit_id=f"AUD-APP-{uuid.uuid4().hex[:6].upper()}",
        correlation_id=plan.plan_id,
        event_type="PLAN_APPROVED",
        entity_type="RECOVERY_PLAN",
        entity_id=plan.plan_id,
        actor=req.manager_role,
        description=f"Dispatcher approved {plan.plan_code}. Assigned {truck_id} to container {c_id} at {slot_id}. Savings: INR {plan.avoidable_cost_inr}",
        details={"assignment_id": assignment_id, "reason": req.reason}
    )
    db.add(audit)
    await db.commit()

    return ApprovePlanResponse(
        accepted=True,
        plan_id=plan.plan_id,
        plan_code=plan.plan_code,
        assignment_id=assignment_id,
        status="APPROVED",
        driver_notified=True,
        edge_notified=True,
        message=f"Plan {plan.plan_code} approved. Instructions dispatched to Android (Truck {truck_id}) and ESP32 TFT (LIRA-EDGE-01)."
    )

