from unittest.mock import MagicMock, patch
import pytest

from app.ai.base import (
    AuthenticationError,
    BaseAIProvider,
    InvalidResponseError,
    NetworkError,
    RateLimitError,
)
from app.ai.chunking import split_text_into_chunks, summarize_long_document
from app.ai.groq_provider import GroqProvider
from app.ai.models import SummaryLength, SummaryResponse
from app.ai.service import SummarizationService


class MockAIProvider(BaseAIProvider):
    def __init__(self, should_fail: str | None = None):
        self.should_fail = should_fail
        self.call_count = 0

    @property
    def provider_name(self) -> str:
        return "mock_groq"

    @property
    def model_name(self) -> str:
        return "mock-model"

    def is_configured(self) -> bool:
        return self.should_fail != "auth"

    def generate_summary(
        self,
        text: str,
        length: SummaryLength = "medium",
        focus: str | None = None,
    ) -> SummaryResponse:
        self.call_count += 1
        if self.should_fail == "auth":
            raise AuthenticationError("Invalid Groq API key")
        elif self.should_fail == "rate_limit":
            raise RateLimitError("Rate limit exceeded")
        elif self.should_fail == "network":
            raise NetworkError("Connection refused")
        elif self.should_fail == "invalid_json":
            raise InvalidResponseError("Model returned invalid JSON")

        return SummaryResponse(
            overview=f"This is a {length} overview of the document contents.",
            key_points=["Point A: Core achievement", "Point B: Growth metric"],
            key_dates_and_figures=["Q3 2026", "$1.2M Revenue"],
            provider="mock_groq",
            model="mock-model",
            length=length,
            warnings=["Focus note"] if focus else [],
        )


def test_chunking_utility():
    long_text = "\n\n".join([f"Paragraph {i} with some detailed analytical content." for i in range(200)])
    chunks = split_text_into_chunks(long_text, target_words=100)
    assert len(chunks) > 1
    # Verify whole text is retained
    reconstructed = "\n\n".join(chunks)
    assert "Paragraph 0" in reconstructed
    assert "Paragraph 199" in reconstructed


def test_summarize_long_document_map_reduce():
    provider = MockAIProvider()
    long_text = "\n\n".join([f"Section content paragraph {i} " * 20 for i in range(100)])

    res = summarize_long_document(
        text=long_text,
        summarize_func=provider.generate_summary,
        length="detailed",
        focus="performance",
    )

    assert provider.call_count > 1  # Map passes + reduce pass
    assert res.overview
    assert len(res.key_points) > 0
    assert any("multi-stage analysis" in w for w in res.warnings)


def test_service_summarize_and_caching(client, auth):
    # Import sample document
    files = {"file": ("strategy.txt", b"Annual Business Strategy 2026: Expansion into enterprise markets.", "text/plain")}
    import_res = client.post("/api/documents/import", headers=auth, files=files)
    assert import_res.status_code == 201
    doc_id = import_res.json()["metadata"]["id"]

    # Mock the provider inside the app's AI service
    mock_provider = MockAIProvider()
    ai_service = client.app.state.ai_service
    ai_service.provider = mock_provider

    # Generate summary
    res1 = client.post(
        f"/api/documents/{doc_id}/summary",
        headers=auth,
        json={"length": "medium", "focus": "expansion"},
    )
    assert res1.status_code == 200
    body1 = res1.json()
    assert "overview" in body1
    assert body1["provider"] == "mock_groq"
    assert mock_provider.call_count == 1

    # Second call without force should hit the cache (call_count remains 1)
    res2 = client.post(
        f"/api/documents/{doc_id}/summary",
        headers=auth,
        json={"length": "medium"},
    )
    assert res2.status_code == 200
    assert mock_provider.call_count == 1

    # GET summary
    get_res = client.get(f"/api/documents/{doc_id}/summary", headers=auth)
    assert get_res.status_code == 200
    assert get_res.json()["overview"] == body1["overview"]

    # Regenerate summary with force=true (call_count increments)
    res_regen = client.post(
        f"/api/documents/{doc_id}/summary?force=true",
        headers=auth,
        json={"length": "detailed"},
    )
    assert res_regen.status_code == 200
    assert mock_provider.call_count == 2


def test_service_auth_error_handling(client, auth):
    files = {"file": ("auth_test.txt", b"Content for auth test.", "text/plain")}
    import_res = client.post("/api/documents/import", headers=auth, files=files)
    doc_id = import_res.json()["metadata"]["id"]

    client.app.state.ai_service.provider = MockAIProvider(should_fail="auth")

    res = client.post(f"/api/documents/{doc_id}/summary?force=true", headers=auth, json={})
    assert res.status_code == 401
    assert "api key" in res.json()["detail"].lower()


def test_service_rate_limit_handling(client, auth):
    files = {"file": ("rl_test.txt", b"Content for rate limit test.", "text/plain")}
    import_res = client.post("/api/documents/import", headers=auth, files=files)
    doc_id = import_res.json()["metadata"]["id"]

    client.app.state.ai_service.provider = MockAIProvider(should_fail="rate_limit")

    res = client.post(f"/api/documents/{doc_id}/summary?force=true", headers=auth, json={})
    assert res.status_code == 429
    assert "rate limit" in res.json()["detail"].lower()


def test_ai_settings_endpoint(client, auth):
    res = client.get("/api/ai/settings", headers=auth)
    assert res.status_code == 200
    body = res.json()
    assert "provider" in body
    assert "model" in body
    assert "configured" in body


def test_ai_consent_endpoint(client, auth):
    res = client.post("/api/ai/consent", headers=auth, json={"consent": True})
    assert res.status_code == 200
    assert res.json()["consent"] is True
