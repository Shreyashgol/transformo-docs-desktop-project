from __future__ import annotations

from pathlib import Path

from app.extraction.base import BaseExtractor
from app.extraction.models import ExtractionResult

ENCODINGS = ("utf-8", "utf-8-sig", "utf-16", "cp1252", "latin-1")


class TxtExtractor(BaseExtractor):
    """Extracts text from plain text files with robust encoding fallback."""

    def extract(self, path: Path) -> ExtractionResult:
        try:
            raw_bytes = path.read_bytes()
        except Exception as exc:
            raise ValueError(f"Failed to read file: {exc}") from exc

        decoded_text: str | None = None
        used_encoding = "utf-8"

        for enc in ENCODINGS:
            try:
                decoded_text = raw_bytes.decode(enc)
                used_encoding = enc
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if decoded_text is None:
            # Safe replacement fallback so user data is never lost completely
            decoded_text = raw_bytes.decode("utf-8", errors="replace")
            used_encoding = "utf-8 (lossy fallback)"

        # Normalize carriage returns
        normalized_text = decoded_text.replace("\r\n", "\n").replace("\r", "\n").strip()

        line_count = len(normalized_text.splitlines()) if normalized_text else 0
        estimated_pages = max(1, (len(normalized_text) + 2000) // 2500) if normalized_text else 1

        warnings: list[str] = []
        if not normalized_text:
            warnings.append("Document is empty.")

        metadata = {
            "format": "TXT",
            "encoding": used_encoding,
            "line_count": line_count,
        }

        return ExtractionResult(
            text=normalized_text,
            page_count=estimated_pages,
            metadata=metadata,
            warnings=warnings,
            is_scanned=False,
        )
