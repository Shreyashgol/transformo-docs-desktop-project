"""
Phase 07 Integration Tests — Release Readiness Audit
=====================================================
Covers:
  - Full import → extract → search → export workflow
  - Malformed / oversized / missing-credential edge cases
  - Mocked AI provider for summary + extraction (no live API calls)
  - JSON and CSV export validation
  - SQLite persistence across simulated restarts
  - DB error simulation (repository-level)
  - Repeated imports and idempotency
"""
from __future__ import annotations

import csv
import io
import json
import sqlite3
from unittest.mock import MagicMock, patch

import fitz
import docx as python_docx
import pytest
from fastapi.testclient import TestClient

from app.ai.base import (
    AuthenticationError,
    BaseAIProvider,
    NetworkError,
    RateLimitError,
)
from app.ai.extraction_models import ExtractionProfile
from app.ai.models import SummaryLength, SummaryResponse
from app.config import Settings, ensure_data_dirs
from app.db.connection import connect_db, get_db_path
from app.db.repository import DocumentRepository
from app.db.schema import init_db
from app.ingestion.service import IngestionService
from app.main import create_app


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

TEST_TOKEN = "z" * 48
TEST_PORT = 48200


class StubProvider(BaseAIProvider):
    """Zero-network AI stub for deterministic tests."""

    def __init__(self, fail: str | None = None, extraction_data: dict | None = None):
        self._fail = fail
        self._extraction_data = extraction_data or {"document_type": "Report", "title": "Stub"}

    @property
    def provider_name(self) -> str:
        return "stub_groq"

    @property
    def model_name(self) -> str:
        return "stub-model"

    def is_configured(self) -> bool:
        return self._fail != "auth"

    def generate_summary(self, text: str, length: SummaryLength = "medium", focus: str | None = None) -> SummaryResponse:
        if self._fail == "auth":
            raise AuthenticationError("Invalid API key – stub")
        if self._fail == "rate_limit":
            raise RateLimitError("Rate limit exceeded – stub")
        if self._fail == "network":
            raise NetworkError("Connection refused – stub")
        return SummaryResponse(
            overview="Stub overview of the document.",
            key_points=["Stub point 1", "Stub point 2"],
            key_dates_and_figures=["2026-Q3"],
            provider="stub_groq",
            model="stub-model",
            length=length,
        )

    def extract_structured_data(self, text: str, profile: str) -> dict:
        if self._fail == "auth":
            raise AuthenticationError("Invalid API key – stub")
        if self._fail == "rate_limit":
            raise RateLimitError("Rate limit exceeded – stub")
        if self._fail == "network":
            raise NetworkError("Connection refused – stub")
        return self._extraction_data


def _make_pdf(text: str = "Integration test PDF content") -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def _make_docx(text: str = "Integration test DOCX content") -> bytes:
    doc = python_docx.Document()
    doc.add_paragraph(text)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


@pytest.fixture
def p7_settings(tmp_path) -> Settings:
    s = Settings(port=TEST_PORT, token=TEST_TOKEN, data_dir=tmp_path / "p7data")
    ensure_data_dirs(s)
    return s


@pytest.fixture
def p7_client(p7_settings: Settings) -> TestClient:
    return TestClient(create_app(p7_settings), base_url=f"http://127.0.0.1:{TEST_PORT}")


@pytest.fixture
def p7_auth() -> dict[str, str]:
    return {"X-Transformo-Token": TEST_TOKEN}


# ---------------------------------------------------------------------------
# 1. Full end-to-end workflow: import → summary → extract → export (JSON+CSV)
# ---------------------------------------------------------------------------

