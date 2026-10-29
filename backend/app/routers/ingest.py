import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Request, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import EvidenceRecordModel
from app.schemas.evidence import DocumentIngestResponse, IngestJobResponse
from app.services.evidence.ingest import process_document_ingestion
from app.services.evidence.parsers import parse_incoming_payload
from app.core.errors import LIRAException

router = APIRouter(prefix="/ingest", tags=["Document & Evidence Ingest"])

# In-memory store for instant job retrieval in demo
INGEST_JOBS_STORE = {}


@router.post("/document", response_model=DocumentIngestResponse)
async def ingest_document(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    content_type = request.headers.get("content-type", "")
    text_content = ""
    s_id = None
    c_id = "C102"
    s_type = "EMAIL"
    tier = "T2"

    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        if file and hasattr(file, "read"):
            content_bytes = await file.read()
            filename = getattr(file, "filename", "uploaded_doc")
            file_mime = getattr(file, "content_type", "") or ""
            text_content, s_type, _ = parse_incoming_payload(filename, content_bytes, file_mime)
            s_id = filename or f"SRC-FILE-{uuid.uuid4().hex[:6].upper()}"
        else:
            text_content = form.get("raw_text", "")
            s_id = form.get("source_id")
            c_id = form.get("container_id", "C102")
            s_type = form.get("source_type", "EMAIL")
            tier = form.get("tier", "T2")
    else:
        try:
            body = await request.json()
            text_content = body.get("raw_text", "")
            s_id = body.get("source_id")
            c_id = body.get("container_id", "C102")
            s_type = body.get("source_type", "EMAIL")
            tier = body.get("tier", "T2")
        except Exception:
            text_content = ""

    if not text_content:
        # Default synthetic document for quick demo button
        text_content = """FROM: operations@maersk-liner-agency.com
TO: logistics-dispatch@lira.in
SUBJECT: Exception Notice: Consignment C102 clearance variance

Container C102 arrived on vessel Maersk Saltoro.
Gross weight: 12,450 kg declared on invoice differs from Packing List (14,200 kg).
Bill of Entry pending amendment under Section 149.
Free time expires 2026-10-28 18:30 IST.
Immediate customs broker resolution required to avoid port demurrage."""
        s_id = s_id or "SRC-MAERSK-EMAIL-01"
    else:
        s_id = s_id or f"SRC-{uuid.uuid4().hex[:6].upper()}"

    result = await process_document_ingestion(
        db=db,
        raw_text=text_content,
        source_id=s_id,
        source_type=s_type,
        tier=tier,
        container_id=c_id
    )

    INGEST_JOBS_STORE[result["job_id"]] = result

    return DocumentIngestResponse(
        job_id=result["job_id"],
        status="COMPLETED",
        source_id=s_id,
        accepted_metadata={
            "container_id": c_id,
            "evidence_id": result["evidence_id"],
            "blockers_found": len(result["candidate_blockers"]),
            "char_count": len(text_content),
            "verification_tasks": len(result.get("verification_tasks_created", []))
        }
    )


@router.get("/jobs/{job_id}", response_model=IngestJobResponse)
async def get_ingest_job(job_id: str, db: AsyncSession = Depends(get_db)):
    if job_id in INGEST_JOBS_STORE:
        j = INGEST_JOBS_STORE[job_id]
        return IngestJobResponse(
            job_id=job_id,
            container_id=j.get("container_id"),
            status=j.get("status", "COMPLETED"),
            raw_source_text=j.get("raw_source_text", ""),
            candidate_blockers=j.get("candidate_blockers", []),
            validation_errors=j.get("validation_errors", []),
            created_at=j.get("created_at")
        )

    # Fallback search in DB
    stmt = select(EvidenceRecordModel).where(EvidenceRecordModel.evidence_id == job_id)
    res = await db.execute(stmt)
    ev = res.scalars().first()
    if ev:
        return IngestJobResponse(
            job_id=job_id,
            container_id=ev.container_id,
            status="COMPLETED",
            raw_source_text=ev.raw_source_text or "",
            candidate_blockers=ev.claims or [],
            validation_errors=[],
            created_at=ev.created_at
        )

    raise HTTPException(status_code=404, detail="Ingestion job not found")
