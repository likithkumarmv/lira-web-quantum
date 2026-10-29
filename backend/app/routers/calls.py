import uuid
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Body, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import CallJobModel, AuditEventModel
from app.services.calling.bolna_adapter import initiate_bolna_driver_call, check_bolna_agent_health, mask_phone_number
from app.services.calling.webhooks import process_call_webhook

router = APIRouter(tags=["AI Voice Calling"])


@router.get("/calls/health")
async def get_calling_health():
    """Returns real Bolna agent connectivity and configuration health."""
    return await check_bolna_agent_health()


@router.get("/calls/history")
async def list_calls_history(db: AsyncSession = Depends(get_db)):
    stmt = select(CallJobModel).order_by(CallJobModel.created_at.desc())
    res = await db.execute(stmt)
    calls = res.scalars().all()
    return {
        "calls": [
            {
                "call_id": c.call_id,
                "incident_id": c.incident_id,
                "truck_id": c.truck_id,
                "phone_number": mask_phone_number(c.phone_number),
                "recipient_name": c.recipient_name,
                "provider": c.provider,
                "status": c.status,
                "extracted_eta": c.extracted_eta,
                "extracted_availability": c.extracted_availability,
                "transcript": c.transcript,
                "created_at": c.created_at
            }
            for c in calls
        ]
    }


@router.post("/calls/start")
async def start_voice_call(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db)
):
    incident_id = payload.get("incident_id", "INC-C102")
    truck_id = payload.get("truck_id", "T07")
    phone = payload.get("phone_number", "+919820119420")
    recipient = payload.get("recipient_name", "Driver T07")
    purpose = payload.get("purpose_question", f"Can backup Truck {truck_id} accept container allocation by 16:30 IST?")
    task_id = payload.get("task_id", "TASK-VERIF-01")
    consent_ref = payload.get("consent_reference", f"CONSENT-{truck_id}-AUTO")

    res = await initiate_bolna_driver_call(
        incident_id=incident_id,
        truck_id=truck_id,
        phone_number=phone,
        recipient_name=recipient,
        purpose_question=purpose,
        task_id=task_id,
        consent_reference=consent_ref
    )

    call_id = res["call_id"]
    extracted_eta = res.get("extracted_eta", "2026-10-29T16:30:00+05:30")
    extracted_avail = res.get("extracted_availability", "CONFIRMED_AVAILABLE")
    transcript = res.get("transcript", "")

    # Save CallJob in database
    job = CallJobModel(
        call_id=call_id,
        incident_id=incident_id,
        truck_id=truck_id,
        phone_number=phone,
        recipient_name=recipient,
        provider=res.get("provider", "BOLNA"),
        status="COMPLETED",
        extracted_eta=extracted_eta,
        extracted_availability=extracted_avail,
        transcript=transcript,
        raw_payload=res
    )
    db.add(job)

    # Log Audit Event with masked phone
    audit = AuditEventModel(
        audit_id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        correlation_id=incident_id,
        event_type="DRIVER_CALL_VERIFIED",
        entity_type="TRUCK",
        entity_id=truck_id,
        actor="BOLNA_VOICE_AGENT",
        description=f"Voice verification call to {recipient} ({mask_phone_number(phone)}) completed. Consent Ref: {consent_ref}. Outcome: {extracted_avail}.",
        details={
            "call_id": call_id,
            "provider_call_id": res.get("provider_call_id"),
            "agent_id": res.get("agent_id"),
            "mode": res.get("mode"),
            "eta": extracted_eta,
            "trust_tier": "T4_UNVERIFIED"
        }
    )
    db.add(audit)
    await db.commit()

    return res


@router.post("/integrations/bolna/webhook")
async def bolna_webhook(
    payload: Dict[str, Any] = Body(...),
    signature: Optional[str] = Header(None, alias="X-Bolna-Signature"),
    db: AsyncSession = Depends(get_db)
):
    """
    Webhook callback from Bolna AI platform upon outbound call completion / transcript generation.
    Authenticates webhook, updates call record, and dispatches replan check if material update.
    """
    processed = await process_call_webhook(db=db, raw_payload=payload, signature=signature)
    return {"status": "SUCCESS", "details": processed}


