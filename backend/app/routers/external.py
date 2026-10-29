import datetime
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import ExternalEventModel, AuditEventModel
from app.schemas.external import ExternalEventItem, SimulateExternalEventRequest, SimulateExternalEventResponse
from app.services.external.normalizer import normalize_external_event

router = APIRouter(prefix="/external", tags=["External Disruptions"])


@router.get("/events", response_model=List[ExternalEventItem])
async def list_external_events(db: AsyncSession = Depends(get_db)):
    stmt = select(ExternalEventModel).order_by(ExternalEventModel.updated_at.desc())
    res = await db.execute(stmt)
    events = res.scalars().all()

    return [
        ExternalEventItem(
            event_id=e.event_id,
            type=e.type,
            trust_state=e.trust_state,
            severity=e.severity,
            title=e.title,
            source_label=e.source_label,
            geography=e.geography,
            starts_at=e.starts_at,
            ends_at=e.ends_at,
            affected_trucks=e.affected_trucks or [],
            affected_slots=e.affected_slots or [],
            is_simulated=e.is_simulated,
            updated_at=e.updated_at
        ) for e in events
    ]


@router.post("/events/simulate", response_model=SimulateExternalEventResponse)
async def simulate_external_event(req: SimulateExternalEventRequest, db: AsyncSession = Depends(get_db)):
    now = datetime.datetime.now(datetime.timezone.utc)
    ends = now + datetime.timedelta(hours=req.duration_hours)

    event_id = f"EXT-SIM-{uuid.uuid4().hex[:6].upper()}"
    normalized = normalize_external_event(
        event_type=req.type,
        raw_payload={
            "event_id": event_id,
            "severity": req.severity,
            "title": req.title,
            "geography": req.geography,
            "starts_at": now.isoformat(),
            "ends_at": ends.isoformat(),
            "affected_trucks": req.affected_trucks,
            "affected_slots": req.affected_slots,
            "is_simulated": True
        },
        source_label=req.source_label,
        trust_state=req.trust_state
    )

    event_model = ExternalEventModel(
        event_id=normalized["event_id"],
        type=normalized["type"],
        trust_state=normalized["trust_state"],
        severity=normalized["severity"],
        title=normalized["title"],
        source_label=normalized["source_label"],
        geography=normalized["geography"],
        starts_at=normalized["starts_at"],
        ends_at=normalized["ends_at"],
        affected_trucks=normalized["affected_trucks"],
        affected_slots=normalized["affected_slots"],
        is_simulated=True
    )
    db.add(event_model)

    audit = AuditEventModel(
        audit_id=f"AUD-{event_id}",
        correlation_id=event_id,
        event_type="EXTERNAL_DISRUPTION_SIMULATED",
        entity_type="EXTERNAL_EVENT",
        entity_id=event_id,
        actor="DEMO_MANAGER",
        description=f"Injected labeled external event: {req.type} ({req.trust_state}) affecting trucks {req.affected_trucks}",
        details={"type": req.type, "trust": req.trust_state}
    )
    db.add(audit)
    await db.commit()

    return SimulateExternalEventResponse(
        event_id=event_id,
        type=req.type,
        trust_state=req.trust_state,
        severity=req.severity,
        impact_summary=f"Event {event_id} ({req.type}) recorded with state {req.trust_state}. Affected trucks: {', '.join(req.affected_trucks) or 'None'}."
    )

