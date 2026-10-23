from __future__ import annotations

from fastapi import FastAPI

from app import __version__
from app.api import ai, documents, health, version
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

    from app.ingestion.service import IngestionService
    from app.ai.service import SummarizationService
    from app.ai.extraction_service import ExtractionService
    from app.ai.groq_provider import GroqProvider

    shared_provider = GroqProvider()
    ingestion_service = IngestionService(settings)
    app.state.ingestion_service = ingestion_service
    app.state.ai_service = SummarizationService(ingestion_service.repo, provider=shared_provider)
    app.state.extraction_service = ExtractionService(ingestion_service.repo, provider=shared_provider)

    app.add_middleware(LocalAuthMiddleware, token=settings.token, port=settings.port)
    app.include_router(health.router)
    app.include_router(version.router)
    app.include_router(documents.router)
    app.include_router(ai.router)
    return app
