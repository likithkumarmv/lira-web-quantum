import time
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import UserModel
from app.schemas.common import HealthResponse, DemoLoginRequest, DemoLoginResponse
from app.core.security import create_access_token
from app.services.edge.device_auth import verify_device_auth

router = APIRouter(tags=["Auth & Health"])


from app.core.config import settings


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request, db: AsyncSession = Depends(get_db)):
    # Requirement 1: If X-LIRA-Device header is present, verify device HMAC
    if request.headers.get("X-LIRA-Device"):
        await verify_device_auth(request, db=db, required=True)

    bolna_status = "READY" if settings.BOLNA_API_KEY and settings.BOLNA_AGENT_ID else "NOT_CONFIGURED"
    qpiai_opt_status = "READY" if settings.QPIAI_OPT_API_KEY else "NOT_CONFIGURED"
    qpiai_qcloud_status = "READY" if settings.QPIAI_QCLOUD_API_KEY else "NOT_CONFIGURED"
    weather_status = "READY" if settings.OPENWEATHER_API_KEY or settings.WEATHER_API_KEY else "NOT_CONFIGURED"
    traffic_status = "READY" if settings.GOOGLE_MAPS_API_KEY or settings.TRAFFIC_API_KEY else "NOT_CONFIGURED"
    gemini_status = "READY" if settings.GEMINI_API_KEY else "NOT_CONFIGURED"
    sarvam_status = "READY" if settings.SARVAM_API_KEY else "NOT_CONFIGURED"
    supabase_status = "READY" if settings.SUPABASE_URL and settings.SUPABASE_PUBLISHABLE_KEY else "NOT_CONFIGURED"

    return HealthResponse(
        status="ok",
        mode="LIVE",
        version="v11.0",
        schema="v13.0",
        server_unix=int(time.time()),
        bolna_agent_status=bolna_status,
        qpiai_opt_status=qpiai_opt_status,
        qpiai_qcloud_status=qpiai_qcloud_status,
        weather_status=weather_status,
        traffic_status=traffic_status,
        gemini_status=gemini_status,
        sarvam_status=sarvam_status,
        supabase_status=supabase_status,
        providers={
            "bolna": {"status": bolna_status},
            "qpiai_opt": {"status": qpiai_opt_status, "engine": "QUBO_HUBO_HYBRID"},
            "qpiai_qcloud": {"status": qpiai_qcloud_status, "backend": "QPIAI_QCLOUD_QAOA"},
            "openweather": {"status": weather_status, "corridor": "JNPA_PANVEL"},
            "google_maps": {"status": traffic_status, "routes": "TRAFFIC_AWARE_DIRECTIONS"},
            "gemini": {"status": gemini_status, "model": "gemini-1.5-flash"},
            "sarvam": {"status": sarvam_status, "language": "hi-IN/en-IN"},
            "supabase": {"status": supabase_status, "db": "CANONICAL_STATE"}
        }
    )


@router.post("/auth/demo-login", response_model=DemoLoginResponse)
async def demo_login(req: DemoLoginRequest, db: AsyncSession = Depends(get_db)):
    # Lookup or create demo user
    stmt = select(UserModel).where(UserModel.user_code == req.user_code)
    res = await db.execute(stmt)
    user = res.scalars().first()

    role = "DRIVER" if req.user_code.startswith("DRIVER_") else "OPS_MANAGER"
    truck_id = req.user_code.replace("DRIVER_", "") if role == "DRIVER" else None
    display_name = f"Driver {truck_id}" if truck_id else "Operations Dispatcher"

    if not user:
        user = UserModel(
            id=f"USR-{req.user_code}",
            user_code=req.user_code,
            role=role,
            display_name=display_name,
            truck_id=truck_id,
            active=True
        )
        db.add(user)
        await db.commit()
    else:
        role = user.role
        truck_id = user.truck_id
        display_name = user.display_name or req.user_code

    token = create_access_token(
        user_code=req.user_code,
        role=role,
        truck_id=truck_id,
        display_name=display_name
    )

    return DemoLoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=3600,
        role=role,
        display_name=display_name,
        truck_id=truck_id
    )

