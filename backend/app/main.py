from __future__ import annotations

from fastapi import FastAPI

from app import __version__
from app.api import documents, health, version
from app.config import Settings
from app.security import LocalAuthMiddleware


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Transformo Docs Backend",
        version=__version__,
        # The API is private to the desktop app; no interactive docs are served.
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.settings = settings
    app.add_middleware(LocalAuthMiddleware, token=settings.token, port=settings.port)
    app.include_router(health.router)
    app.include_router(version.router)
    app.include_router(documents.router)
    return app
