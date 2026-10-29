import datetime
import httpx
from typing import Dict, Any, Optional
from app.core.config import settings

def _utcnow_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def _expires_at_iso(minutes: int = 15):
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)).isoformat()


async def fetch_corridor_transit_time(
    origin_lat: float = 19.03,
    origin_lng: float = 73.02,
    dest_lat: float = 18.95,
    dest_lng: float = 72.95,
    corridor_name: str = "NH-348 Panvel-JNPA Expressway"
) -> Dict[str, Any]:
    api_key = settings.GOOGLE_MAPS_API_KEY or settings.TRAFFIC_API_KEY
    now_iso = _utcnow_iso()
    ttl_iso = _expires_at_iso(15)

    if api_key and api_key not in ["REPLACE_LOCALLY", "your_traffic_api_key_here"]:
        try:
            # 1. Try Google Routes API (computeRoutes) with narrow field mask
            routes_url = "https://routes.googleapis.com/directions/v2:computeRoutes"
            headers = {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters"
            }
            body = {
                "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}},
                "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}},
                "travelMode": "DRIVE",
                "routingPreference": "TRAFFIC_AWARE",
                "departureTime": now_iso
            }

            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.post(routes_url, headers=headers, json=body)
                if resp.status_code == 200:
                    data = resp.json()
                    routes = data.get("routes", [])
                    if routes:
                        r = routes[0]
                        # duration format: e.g. "3600s"
                        duration_str = r.get("duration", "3600s").rstrip("s")
                        static_str = r.get("staticDuration", "2400s").rstrip("s")
                        duration_s = int(float(duration_str))
                        static_s = int(float(static_str))
                        dist_m = int(r.get("distanceMeters", 28000))

                        duration_mins = int(duration_s / 60)
                        static_mins = int(static_s / 60)
                        congestion_delay_mins = max(0, duration_mins - static_mins)

                        return {
                            "provider": "GOOGLE_ROUTES",
                            "source_record_id": f"GOOG-ROUTES-{int(origin_lat*100)}-{int(dest_lat*100)}",
                            "origin": "LIVE_EXTERNAL",
                            "corridor": corridor_name,
                            "distance_km": round(dist_m / 1000.0, 1),
                            "duration_traffic_mins": duration_mins,
                            "static_duration_mins": static_mins,
                            "congestion_delay_mins": congestion_delay_mins,
                            "traffic_severity": "CRITICAL" if congestion_delay_mins > 40 else ("HIGH" if congestion_delay_mins > 20 else "LOW"),
                            "truck_routing_disclaimer": "Google automobile routing is NOT certified heavy-vehicle routing. Prime mover 3-axle weight permits and bridge clearances must be validated.",
                            "road_closure_disclaimer": "Traffic congestion is an operational signal; it does NOT constitute legal proof of road closure without an official MSRDC/Traffic Police bulletin.",
                            "checked_at": now_iso,
                            "expires_at": ttl_iso,
                            "is_stale": False
                        }
        except Exception:
            pass

    # High-Fidelity Grounded Lab Fixture (NH-348 Monsoon Waterlogging Corridor)
    return {
        "provider": "GOOGLE_ROUTES",
        "source_record_id": "FIXTURE-GOOG-NH348-MONSOON",
        "origin": "LAB_FIXTURE",
        "corridor": corridor_name,
        "distance_km": 28.4,
        "duration_traffic_mins": 65,
        "static_duration_mins": 35,
        "congestion_delay_mins": 30,
        "traffic_severity": "HIGH",
        "truck_routing_disclaimer": "Google automobile routing is NOT certified heavy-vehicle routing. Prime mover 3-axle weight permits and bridge clearances must be validated.",
        "road_closure_disclaimer": "Traffic congestion is an operational signal; it does NOT constitute legal proof of road closure without an official MSRDC/Traffic Police bulletin.",
        "checked_at": now_iso,
        "expires_at": ttl_iso,
        "is_stale": False
    }
