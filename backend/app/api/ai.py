from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.ai.base import (
    AIProviderError,
    AuthenticationError,
    InvalidResponseError,
    NetworkError,
    RateLimitError,
)
from app.ai.extraction_models import (
    ExtractionProfile,
    ExtractionRequest,
    ExtractionResult,
    ExtractionUpdateRequest,
)
from app.ai.extraction_service import ExtractionService
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


class UpdateAIConfigRequest(BaseModel):
    api_key: str | None = None
    model: str | None = None


@router.get("/api/ai/settings", response_model=AIProviderConfig)
def get_ai_settings(request: Request) -> AIProviderConfig:
    service = get_ai_service(request)
    return service.get_config()


@router.post("/api/ai/settings", response_model=AIProviderConfig)
def update_ai_settings(request: Request, body: UpdateAIConfigRequest) -> AIProviderConfig:
    service = get_ai_service(request)
    if hasattr(service.provider, "update_config"):
        service.provider.update_config(api_key=body.api_key, model=body.model)
    return service.get_config()


@router.post("/api/ai/validate")
def validate_ai_connection(request: Request) -> dict[str, Any]:
    service = get_ai_service(request)
    if hasattr(service.provider, "validate_connection"):
        return service.provider.validate_connection()
    return {"valid": False, "error": "Provider does not support connection testing."}


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


# ============================================================================
# Phase 05: Structured Data Extraction Endpoints
# ============================================================================

def get_extraction_service(request: Request) -> ExtractionService:
    if not hasattr(request.app.state, "extraction_service"):
        if not hasattr(request.app.state, "ingestion_service"):
            from app.ingestion.service import IngestionService
            request.app.state.ingestion_service = IngestionService(request.app.state.settings)
        repo = request.app.state.ingestion_service.repo
        from app.ai.extraction_service import ExtractionService
        request.app.state.extraction_service = ExtractionService(repo)
    return request.app.state.extraction_service


@router.post("/api/documents/{doc_id}/extract", response_model=ExtractionResult)
def extract_document(
    request: Request,
    doc_id: str,
    req: ExtractionRequest,
) -> ExtractionResult:
    service = get_extraction_service(request)
    try:
        return service.extract_document(
            doc_id=doc_id,
            profile=req.profile,
            force_regenerate=req.force_regenerate,
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


@router.get("/api/documents/{doc_id}/extract", response_model=ExtractionResult)
def get_extraction(
    request: Request,
    doc_id: str,
    profile: ExtractionProfile = Query("general", description="Extraction profile"),
) -> ExtractionResult:
    service = get_extraction_service(request)
    result = service.get_cached_extraction(doc_id, profile)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No extraction found for document '{doc_id}' with profile '{profile}'.",
        )
    return result


@router.put("/api/documents/{doc_id}/extract", response_model=ExtractionResult)
def update_extraction(
    request: Request,
    doc_id: str,
    body: ExtractionUpdateRequest,
    profile: ExtractionProfile = Query("general", description="Extraction profile"),
) -> ExtractionResult:
    service = get_extraction_service(request)
    try:
        return service.update_extraction(
            doc_id=doc_id,
            profile=profile,
            data=body.data,
            is_verified=body.is_verified,
            user_notes=body.user_notes,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/api/documents/{doc_id}/export")
def export_extraction(
    request: Request,
    doc_id: str,
    profile: ExtractionProfile = Query("general", description="Extraction profile"),
    format: str = Query("json", description="Export format: json or csv"),
):
    from fastapi.responses import Response

    service = get_extraction_service(request)
    fmt = format.lower().strip()
    if fmt not in ("json", "csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported export format. Supported formats are 'json' and 'csv'.",
        )

    try:
        if fmt == "csv":
            csv_content = service.export_csv(doc_id, profile)
            return Response(
                content=csv_content,
                media_type="text/csv; charset=utf-8",
                headers={
                    "Content-Disposition": f'attachment; filename="extraction_{profile}_{doc_id[:8]}.csv"',
                },
            )
        else:
            json_content = service.export_json(doc_id, profile)
            return Response(
                content=json_content,
                media_type="application/json; charset=utf-8",
                headers={
                    "Content-Disposition": f'attachment; filename="extraction_{profile}_{doc_id[:8]}.json"',
                },
            )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
