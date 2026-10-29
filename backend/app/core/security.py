import time
from typing import Optional
import jwt
from fastapi import Header, HTTPException, Depends
from app.core.config import settings
from app.core.errors import LIRAException


def create_access_token(user_code: str, role: str, truck_id: Optional[str] = None, display_name: Optional[str] = None) -> str:
    payload = {
        "sub": user_code,
        "role": role,
        "truck_id": truck_id,
        "display_name": display_name or user_code,
        "exp": int(time.time()) + 3600,
        "iat": int(time.time())
    }
    return jwt.encode(payload, settings.JWT_SIGNING_SECRET, algorithm="HS256")


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SIGNING_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise LIRAException(status_code=401, code="TOKEN_EXPIRED", message="Token has expired")
    except Exception:
        raise LIRAException(status_code=401, code="INVALID_TOKEN", message="Invalid authentication token")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        # Default fallback for local testing if DEMO_AUTH_ENABLED
        if settings.DEMO_AUTH_ENABLED:
            return {"sub": "DEMO_USER", "role": "OPS_MANAGER", "truck_id": None, "display_name": "Demo Manager"}
        raise LIRAException(status_code=401, code="UNAUTHORIZED", message="Authorization header missing")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise LIRAException(status_code=401, code="INVALID_HEADER", message="Invalid Authorization header format")

    token = parts[1]
    return verify_token(token)


async def get_current_driver(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "DRIVER" and user.get("role") != "OPS_MANAGER":
        raise LIRAException(status_code=403, code="FORBIDDEN", message="Driver access required")
    return user

