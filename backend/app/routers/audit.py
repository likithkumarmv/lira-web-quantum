from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import AuditEventModel

router = APIRouter(prefix="/audit", tags=["Audit & Timeline"])


@router.get("/events")
async def list_audit_events(
    correlation_id: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AuditEventModel)
    if correlation_id:
        stmt = stmt.where(AuditEventModel.correlation_id == correlation_id)
    stmt = stmt.order_by(AuditEventModel.timestamp.desc()).limit(limit)

    res = await db.execute(stmt)
    events = res.scalars().all()

    return {
        "items": [
            {
                "audit_id": e.audit_id,
                "correlation_id": e.correlation_id,
                "event_type": e.event_type,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "actor": e.actor,
                "description": e.description,
                "details": e.details or {},
                "timestamp": e.timestamp
            } for e in events
        ]
    }

