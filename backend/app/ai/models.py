from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field

SummaryLength = Literal["short", "medium", "detailed"]


class SummaryRequest(BaseModel):
    length: SummaryLength = "medium"
    focus: str | None = None


class SummaryResponse(BaseModel):
    overview: str
    key_points: list[str] = Field(default_factory=list)
    key_dates_and_figures: list[str] = Field(default_factory=list)
    provider: str
    model: str
    length: SummaryLength
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    warnings: list[str] = Field(default_factory=list)


class AIProviderConfig(BaseModel):
    provider: str
    model: str
    configured: bool
    masked_key: str | None = None
