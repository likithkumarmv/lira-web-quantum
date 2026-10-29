import datetime
import httpx
from typing import Dict, Any, Optional
from app.core.config import settings

def _utcnow_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def _expires_at_iso(minutes: int = 15):
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)).isoformat()


async def fetch_live_weather(lat: float = 18.95, lon: float = 72.95) -> Dict[str, Any]:
    api_key = settings.OPENWEATHER_API_KEY or settings.WEATHER_API_KEY
    now_iso = _utcnow_iso()
    ttl_iso = _expires_at_iso(15)

    if api_key and api_key not in ["REPLACE_LOCALLY", "your_openweather_api_key_here"]:
        try:
            # 1. Fetch current weather
            current_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
            # 2. Fetch 5-day / 3-hour forecast
            forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={api_key}&units=metric&cnt=4"

            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(current_url)
                if resp.status_code == 200:
                    data = resp.json()
                    weather_desc = data.get("weather", [{}])[0].get("description", "clear sky")
                    main = data.get("main", {})
                    wind = data.get("wind", {})
                    rain = data.get("rain", {})
                    temp = main.get("temp", 28.5)
                    humidity = main.get("humidity", 78)
                    wind_speed = wind.get("speed", 5.2)
                    rain_1h = rain.get("1h", 2.4)

                    is_rain = "rain" in weather_desc.lower() or "thunderstorm" in weather_desc.lower()
                    severity = "HIGH" if ("heavy" in weather_desc.lower() or rain_1h > 10.0) else ("MEDIUM" if is_rain else "LOW")

                    # Forecast glimpse
                    forecast_summary = "Monsoon precipitation expected to continue through 18:00 IST"
                    try:
                        f_resp = await client.get(forecast_url)
                        if f_resp.status_code == 200:
                            f_data = f_resp.json()
                            first_f = f_data.get("list", [{}])[0]
                            f_desc = first_f.get("weather", [{}])[0].get("description", "")
                            if f_desc:
                                forecast_summary = f"Next 3h: {f_desc}, temp {first_f.get('main', {}).get('temp')}°C"
                    except Exception:
                        pass

                    return {
                        "provider": "OPENWEATHER",
                        "source_record_id": f"OWM-{data.get('id', 'JNPA')}",
                        "origin": "LIVE_EXTERNAL",
                        "location": "JNPA Nhava Sheva Terminal Corridor (18.95N, 72.95E)",
                        "condition": weather_desc.title(),
                        "temperature_c": temp,
                        "humidity_pct": humidity,
                        "wind_speed_mps": wind_speed,
                        "rain_1h_mm": rain_1h,
                        "forecast_summary": forecast_summary,
                        "is_disruption_risk": is_rain,
                        "suggested_severity": severity,
                        "port_operations_impact": "ADVISORY_MONSOON_SURGE" if is_rain else "NORMAL",
                        "statutory_closure_note": "Weather forecast is an operational advisory; it does NOT constitute an official statutory port closure under JNPA Tariff 3.2.4 without a formal Harbor-Master notice.",
                        "checked_at": now_iso,
                        "expires_at": ttl_iso,
                        "is_stale": False
                    }
        except Exception:
            pass

    # High-Fidelity Grounded Lab Fixture (JNPA Nhava Sheva Monsoon Staging)
    return {
        "provider": "OPENWEATHER",
        "source_record_id": "FIXTURE-OWM-JNPA-MONSOON",
        "origin": "LAB_FIXTURE",
        "location": "JNPA Nhava Sheva Terminal Corridor (18.95N, 72.95E)",
        "condition": "Scattered Monsoon Showers",
        "temperature_c": 29.2,
        "humidity_pct": 84,
        "wind_speed_mps": 6.8,
        "rain_1h_mm": 4.5,
        "forecast_summary": "Intense convective showers over NH-348/Uran Phata through 17:30 IST",
        "is_disruption_risk": True,
        "suggested_severity": "MEDIUM",
        "port_operations_impact": "ADVISORY_MONSOON_SURGE",
        "statutory_closure_note": "Weather forecast is an operational advisory; it does NOT constitute an official statutory port closure under JNPA Tariff 3.2.4 without a formal Harbor-Master notice.",
        "checked_at": now_iso,
        "expires_at": ttl_iso,
        "is_stale": False
    }
