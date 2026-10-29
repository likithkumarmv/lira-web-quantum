"""
LIRA ESP32 Edge Device Authentication Protocol v13
Requirement 1:
Headers: X-LIRA-Device, X-LIRA-Nonce, X-LIRA-Signature
signature = HMAC_SHA256_HEX(key=EDGE_HMAC_KEY_EDGE_01 as raw UTF-8 bytes,
            msg = METHOD + "\n" + URL_PATH + "\n" + NONCE + "\n" + SHA256_HEX(raw_body_bytes))
lowercase hex, constant-time compare, reject reused nonce (store nonces in DB/redis) -> 401.
Lab key for now: lira-lab-device-key-change-me-32b (from backend/.env, never hardcoded).
"""

import hashlib
import hmac
import time
from typing import Optional
from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.db.models import EdgeNonceModel

# In-memory cache for fast lookup
_SEEN_NONCES: set[tuple[str, str]] = set()


def compute_v13_signature(
    method: str,
    path: str,
    nonce: str,
    body_bytes: bytes,
    key_str: Optional[str] = None
) -> str:
    key = (key_str or settings.EDGE_HMAC_KEY_EDGE_01).encode("utf-8")
    body_hash = hashlib.sha256(body_bytes).hexdigest().lower()
    msg = f"{method.upper()}\n{path}\n{nonce}\n{body_hash}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest().lower()


async def verify_device_auth(
    request: Request,
    db: Optional[AsyncSession] = None,
    required: bool = False
) -> Optional[str]:
    """
    Verifies X-LIRA-Device, X-LIRA-Nonce, X-LIRA-Signature if present or required.
    Returns device_id if authenticated, or None if headers absent and not required.
    Raises HTTPException(401) on invalid signature or reused nonce.
    """
    device_id = request.headers.get("X-LIRA-Device")
    nonce = request.headers.get("X-LIRA-Nonce")
    signature = request.headers.get("X-LIRA-Signature")

    if not device_id or not nonce or not signature:
        if required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing edge device authentication headers (X-LIRA-Device, X-LIRA-Nonce, X-LIRA-Signature)"
            )
        return None

    # Check for nonce reuse in-memory
    nonce_key = (device_id, nonce)
    if nonce_key in _SEEN_NONCES:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Replay detected: nonce {nonce} has already been used for device {device_id}"
        )

    # Check for nonce reuse in DB if session is available
    if db is not None:
        try:
            stmt = select(EdgeNonceModel).where(
                EdgeNonceModel.device_id == device_id,
                EdgeNonceModel.nonce == nonce
            )
            res = await db.execute(stmt)
            if res.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Replay detected: nonce {nonce} already exists in database"
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # Read body bytes without consuming request stream
    body_bytes = await request.body()

    path = request.url.path
    method = request.method
    expected_sig = compute_v13_signature(
        method=method,
        path=path,
        nonce=nonce,
        body_bytes=body_bytes,
        key_str=settings.EDGE_HMAC_KEY_EDGE_01
    )

    if not hmac.compare_digest(expected_sig.lower(), signature.lower()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid edge device HMAC signature"
        )

    # Record valid nonce
    _SEEN_NONCES.add(nonce_key)
    if len(_SEEN_NONCES) > 10000:
        _SEEN_NONCES.clear()

    if db is not None:
        try:
            db_nonce = EdgeNonceModel(
                device_id=device_id,
                nonce=nonce,
                created_at=int(time.time())
            )
            db.add(db_nonce)
            await db.commit()
        except Exception:
            await db.rollback()

    return device_id

