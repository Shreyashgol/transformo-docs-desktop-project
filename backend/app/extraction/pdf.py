from __future__ import annotations

import logging
from pathlib import Path

import fitz  # PyMuPDF

from app.extraction.base import BaseExtractor
from app.extraction.models import ExtractionResult

logger = logging.getLogger("transformo.extraction.pdf")


class PdfExtractor(BaseExtractor):
    """Extracts text and metadata from PDF files using PyMuPDF."""

    def extract(self, path: Path) -> ExtractionResult:
        try:
            doc = fitz.open(str(path))
        except Exception as exc:
            raise ValueError(f"Failed to open PDF document: {exc}") from exc

        try:
            page_count = len(doc)
            page_texts: list[str] = []
            has_images = False

            for page_index in range(page_count):
                page = doc[page_index]
                text = page.get_text() or ""
                page_texts.append(text)
                if not has_images and len(page.get_images()) > 0:
                    has_images = True

            combined_text = "\n\n".join(page_texts).strip()

            metadata = {
                "format": "PDF",
                "title": doc.metadata.get("title") or "",
                "author": doc.metadata.get("author") or "",
                "subject": doc.metadata.get("subject") or "",
                "creator": doc.metadata.get("creator") or "",
                "producer": doc.metadata.get("producer") or "",
                "creation_date": doc.metadata.get("creationDate") or "",
                "mod_date": doc.metadata.get("modDate") or "",
            }

            warnings: list[str] = []
            is_scanned = False

            # Check if document has pages but virtually no extractable text
            if page_count > 0 and len(combined_text.strip()) == 0:
                is_scanned = True
                warnings.append(
                    "This document appears to be scanned or image-based with no extractable text. "
                    "OCR is not yet available."
                )
            elif page_count > 0 and (len(combined_text) / page_count < 15) and has_images:
                # Very low text density while images are present
                warnings.append(
                    "This document contains very little extractable text and may be partially scanned. "
                    "OCR is not yet available."
                )

            return ExtractionResult(
                text=combined_text,
                page_count=page_count,
                metadata=metadata,
                warnings=warnings,
                is_scanned=is_scanned,
            )
        finally:
            doc.close()
