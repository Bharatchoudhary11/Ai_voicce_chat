from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Environment-driven configuration."""

    app_name: str = "salon-agent"
    database_url: str = Field(
        default=f"sqlite:///{Path(__file__).resolve().parent.parent / 'data' / 'app.db'}"
    )
    livekit_url: str = Field(default="wss://example.livekit.dev")
    livekit_api_key: str = Field(default="demo-key")
    livekit_api_secret: str = Field(default="demo-secret")
    request_timeout_minutes: int = Field(default=30)
    knowledge_base_auto_tag: str = Field(default="General")
    post_resolution_followup: str = Field(
        default="Thanks for reaching out! If you have any more questions, feel free to contact me anytime — I'm here for you."
    )
    allowed_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ]
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
