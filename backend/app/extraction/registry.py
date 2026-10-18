from __future__ import annotations

from pathlib import Path

from app.extraction.base import BaseExtractor
from app.extraction.docx import DocxExtractor
from app.extraction.models import ExtractionResult
from app.extraction.pdf import PdfExtractor
from app.extraction.txt import TxtExtractor

SUPPORTED_EXTENSIONS = {
    ".pdf": PdfExtractor(),
    ".docx": DocxExtractor(),
    ".txt": TxtExtractor(),
}


def get_extractor(extension_or_path: str | Path) -> BaseExtractor:
    ext = (
        Path(extension_or_path).suffix.lower()
        if isinstance(extension_or_path, (str, Path))
        else ""
    )
    if not ext.startswith("."):
        ext = f".{ext.lower()}"

    extractor = SUPPORTED_EXTENSIONS.get(ext)
    if not extractor:
        supported = ", ".join(SUPPORTED_EXTENSIONS.keys())
        raise ValueError(
            f"Unsupported file format '{ext}'. Supported formats: {supported}"
        )
    return extractor


def extract_document(path: Path) -> ExtractionResult:
    extractor = get_extractor(path)
    return extractor.extract(path)
