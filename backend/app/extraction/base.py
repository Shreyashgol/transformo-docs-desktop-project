from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from app.extraction.models import ExtractionResult


class BaseExtractor(ABC):
    """Base class for document format extractors."""

    @abstractmethod
    def extract(self, path: Path) -> ExtractionResult:
        """Extract text and metadata from the document at path."""
        raise NotImplementedError
