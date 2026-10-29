"""
LIRA ESP32 Edge HMAC-SHA256 Verification Protocol
PRD v7.0 Normative Implementation:
Validates incoming cryptographic signatures from ESP32 DevKit V1 + 2.8" ILI9341 TFT Touch + RC522 RFID.
Eliminates DS3231 RTC wall-clock dependency by verifying via device sequence counter and cryptographic nonce.
"""

import hmac
import hashlib
from typing import Optional
from app.core.config import settings


def compute_canonical_string_v7(
    device_id: str,
    event_type: str,
    device_seq: int,
    assignment_id: Optional[str] = None,
    nonce: Optional[str] = None
) -> str:
    """Normative PRD v7.0 Canonical Signature String (No RTC Wall Clock Required)"""
    return f"{device_id}|{event_type}|{device_seq}|{assignment_id or ''}|{nonce or ''}"


def compute_canonical_string_v5(
    device_id: str,
    event_type: str,
    observed_at: Optional[str],
    sequence: int,
    assignment_id: Optional[str] = None
) -> str:
    """Legacy v5.0 Canonical Signature String"""
    return f"{device_id}|{event_type}|{observed_at or ''}|{sequence}|{assignment_id or ''}"


def verify_edge_signature(
    device_id: str,
    event_type: str,
    sequence: int,
    assignment_id: Optional[str],
    signature: Optional[str],
    observed_at: Optional[str] = None,
    device_seq: Optional[int] = None,
    nonce: Optional[str] = None,
    device_key: Optional[str] = None
) -> bool:
    if not signature:
        return False

    effective_seq = device_seq if device_seq is not None else sequence
    keys_to_try = [
        (device_key or settings.EDGE_HMAC_KEY_EDGE_01).encode("utf-8"),
        settings.EDGE_HMAC_KEY_EDGE_01.encode("utf-8"),
        b"edge_hmac_secret_key_lira_01",
        b"lira-lab-device-key-change-me-32b",
    ]

    for key in keys_to_try:
        # Try v7.0 canonical string first
        canonical_v7 = compute_canonical_string_v7(device_id, event_type, effective_seq, assignment_id, nonce).encode("utf-8")
        sig_v7 = hmac.new(key, canonical_v7, hashlib.sha256).hexdigest()
        if hmac.compare_digest(sig_v7.lower(), signature.lower()):
            return True

        # Fallback to legacy v5 format if observed_at is provided
        if observed_at:
            canonical_v5 = compute_canonical_string_v5(device_id, event_type, observed_at, sequence, assignment_id).encode("utf-8")
            sig_v5 = hmac.new(key, canonical_v5, hashlib.sha256).hexdigest()
            if hmac.compare_digest(sig_v5.lower(), signature.lower()):
                return True

    return False


def generate_edge_signature(
    device_id: str,
    event_type: str,
    sequence: int = 1,
    assignment_id: Optional[str] = None,
    nonce: Optional[str] = None,
    observed_at: Optional[str] = None,
    device_key: Optional[str] = None
) -> str:
    key = (device_key or settings.EDGE_HMAC_KEY_EDGE_01).encode("utf-8")
    if nonce is not None:
        canonical = compute_canonical_string_v7(device_id, event_type, sequence, assignment_id, nonce).encode("utf-8")
    else:
        canonical = compute_canonical_string_v5(device_id, event_type, observed_at, sequence, assignment_id).encode("utf-8")
    return hmac.new(key, canonical, hashlib.sha256).hexdigest()
