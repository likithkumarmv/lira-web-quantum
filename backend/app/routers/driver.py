import asyncio
import datetime
import json
import uuid
from typing import Optional, Set
from fastapi import APIRouter, Depends, Query, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.session import get_db
from app.db.models import AssignmentModel, TruckModel, ExternalEventModel, DriverEventModel, EdgeEventModel
from app.schemas.driver import (
    DriverAssignmentsResponse, AssignmentItem,
    DriverAckRequest, DriverAckResponse,
    DriverEtaRequest, DriverEtaResponse,
    DriverDisruptionsResponse, DisruptionItem,
    DriverEventsResponse, DriverEventItem,
    CheckpointStatusResponse
)
from app.core.security import get_current_driver
from app.core.errors import LIRAException

router = APIRouter(prefix="/driver", tags=["Driver Mobile Contract"])

# In-memory pub/sub queues for live SSE driver stream
_DRIVER_QUEUES: Set[asyncio.Queue] = set()


def broadcast_driver_event(event_data: dict):
    """Broadcast an SSE event payload to all connected driver clients."""
    msg_str = f"data: {json.dumps(event_data)}\n\n"
    for q in list(_DRIVER_QUEUES):
        try:
            q.put_nowait(msg_str)
        except Exception:
            _DRIVER_QUEUES.discard(q)


@router.get("/stream")
async def driver_sse_stream(request: Request):
    """
    SSE stream for driver mobile app.
    Emits live updates: reserve_assigned, live_incident, plan_superseded, assignment_updated.
    """
    queue: asyncio.Queue = asyncio.Queue()
    _DRIVER_QUEUES.add(queue)

    async def event_generator():
        try:
            # Send initial keepalive
            yield f"data: {json.dumps({'type': 'connected', 'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat()})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield f": keepalive\n\n"
        finally:
            _DRIVER_QUEUES.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/assignments/{assignment_id}/why")
async def get_assignment_why(
    assignment_id: str,
    db: AsyncSession = Depends(get_db)
):
    assignment = await db.get(AssignmentModel, assignment_id)
    if not assignment:
        raise LIRAException(status_code=404, code="NOT_FOUND", message="Assignment not found")

    return {
        "assignment_id": assignment.assignment_id,
        "plan_id": assignment.plan_id,
        "container_id": assignment.container_id,
        "truck_id": assignment.truck_id,
        "reason_code": assignment.reason_code,
        "reason_text": assignment.reason_text,
        "origin": getattr(assignment, "origin", "DISPATCHER"),
        "assignment_kind": getattr(assignment, "assignment_kind", "ACTIVE"),
        "projected_avoidable_cost_inr": assignment.projected_avoidable_cost_inr,
        "evidence_ids": assignment.evidence_ids or []
    }



@router.get("/assignments", response_model=DriverAssignmentsResponse)
async def get_driver_assignments(
    current_user: dict = Depends(get_current_driver),
    db: AsyncSession = Depends(get_db)
):
    truck_id = current_user.get("truck_id")
    stmt = select(AssignmentModel)
    if truck_id:
        stmt = stmt.where(AssignmentModel.truck_id == truck_id)

    stmt = stmt.order_by(AssignmentModel.updated_at.desc())
    res = await db.execute(stmt)
    assignments = res.scalars().all()

    items = []
    for a in assignments:
        items.append(AssignmentItem(
            assignment_id=a.assignment_id,
            plan_id=a.plan_id,
            container_id=a.container_id,
            truck_id=a.truck_id,
            slot_id=a.slot_id,
            slot_start=a.slot_start,
            slot_end=a.slot_end,
            checkpoint_id=a.checkpoint_id,
            status=a.status,
            driver_ack_state=a.driver_ack_state,
            physical_state=a.physical_state,
            reason_code=a.reason_code,
            reason_text=a.reason_text,
            customs_release=a.customs_release,
            deadline=a.deadline,
            projected_avoidable_cost_inr=a.projected_avoidable_cost_inr,
            evidence_ids=a.evidence_ids or [],
            assignment_kind=getattr(a, "assignment_kind", "ACTIVE"),
            origin=getattr(a, "origin", "DISPATCHER"),
            updated_at=a.updated_at
        ))

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return DriverAssignmentsResponse(items=items, updated_at=now_iso)


@router.post("/assignments/{assignment_id}/ack", response_model=DriverAckResponse)
async def ack_assignment(
    assignment_id: str,
    req: DriverAckRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: dict = Depends(get_current_driver),
    db: AsyncSession = Depends(get_db)
):
    assignment = await db.get(AssignmentModel, assignment_id)
    if not assignment:
        raise LIRAException(status_code=404, code="NOT_FOUND", message="Assignment not found")

    # Verify truck ownership if role is driver
    if current_user.get("truck_id") and assignment.truck_id != current_user.get("truck_id"):
        raise LIRAException(status_code=403, code="FORBIDDEN", message="Cannot acknowledge assignment for another truck")

    new_ack_state = "ACKNOWLEDGED" if req.action == "ACKNOWLEDGE" else "CANNOT_COMPLY"
    assignment.driver_ack_state = new_ack_state
    if new_ack_state == "ACKNOWLEDGED" and assignment.status == "APPROVED":
        assignment.status = "ACKNOWLEDGED"
    elif new_ack_state == "CANNOT_COMPLY":
        assignment.status = "CANCELLED"

    assignment.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    event_id = f"EVT-{uuid.uuid4().hex[:6].upper()}"
    drv_evt = DriverEventModel(
        event_id=event_id,
        truck_id=assignment.truck_id,
        assignment_id=assignment_id,
        type="ACK_RECORDED",
        payload={
            "action": req.action,
            "reason": req.reason,
            "idempotency_key": idempotency_key
        }
    )
    db.add(drv_evt)
    await db.commit()

    return DriverAckResponse(
        accepted=True,
        assignment_id=assignment_id,
        driver_ack_state=new_ack_state,
        event_id=event_id
    )


