from __future__ import annotations

from fastapi import FastAPI

from .api.router import router
from .config import get_settings
from .repository import init_db

settings = get_settings()
app = FastAPI(title="Human-in-the-loop API", version="0.1.0")
app.include_router(router)


@app.on_event("startup")
async def startup() -> None:
    init_db()


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}
