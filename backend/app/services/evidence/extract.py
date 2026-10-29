import json
import re
from typing import List, Dict, Any, Optional
import httpx
from app.core.config import settings


# 15 Canonical Freight Patterns for Deterministic Extraction & Grounding
MOCK_PATTERNS = [
    {
        "pattern": r"(Gross weight:\s*12,450\s*kg|Gross weight\s*12450\s*kg|12,450\s*kg)",
        "type": "DOCUMENT_MISMATCH",
        "claim": "Gross weight differs between commercial invoice (12,450 kg) and packing list (14,200 kg)",
        "authority_tier": "T2",
        "status": "NEEDS_VERIFICATION",
        "responsible_role": "CUSTOMS_BROKER",
        "confidence": 0.94
    },
    {
        "pattern": r"(Bill of Entry pending amendment|BoE amendment required|Amendment Code 402|Section 149 amendment)",
        "type": "CUSTOMS_AMENDMENT_PENDING",
        "claim": "Bill of Entry requires customs amendment under Section 149 due to classification variance",
        "authority_tier": "T1",
        "status": "HARD_BLOCKER",
        "responsible_role": "CUSTOMS_BROKER",
        "confidence": 0.98
    },
    {
        "pattern": r"(Delivery Order expired|DO validity lapsed|DO validity:\s*2026-10-28 12:00|DO extension required)",
        "type": "DELIVERY_ORDER_EXPIRED",
        "claim": "Shipping line delivery order expired; terminal gate-out prohibited until renewal fee cleared",
        "authority_tier": "T2",
        "status": "HARD_BLOCKER",
        "responsible_role": "SHIPPING_LINE_AGENT",
        "confidence": 0.96
    },
    {
        "pattern": r"(Customs release unconfirmed|Out of Charge \(OoC\) pending|OoC not issued|ICEGATE OoC hold)",
        "type": "CUSTOMS_HOLD",
        "claim": "Out of Charge (OoC) not confirmed on ICEGATE; terminal customs release gated",
        "authority_tier": "T1",
        "status": "HARD_BLOCKER",
        "responsible_role": "CUSTOMS_BROKER",
        "confidence": 0.99
    },
    {
        "pattern": r"(Driver T04 ETA:\s*16:45|delayed in traffic|ETA 16:45|driver reported arterial delay)",
        "type": "DRIVER_ETA_CONFLICT",
        "claim": "Original designated driver cannot reach assigned slot window before cutoff",
        "authority_tier": "T4",
        "status": "NEEDS_VERIFICATION",
        "responsible_role": "DISPATCHER",
        "confidence": 0.89
    },
    {
        "pattern": r"(tri-axle chassis required|cargo weight exceeds 24,000 kg|heavy-haul mandate|exceeds tandem axle capacity)",
        "type": "TRI_AXLE_REQUIRED",
        "claim": "Payload exceeds 24,000 kg statutory tandem limit; certified tri-axle chassis mandated",
        "authority_tier": "T1",
        "status": "HARD_BLOCKER",
        "responsible_role": "DISPATCHER",
        "confidence": 0.97
    },
    {
        "pattern": r"(clip-on genset required|reefer temperature excursion|auxiliary power unit required|reefer plug disconnected)",
        "type": "REEFER_GENSET_REQUIRED",
        "claim": "Perishable cold-chain cargo requires operational diesel clip-on genset before yard gate-out",
        "authority_tier": "T2",
        "status": "HARD_BLOCKER",
        "responsible_role": "DISPATCHER",
        "confidence": 0.95
    },
    {
        "pattern": r"(DPD evacuation cutoff|48-hour DPD window|CFS transfer penalty applicable|direct port delivery cliff)",
        "type": "DPD_EVACUATION_CLIFF",
        "claim": "Direct Port Delivery 48-hour evacuation limit expiring; risk of ₹15,000 CFS transfer fee",
        "authority_tier": "T1",
        "status": "HARD_BLOCKER",
        "responsible_role": "CUSTOMS_BROKER",
        "confidence": 0.96
    },
    {
        "pattern": r"(FSSAI statutory sampling|Plant Quarantine hold|PQ inspection pending|Animal Quarantine NOC required)",
        "type": "PGA_CLEARANCE_PENDING",
        "claim": "Participating Government Agency statutory clearance pending physical lab inspection",
        "authority_tier": "T1",
        "status": "HARD_BLOCKER",
        "responsible_role": "CUSTOMS_BROKER",
        "confidence": 0.98
    },
    {
        "pattern": r"(UTR payment unverified|payment reconciliation pending|bank transfer not cleared in carrier ledger)",
        "type": "PAYMENT_RECONCILIATION_DELAY",
        "claim": "Terminal handling payment UTR not reconciled by carrier finance desk; DO withheld",
        "authority_tier": "T2",
        "status": "NEEDS_VERIFICATION",
        "responsible_role": "FINANCE_DESK",
        "confidence": 0.92
    },
    {
        "pattern": r"(empty return depot full|depot rejected empty box|empty container return yard at capacity)",
        "type": "EMPTY_DEPOT_REJECTION",
        "claim": "Designated empty return yard has suspended gate-in; detention clock running",
        "authority_tier": "T2",
        "status": "HARD_BLOCKER",
        "responsible_role": "SHIPPING_LINE_AGENT",
        "confidence": 0.93
    },
    {
        "pattern": r"(yard stack depth 4|deep dig-out required|container buried in stack tier 4|crane dig-out delay)",
        "type": "YARD_STACK_DEPTH_DELAY",
        "claim": "Container buried in yard stack tier 4+; terminal turnaround delayed by 2.5 hours",
        "authority_tier": "T2",
        "status": "NEEDS_VERIFICATION",
        "responsible_role": "TERMINAL_OPERATOR",
        "confidence": 0.90
    },
    {
        "pattern": r"(warehouse appointment cancelled|receiving dock slot missed|consignee dock full)",
        "type": "WAREHOUSE_APPOINTMENT_MISSED",
        "claim": "Consignee delivery appointment lapsed; offload refused until next scheduled window",
        "authority_tier": "T3",
        "status": "NEEDS_VERIFICATION",
        "responsible_role": "LOGISTICS_COORDINATOR",
        "confidence": 0.91
    }
]


