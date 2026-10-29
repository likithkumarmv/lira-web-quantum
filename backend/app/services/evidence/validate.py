"""
LIRA Grounded Evidence Validator — PRD v7.0 Normative Implementation
Implements:
1. Strict 5-tier authority hierarchy (T1 statutory down to T5 predictive).
2. Verbatim substring offset grounding against original document byte streams.
3. Statutory Demurrage Invoice Audit Gate (46 CFR § 541.6 & Indian Tariff Compliance):
   Enforces 4 mandatory elements: free-time start, free-time end, explicit tiered rate, carrier dispute contact.
   Deficient invoices are flagged as STATUTORILY_DEFICIENT_INVOICE with zero payment obligation.
"""

import re
from typing import List, Dict, Any, Tuple


MANDATORY_INVOICE_FIELDS = [
    ("free_time_start", r"(free\s*time\s*start|discharge\s*date|commenced|free\s*period\s*from)"),
    ("free_time_end", r"(free\s*time\s*end|expiry|free\s*time\s*deadline|lapsed|free\s*period\s*to)"),
    ("tiered_rate", r"(rate\s*per|tier|per\s*day|\/day|\/hour|slab|daily\s*charge)"),
    ("dispute_contact", r"(dispute|contact|email|helpdesk|grievance|officer|desk)")
]


def audit_demurrage_invoice_compliance(raw_text: str, candidate: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Evaluates demurrage claims against 46 CFR § 541.6 and Indian Major Port Authority Tariff Regulations.
    Returns (is_compliant, missing_elements, dispute_packet).
    """
    text_lower = raw_text.lower()
    missing_elements = []

    for field_name, pattern in MANDATORY_INVOICE_FIELDS:
        if not re.search(pattern, text_lower):
            missing_elements.append(field_name)

    is_compliant = len(missing_elements) == 0
    dispute_packet = {
        "statute": "46 CFR § 541.6 / Indian Major Port Authority Tariff Compliance",
        "is_compliant": is_compliant,
        "missing_elements": missing_elements,
        "payment_obligation": "MANDATORY_SUSPENDED" if not is_compliant else "VALID_PAYABLE",
        "action_required": "Auto-assemble dispute packet and demand re-issuance" if not is_compliant else "Proceed with settlement audit"
    }
    return is_compliant, missing_elements, dispute_packet


def validate_extraction_results(
    raw_text: str,
    candidates: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[str]]:
    valid_candidates = []
    errors = []

    # Track T1 statutory holds to prevent T4 overrides
    t1_statutory_holds = set()
    for c in candidates:
        if c.get("authority_tier") == "T1" and c.get("status") == "HARD_BLOCKER":
            t1_statutory_holds.add(c.get("type"))

    for idx, c in enumerate(candidates):
        quote = c.get("quote", "")
        start_c = c.get("start_char", 0)
        end_c = c.get("end_char", 0)
        tier = c.get("authority_tier", "T2")
        claim_type = c.get("type", "")

        # Rule 1: Span bounds check & quote grounding
        if start_c < 0 or end_c > len(raw_text) or start_c >= end_c:
            pos = raw_text.find(quote)
            if pos != -1:
                start_c = pos
                end_c = pos + len(quote)
                c["start_char"] = start_c
                c["end_char"] = end_c
            else:
                errors.append(f"Blocker {idx} ('{claim_type}') span [{start_c}:{end_c}] invalid and quote not found in text.")
                continue

        # Rule 2: Verbatim quote match
        actual_substring = raw_text[start_c:end_c]
        if actual_substring.strip() != quote.strip():
            pos = raw_text.find(quote.strip())
            if pos != -1:
                c["start_char"] = pos
                c["end_char"] = pos + len(quote.strip())
            else:
                errors.append(f"Blocker {idx} quote '{quote}' does not match text span '{actual_substring}'.")
                continue

        # Rule 3: 46 CFR § 541.6 Statutory Demurrage Invoice Audit Gate
        if any(term in claim_type.lower() for term in ["demurrage", "detention", "carrier_invoice"]):
            is_comp, missing, packet = audit_demurrage_invoice_compliance(raw_text, c)
            c["statutory_compliance"] = packet
            if not is_comp:
                c["status"] = "STATUTORILY_DEFICIENT_INVOICE"
                c["authority_tier"] = "T1"  # Statutory audit verdict
                errors.append(
                    f"46 CFR § 541.6 Audit: Carrier invoice deficient in mandatory fields {missing}. Payment obligation suspended."
                )

        # Rule 4: UNKNOWN is not CLEARED (Only T1 can confirm statutory customs/port clearance)
        if c.get("status") == "CLEARED" and tier != "T1":
            c["status"] = "NEEDS_VERIFICATION"
            errors.append(f"Authority Guard: Demoted blocker {idx} ({claim_type}) to NEEDS_VERIFICATION; non-T1 authority ({tier}) cannot confirm statutory clearance.")

        # Rule 5: T5 (AI interpretation / unverified suggestion) cannot independently establish hard blockers
        if tier == "T5":
            if c.get("status") == "HARD_BLOCKER":
                c["status"] = "NEEDS_VERIFICATION"
                errors.append(f"Authority Guard: T5 AI interpretation cannot independently mandate a HARD_BLOCKER without corroborating T1/T2 evidence.")

        # Rule 6: T4 (informal driver/broker statement) cannot override active T1 statutory hold
        if tier in ["T3", "T4"] and claim_type in t1_statutory_holds and c.get("status") == "CLEARED":
            c["status"] = "NEEDS_VERIFICATION"
            errors.append(f"Authority Guard: Driver/broker statement ({tier}) cannot override authoritative T1 statutory hold for {claim_type}.")

        valid_candidates.append(c)

    return valid_candidates, errors