def test_full_workflow_txt(p7_client, p7_auth):
    """Import TXT → summary (mocked) → extraction (mocked) → JSON + CSV export."""
    client = p7_client
    auth = p7_auth

    # --- Import ---
    content = b"Transformo Phase 07 integration test document with rich content for extraction."
    files = {"file": ("workflow.txt", content, "text/plain")}
    res = client.post("/api/documents/import", headers=auth, files=files)
    assert res.status_code == 201
    doc_id = res.json()["metadata"]["id"]
    assert doc_id.startswith("doc_")

    # --- Search finds the document ---
    search = client.get("/api/documents?q=extraction", headers=auth)
    assert search.status_code == 200
    assert any(i["metadata"]["id"] == doc_id for i in search.json()["items"])

    # --- Set AI consent ---
    consent_res = client.post("/api/ai/consent", headers=auth, json={"consent": True})
    assert consent_res.status_code == 200

    # --- Inject stub provider ---
    client.app.state.ai_service.provider = StubProvider()
    client.app.state.extraction_service.provider = StubProvider(
        extraction_data={"document_type": "Report", "title": "Phase 07 Test", "date": "2026-10-17"}
    )

    # --- Summary ---
    sum_res = client.post(
        f"/api/documents/{doc_id}/summary",
        headers=auth,
        json={"length": "short"},
    )
    assert sum_res.status_code == 200
    body = sum_res.json()
    assert body["overview"] == "Stub overview of the document."
    assert body["provider"] == "stub_groq"

    # Caching: second call without force should not re-invoke provider
    sum_res2 = client.post(f"/api/documents/{doc_id}/summary", headers=auth, json={})
    assert sum_res2.status_code == 200
    assert sum_res2.json()["overview"] == body["overview"]

    # GET cached summary
    get_sum = client.get(f"/api/documents/{doc_id}/summary", headers=auth)
    assert get_sum.status_code == 200

    # --- Structured extraction (general profile) ---
    ext_res = client.post(
        f"/api/documents/{doc_id}/extract",
        headers=auth,
        json={"profile": "general", "force_regenerate": False},
    )
    assert ext_res.status_code == 200
    ext_body = ext_res.json()
    assert ext_body["profile"] == "general"
    assert ext_body["data"]["title"] == "Phase 07 Test"

    # GET cached extraction
    get_ext = client.get(
        f"/api/documents/{doc_id}/extract?profile=general", headers=auth
    )
    assert get_ext.status_code == 200

    # --- Export JSON ---
    json_exp = client.get(
        f"/api/documents/{doc_id}/export?profile=general&format=json", headers=auth
    )
    assert json_exp.status_code == 200
    assert json_exp.headers["content-type"].startswith("application/json")
    parsed = json.loads(json_exp.content)
    assert isinstance(parsed, dict)
    # The export endpoint returns the full ExtractionResult envelope
    assert "document_id" in parsed or "data" in parsed  # envelope keys

    # --- Export CSV ---
    csv_exp = client.get(
        f"/api/documents/{doc_id}/export?profile=general&format=csv", headers=auth
    )
    assert csv_exp.status_code == 200
    assert "text/csv" in csv_exp.headers["content-type"]
    reader = csv.reader(io.StringIO(csv_exp.text))
    rows = list(reader)
    assert len(rows) >= 1  # at least header row


def test_full_workflow_pdf(p7_client, p7_auth):
    """Import PDF → summary → extraction → JSON export."""
    client, auth = p7_client, p7_auth
    pdf_bytes = _make_pdf("Phase 07 PDF workflow: annual report Q4 results.")
    files = {"file": ("annual_report.pdf", pdf_bytes, "application/pdf")}
    res = client.post("/api/documents/import", headers=auth, files=files)
    assert res.status_code == 201
    doc_id = res.json()["metadata"]["id"]

    client.app.state.ai_service.provider = StubProvider()
    client.app.state.extraction_service.provider = StubProvider(
        extraction_data={"document_type": "Invoice", "vendor": "Acme Corp"}
    )

    sum_res = client.post(f"/api/documents/{doc_id}/summary", headers=auth, json={})
    assert sum_res.status_code == 200

    ext_res = client.post(
        f"/api/documents/{doc_id}/extract",
        headers=auth,
        json={"profile": "invoice", "force_regenerate": True},
    )
    assert ext_res.status_code == 200
    assert ext_res.json()["profile"] == "invoice"

    json_exp = client.get(
        f"/api/documents/{doc_id}/export?profile=invoice&format=json", headers=auth
    )
    assert json_exp.status_code == 200


