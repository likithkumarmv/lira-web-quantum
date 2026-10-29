import re
import uuid
import hashlib
import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import RAGChunkModel, EvidenceRecordModel

def _utcnow_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


# Pre-populated authoritative knowledge base for maritime freight recovery
AUTHORITATIVE_CHUNKS = [
    {
        "document_id": "DOC-C102-EML-HL",
        "document_name": "Hapag-Lloyd Carrier Arrival Notice & DO Instructions.eml",
        "tenant_id": "TENANT_JNPA",
        "container_id": "C102",
        "source_type": "EMAIL",
        "issuer": "Hapag-Lloyd Operations Desk",
        "tier": "T1",
        "chunk_text": "Delivery Order (DO) counter cutoff is strictly 16:30 IST today. UTR bank payment confirmation must be reconciled by finance desk before electronic gate release is authorized.",
        "start_char": 42,
        "end_char": 218
    },
    {
        "document_id": "DOC-C102-PDF-ICEGATE",
        "document_name": "Indian Customs ICEGATE RMS Facilitation Bill of Entry.pdf",
        "tenant_id": "TENANT_JNPA",
        "container_id": "C102",
        "source_type": "PDF",
        "issuer": "Indian Customs ICEGATE EDI",
        "tier": "T1",
        "chunk_text": "Bill of Entry 9482104: AEO-T2 RMS Facilitation confirmed. Out of Charge (OoC) officially granted at 14:15 IST. No physical assessment or examination mandated.",
        "start_char": 105,
        "end_char": 268
    },
    {
        "document_id": "DOC-C102-CSV-PACKING",
        "document_name": "Commercial Invoice & Verified Gross Mass Packing List.csv",
        "tenant_id": "TENANT_JNPA",
        "container_id": "C102",
        "source_type": "CSV",
        "issuer": "DHL Global Forwarding Exim",
        "tier": "T2",
        "chunk_text": "Container C102: Verified Gross Mass (VGM) 26,400 kg. Mandatory requirement: 3-Axle Prime Mover and active Carrier Transicold Reefer Genset APU (voltage 460V).",
        "start_char": 0,
        "end_char": 160
    },
    {
        "document_id": "DOC-JNPA-TARIFF-2026",
        "document_name": "JNPA Port Operational Scale of Rates & Demurrage Tariff 3.2.4.pdf",
        "tenant_id": "TENANT_JNPA",
        "container_id": None,
        "source_type": "TARIFF",
        "issuer": "Jawaharlal Nehru Port Authority (JNPA)",
        "tier": "T1",
        "chunk_text": "Tariff Clause 3.2.4: Free time expires 48 hours post-discharge. Demurrage accrues at ₹12,000/day for Tier 1 (Days 1-3), escalating to ₹24,000/day for Tier 2 (Days 4+). Reefer electricity monitoring surcharge: ₹4,500/day.",
        "start_char": 12,
        "end_char": 235
    },
    {
        "document_id": "DOC-C999-CONFIDENTIAL",
        "document_name": "Tenant B Freight Bill - Other Client.pdf",
        "tenant_id": "TENANT_MUNDRA",
        "container_id": "C999",
        "source_type": "PDF",
        "issuer": "Third Party Broker",
        "tier": "T3",
        "chunk_text": "Confidential rate agreement for Container C999 consigned to separate client entity.",
        "start_char": 0,
        "end_char": 83
    }
]


# Prompt Injection Signatures
PROMPT_INJECTION_PATTERNS = [
    r"ignore previous instructions",
    r"disregard all rules",
    r"you are now a",
    r"confirm customs is cleared regardless",
    r"pretend there are no blockers",
    r"bypass security"
]


def detect_prompt_injection(query: str) -> bool:
    q_lower = query.lower()
    for pat in PROMPT_INJECTION_PATTERNS:
        if re.search(pat, q_lower):
            return True
    return False


async def seed_rag_chunks_if_needed(db: AsyncSession):
    stmt = select(RAGChunkModel)
    res = await db.execute(stmt)
    if not res.scalars().first():
        chunks = []
        for c in AUTHORITATIVE_CHUNKS:
            ch_hash = hashlib.sha256(c["chunk_text"].encode()).hexdigest()[:16]
            chunk = RAGChunkModel(
                chunk_id=f"CHK-{uuid.uuid4().hex[:8].upper()}",
                document_id=c["document_id"],
                document_name=c["document_name"],
                tenant_id=c["tenant_id"],
                container_id=c["container_id"],
                source_type=c["source_type"],
                issuer=c["issuer"],
                tier=c["tier"],
                start_char=c["start_char"],
                end_char=c["end_char"],
                chunk_text=c["chunk_text"],
                chunk_hash=ch_hash,
                metadata_json={"authority_weight": 1.0 if c["tier"] == "T1" else 0.8}
            )
            chunks.append(chunk)
        db.add_all(chunks)
        await db.commit()


