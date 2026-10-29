import datetime
import uuid
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import RiskSnapshotModel, IncidentModel, BlockerNodeModel
from app.services.external.weather_adapter import fetch_live_weather
from app.services.external.traffic_adapter import fetch_corridor_transit_time

def _utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

def _parse_iso(s: Optional[str]) -> Optional[datetime.datetime]:
    if not s:
        return None
    try:
        return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


async def evaluate_incident_risk(
    db: AsyncSession,
    incident_id: str,
    departure_time_iso: Optional[str] = None,
    permitted_deadline_iso: Optional[str] = None,
    corridor_name: str = "NH-348 Panvel-JNPA Expressway",
    loading_buffer_minutes: int = 20
) -> Dict[str, Any]:
    now = _utcnow()
    now_iso = now.isoformat()

    # 1. Check existing cached risk snapshot (TTL: 15 mins)
    stmt = select(RiskSnapshotModel).where(
        RiskSnapshotModel.incident_id == incident_id,
        RiskSnapshotModel.expires_at > now_iso
    ).order_by(RiskSnapshotModel.checked_at.desc())
    res = await db.execute(stmt)
    cached = res.scalars().first()
    if cached:
        return {
            "snapshot_id": cached.snapshot_id,
            "incident_id": cached.incident_id,
            "provider": cached.provider,
            "origin": cached.origin,
            "corridor": cached.location_corridor,
            "duration_minutes": int(cached.duration_seconds / 60),
            "distance_km": round(cached.distance_meters / 1000.0, 1),
            "predicted_arrival": cached.predicted_arrival,
            "permitted_deadline": cached.permitted_deadline,
            "risk_status": cached.risk_status,
            "confidence_score": cached.confidence_score,
            "severity": cached.severity,
            "certainty": cached.certainty,
            "raw_source_ref": cached.raw_source_ref,
            "checked_at": cached.checked_at,
            "expires_at": cached.expires_at,
            "is_cached": True
        }

    # 2. Fetch fresh weather and traffic signals
    weather = await fetch_live_weather()
    traffic = await fetch_corridor_transit_time(corridor_name=corridor_name)

    # 3. Calculate predicted arrival
    dep_time = _parse_iso(departure_time_iso) or now
    travel_minutes = traffic.get("duration_traffic_mins", 65)
    total_minutes = travel_minutes + loading_buffer_minutes
    pred_arrival = dep_time + datetime.timedelta(minutes=total_minutes)
    pred_arrival_iso = pred_arrival.isoformat()

    # Default permitted deadline: today at 17:00 IST (approx 11:30 UTC) or +90 mins
    deadline = _parse_iso(permitted_deadline_iso) or (now + datetime.timedelta(minutes=90))
    deadline_iso = deadline.isoformat()

    # 4. Assess Risk Status
    slack_minutes = (deadline - pred_arrival).total_seconds() / 60.0
    if slack_minutes >= 20.0:
        risk_status = "ON_SCHEDULE"
        confidence = 0.95
        severity = "LOW"
    elif slack_minutes >= 0.0:
        risk_status = "AT_RISK"
        confidence = 0.88
        severity = "HIGH"
    else:
        risk_status = "LIKELY_MISS"
        confidence = 0.92
        severity = "CRITICAL"

    certainty = "CONFIRMED" if traffic.get("origin") == "LIVE_EXTERNAL" else "FORECAST"
    source_ref = f"{traffic.get('provider')}:{traffic.get('source_record_id')} | {weather.get('provider')}:{weather.get('source_record_id')}"

    # 5. Persist to DB
    snapshot_id = f"RSK-{uuid.uuid4().hex[:8].upper()}"
    ttl_iso = (now + datetime.timedelta(minutes=15)).isoformat()
    snapshot = RiskSnapshotModel(
        snapshot_id=snapshot_id,
        incident_id=incident_id,
        provider=traffic.get("provider", "GOOGLE_ROUTES"),
        source_record_id=traffic.get("source_record_id"),
        origin=traffic.get("origin", "LAB_FIXTURE"),
        location_corridor=corridor_name,
        departure_time=dep_time.isoformat(),
        duration_seconds=travel_minutes * 60,
        distance_meters=int(traffic.get("distance_km", 28.4) * 1000),
        predicted_arrival=pred_arrival_iso,
        permitted_deadline=deadline_iso,
        risk_status=risk_status,
        confidence_score=confidence,
        severity=severity,
        certainty=certainty,
        raw_source_ref=source_ref,
        is_stale=False,
        checked_at=now_iso,
        expires_at=ttl_iso
    )
    db.add(snapshot)
    await db.commit()

    return {
        "snapshot_id": snapshot_id,
        "incident_id": incident_id,
        "provider": snapshot.provider,
        "origin": snapshot.origin,
        "corridor": corridor_name,
        "weather_condition": weather.get("condition"),
        "weather_severity": weather.get("suggested_severity"),
        "duration_minutes": travel_minutes,
        "congestion_delay_minutes": traffic.get("congestion_delay_mins", 30),
        "distance_km": traffic.get("distance_km", 28.4),
        "predicted_arrival": pred_arrival_iso,
        "permitted_deadline": deadline_iso,
        "risk_status": risk_status,
        "confidence_score": confidence,
        "severity": severity,
        "certainty": certainty,
        "raw_source_ref": source_ref,
        "checked_at": now_iso,
        "expires_at": ttl_iso,
        "is_cached": False,
        "disclaimers": [
            traffic.get("truck_routing_disclaimer"),
            traffic.get("road_closure_disclaimer"),
            weather.get("statutory_closure_note")
        ]
    }

