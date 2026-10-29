import uuid
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import VerificationTaskModel, BlockerNodeModel, AuditEventModel, IncidentModel

router = APIRouter(prefix="/verification", tags=["Active Fact Acquisition & Verification"])


class VerificationTaskCreate(BaseModel):
    incident_id: str
    container_id: str
    blocker_code: str
    question: str
    target_role: str = "DISPATCHER"
    target_contact: Optional[str] = None
    deadline_minutes: int = 60
    assigned_owner: str = "DISPATCHER"


class VerificationTaskResolve(BaseModel):
    resolved_claim: str
    verified_by_role: str = "DISPATCHER"
    evidence_tier: str = "T4"
    clear_blocker: bool = True


@router.get("/tasks")
async def list_verification_tasks(
    incident_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(VerificationTaskModel)
    if incident_id:
        stmt = stmt.where(VerificationTaskModel.incident_id == incident_id)
    if status:
        stmt = stmt.where(VerificationTaskModel.status == status)
    stmt = stmt.order_by(VerificationTaskModel.created_at.desc())
    
    res = await db.execute(stmt)
    tasks = res.scalars().all()
    return [
        {
            "task_id": t.task_id,
            "incident_id": t.incident_id,
            "container_id": t.container_id,
            "blocker_code": t.blocker_code,
            "question": t.question,
            "target_role": t.target_role,
            "target_contact": t.target_contact,
            "status": t.status,
            "evidence_tier": t.evidence_tier,
            "deadline": t.deadline,
            "assigned_owner": t.assigned_owner,
            "resolved_claim": t.resolved_claim,
            "created_at": t.created_at,
            "updated_at": t.updated_at
        }
        for t in tasks
    ]


@router.post("/tasks")
async def create_verification_task(
    payload: VerificationTaskCreate,
    db: AsyncSession = Depends(get_db)
):
    task_id = f"TASK-{uuid.uuid4().hex[:6].upper()}"
    deadline = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=payload.deadline_minutes)).isoformat()
    
    task = VerificationTaskModel(
        task_id=task_id,
        incident_id=payload.incident_id,
        container_id=payload.container_id,
        blocker_code=payload.blocker_code,
        question=payload.question,
        target_role=payload.target_role,
        target_contact=payload.target_contact,
        status="PENDING",
        evidence_tier="T4",
        deadline=deadline,
        assigned_owner=payload.assigned_owner
    )
    db.add(task)
    
    # Audit event
    audit = AuditEventModel(
        audit_id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        correlation_id=payload.incident_id,
        event_type="VERIFICATION_TASK_CREATED",
        entity_type="VERIFICATION_TASK",
        entity_id=task_id,
        actor="SYSTEM",
        description=f"Generated active verification task: {payload.question}",
        details={"blocker_code": payload.blocker_code, "target_role": payload.target_role}
    )
    db.add(audit)
    await db.commit()
    
    return {"task_id": task_id, "status": "PENDING", "deadline": deadline}


@router.post("/tasks/{task_id}/resolve")
async def resolve_verification_task(
    task_id: str,
    payload: VerificationTaskResolve,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(VerificationTaskModel).where(VerificationTaskModel.task_id == task_id)
    res = await db.execute(stmt)
    task = res.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    task.status = "RESOLVED"
    task.resolved_claim = payload.resolved_claim
    task.evidence_tier = payload.evidence_tier
    task.updated_at = now_iso

    # If requested to clear blocker in the DAG
    if payload.clear_blocker:
        node_stmt = select(BlockerNodeModel).where(
            BlockerNodeModel.incident_id == task.incident_id,
            BlockerNodeModel.code == task.blocker_code
        )
        node_res = await db.execute(node_stmt)
        node = node_res.scalars().first()
        if node:
            node.status = "CLEARED"

    # Audit log
    audit = AuditEventModel(
        audit_id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        correlation_id=task.incident_id,
        event_type="VERIFICATION_TASK_RESOLVED",
        entity_type="VERIFICATION_TASK",
        entity_id=task_id,
        actor=payload.verified_by_role,
        description=f"Task resolved: {payload.resolved_claim}",
        details={"clear_blocker": payload.clear_blocker, "tier": payload.evidence_tier}
    )
    db.add(audit)
    await db.commit()

    return {
        "task_id": task_id,
        "status": "RESOLVED",
        "resolved_claim": payload.resolved_claim,
        "updated_at": now_iso
    }

