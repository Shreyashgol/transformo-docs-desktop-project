from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
import zipfile

from app.config import Settings
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
        # Plain text should not contain excessive null bytes indicative of arbitrary binary
        if b"\x00" in data[:1024]:
            raise InvalidFileContentError(
                "File has .txt extension but contains binary content."
            )


class IngestionService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.docs_dir = settings.data_dir / "documents"
        self.docs_dir.mkdir(parents=True, exist_ok=True, mode=0o700)

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

        # Check duplicate policy: content hash duplicate check
        stored_path = self.docs_dir / f"{content_hash}{ext}"
        meta_path = self.docs_dir / f"{content_hash}.json"

        if stored_path.exists() and meta_path.exists():
            try:
                existing_meta = json.loads(meta_path.read_text(encoding="utf-8"))
                raise DuplicateDocumentError(
                    f"Document '{original_filename}' is identical to already imported document '{existing_meta.get('original_filename', original_filename)}'.",
                    existing_doc_id=existing_meta.get("id", doc_id),
                )
            except (json.JSONDecodeError, OSError):
                # Corrupted metadata; allow re-importing
                pass

        # Write original file securely to user data dir
        stored_path.write_bytes(data)

        # Extract text and metadata
        try:
            extraction = extract_document(stored_path)
        except Exception as exc:
            # If extraction failed, clean up stored file so we don't leave partial state
            stored_path.unlink(missing_ok=True)
            raise InvalidFileContentError(f"Failed to extract document contents: {exc}") from exc

        metadata = DocumentMetadata(
            id=doc_id,
            original_filename=original_filename,
            extension=ext,
            file_size_bytes=len(data),
            content_hash=content_hash,
            page_count=extraction.page_count,
            format_metadata=extraction.metadata,
            warnings=extraction.warnings,
            is_scanned=extraction.is_scanned,
        )

        detail = DocumentDetail(
            metadata=metadata,
            extracted_text=extraction.text,
        )

        # Persist document metadata and text preview to disk
        meta_path.write_text(detail.model_dump_json(indent=2), encoding="utf-8")

        return detail

    def get_document(self, doc_id: str) -> DocumentDetail | None:
        for json_file in self.docs_dir.glob("*.json"):
            try:
                detail = DocumentDetail.model_validate_json(json_file.read_text(encoding="utf-8"))
                if detail.metadata.id == doc_id:
                    return detail
            except Exception:
                continue
        return None

    def list_documents(self) -> list[DocumentMetadata]:
        documents: list[DocumentMetadata] = []
        for json_file in sorted(self.docs_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                detail = DocumentDetail.model_validate_json(json_file.read_text(encoding="utf-8"))
                documents.append(detail.metadata)
            except Exception:
                continue
        return documents
