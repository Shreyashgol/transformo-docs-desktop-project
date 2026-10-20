from __future__ import annotations

from abc import ABC, abstractmethod
from app.ai.models import SummaryLength, SummaryResponse


class AIProviderError(Exception):
    """Base exception for AI provider operations."""


class AuthenticationError(AIProviderError):
    """Raised when the API key is missing or invalid."""


class RateLimitError(AIProviderError):
    """Raised when rate limit is exceeded."""


class NetworkError(AIProviderError):
    """Raised when network connectivity fails."""


class InvalidResponseError(AIProviderError):
    """Raised when the model response is malformed or unparseable."""


class BaseAIProvider(ABC):
    """Abstract interface for LLM providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def model_name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def is_configured(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def generate_summary(
        self,
        text: str,
        length: SummaryLength = "medium",
        focus: str | None = None,
    ) -> SummaryResponse:
        raise NotImplementedError

    @abstractmethod
    def extract_structured_data(
        self,
        text: str,
        profile: str,
    ) -> dict[str, Any]:
        raise NotImplementedError
