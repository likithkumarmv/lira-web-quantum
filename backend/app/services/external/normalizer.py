import datetime
from typing import Dict, Any, List


def normalize_external_event(
    event_type: str,
    raw_payload: Dict[str, Any],
    source_label: str = "Weather radar / DEMO",
    trust_state: str = "FORECAST_RISK"
) -> Dict[str, Any]:
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    four_hrs_later = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=4)).isoformat()

    # Weather forecast is ALWAYS FORECAST_RISK unless official port emergency bulletin
    if event_type == "HEAVY_RAIN" and trust_state != "CONFIRMED_DISRUPTION":
        trust_state = "FORECAST_RISK"

    return {
        "event_id": raw_payload.get("event_id", f"EXT-{datetime.datetime.now().strftime('%M%S')}"),
        "type": event_type,
        "trust_state": trust_state,  # FORECAST_RISK | CONFIRMED_DISRUPTION | CANCELLED
        "severity": raw_payload.get("severity", "HIGH"),
        "title": raw_payload.get("title", f"Weather risk: {event_type}"),
        "source_label": source_label,
        "geography": raw_payload.get("geography", "Nhava Sheva Corridor"),
        "starts_at": raw_payload.get("starts_at", now_iso),
        "ends_at": raw_payload.get("ends_at", four_hrs_later),
        "affected_trucks": raw_payload.get("affected_trucks", ["T07"]),
        "affected_slots": raw_payload.get("affected_slots", []),
        "is_simulated": raw_payload.get("is_simulated", True)
    }

