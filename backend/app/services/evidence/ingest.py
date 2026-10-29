import hashlib
import uuid
import datetime
from typing import Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import (
    EvidenceRecordModel, IncidentModel, BlockerNodeModel,
    DependencyEdgeModel, VerificationTaskModel
)
from app.services.evidence.extract import extract_candidate_blockers
from app.services.evidence.validate import validate_extraction_results


def _generate_verification_question(blocker_type: str, container_id: str) -> str:
    questions = {
        "DOCUMENT_MISMATCH": f"Verify gross weight declaration difference between commercial invoice and packing list for {container_id}.",
        "DRIVER_ETA_CONFLICT": f"Confirm driver current GPS coordinates, highway delay status, and estimated arrival slot for {container_id}.",
        "PAYMENT_RECONCILIATION_DELAY": f"Verify bank UTR settlement confirmation with shipping line finance desk for {container_id}.",
        "YARD_STACK_DEPTH_DELAY": f"Confirm terminal RTG crane pre-stage dig-out schedule for buried container {container_id}.",
        "WAREHOUSE_APPOINTMENT_MISSED": f"Confirm consignee warehouse receiving dock slot rescheduling for {container_id}.",
        "CUSTOMS_HOLD": f"Verify if Out-of-Charge (OoC) has cleared on ICEGATE portal for {container_id}.",
        "DELIVERY_ORDER_EXPIRED": f"Confirm shipping line delivery order extension payment receipt for {container_id}."
    }
    return questions.get(blocker_type, f"Confirm operational release prerequisites for {blocker_type} on {container_id}.")


async def process_document_ingestion(
    db: AsyncSession,
    raw_text: str,
    source_id: str,
    source_type: str = "EMAIL",
    tier: str = "T2",
    container_id: str = "C102"
) -> Dict[str, Any]:
    # 1. SHA256 Hash
    text_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
    job_id = f"JOB-{uuid.uuid4().hex[:8].upper()}"
    evidence_id = f"EV-{uuid.uuid4().hex[:8].upper()}"

    # 2. Extract blockers (Gemini / Deterministic)
    raw_candidates = await extract_candidate_blockers(raw_text, source_id, container_id)

    # 3. Deterministic Validation against Grounding & Tier Precedence
    validated_candidates, validation_errors = validate_extraction_results(raw_text, raw_candidates)

    # 4. Save Evidence Record
    evidence_record = EvidenceRecordModel(
        evidence_id=evidence_id,
        container_id=container_id,
        source_id=source_id,
        source_type=source_type,
        tier=tier,
        quote=validated_candidates[0]["quote"] if validated_candidates else raw_text[:100],
        start_char=validated_candidates[0]["start_char"] if validated_candidates else 0,
        end_char=validated_candidates[0]["end_char"] if validated_candidates else min(100, len(raw_text)),
        raw_source_text=raw_text,
        source_hash=text_hash,
        freshness_minutes=5,
        claims=validated_candidates
    )
    db.add(evidence_record)

    # 5. Connect to or create Incident
    inc_stmt = select(IncidentModel).where(IncidentModel.container_id == container_id)
    res = await db.execute(inc_stmt)
    incident = res.scalars().first()

    has_hard = any(c.get("status") == "HARD_BLOCKER" for c in validated_candidates)
    severity = "CRITICAL" if has_hard else "HIGH"

    if not incident:
        incident_id = f"INC-{container_id}"
        incident = IncidentModel(
            incident_id=incident_id,
            container_id=container_id,
            title=f"Clearance and Slot Exception for {container_id}",
            severity=severity,
            status="OPEN" if has_hard else "NEEDS_VERIFICATION",
            root_blocker_code=validated_candidates[0]["type"] if validated_candidates else "DOCUMENT_REVIEW",
            owner_role=validated_candidates[0]["responsible_role"] if validated_candidates else "CUSTOMS_BROKER",
            action_deadline=(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=3)).isoformat(),
            projected_avoidable_cost_inr=18000,
            do_nothing_cost_inr=32000
        )
        db.add(incident)
        await db.flush()

    # 6. Add Blocker Nodes & Link Dependency Edges
    prev_node_id = None
    created_tasks = []
    
    for cand in validated_candidates:
        node_id = f"NODE-{uuid.uuid4().hex[:6].upper()}"
        node = BlockerNodeModel(
            node_id=node_id,
            incident_id=incident.incident_id,
            container_id=container_id,
            code=cand["type"],
            claim=cand["claim"],
            quote=cand["quote"],
            start_char=cand["start_char"],
            end_char=cand["end_char"],
            authority_tier=cand["authority_tier"],
            status=cand["status"],
            responsible_role=cand["responsible_role"],
            evidence_id=evidence_id
        )
        db.add(node)
        await db.flush()

        # Generate Active Verification Task for unconfirmed conditions
        if cand.get("status") == "NEEDS_VERIFICATION":
            task_id = f"TASK-{uuid.uuid4().hex[:6].upper()}"
            question = _generate_verification_question(cand["type"], container_id)
            v_task = VerificationTaskModel(
                task_id=task_id,
                incident_id=incident.incident_id,
                container_id=container_id,
                blocker_code=cand["type"],
                question=question,
                target_role=cand.get("responsible_role", "DISPATCHER"),
                status="PENDING",
                evidence_tier=cand.get("authority_tier", "T4"),
                deadline=(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)).isoformat(),
                assigned_owner="DISPATCHER"
            )
            db.add(v_task)
            created_tasks.append(task_id)

        if prev_node_id:
            edge = DependencyEdgeModel(
                edge_id=f"EDGE-{uuid.uuid4().hex[:6].upper()}",
                incident_id=incident.incident_id,
                source_node_id=prev_node_id,
                target_node_id=node_id,
                relationship_type="BLOCKS"
            )
            db.add(edge)
        prev_node_id = node_id

    await db.commit()

    return {
        "job_id": job_id,
        "evidence_id": evidence_id,
        "container_id": container_id,
        "status": "COMPLETED",
        "raw_source_text": raw_text,
        "candidate_blockers": validated_candidates,
        "validation_errors": validation_errors,
        "verification_tasks_created": created_tasks,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
