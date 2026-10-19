from __future__ import annotations

import logging
from fastapi import APIRouter, File, HTTPException, Query, Request, Response, UploadFile, status

from app.db.repository import PaginatedDocuments
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


@router.get("/stats")
def get_document_stats(request: Request) -> dict[str, int]:
    service = get_service(request)
    return service.get_stats()


@router.get("", response_model=PaginatedDocuments)
def list_documents(
    request: Request,
    q: str | None = Query(None, description="Search query across contents and filenames"),
    ext: str | None = Query(None, description="Filter by file extension (.pdf, .docx, .txt)"),
    status: str | None = Query(None, description="Filter by status (completed, scanned)"),
    sort_by: str = Query("created_at", description="Sort field (created_at, filename, size, pages)"),
    sort_order: str = Query("desc", description="Sort direction (asc, desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PaginatedDocuments:
    service = get_service(request)
    return service.list_documents(
        query=q,
        extension=ext,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


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


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(request: Request, doc_id: str) -> Response:
    service = get_service(request)
    deleted = service.delete_document(doc_id, delete_file=True)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{doc_id}' not found.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
