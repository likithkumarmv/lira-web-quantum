from typing import List, Optional
from pydantic import BaseModel


class ExternalEventItem(BaseModel):
    event_id: str
    type: str  # HEAVY_RAIN | PORT_CONGESTION | PORT_CLOSURE | TRAFFIC_JAM
    trust_state: str  # FORECAST_RISK | CONFIRMED_DISRUPTION | CANCELLED
    severity: str  # LOW | MEDIUM | HIGH | CRITICAL
    title: str
    source_label: str
    geography: str
    starts_at: str
    ends_at: str
    affected_trucks: List[str]
    affected_slots: List[str]
    is_simulated: bool = False
    updated_at: str


class SimulateExternalEventRequest(BaseModel):
    type: str = "HEAVY_RAIN"
    trust_state: str = "FORECAST_RISK"  # FORECAST_RISK | CONFIRMED_DISRUPTION | CANCELLED
    severity: str = "HIGH"
    title: str = "Heavy rain forecast along Nhava Sheva approach road"
    source_label: str = "IMD Radar / Controlled DEMO"
    geography: str = "Nhava Sheva Corridor"
    duration_hours: int = 4
    affected_trucks: List[str] = ["T07"]
    affected_slots: List[str] = []


class SimulateExternalEventResponse(BaseModel):
    event_id: str
    type: str
    trust_state: str
    severity: str
    impact_summary: str