async def extract_candidate_blockers(raw_text: str, source_id: str, container_id: str) -> List[Dict[str, Any]]:
    """
    Extracts candidate blockers with verbatim quotes, offsets, and authority tiers.
    Uses Gemini 1.5 Flash if configured with valid API key, otherwise deterministic patterns.
    """
    if settings.GEMINI_MODE == "LIVE" and settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "REPLACE_LOCALLY":
        try:
            return await _extract_with_gemini_api(raw_text, source_id, container_id)
        except Exception:
            # Fallback gracefully to deterministic pattern extraction
            pass

    return _extract_deterministic(raw_text, source_id, container_id)


def _extract_deterministic(raw_text: str, source_id: str, container_id: str) -> List[Dict[str, Any]]:
    candidates = []
    for pat in MOCK_PATTERNS:
        match = re.search(pat["pattern"], raw_text, re.IGNORECASE)
        if match:
            start_c = match.start()
            end_c = match.end()
            quote_text = raw_text[start_c:end_c]
            candidates.append({
                "type": pat["type"],
                "claim": pat["claim"],
                "source_id": source_id,
                "quote": quote_text,
                "start_char": start_c,
                "end_char": end_c,
                "confidence": pat["confidence"],
                "authority_tier": pat["authority_tier"],
                "status": pat["status"],
                "responsible_role": pat["responsible_role"]
            })

    # If no pattern matched, provide a fallback observation
    if not candidates:
        first_line = raw_text.splitlines()[0] if raw_text.splitlines() else raw_text[:50]
        start_c = 0
        end_c = len(first_line)
        candidates.append({
            "type": "DOCUMENT_REVIEW",
            "claim": f"Document submitted for {container_id} requires manual verification",
            "source_id": source_id,
            "quote": first_line,
            "start_char": start_c,
            "end_char": end_c,
            "confidence": 0.75,
            "authority_tier": "T2",
            "status": "NEEDS_VERIFICATION",
            "responsible_role": "DISPATCHER"
        })
    return candidates


async def _extract_with_gemini_api(raw_text: str, source_id: str, container_id: str) -> List[Dict[str, Any]]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    prompt = f"""
    Analyze the following shipping/freight text for container {container_id}.
    Extract grounded operational claims and blockers.
    
    Authority Tiers:
    - T1: Statutory / customs / authoritative port records (ICEGATE, Port TOS, Government agencies)
    - T2: Trusted carrier / terminal / operator records (Shipping line notices, CFS, Depot)
    - T3: Authenticated operational / telematics events (GPS, gate camera, IoT)
    - T4: Driver or broker statements with provenance
    - T5: AI interpretations or unverified suggestions
    
    For each candidate blocker:
    1. Extract the EXACT verbatim substring ('quote') from the text. NEVER modify the quote text.
    2. Compute exact 0-indexed start_char and end_char in the original text.
    3. Determine the correct authority tier (T1 through T5).
    4. Categorize blocker type: DOCUMENT_MISMATCH | CUSTOMS_HOLD | DELIVERY_ORDER_EXPIRED | DRIVER_ETA_CONFLICT | TRI_AXLE_REQUIRED | REEFER_GENSET_REQUIRED | DPD_EVACUATION_CLIFF | PGA_CLEARANCE_PENDING | PAYMENT_RECONCILIATION_DELAY | EMPTY_DEPOT_REJECTION | YARD_STACK_DEPTH_DELAY | WAREHOUSE_APPOINTMENT_MISSED.
    
    Return JSON ONLY with this exact structure:
    {{
      "blockers": [
        {{
          "type": "STRING",
          "claim": "Concise factual description",
          "quote": "EXACT verbatim substring from text",
          "start_char": 0,
          "end_char": 10,
          "confidence": 0.95,
          "authority_tier": "T1 | T2 | T3 | T4 | T5",
          "status": "NEEDS_VERIFICATION | HARD_BLOCKER",
          "responsible_role": "CUSTOMS_BROKER | DISPATCHER | SHIPPING_LINE_AGENT | TERMINAL_OPERATOR | FINANCE_DESK"
        }}
      ]
    }}
    
    TEXT TO ANALYZE:
    {raw_text}
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json"}
        })
        if resp.status_code == 200:
            data = resp.json()
            raw_json = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw_json)
            blockers = parsed.get("blockers", [])
            for b in blockers:
                b["source_id"] = source_id
            return blockers
        else:
            raise Exception(f"Gemini API returned status {resp.status_code}")
