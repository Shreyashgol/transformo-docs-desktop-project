from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field


class DocumentMetadata(BaseModel):
    id: str
    original_filename: str
    extension: str
    file_size_bytes: int
    content_hash: str
    page_count: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    format_metadata: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    is_scanned: bool = False


class DocumentDetail(BaseModel):
    metadata: DocumentMetadata
    extracted_text: str
