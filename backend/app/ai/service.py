from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import uuid
from typing import Any

from app.ai.base import AuthenticationError, BaseAIProvider
from app.ai.groq_provider import GroqProvider
from app.ai.models import AIProviderConfig, SummaryLength, SummaryResponse
from app.db.repository import DocumentRepository

logger = logging.getLogger("transformo.ai.service")


class SummarizationService:
    def __init__(
        self,
        repo: DocumentRepository,
        provider: BaseAIProvider | None = None,
    ):
        self.repo = repo
        self.provider = provider or GroqProvider()
        self._user_consent_granted = False

    def get_config(self) -> AIProviderConfig:
        key = getattr(self.provider, "_api_key", "")
        masked = None
        if key and len(key) > 8:
            masked = f"{key[:4]}...{key[-4:]}"
        elif key:
            masked = "***"

        return AIProviderConfig(
            provider=self.provider.provider_name,
            model=self.provider.model_name,
            configured=self.provider.is_configured(),
            masked_key=masked,
        )

    def set_user_consent(self, consent: bool) -> None:
        self._user_consent_granted = consent

    def has_user_consent(self) -> bool:
        return self._user_consent_granted

    def get_cached_summary(self, doc_id: str) -> SummaryResponse | None:
        row = self.repo.conn.execute(
            """
            SELECT result_json
            FROM ai_results
            WHERE document_id = ? AND type = 'summary'
            ORDER BY created_at DESC
            LIMIT 1;
            """,
            (doc_id,),
        ).fetchone()

        if not row:
            return None
        try:
            data = json.loads(row["result_json"])
            return SummaryResponse.model_validate(data)
        except Exception:
            return None

    def summarize_document(
        self,
        doc_id: str,
        length: SummaryLength = "medium",
        focus: str | None = None,
        force_regenerate: bool = False,
    ) -> SummaryResponse:
        # Check cache if not forcing regeneration
        if not force_regenerate:
            cached = self.get_cached_summary(doc_id)
            if cached:
                return cached

        doc = self.repo.get_document(doc_id)
        if not doc:
            raise ValueError(f"Document with ID '{doc_id}' not found.")

        if doc.metadata.is_scanned and not doc.extracted_text.strip():
            raise ValueError(
                "Cannot summarize scanned document: no text could be extracted. OCR is not yet available."
            )

        if not doc.extracted_text.strip():
            raise ValueError("Document has no text content to summarize.")

        # Execute summarization via configured provider
        response = self.provider.generate_summary(
            text=doc.extracted_text,
            length=length,
            focus=focus,
        )

        # Save AI result to SQLite (replace previous summary for this doc)
        result_id = f"ai_sum_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        result_json = response.model_dump_json()

        with self.repo.conn:
            self.repo.conn.execute(
                "DELETE FROM ai_results WHERE document_id = ? AND type = 'summary';",
                (doc_id,),
            )
            self.repo.conn.execute(
                """
                INSERT INTO ai_results (
                    id, document_id, type, provider, model, result_json, created_at
                ) VALUES (?, ?, 'summary', ?, ?, ?, ?);
                """,
                (
                    result_id,
                    doc_id,
                    response.provider,
                    response.model,
                    result_json,
                    now,
                ),
            )

        return response
