from typing import List, Optional, Any
from pydantic import BaseModel, Field


class CandidateBlocker(BaseModel):
    type: str
    claim: str
    source_id: str
    quote: str
    start_char: int
    end_char: int
    confidence: float
    authority_tier: str  # T1, T2, T3
    status: str  # NEEDS_VERIFICATION, HARD_BLOCKER
    responsible_role: str


class ExtractionResult(BaseModel):
    container_id: str
    candidate_blockers: List[CandidateBlocker]


class DocumentIngestResponse(BaseModel):
    job_id: str
    status: str
    source_id: str
    accepted_metadata: dict


class IngestJobResponse(BaseModel):
    job_id: str
    container_id: Optional[str] = None
    status: str
    raw_source_text: str
    candidate_blockers: List[CandidateBlocker]
    validation_errors: List[str]
    created_at: str