@router.post("/eta", response_model=DriverEtaResponse)
async def update_driver_eta(
    req: DriverEtaRequest,
    current_user: dict = Depends(get_current_driver),
    db: AsyncSession = Depends(get_db)
):
    # Verify truck ownership
    if current_user.get("truck_id") and current_user.get("truck_id") != req.truck_id:
        raise LIRAException(status_code=403, code="FORBIDDEN", message="Driver cannot update ETA for a different truck")

    truck = await db.get(TruckModel, req.truck_id)
    if truck:
        truck.location_eta = req.eta
        truck.availability = "DELAYED" if req.reason == "TRAFFIC" else "IN_TRANSIT"

    event_id = f"EVT-{uuid.uuid4().hex[:6].upper()}"
    drv_evt = DriverEventModel(
        event_id=event_id,
        truck_id=req.truck_id,
        type="ETA_UPDATED",
        payload={
            "eta": req.eta,
            "reason": req.reason,
            "source": req.source
        }
    )
    db.add(drv_evt)
    await db.commit()

    return DriverEtaResponse(
        accepted=True,
        event_id=event_id,
        recovery_status="QUEUED"
    )


@router.get("/disruptions", response_model=DriverDisruptionsResponse)
async def get_driver_disruptions(
    current_user: dict = Depends(get_current_driver),
    db: AsyncSession = Depends(get_db)
):
    truck_id = current_user.get("truck_id")
    stmt = select(ExternalEventModel).order_by(ExternalEventModel.updated_at.desc())
    res = await db.execute(stmt)
    all_events = res.scalars().all()

    items = []
    for e in all_events:
        # Check if driver truck is affected or general alert
        aff_trucks = e.affected_trucks or []
        if not truck_id or not aff_trucks or truck_id in aff_trucks:
            items.append(DisruptionItem(
                event_id=e.event_id,
                type=e.type,
                trust_state=e.trust_state,
                severity=e.severity,
                title=e.title,
                source_label=e.source_label,
                affected_trucks=aff_trucks,
                starts_at=e.starts_at,
                ends_at=e.ends_at,
                updated_at=e.updated_at
            ))

    return DriverDisruptionsResponse(items=items)


@router.get("/events", response_model=DriverEventsResponse)
async def get_driver_events(
    after: int = Query(0, description="Sequence offset"),
    current_user: dict = Depends(get_current_driver),
    db: AsyncSession = Depends(get_db)
):
    truck_id = current_user.get("truck_id")
    stmt = select(DriverEventModel).where(DriverEventModel.sequence > after)
    if truck_id:
        stmt = stmt.where(DriverEventModel.truck_id == truck_id)
    stmt = stmt.order_by(DriverEventModel.sequence.asc())

    res = await db.execute(stmt)
    events = res.scalars().all()

    items = [
        DriverEventItem(
            event_id=e.event_id,
            sequence=e.sequence or 1,
            type=e.type,
            assignment_id=e.assignment_id,
            created_at=e.created_at,
            payload=e.payload or {}
        ) for e in events
    ]

    next_seq = events[-1].sequence if events else after
    return DriverEventsResponse(items=items, next_sequence=next_seq)


@router.get("/checkpoint-status", response_model=CheckpointStatusResponse)
async def get_checkpoint_status(
    assignment_id: str = Query(..., description="Assignment ID"),
    db: AsyncSession = Depends(get_db)
):
    assignment = await db.get(AssignmentModel, assignment_id)
    if not assignment:
        raise LIRAException(status_code=404, code="NOT_FOUND", message="Assignment not found")

    # Find latest edge event
    edge_stmt = select(EdgeEventModel).where(
        EdgeEventModel.assignment_id == assignment_id
    ).order_by(EdgeEventModel.created_at.desc())
    res = await db.execute(edge_stmt)
    latest_edge = res.scalars().first()

    rfid_state = "MATCHED" if (latest_edge and latest_edge.rfid_match) else "NOT_SCANNED"
    bay_present = latest_edge.bay_present if latest_edge else False

    return CheckpointStatusResponse(
        assignment_id=assignment.assignment_id,
        device_id=assignment.checkpoint_id,
        state=assignment.physical_state,
        rfid_state=rfid_state,
        bay_present=bay_present,
        last_event_at=latest_edge.observed_at if latest_edge else None
    )

