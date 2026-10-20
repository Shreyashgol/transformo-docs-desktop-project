from __future__ import annotations

import csv
import io
import json
import sqlite3
import pytest
from fastapi.testclient import TestClient

from app.ai.base import BaseAIProvider, InvalidResponseError
from app.ai.extraction_models import (
    GeneralExtraction,
    InvoiceExtraction,
    ResumeExtraction,
)
from app.ai.extraction_service import ExtractionService
from app.config import Settings
from app.db.repository import DocumentRepository
from app.db.schema import init_db
from app.main import create_app


class MockExtractionProvider(BaseAIProvider):
    def __init__(self, canned_response: dict | None = None, raise_error: Exception | None = None):
        self._canned = canned_response or {}
        self._error = raise_error

    @property
    def provider_name(self) -> str:
        return "mock_groq"

    @property
    def model_name(self) -> str:
        return "mock-model"

    def is_configured(self) -> bool:
        return True

    def generate_summary(self, text: str, length: str = "medium", focus: str | None = None):
        raise NotImplementedError

    def extract_structured_data(self, text: str, profile: str) -> dict:
        if self._error:
            raise self._error
        return self._canned


@pytest.fixture
def test_db(tmp_path):
    db_path = tmp_path / "test_extract.db"
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    init_db(conn)
    return conn


@pytest.fixture
def repo(test_db):
    return DocumentRepository(test_db)


@pytest.fixture
def sample_doc(repo):
    detail = repo.create_document(
        doc_id="doc_extract_123",
        original_filename="sample_invoice.pdf",
        extension=".pdf",
        file_size_bytes=1024,
        content_hash="hash_extract_123",
        stored_path="/tmp/fake.pdf",
        page_count=1,
        extracted_text="ACME Corp Invoice #INV-2026-001\nDate: 2026-10-15\nTotal: $1,250.00\nLine 1: Cloud Hosting $1,250.00",
    )
    return detail.metadata


def test_invoice_extraction_schema_and_cleaning(repo, sample_doc):
    canned_invoice = {
        "vendor_name": "ACME Corp",
        "vendor_address": "123 Tech Way, San Francisco, CA",
        "customer_name": "Globex Inc",
        "invoice_number": "INV-2026-001",
        "invoice_date": "2026-10-15",
        "due_date": "2026-11-15",
        "currency": "USD",
        "subtotal": "$1,000.00",  # String formatted currency cleaned to float
        "tax_amount": "$250.00",
        "total_amount": "$1,250.00",
        "line_items": [
            {
                "description": "Cloud Infrastructure, 10 Nodes",
                "quantity": 1,
                "unit_price": "$1,000.00",
                "total_price": "$1,000.00",
            }
        ],
        "notes": "Payment due within 30 days.",
        "provenance": {
            "total_amount": "Total: $1,250.00",
            "vendor_name": "ACME Corp",
        },
    }

    provider = MockExtractionProvider(canned_response=canned_invoice)
    service = ExtractionService(repo, provider=provider)

    res = service.extract_document(sample_doc.id, profile="invoice")
    assert res.profile == "invoice"
    assert res.data["vendor_name"] == "ACME Corp"
    assert res.data["total_amount"] == 1250.0
    assert res.data["subtotal"] == 1000.0
    assert len(res.data["line_items"]) == 1
    assert res.data["line_items"][0]["unit_price"] == 1000.0
    assert res.is_verified is False


