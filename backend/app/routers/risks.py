from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional
from app.db.session import get_db
from app.services.external.risk_engine import evaluate_incident_risk
from app.services.external.weather_adapter import fetch_live_weather
from app.services.external.traffic_adapter import fetch_corridor_transit_time

router = APIRouter(prefix="/risks", tags=["Weather and Traffic Risk Engine"])


@router.get("/summary")
async def get_risk_summary(
    corridor: str = Query("NH-348 Panvel-JNPA Expressway", description="Monitored freight corridor"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    weather = await fetch_live_weather()
    traffic = await fetch_corridor_transit_time(corridor_name=corridor)

    overall_status = "AT_RISK" if (traffic.get("congestion_delay_mins", 0) > 20 or weather.get("is_disruption_risk")) else "ON_SCHEDULE"

    return {
        "status": "HEALTHY",
        "corridor": corridor,
        "overall_status": overall_status,
        "weather": weather,
        "traffic": traffic,
        "disclaimers": [
            traffic.get("truck_routing_disclaimer"),
            traffic.get("road_closure_disclaimer"),
            weather.get("statutory_closure_note")
        ]
    }


@router.get("/{incident_id}")
async def get_incident_risk_profile(
    incident_id: str,
    departure_time: Optional[str] = Query(None, description="ISO departure time"),
    permitted_deadline: Optional[str] = Query(None, description="ISO appointment deadline"),
    corridor: str = Query("NH-348 Panvel-JNPA Expressway"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    result = await evaluate_incident_risk(
        db=db,
        incident_id=incident_id,
        departure_time_iso=departure_time,
        permitted_deadline_iso=permitted_deadline,
        corridor_name=corridor
    )
    return result