def _score_chunk_relevance(query: str, chunk_text: str) -> float:
    q_words = set(re.findall(r"\w+", query.lower()))
    c_words = set(re.findall(r"\w+", chunk_text.lower()))
    if not q_words:
        return 0.0
    overlap = q_words.intersection(c_words)
    # Jaccard + keyword density
    score = len(overlap) / len(q_words)
    # Exact phrase bonus
    for w in ["edo", "e-do", "cutoff", "tariff", "weight", "chassis", "customs", "ooc", "demurrage", "icegate"]:
        if w in query.lower() and w in chunk_text.lower():
            score += 0.3
    return score


async def query_evidence_assistant(
    db: AsyncSession,
    query: str,
    container_id: str = "C102",
    tenant_id: str = "TENANT_JNPA"
) -> Dict[str, Any]:
    await seed_rag_chunks_if_needed(db)

    # 1. Prompt Injection Defense
    if detect_prompt_injection(query):
        return {
            "status": "SECURITY_ALERT_PROMPT_INJECTION",
            "query": query,
            "answer": "Security Alert: Adversarial prompt injection pattern detected. The Evidence Assistant strictly adheres to verified, tamper-evident source documents.",
            "grounded_claims": [],
            "contradictions_detected": False,
            "is_sufficient": False,
            "prompt_injection_prevented": True,
            "tenant_isolation_enforced": True
        }

    # 2. Retrieve Authorized Chunks (Filtering by tenant & container scope)
    stmt = select(RAGChunkModel).where(
        RAGChunkModel.tenant_id == tenant_id
    )
    res = await db.execute(stmt)
    all_chunks = res.scalars().all()

    # Apply container scope: chunk must be for this container OR general port tariff (container_id is None)
    scoped_chunks = [c for c in all_chunks if c.container_id is None or c.container_id == container_id]

    scored_chunks: List[Tuple[float, RAGChunkModel]] = []
    for c in scoped_chunks:
        score = _score_chunk_relevance(query, c.chunk_text)
        if score > 0.15:
            scored_chunks.append((score, c))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)

    # 3. Handle Insufficient Evidence
    if not scored_chunks:
        return {
            "status": "UNKNOWN / INSUFFICIENT_EVIDENCE",
            "query": query,
            "answer": f"Insufficient verified evidence in authorized documents for container {container_id}. No grounded quote spans match your query.",
            "grounded_claims": [],
            "contradictions_detected": False,
            "is_sufficient": False,
            "suggested_verification_task": {
                "question": f"Request official operational release status or document upload for {query[:60]}",
                "target_authority": "T1_SHIPPING_LINE" if "do" in query.lower() else "T1_CUSTOMS",
                "container_id": container_id
            },
            "prompt_injection_prevented": False,
            "tenant_isolation_enforced": True
        }

    # 4. Synthesize Grounded Claims
    top_matches = scored_chunks[:3]
    claims = []
    answer_parts = []

    for score, chunk in top_matches:
        claim = {
            "document_id": chunk.document_id,
            "document_name": chunk.document_name,
            "issuer": chunk.issuer,
            "authority_tier": chunk.tier,
            "quote": chunk.chunk_text,
            "start_char": chunk.start_char,
            "end_char": chunk.end_char,
            "relevance_score": round(score, 2),
            "claim_status": "VERIFIED_GROUNDED" if chunk.tier in ["T1", "T2"] else "UNVERIFIED_THIRD_PARTY"
        }
        claims.append(claim)
        answer_parts.append(f"• According to {chunk.document_name} ({chunk.issuer}, {chunk.tier}): \"{chunk.chunk_text}\"")

    synthesized_answer = (
        f"Grounded response for container {container_id} based on {len(top_matches)} verified document section(s):\n\n"
        + "\n\n".join(answer_parts)
    )

    # 5. Contradiction Detection
    contradictions = False
    conflict_notes = []
    # Check if both pending and cleared exist in claims
    has_pending = any("pending" in c["quote"].lower() or "hold" in c["quote"].lower() for c in claims)
    has_cleared = any("cleared" in c["quote"].lower() or "granted" in c["quote"].lower() for c in claims)
    if has_pending and has_cleared:
        contradictions = True
        conflict_notes.append("Potential contradiction: Source documents contain conflicting statements regarding clearance and pending prerequisites.")

    return {
        "status": "VERIFIED_EVIDENCE_FOUND",
        "query": query,
        "container_id": container_id,
        "answer": synthesized_answer,
        "grounded_claims": claims,
        "contradictions_detected": contradictions,
        "conflict_notes": conflict_notes,
        "is_sufficient": True,
        "prompt_injection_prevented": False,
        "tenant_isolation_enforced": True
    }