def test_resume_extraction_schema(repo, sample_doc):
    canned_resume = {
        "candidate_name": "Jane Doe",
        "contact_details": {
            "email": "jane@example.com",
            "phone": "+1-555-0199",
            "location": "New York, NY",
            "linkedin": "linkedin.com/in/janedoe",
            "website": "https://janedoe.dev",
        },
        "summary": "Experienced software architect specializing in distributed systems.",
        "skills": ["Python", "FastAPI", "React", "Docker"],
        "education": [
            {
                "institution": "MIT",
                "degree": "B.S.",
                "field_of_study": "Computer Science",
                "graduation_year": "2020",
            }
        ],
        "experience": [
            {
                "company": "Tech Corp",
                "role": "Staff Engineer",
                "start_date": "2021",
                "end_date": "Present",
                "responsibilities": ["Led architecture team", "Scaled backend to 10M DAU"],
            }
        ],
        "certifications": ["AWS Certified Solutions Architect"],
        "provenance": {
            "candidate_name": "Jane Doe",
        },
    }

    provider = MockExtractionProvider(canned_response=canned_resume)
    service = ExtractionService(repo, provider=provider)

    res = service.extract_document(sample_doc.id, profile="resume")
    assert res.profile == "resume"
    assert res.data["candidate_name"] == "Jane Doe"
    assert res.data["contact_details"]["email"] == "jane@example.com"
    assert len(res.data["skills"]) == 4
    assert len(res.data["education"]) == 1
    assert len(res.data["experience"]) == 1


def test_general_extraction_schema(repo, sample_doc):
    canned_general = {
        "document_type": "Master Services Agreement",
        "title": "Vendor Engagement Agreement",
        "people": ["Alice Smith", "Bob Jones"],
        "organizations": ["Alpha LLC", "Beta Corp"],
        "dates": ["January 1, 2026", "December 31, 2026"],
        "key_facts": [
            "Parties agree to annual renewal",
            "Confidentiality clause survives termination for 5 years",
        ],
        "provenance": {
            "title": "Vendor Engagement Agreement",
        },
    }

    provider = MockExtractionProvider(canned_response=canned_general)
    service = ExtractionService(repo, provider=provider)

    res = service.extract_document(sample_doc.id, profile="general")
    assert res.profile == "general"
    assert res.data["document_type"] == "Master Services Agreement"
    assert "Alice Smith" in res.data["people"]
    assert len(res.data["key_facts"]) == 2


def test_missing_fields_are_nullable(repo, sample_doc):
    # Minimal response where optional fields are missing
    canned_minimal = {
        "candidate_name": "Only Name Given",
        # Everything else omitted
    }

    provider = MockExtractionProvider(canned_response=canned_minimal)
    service = ExtractionService(repo, provider=provider)

    res = service.extract_document(sample_doc.id, profile="resume")
    assert res.data["candidate_name"] == "Only Name Given"
    assert res.data["summary"] is None
    assert res.data["skills"] == []
    assert res.data["education"] == []
    assert res.data["experience"] == []


def test_csv_export_proper_escaping(repo, sample_doc):
    canned_invoice = {
        "vendor_name": 'ACME "Super" Corp, Inc.',  # Contains quotes and comma
        "vendor_address": "Line 1\nLine 2\nCity, State",  # Contains newlines and comma
        "invoice_number": "INV-001",
        "total_amount": 100.0,
        "line_items": [
            {
                "description": 'Widget with "quoted" spec, item A',
                "quantity": 1,
                "unit_price": 100.0,
                "total_price": 100.0,
            }
        ],
        "notes": 'Special note:\n"handle with care", express shipment',
    }
    provider = MockExtractionProvider(canned_response=canned_invoice)
    service = ExtractionService(repo, provider=provider)
    service.extract_document(sample_doc.id, profile="invoice")

    csv_text = service.export_csv(sample_doc.id, profile="invoice")

    # Parse with standard csv reader to verify RFC 4180 compliance
    reader = list(csv.reader(io.StringIO(csv_text)))
    assert any("ACME \"Super\" Corp, Inc." in row for row in reader)
    assert any('Widget with "quoted" spec, item A' in row for row in reader)


def test_document_isolation(repo, sample_doc):
    other_doc = repo.create_document(
        doc_id="doc_other_999",
        original_filename="other.pdf",
        extension=".pdf",
        file_size_bytes=500,
        content_hash="hash_other_999",
        stored_path="/tmp/other.pdf",
        page_count=1,
        extracted_text="Other doc text",
    ).metadata

    provider = MockExtractionProvider(canned_response={"document_type": "Secret Doc", "title": "Doc 1"})
    service = ExtractionService(repo, provider=provider)
    service.extract_document(sample_doc.id, profile="general")

    # Verify that other_doc has no extraction
    cached_other = service.get_cached_extraction(other_doc.id, profile="general")
    assert cached_other is None

    # Verify that requesting export for other_doc raises 404/ValueError
    with pytest.raises(ValueError):
        service.export_json(other_doc.id, profile="general")


