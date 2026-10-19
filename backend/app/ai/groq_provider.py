from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any
from dotenv import load_dotenv

from app.ai.base import (
    AIProviderError,
    AuthenticationError,
    BaseAIProvider,
    InvalidResponseError,
    NetworkError,
    RateLimitError,
)
from app.ai.chunking import MAX_SINGLE_PASS_WORDS, summarize_long_document
from app.ai.models import SummaryLength, SummaryResponse

logger = logging.getLogger("transformo.ai.groq")

DEFAULT_MODEL = "openai/gpt-oss-120b"


class GroqProvider(BaseAIProvider):
    def __init__(self, api_key: str | None = None, model: str | None = None):
        # Load environment from root or backend .env if not yet loaded
        load_dotenv(Path(__file__).resolve().parents[2] / ".env")
        load_dotenv(Path(__file__).resolve().parents[3] / ".env")

        self._api_key = api_key or os.getenv("GROQ_API_KEY") or ""
        self._model = model or os.getenv("GROQ_MODEL") or DEFAULT_MODEL
        self._client: Any = None

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def model_name(self) -> str:
        return self._model

    def is_configured(self) -> bool:
        return bool(self._api_key.strip())

    def _get_client(self) -> Any:
        if not self.is_configured():
            raise AuthenticationError(
                "Groq API key is not configured. Please set GROQ_API_KEY in your .env file or Settings."
            )
        if self._client is None:
            try:
                from groq import Groq
                self._client = Groq(api_key=self._api_key, timeout=45.0)
            except Exception as exc:
                raise AIProviderError(f"Failed to initialize Groq client: {exc}") from exc
        return self._client

    def generate_summary(
        self,
        text: str,
        length: SummaryLength = "medium",
        focus: str | None = None,
    ) -> SummaryResponse:
        words = len(text.split())
        if words > MAX_SINGLE_PASS_WORDS:
            return summarize_long_document(
                text=text,
                summarize_func=self._generate_single_pass,
                length=length,
                focus=focus,
            )
        return self._generate_single_pass(text, length, focus)

    def _generate_single_pass(
        self,
        text: str,
        length: SummaryLength = "medium",
        focus: str | None = None,
    ) -> SummaryResponse:
        client = self._get_client()

        length_instructions = {
            "short": "Provide a concise 1-2 paragraph overview and 3-4 core takeaways.",
            "medium": "Provide a balanced 2-3 paragraph overview, 4-6 key points, and notable dates or figures.",
            "detailed": "Provide an in-depth 3-5 paragraph comprehensive overview, 6-8 key points, and all specific dates, metrics, and monetary figures present.",
        }

        system_prompt = (
            "You are an expert document intelligence assistant. Your task is to analyze document text "
            "and generate an accurate, structured summary. You must never invent facts not present in the text.\n"
            f"Summary depth requested: {length_instructions.get(length, length_instructions['medium'])}\n"
            + (f"Specific user analytical focus: {focus}\n" if focus else "")
            + "Output format: You MUST return a single valid JSON object with EXACTLY these keys:\n"
            "{\n"
            '  "overview": "Detailed overview string...",\n'
            '  "key_points": ["Point 1", "Point 2", ...],\n'
            '  "key_dates_and_figures": ["Date or Metric 1", "Date or Metric 2", ...]\n'
            "}"
        )

        user_content = f"Document content to analyze:\n\n{text}"

        try:
            from groq import APIConnectionError, APIStatusError
            from groq import AuthenticationError as GroqAuthError
            from groq import RateLimitError as GroqRateLimitError

            response = client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )

            raw_text = response.choices[0].message.content or "{}"
            parsed = json.loads(raw_text)

            overview = str(parsed.get("overview") or "").strip()
            key_points = [str(p).strip() for p in parsed.get("key_points") or [] if str(p).strip()]
            dates_figures = [
                str(d).strip() for d in parsed.get("key_dates_and_figures") or [] if str(d).strip()
            ]

            if not overview and not key_points:
                raise InvalidResponseError("Model returned an empty summary.")

            return SummaryResponse(
                overview=overview,
                key_points=key_points,
                key_dates_and_figures=dates_figures,
                provider="groq",
                model=self._model,
                length=length,
            )

        except GroqAuthError as exc:
            raise AuthenticationError(f"Invalid Groq API key: {exc}") from exc
        except GroqRateLimitError as exc:
            raise RateLimitError(f"Groq API rate limit exceeded: {exc}") from exc
        except APIConnectionError as exc:
            raise NetworkError(f"Could not connect to Groq API: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise InvalidResponseError(f"Failed to parse model JSON output: {exc}") from exc
        except (AuthenticationError, RateLimitError, NetworkError, InvalidResponseError):
            raise
        except Exception as exc:
            raise AIProviderError(f"Groq summarization failed: {exc}") from exc
