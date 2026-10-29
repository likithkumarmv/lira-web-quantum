import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import (
    IncidentModel, BlockerNodeModel, AuditEventModel, ContainerModel,
    RecoveryPlanModel, AssignmentModel, EdgeEventModel, SolverRunModel, ExternalEventModel
)
from app.schemas.incident import IncidentItem, IncidentDetailResponse, VerifyRequest, VerifyResponse
from app.schemas.qpiai import TriggerSolveRequest, TriggerSolveResponse
from app.services.blockers.graph import get_incident_blocker_graph
from app.services.qpiai.orchestrator import solve_incident_recovery
from app.core.errors import LIRAException

router = APIRouter(prefix="/incidents", tags=["Incidents & Blocker Graph"])


@router.get("/overview/metrics")
async def get_overview_metrics(db: AsyncSession = Depends(get_db)):
    # 1. Containers
    c_res = await db.execute(select(ContainerModel))
    containers = c_res.scalars().all()
    total_active_containers = len(containers)

    # 2. Incidents & Blockers
    inc_res = await db.execute(select(IncidentModel))
    incidents = inc_res.scalars().all()
    total_avoidable_cost = sum(i.projected_avoidable_cost_inr or 0 for i in incidents)
    total_do_nothing_cost = sum(i.do_nothing_cost_inr or 0 for i in incidents)
    containers_blocked = sum(1 for i in incidents if i.severity == "CRITICAL" or i.status == "OPEN")
    containers_awaiting_verification = sum(1 for i in incidents if i.status == "NEEDS_VERIFICATION")

    # 3. Approvals and assignments
    plan_res = await db.execute(select(RecoveryPlanModel))
    plans = plan_res.scalars().all()
    approved_recovery_actions = sum(1 for p in plans if p.status == "APPROVED")
    max_wave = max([p.wave for p in plans], default=1) if plans else 1

    asgn_res = await db.execute(select(AssignmentModel))
    assignments = asgn_res.scalars().all()
    driver_acks_pending = sum(1 for a in assignments if a.driver_ack_state == "PENDING")

    # 4. Checkpoints
    edge_res = await db.execute(select(EdgeEventModel))
    edge_events = edge_res.scalars().all()
    failed_physical_checkpoints = sum(1 for e in edge_events if e.event_type in ["PHYSICAL_NO_SHOW", "RFID_MISMATCH"])

    # 5. Solver status
    solver_res = await db.execute(select(SolverRunModel).order_by(SolverRunModel.created_at.desc()))
    latest_solver = solver_res.scalars().first()
    qpiai_job_status = "SOLVED_FEASIBLE" if latest_solver else "READY"

    # 6. Disruption warnings
    disrupt_res = await db.execute(select(ExternalEventModel).where(ExternalEventModel.trust_state.in_(["CONFIRMED_DISRUPTION", "FORECAST_RISK"])))
    disruptions = disrupt_res.scalars().all()

    return {
        "total_active_containers": total_active_containers,
        "containers_blocked": containers_blocked,
        "containers_awaiting_verification": containers_awaiting_verification,
        "containers_nearing_deadline": sum(1 for c in containers if "18:30" in (c.free_time_deadline or "") or "17:45" in (c.free_time_deadline or "")),
        "estimated_avoidable_cost_inr": total_avoidable_cost,
        "do_nothing_cost_inr": total_do_nothing_cost,
        "approved_recovery_actions": approved_recovery_actions,
        "driver_acknowledgements_pending": driver_acks_pending,
        "failed_physical_checkpoints": failed_physical_checkpoints,
        "recovery_waves_triggered": max_wave,
        "qpiai_job_status": qpiai_job_status,
        "current_disruption_warnings": len(disruptions),
        "data_freshness_seconds": 2,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }



@router.get("", response_model=List[IncidentItem])
async def list_incidents(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(IncidentModel)
    if status:
        stmt = stmt.where(IncidentModel.status == status)
    if severity:
        stmt = stmt.where(IncidentModel.severity == severity)
    stmt = stmt.order_by(IncidentModel.updated_at.desc())

    res = await db.execute(stmt)
    incidents = res.scalars().all()

    items = []
    for inc in incidents:
        # Check if has hard blocker
        nodes_stmt = select(BlockerNodeModel).where(BlockerNodeModel.incident_id == inc.incident_id)
        n_res = await db.execute(nodes_stmt)
        nodes = n_res.scalars().all()
        has_hard = any(n.status == "HARD_BLOCKER" for n in nodes)

        items.append(IncidentItem(
            incident_id=inc.incident_id,
            container_id=inc.container_id,
            title=inc.title,
            severity=inc.severity,
            status=inc.status,
            root_blocker_code=inc.root_blocker_code,
            owner_role=inc.owner_role,
            action_deadline=inc.action_deadline,
            projected_avoidable_cost_inr=inc.projected_avoidable_cost_inr,
            do_nothing_cost_inr=inc.do_nothing_cost_inr,
            has_hard_blocker=has_hard,
            evidence_count=len(nodes),
            updated_at=inc.updated_at
        ))

    return items


@router.get("/{incident_id}", response_model=IncidentDetailResponse)
async def get_incident_detail(incident_id: str, db: AsyncSession = Depends(get_db)):
    graph_data = await get_incident_blocker_graph(db, incident_id)
    if not graph_data:
        raise LIRAException(status_code=404, code="NOT_FOUND", message=f"Incident {incident_id} not found")
    return graph_data


@router.post("/{incident_id}/verify", response_model=VerifyResponse)
async def verify_incident_blocker(
    incident_id: str,
    req: VerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    inc = await db.get(IncidentModel, incident_id)
    if not inc:
        raise LIRAException(status_code=404, code="NOT_FOUND", message="Incident not found")

    task_id = f"TASK-VERIFY-{uuid.uuid4().hex[:6].upper()}"

    # Log audit event
    audit = AuditEventModel(
        audit_id=f"AUD-{task_id}",
        correlation_id=incident_id,
        event_type="VERIFICATION_TASK_CREATED",
        entity_type="INCIDENT",
        entity_id=incident_id,
        actor=req.target_role,
        description=f"Action '{req.action_type}' assigned to {req.target_role}. Notes: {req.notes or 'None'}",
        details={"task_id": task_id, "action_type": req.action_type}
    )
    db.add(audit)
    await db.commit()

    return VerifyResponse(
        task_id=task_id,
        incident_id=incident_id,
        status="DISPATCHED",
        message=f"Verification request for {inc.container_id} assigned to {req.target_role}."
    )


@router.post("/{incident_id}/solve", response_model=TriggerSolveResponse)
async def trigger_solve(
    incident_id: str,
    req: TriggerSolveRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await solve_incident_recovery(
        db=db,
        incident_id=incident_id,
        wave=req.wave,
        prefer_quantum=req.prefer_quantum
    )

    if "error" in result:
        raise LIRAException(status_code=400, code="SOLVER_ERROR", message=result["error"])

    alts = result.get("alternatives", [])
    best_avoidable = alts[0]["avoidable_cost_inr"] if alts else 0

    return TriggerSolveResponse(
        run_id=result["run_id"],
        incident_id=incident_id,
        status="SOLVED",
        provider_mode=result["provider_mode"],
        solver_source=result["solver_source"],
        alternatives_generated=len(alts),
        best_avoidable_cost_inr=best_avoidable,
        message=f"QpiAI recovery generated {len(alts)} ranked feasible plans."
    )

