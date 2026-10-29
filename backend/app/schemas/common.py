import time
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class HealthResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    status: str = "ok"
    mode: str = "LIVE"
    version: str = "v11.0"
    schema_version: str = Field("v13.0", alias="schema")
    server_unix: int = Field(default_factory=lambda: int(time.time()))
    bolna_agent_status: Optional[str] = "READY"
    qpiai_opt_status: Optional[str] = "READY"
    qpiai_qcloud_status: Optional[str] = "READY"
    weather_status: Optional[str] = "READY"
    traffic_status: Optional[str] = "READY"
    gemini_status: Optional[str] = "READY"
    sarvam_status: Optional[str] = "READY"
    supabase_status: Optional[str] = "READY"
    providers: Optional[dict] = None


class DemoLoginRequest(BaseModel):
    user_code: str


class DemoLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    role: str
    display_name: str
    truck_id: Optional[str] = None