def test_full_workflow_docx(p7_client, p7_auth):
    """Import DOCX → summary → resume extraction → CSV export."""
    client, auth = p7_client, p7_auth
    docx_bytes = _make_docx("Jane Smith — Software Engineer — Python FastAPI Electron")
    files = {"file": ("resume.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    res = client.post("/api/documents/import", headers=auth, files=files)
    assert res.status_code == 201
    doc_id = res.json()["metadata"]["id"]

    client.app.state.ai_service.provider = StubProvider()
    client.app.state.extraction_service.provider = StubProvider(
        extraction_data={"full_name": "Jane Smith", "current_title": "Software Engineer"}
    )

    ext_res = client.post(
        f"/api/documents/{doc_id}/extract",
        headers=auth,
        json={"profile": "resume", "force_regenerate": False},
    )
    assert ext_res.status_code == 200

    csv_exp = client.get(
        f"/api/documents/{doc_id}/export?profile=resume&format=csv", headers=auth
    )
    assert csv_exp.status_code == 200
    assert "text/csv" in csv_exp.headers["content-type"]


# ---------------------------------------------------------------------------
# 2. Malformed / edge-case uploads
# ---------------------------------------------------------------------------

def test_upload_empty_file_rejected(p7_client, p7_auth):
    files = {"file": ("empty.txt", b"", "text/plain")}
    res = p7_client.post("/api/documents/import", headers=p7_auth, files=files)
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_upload_oversized_file_rejected(p7_client, p7_auth):
    """51 MB fake content should trigger FileSizeLimitError → 413."""
    big = b"X" * (51 * 1024 * 1024)
    files = {"file": ("huge.txt", big, "text/plain")}
    res = p7_client.post("/api/documents/import", headers=p7_auth, files=files)
    assert res.status_code == 413


def test_upload_unsupported_extension_rejected(p7_client, p7_auth):
    files = {"file": ("data.xlsx", b"PK\x03\x04", "application/vnd.ms-excel")}
    res = p7_client.post("/api/documents/import", headers=p7_auth, files=files)
    assert res.status_code == 400
    assert "unsupported" in res.json()["detail"].lower()


def test_upload_malformed_pdf_rejected(p7_client, p7_auth):
    files = {"file": ("bad.pdf", b"NOTAPDF", "application/pdf")}
    res = p7_client.post("/api/documents/import", headers=p7_auth, files=files)
    assert res.status_code == 422


def test_upload_binary_as_txt_rejected(p7_client, p7_auth):
    files = {"file": ("binary.txt", b"\x00\x01\x02\x03" * 256, "text/plain")}
    res = p7_client.post("/api/documents/import", headers=p7_auth, files=files)
    assert res.status_code == 422


def test_upload_repeated_import_returns_409(p7_client, p7_auth):
    content = b"Idempotent content for duplicate detection test 98765."
    for i in range(3):
        files = {"file": (f"dup_{i}.txt", content, "text/plain")}
        res = p7_client.post("/api/documents/import", headers=p7_auth, files=files)
        if i == 0:
            assert res.status_code == 201
        else:
            assert res.status_code == 409
            assert "already imported" in str(res.json()["detail"]).lower()


# ---------------------------------------------------------------------------
# 3. Missing credentials / failed AI requests
# ---------------------------------------------------------------------------

def test_summary_auth_error_returns_401(p7_client, p7_auth):
    files = {"file": ("cred_test.txt", b"Testing missing credentials scenario.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]

    p7_client.app.state.ai_service.provider = StubProvider(fail="auth")
    res = p7_client.post(f"/api/documents/{doc_id}/summary?force=true", headers=p7_auth, json={})
    assert res.status_code == 401
    assert "api key" in res.json()["detail"].lower()


def test_summary_rate_limit_returns_429(p7_client, p7_auth):
    files = {"file": ("rl_test.txt", b"Testing rate limit scenario for Phase 07.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]

    p7_client.app.state.ai_service.provider = StubProvider(fail="rate_limit")
    res = p7_client.post(f"/api/documents/{doc_id}/summary?force=true", headers=p7_auth, json={})
    assert res.status_code == 429


def test_summary_network_error_returns_503(p7_client, p7_auth):
    files = {"file": ("net_test.txt", b"Testing network error scenario for Phase 07.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]

    p7_client.app.state.ai_service.provider = StubProvider(fail="network")
    res = p7_client.post(f"/api/documents/{doc_id}/summary?force=true", headers=p7_auth, json={})
    assert res.status_code == 503


def test_extraction_auth_error_returns_401(p7_client, p7_auth):
    files = {"file": ("ext_cred.txt", b"Extraction credentials test.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]

    p7_client.app.state.extraction_service.provider = StubProvider(fail="auth")
    res = p7_client.post(
        f"/api/documents/{doc_id}/extract",
        headers=p7_auth,
        json={"profile": "general", "force_regenerate": True},
    )
    assert res.status_code == 401


def test_extraction_rate_limit_returns_429(p7_client, p7_auth):
    files = {"file": ("ext_rl.txt", b"Extraction rate limit test.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]

    p7_client.app.state.extraction_service.provider = StubProvider(fail="rate_limit")
    res = p7_client.post(
        f"/api/documents/{doc_id}/extract",
        headers=p7_auth,
        json={"profile": "general", "force_regenerate": True},
    )
    assert res.status_code == 429


# ---------------------------------------------------------------------------
# 4. Export edge cases
# ---------------------------------------------------------------------------

def test_export_unsupported_format_returns_400(p7_client, p7_auth):
    files = {"file": ("fmt_test.txt", b"Format validation test content.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]

    # Inject extraction first
    p7_client.app.state.extraction_service.provider = StubProvider()
    p7_client.post(
        f"/api/documents/{doc_id}/extract",
        headers=p7_auth,
        json={"profile": "general", "force_regenerate": True},
    )

    res = p7_client.get(
        f"/api/documents/{doc_id}/export?profile=general&format=xml",
        headers=p7_auth,
    )
    assert res.status_code == 400
    assert "unsupported" in res.json()["detail"].lower()


def test_export_no_extraction_returns_404(p7_client, p7_auth):
    files = {"file": ("noext.txt", b"No extraction exists for this document.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]

    res = p7_client.get(
        f"/api/documents/{doc_id}/export?profile=general&format=json",
        headers=p7_auth,
    )
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# 5. SQLite persistence across simulated application restarts
# ---------------------------------------------------------------------------

def test_sqlite_persistence_across_restarts(tmp_path):
    """Simulate two separate app starts sharing the same data directory."""
    data_dir = tmp_path / "persistent_data"

    # --- Session 1: create app, import document ---
    s1 = Settings(port=48201, token=TEST_TOKEN, data_dir=data_dir)
    ensure_data_dirs(s1)
    app1 = create_app(s1)
    client1 = TestClient(app1, base_url="http://127.0.0.1:48201")
    auth = {"X-Transformo-Token": TEST_TOKEN}

    content = b"Persistent document for Phase 07 restart test."
    files = {"file": ("persist.txt", content, "text/plain")}
    r1 = client1.post("/api/documents/import", headers=auth, files=files)
    assert r1.status_code == 201
    doc_id = r1.json()["metadata"]["id"]

    # Inject mocked summary and save it
    app1.state.ai_service.provider = StubProvider()
    sum_r = client1.post(f"/api/documents/{doc_id}/summary", headers=auth, json={})
    assert sum_r.status_code == 200

    # --- Session 2: fresh app instance, same data_dir ---
    s2 = Settings(port=48202, token=TEST_TOKEN, data_dir=data_dir)
    ensure_data_dirs(s2)
    app2 = create_app(s2)
    client2 = TestClient(app2, base_url="http://127.0.0.1:48202")
    auth2 = {"X-Transformo-Token": TEST_TOKEN}

    # Document must still be retrievable
    get_r = client2.get(f"/api/documents/{doc_id}", headers=auth2)
    assert get_r.status_code == 200
    assert get_r.json()["metadata"]["id"] == doc_id

    # Summary must be cached (not re-generated)
    sum_get = client2.get(f"/api/documents/{doc_id}/summary", headers=auth2)
    assert sum_get.status_code == 200
    assert sum_get.json()["overview"] == "Stub overview of the document."

    # Stats reflect the imported document
    stats = client2.get("/api/documents/stats", headers=auth2)
    assert stats.status_code == 200
    assert stats.json()["total_documents"] >= 1
    assert stats.json()["summaries_generated"] >= 1


# ---------------------------------------------------------------------------
# 6. Security: auth and host validation
# ---------------------------------------------------------------------------

def test_missing_token_on_import_rejected(p7_client):
    files = {"file": ("noauth.txt", b"Content", "text/plain")}
    res = p7_client.post("/api/documents/import", files=files)
    assert res.status_code == 401


def test_wrong_token_on_export_rejected(p7_client, p7_auth):
    files = {"file": ("wrongtok.txt", b"Content for wrong token test.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]
    bad_auth = {"X-Transformo-Token": "a" * 48}
    res = p7_client.get(f"/api/documents/{doc_id}/export?format=json", headers=bad_auth)
    assert res.status_code == 401


def test_delete_nonexistent_doc_returns_404(p7_client, p7_auth):
    res = p7_client.delete("/api/documents/doc_doesnotexist9999", headers=p7_auth)
    assert res.status_code == 404


def test_get_summary_no_summary_returns_404(p7_client, p7_auth):
    files = {"file": ("nosum.txt", b"Content with no summary yet.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]
    res = p7_client.get(f"/api/documents/{doc_id}/summary", headers=p7_auth)
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# 7. Database error simulation
# ---------------------------------------------------------------------------

def test_repository_handles_missing_document_gracefully(tmp_path):
    conn = connect_db(tmp_path / "err.db")
    init_db(conn)
    repo = DocumentRepository(conn)

    # Get non-existent document returns None
    assert repo.get_document("doc_missing") is None

    # Delete non-existent document returns None (no stored_path)
    assert repo.delete_document("doc_missing") is None

    conn.close()


def test_stats_on_empty_db(tmp_path):
    conn = connect_db(tmp_path / "empty.db")
    init_db(conn)
    repo = DocumentRepository(conn)
    stats = repo.get_stats()
    assert stats["total_documents"] == 0
    assert stats["total_storage_bytes"] == 0
    assert stats["summaries_generated"] == 0
    assert stats["extractions_generated"] == 0
    conn.close()


# ---------------------------------------------------------------------------
# 8. Extraction update (user verification flow)
# ---------------------------------------------------------------------------

def test_extraction_update_and_verification(p7_client, p7_auth):
    files = {"file": ("verify.txt", b"Document for verification workflow test.", "text/plain")}
    doc_id = p7_client.post("/api/documents/import", headers=p7_auth, files=files).json()["metadata"]["id"]

    p7_client.app.state.extraction_service.provider = StubProvider(
        extraction_data={"document_type": "Report", "title": "Original Title"}
    )
    ext_res = p7_client.post(
        f"/api/documents/{doc_id}/extract",
        headers=p7_auth,
        json={"profile": "general", "force_regenerate": True},
    )
    assert ext_res.status_code == 200

    # Update extraction with user edits
    upd_res = p7_client.put(
        f"/api/documents/{doc_id}/extract?profile=general",
        headers=p7_auth,
        json={
            "data": {"document_type": "Report", "title": "User-Corrected Title"},
            "is_verified": True,
            "user_notes": "Verified by auditor on 2026-10-17",
        },
    )
    assert upd_res.status_code == 200
    upd_body = upd_res.json()
    assert upd_body["is_verified"] is True
    assert upd_body["data"]["title"] == "User-Corrected Title"
    assert upd_body["user_notes"] == "Verified by auditor on 2026-10-17"
