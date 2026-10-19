from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from app.config import Settings
from app.db.connection import connect_db, get_db_path
from app.db.repository import DocumentListItem, DocumentRepository, PaginatedDocuments
from app.db.schema import init_db
from app.extraction.registry import extract_document
from app.ingestion.models import DocumentDetail, DocumentMetadata

logger = logging.getLogger("transformo.ingestion")

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


class IngestionError(Exception):
    """Base exception for document ingestion errors."""


class UnsupportedFormatError(IngestionError):
    """Raised when file extension is not supported."""


class FileSizeLimitError(IngestionError):
    """Raised when file exceeds allowed size."""


class EmptyFileError(IngestionError):
    """Raised when file is 0 bytes."""


class InvalidFileContentError(IngestionError):
    """Raised when file contents do not match expected format structure."""


class DuplicateDocumentError(IngestionError):
    """Raised when a document with identical content has already been imported."""

    def __init__(self, message: str, existing_doc_id: str):
        super().__init__(message)
        self.existing_doc_id = existing_doc_id


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def generate_document_id(content_hash: str) -> str:
    return f"doc_{content_hash[:16]}"


def validate_file_content(data: bytes, ext: str) -> None:
    if len(data) == 0:
        raise EmptyFileError("Cannot import an empty file (0 bytes).")
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise FileSizeLimitError(
            f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
        )

    if ext == ".pdf":
        if not data.startswith(b"%PDF"):
            raise InvalidFileContentError(
                "File has .pdf extension but does not contain a valid PDF header."
            )
    elif ext == ".docx":
        # DOCX is an OpenXML ZIP package starting with PK\x03\x04
        if not data.startswith(b"PK\x03\x04"):
            raise InvalidFileContentError(
                "File has .docx extension but is not a valid ZIP package."
            )
    elif ext == ".txt":
        # Plain text should not contain binary null bytes
        if b"\x00" in data[:1024]:
            raise InvalidFileContentError(
                "File has .txt extension but contains binary content."
            )


class IngestionService:
    def __init__(self, settings: Settings, repo: DocumentRepository | None = None):
        self.settings = settings
        self.docs_dir = settings.data_dir / "documents"
        self.docs_dir.mkdir(parents=True, exist_ok=True, mode=0o700)

        if repo is None:
            db_path = get_db_path(settings.data_dir)
            conn = connect_db(db_path)
            init_db(conn)
            self.repo = DocumentRepository(conn)
        else:
            self.repo = repo

    def import_document_bytes(
        self,
        data: bytes,
        original_filename: str,
    ) -> DocumentDetail:
        ext = Path(original_filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            allowed = ", ".join(ALLOWED_EXTENSIONS)
            raise UnsupportedFormatError(
                f"Unsupported format '{ext}'. Allowed formats: {allowed}"
            )

        validate_file_content(data, ext)

        content_hash = compute_sha256(data)
        doc_id = generate_document_id(content_hash)

        # Check duplicate policy using persistent DB
        existing = self.repo.find_by_content_hash(content_hash)
        if existing:
            raise DuplicateDocumentError(
                f"Document '{original_filename}' is identical to already imported document '{existing.original_filename}'.",
                existing_doc_id=existing.id,
            )

        # Write original file securely to per-user data directory
        stored_path = self.docs_dir / f"{content_hash}{ext}"
        stored_path.write_bytes(data)

        # Extract text and metadata
        try:
            extraction = extract_document(stored_path)
        except Exception as exc:
            # Clean up stored file if extraction fails
            stored_path.unlink(missing_ok=True)
            raise InvalidFileContentError(f"Failed to extract document contents: {exc}") from exc

        return self.repo.create_document(
            doc_id=doc_id,
            original_filename=original_filename,
            extension=ext,
            file_size_bytes=len(data),
            content_hash=content_hash,
            stored_path=str(stored_path),
            page_count=extraction.page_count,
            extracted_text=extraction.text,
            format_metadata=extraction.metadata,
            warnings=extraction.warnings,
            is_scanned=extraction.is_scanned,
            status="completed",
        )

    def get_document(self, doc_id: str) -> DocumentDetail | None:
        return self.repo.get_document(doc_id)

    def list_documents(
        self,
        query: str | None = None,
        extension: str | None = None,
        status: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedDocuments:
        return self.repo.list_documents(
            query=query,
            extension=extension,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=page_size,
        )

    def delete_document(self, doc_id: str, delete_file: bool = True) -> bool:
        stored_path = self.repo.delete_document(doc_id)
        if not stored_path:
            return False
        if delete_file:
            try:
                Path(stored_path).unlink(missing_ok=True)
            except OSError as err:
                logger.warning("Could not delete stored file %s: %s", stored_path, err)
        return True

    def get_stats(self) -> dict[str, int]:
        return self.repo.get_stats()
