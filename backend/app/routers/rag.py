from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import RAGChunkModel
from app.services.evidence.rag import query_evidence_assistant, seed_rag_chunks_if_needed

router = APIRouter(prefix="/evidence/assistant", tags=["Evidence-Grounded Document RAG"])


class RAGQueryRequest(BaseModel):
    query: str
    container_id: str = "C102"
    tenant_id: str = "TENANT_JNPA"


@router.post("/query")
async def ask_evidence_assistant(
    req: RAGQueryRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    # Enforce basic query validation
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be empty")

    result = await query_evidence_assistant(
        db=db,
        query=req.query,
        container_id=req.container_id,
        tenant_id=req.tenant_id
    )
    return result


@router.get("/chunks")
async def get_authorized_chunks(
    container_id: Optional[str] = Query(None),
    tenant_id: str = Query("TENANT_JNPA"),
    db: AsyncSession = Depends(get_db)
):
    await seed_rag_chunks_if_needed(db)
    stmt = select(RAGChunkModel).where(RAGChunkModel.tenant_id == tenant_id)
    if container_id:
        stmt = stmt.where((RAGChunkModel.container_id == container_id) | (RAGChunkModel.container_id.is_(None)))
    res = await db.execute(stmt)
    chunks = res.scalars().all()
    return {
        "tenant_id": tenant_id,
        "count": len(chunks),
        "items": [
            {
                "chunk_id": c.chunk_id,
                "document_id": c.document_id,
                "document_name": c.document_name,
                "issuer": c.issuer,
                "tier": c.tier,
                "chunk_text": c.chunk_text,
                "start_char": c.start_char,
                "end_char": c.end_char
            }
            for c in chunks
        ]
    }

