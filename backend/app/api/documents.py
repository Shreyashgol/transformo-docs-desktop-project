from __future__ import annotations

import logging
from pathlib import Path
from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from app.ingestion.models import DocumentDetail, DocumentMetadata
from app.ingestion.service import (
    DuplicateDocumentError,
    EmptyFileError,
    FileSizeLimitError,
    IngestionService,
    InvalidFileContentError,
    UnsupportedFormatError,
)

logger = logging.getLogger("transformo.api.documents")
router = APIRouter(prefix="/api/documents", tags=["documents"])


def get_service(request: Request) -> IngestionService:
    settings = request.app.state.settings
    if not hasattr(request.app.state, "ingestion_service"):
        request.app.state.ingestion_service = IngestionService(settings)
    return request.app.state.ingestion_service


@router.post("/import", response_model=DocumentDetail, status_code=status.HTTP_201_CREATED)
async def import_document(
    request: Request,
    file: UploadFile = File(...),
) -> DocumentDetail:
    service = get_service(request)
    filename = file.filename or "unknown.txt"
    try:
        content = await file.read()
        return service.import_document_bytes(content, original_filename=filename)
    except UnsupportedFormatError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except EmptyFileError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except FileSizeLimitError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc
    except DuplicateDocumentError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(exc), "existing_doc_id": exc.existing_doc_id},
        ) from exc
    except InvalidFileContentError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error importing document %s", filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during ingestion: {exc}",
        ) from exc


@router.get("", response_model=list[DocumentMetadata])
def list_documents(request: Request) -> list[DocumentMetadata]:
    service = get_service(request)
    return service.list_documents()


@router.get("/{doc_id}", response_model=DocumentDetail)
def get_document(request: Request, doc_id: str) -> DocumentDetail:
    service = get_service(request)
    doc = service.get_document(doc_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{doc_id}' not found.",
        )
    return doc
