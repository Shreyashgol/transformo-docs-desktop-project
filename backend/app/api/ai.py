from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.ai.base import (
    AIProviderError,
    AuthenticationError,
    InvalidResponseError,
    NetworkError,
    RateLimitError,
)
from app.ai.models import AIProviderConfig, SummaryRequest, SummaryResponse
from app.ai.service import SummarizationService

logger = logging.getLogger("transformo.api.ai")
router = APIRouter(tags=["ai"])


def get_ai_service(request: Request) -> SummarizationService:
    if not hasattr(request.app.state, "ai_service"):
        # Access ingestion service's repository
        if not hasattr(request.app.state, "ingestion_service"):
            from app.ingestion.service import IngestionService
            request.app.state.ingestion_service = IngestionService(request.app.state.settings)
        repo = request.app.state.ingestion_service.repo
        request.app.state.ai_service = SummarizationService(repo)
    return request.app.state.ai_service


class ConsentRequest(BaseModel):
    consent: bool


@router.get("/api/ai/settings", response_model=AIProviderConfig)
def get_ai_settings(request: Request) -> AIProviderConfig:
    service = get_ai_service(request)
    return service.get_config()


@router.post("/api/ai/consent")
def set_ai_consent(request: Request, body: ConsentRequest) -> dict[str, bool]:
    service = get_ai_service(request)
    service.set_user_consent(body.consent)
    return {"consent": body.consent}


@router.post("/api/documents/{doc_id}/summary", response_model=SummaryResponse)
def generate_summary(
    request: Request,
    doc_id: str,
    req: SummaryRequest,
    force: bool = Query(False, description="Force regeneration bypassing cached summary"),
) -> SummaryResponse:
    service = get_ai_service(request)
    try:
        return service.summarize_document(
            doc_id=doc_id,
            length=req.length,
            focus=req.focus,
            force_regenerate=force,
        )
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except RateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc
    except NetworkError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except InvalidResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except AIProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.get("/api/documents/{doc_id}/summary", response_model=SummaryResponse)
def get_summary(request: Request, doc_id: str) -> SummaryResponse:
    service = get_ai_service(request)
    summary = service.get_cached_summary(doc_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No summary found for document '{doc_id}'.",
        )
    return summary