def test_user_verification_and_edit_persistence(repo, sample_doc):
    provider = MockExtractionProvider(canned_response={"document_type": "Invoice", "title": "Draft"})
    service = ExtractionService(repo, provider=provider)
    service.extract_document(sample_doc.id, profile="general")

    updated = service.update_extraction(
        doc_id=sample_doc.id,
        profile="general",
        data={"document_type": "Verified Invoice", "title": "Final Invoice", "people": ["Auditor"]},
        is_verified=True,
        user_notes="Reviewed and approved by finance",
    )

    assert updated.is_verified is True
    assert updated.user_notes == "Reviewed and approved by finance"
    assert updated.data["document_type"] == "Verified Invoice"

    # Fetch from SQLite cache to verify persistence
    cached = service.get_cached_extraction(sample_doc.id, profile="general")
    assert cached is not None
    assert cached.is_verified is True
    assert cached.user_notes == "Reviewed and approved by finance"


def test_api_extraction_endpoints(client, auth):
    # Ingest a test document first
    ingest_resp = client.post(
        "/api/documents/import",
        files={"file": ("report.txt", b"Annual Report 2026\nRevenue: $5,000,000\nCEO: John Doe", "text/plain")},
        headers=auth,
    )
    assert ingest_resp.status_code == 201
    doc_id = ingest_resp.json()["metadata"]["id"]

    # Mock the extraction service in app state
    mock_provider = MockExtractionProvider(
        canned_response={
            "document_type": "Annual Report",
            "title": "Report 2026",
            "people": ["John Doe"],
            "organizations": ["Acme"],
            "dates": ["2026"],
            "key_facts": ["Revenue reached $5,000,000"],
            "provenance": {"title": "Annual Report 2026"},
        }
    )
    client.app.state.extraction_service = ExtractionService(
        client.app.state.ingestion_service.repo,
        provider=mock_provider,
    )

    # 1. Run extraction
    ext_resp = client.post(
        f"/api/documents/{doc_id}/extract",
        json={"profile": "general", "force_regenerate": True},
        headers=auth,
    )
    assert ext_resp.status_code == 200
    res_data = ext_resp.json()
    assert res_data["profile"] == "general"
    assert res_data["data"]["title"] == "Report 2026"

    # 2. Get cached extraction
    get_resp = client.get(
        f"/api/documents/{doc_id}/extract?profile=general",
        headers=auth,
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["title"] == "Report 2026"

    # 3. Update extraction (mark verified)
    put_resp = client.put(
        f"/api/documents/{doc_id}/extract?profile=general",
        json={
            "data": {
                "document_type": "Audited Annual Report",
                "title": "Annual Report 2026 Final",
                "people": ["John Doe", "Jane Auditor"],
                "organizations": ["Acme Corp"],
                "dates": ["2026"],
                "key_facts": ["Revenue reached $5,000,000"],
                "provenance": {},
            },
            "is_verified": True,
            "user_notes": "Audited by KPMG",
        },
        headers=auth,
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["is_verified"] is True

    # 4. Export JSON
    json_export = client.get(
        f"/api/documents/{doc_id}/export?profile=general&format=json",
        headers=auth,
    )
    assert json_export.status_code == 200
    assert "application/json" in json_export.headers["content-type"]
    exported_data = json_export.json()
    assert exported_data["is_verified"] is True
    assert exported_data["extracted_data"]["title"] == "Annual Report 2026 Final"
    # Ensure no secrets leaked
    assert "GROQ_API_KEY" not in str(exported_data)
    assert "test-secret-token" not in str(exported_data)

    # 5. Export CSV
    csv_export = client.get(
        f"/api/documents/{doc_id}/export?profile=general&format=csv",
        headers=auth,
    )
    assert csv_export.status_code == 200
    assert "text/csv" in csv_export.headers["content-type"]
    assert "Annual Report 2026 Final" in csv_export.text
    assert "test-secret-token" not in csv_export.text
