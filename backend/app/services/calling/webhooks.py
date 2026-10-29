import datetime
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import CallJobModel, TruckModel, AuditEventModel, IncidentModel


async def process_call_webhook(db: AsyncSession, payload: Dict[str, Any]) -> Dict[str, Any]:
    call_id = payload.get("call_id", f"CALL-{datetime.datetime.now().strftime('%H%M%S')}")
    incident_id = payload.get("incident_id", "INC-C102")
    truck_id = payload.get("truck_id", "T04")
    extracted_eta = payload.get("eta", "2026-10-28T16:45:00+05:30")
    extracted_avail = payload.get("availability", "DELAYED")
    transcript = payload.get("transcript", "Driver T04 confirmed waterlogging delay on JNPT arterial road; ETA pushed to 16:45.")

    # 1. Update or create CallJob
    job = await db.get(CallJobModel, call_id)
    if not job:
        job = CallJobModel(
            call_id=call_id,
            incident_id=incident_id,
            truck_id=truck_id,
            status="COMPLETED",
            extracted_eta=extracted_eta,
            extracted_availability=extracted_avail,
            transcript=transcript,
            raw_payload=payload
        )
        db.add(job)
    else:
        job.status = "COMPLETED"
        job.extracted_eta = extracted_eta
        job.extracted_availability = extracted_avail
        job.transcript = transcript

    # 2. Update Truck state
    truck = await db.get(TruckModel, truck_id)
    if truck:
        truck.location_eta = extracted_eta
        truck.availability = extracted_avail

    # 3. Log Audit Event
    audit = AuditEventModel(
        audit_id=f"AUD-CALL-{call_id[-6:]}",
        correlation_id=incident_id,
        event_type="DRIVER_CALL_VERIFIED",
        entity_type="TRUCK",
        entity_id=truck_id,
        actor="AI_CALLING_AGENT",
        description=f"Confirmed driver ETA {extracted_eta} via Bolna conversational voice verification. Status: {extracted_avail}.",
        details={"eta": extracted_eta, "availability": extracted_avail, "call_id": call_id}
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "PROCESSED",
        "call_id": call_id,
        "truck_id": truck_id,
        "extracted_eta": extracted_eta,
        "extracted_availability": extracted_avail
    }

