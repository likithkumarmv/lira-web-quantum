import os
import tempfile
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

os.environ.setdefault("MPLCONFIGDIR", tempfile.gettempdir())

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DEMO_AUTH_ENABLED: bool = True
    DATABASE_URL: str = "sqlite+aiosqlite:///./lira.db"
    PUBLIC_API_BASE_URL: str = "http://localhost:8000/api/v1"
    WEB_ORIGIN: str = "http://localhost:3000"

    # API Keys
    GEMINI_API_KEY: Optional[str] = None
    QPIAI_OPT_API_KEY: Optional[str] = None
    QPIAI_QCLOUD_API_KEY: Optional[str] = None
    BOLNA_API_KEY: Optional[str] = None
    BOLNA_AGENT_ID: Optional[str] = "7c439d93-81bf-447a-a2a7-cfb3fbc3a57f"
    SARVAM_API_KEY: Optional[str] = None
    WEATHER_API_KEY: Optional[str] = None
    OPENWEATHER_API_KEY: Optional[str] = None
    TRAFFIC_API_KEY: Optional[str] = None
    GOOGLE_MAPS_API_KEY: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    SUPABASE_PUBLISHABLE_KEY: Optional[str] = None

    # Secret settings
    JWT_SIGNING_SECRET: str = "lira_dev_jwt_secret_key_36hr_hackathon_demo"
    EDGE_HMAC_KEY_EDGE_01: str = "lira-lab-device-key-change-me-32b"
    BOLNA_WEBHOOK_SIGNING_SECRET: str = "bolna_webhook_secret_dev"

    # Feature modes: MOCK | LIVE | SIMULATOR
    GEMINI_MODE: str = "LIVE"
    QPIAI_OPT_MODE: str = "LIVE"
    QPIAI_QCLOUD_MODE: str = "QCLOUD"
    CALLING_MODE: str = "LIVE"
    EXTERNAL_DATA_MODE: str = "LIVE"

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

