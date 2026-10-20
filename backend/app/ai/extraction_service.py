from __future__ import annotations

import csv
from datetime import datetime, timezone
import io
import json
import logging
import re
import uuid
from typing import Any

from app.ai.base import AuthenticationError, BaseAIProvider, InvalidResponseError
from app.ai.extraction_models import (
    ExtractionProfile,
    ExtractionResult,
    GeneralExtraction,
    InvoiceExtraction,
    InvoiceLineItem,
    ResumeContactDetails,
    ResumeEducation,
    ResumeExperience,
    ResumeExtraction,
)
from app.ai.groq_provider import GroqProvider
from app.db.repository import DocumentRepository

logger = logging.getLogger("transformo.ai.extraction")


def _clean_float(val: Any) -> float | None:
    """Safely parse float from string or number, stripping currency symbols/commas."""
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        # Remove currency symbols and commas e.g. "$1,234.56" -> "1234.56"
        cleaned = re.sub(r"[^\d.-]", "", val)
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _sanitize_invoice_dict(raw: dict[str, Any]) -> dict[str, Any]:
    """Clean raw invoice dictionary before Pydantic validation."""
    data = dict(raw)
    data["subtotal"] = _clean_float(data.get("subtotal"))
    data["tax_amount"] = _clean_float(data.get("tax_amount"))
    data["total_amount"] = _clean_float(data.get("total_amount"))

    raw_items = data.get("line_items")
    if isinstance(raw_items, list):
        cleaned_items = []
        for item in raw_items:
            if isinstance(item, dict):
                cleaned_items.append({
                    "description": str(item.get("description") or "Item"),
                    "quantity": _clean_float(item.get("quantity")),
                    "unit_price": _clean_float(item.get("unit_price")),
                    "total_price": _clean_float(item.get("total_price")),
                })
        data["line_items"] = cleaned_items
    else:
        data["line_items"] = []
    return data


class ExtractionService:
    def __init__(
        self,
        repo: DocumentRepository,
        provider: BaseAIProvider | None = None,
    ):
        self.repo = repo
        self.provider = provider or GroqProvider()

    def get_cached_extraction(self, doc_id: str, profile: ExtractionProfile) -> ExtractionResult | None:
        result_type = f"extraction:{profile}"
        row = self.repo.conn.execute(
            """
            SELECT result_json
            FROM ai_results
            WHERE document_id = ? AND type = ?
            ORDER BY created_at DESC
            LIMIT 1;
            """,
            (doc_id, result_type),
        ).fetchone()

        if not row:
            return None
        try:
            payload = json.loads(row["result_json"])
            return ExtractionResult.model_validate(payload)
        except Exception as exc:
            logger.warning(f"Failed to parse cached extraction for {doc_id}: {exc}")
            return None

    def validate_profile_data(self, profile: ExtractionProfile, raw_data: dict[str, Any]) -> dict[str, Any]:
        """Validate raw dictionary against the requested profile's Pydantic schema."""
        if profile == "invoice":
            sanitized = _sanitize_invoice_dict(raw_data)
            validated = InvoiceExtraction.model_validate(sanitized)
            return validated.model_dump()
        elif profile == "resume":
            validated = ResumeExtraction.model_validate(raw_data)
            return validated.model_dump()
        else:  # general
            validated = GeneralExtraction.model_validate(raw_data)
            return validated.model_dump()

    def extract_document(
        self,
        doc_id: str,
        profile: ExtractionProfile = "general",
        force_regenerate: bool = False,
    ) -> ExtractionResult:
        if not force_regenerate:
            cached = self.get_cached_extraction(doc_id, profile)
            if cached:
                return cached

        doc = self.repo.get_document(doc_id)
        if not doc:
            raise ValueError(f"Document with ID '{doc_id}' not found.")

        if doc.metadata.is_scanned and not doc.extracted_text.strip():
            raise ValueError("Cannot extract from scanned document: OCR is not yet available.")

        if not doc.extracted_text.strip():
            raise ValueError("Document has no text content to extract from.")

        # Call AI provider to extract structured dictionary
        raw_dict = self.provider.extract_structured_data(
            text=doc.extracted_text,
            profile=profile,
        )

        # Validate with explicit Pydantic schema
        try:
            validated_dict = self.validate_profile_data(profile, raw_dict)
        except Exception as exc:
            logger.error(f"Structured validation failed for profile '{profile}': {exc}")
            raise InvalidResponseError(f"Model output failed schema validation for {profile}: {exc}") from exc

        now = datetime.now(timezone.utc).isoformat()
        result = ExtractionResult(
            document_id=doc_id,
            profile=profile,
            data=validated_dict,
            is_verified=False,
            user_notes=None,
            provider=self.provider.provider_name,
            model=self.provider.model_name,
            created_at=now,
            updated_at=now,
            warnings=[],
        )

        # Persist to SQLite ai_results table
        self._save_extraction_result(result)
        return result

    def update_extraction(
        self,
        doc_id: str,
        profile: ExtractionProfile,
        data: dict[str, Any],
        is_verified: bool = False,
        user_notes: str | None = None,
    ) -> ExtractionResult:
        doc = self.repo.get_document(doc_id)
        if not doc:
            raise ValueError(f"Document with ID '{doc_id}' not found.")

        # Re-validate user edited data against schema
        validated_dict = self.validate_profile_data(profile, data)

        cached = self.get_cached_extraction(doc_id, profile)
        now = datetime.now(timezone.utc).isoformat()
        created_at = cached.created_at if cached else now

        result = ExtractionResult(
            document_id=doc_id,
            profile=profile,
            data=validated_dict,
            is_verified=is_verified,
            user_notes=user_notes,
            provider=cached.provider if cached else self.provider.provider_name,
            model=cached.model if cached else self.provider.model_name,
            created_at=created_at,
            updated_at=now,
            warnings=[],
        )

        self._save_extraction_result(result)
        return result

    def _save_extraction_result(self, result: ExtractionResult) -> None:
        result_type = f"extraction:{result.profile}"
        result_id = f"ai_ext_{uuid.uuid4().hex[:12]}"
        result_json = result.model_dump_json()

        with self.repo.conn:
            self.repo.conn.execute(
                "DELETE FROM ai_results WHERE document_id = ? AND type = ?;",
                (result.document_id, result_type),
            )
            self.repo.conn.execute(
                """
                INSERT INTO ai_results (
                    id, document_id, type, provider, model, result_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    result_id,
                    result.document_id,
                    result_type,
                    result.provider,
                    result.model,
                    result_json,
                    result.updated_at,
                ),
            )

    def export_json(self, doc_id: str, profile: ExtractionProfile) -> str:
        """Export extraction data as clean, formatted JSON (no credentials)."""
        ext = self.get_cached_extraction(doc_id, profile)
        if not ext:
            raise ValueError(f"No extraction found for document '{doc_id}' with profile '{profile}'.")

        doc = self.repo.get_document(doc_id)
        filename = doc.metadata.original_filename if doc else "unknown"

        export_obj = {
            "document_id": doc_id,
            "filename": filename,
            "profile": profile,
            "is_verified": ext.is_verified,
            "user_notes": ext.user_notes,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "extracted_data": ext.data,
        }
        return json.dumps(export_obj, indent=2, ensure_ascii=False)

    def export_csv(self, doc_id: str, profile: ExtractionProfile) -> str:
        """Export extraction data as standard CSV, properly escaping commas, quotes, and newlines."""
        ext = self.get_cached_extraction(doc_id, profile)
        if not ext:
            raise ValueError(f"No extraction found for document '{doc_id}' with profile '{profile}'.")

        doc = self.repo.get_document(doc_id)
        filename = doc.metadata.original_filename if doc else "unknown"
        data = ext.data

        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")

        # Header metadata block
        writer.writerow(["Transformo Docs - Structured Extraction Export"])
        writer.writerow(["Document ID", doc_id])
        writer.writerow(["Filename", filename])
        writer.writerow(["Profile", profile.capitalize()])
        writer.writerow(["Verified by User", "Yes" if ext.is_verified else "No"])
        if ext.user_notes:
            writer.writerow(["User Notes", ext.user_notes])
        writer.writerow(["Exported At", datetime.now(timezone.utc).isoformat()])
        writer.writerow([])

        if profile == "invoice":
            writer.writerow(["--- INVOICE SUMMARY ---"])
            writer.writerow(["Field", "Value"])
            writer.writerow(["Vendor Name", data.get("vendor_name") or ""])
            writer.writerow(["Vendor Address", data.get("vendor_address") or ""])
            writer.writerow(["Customer Name", data.get("customer_name") or ""])
            writer.writerow(["Invoice Number", data.get("invoice_number") or ""])
            writer.writerow(["Invoice Date", data.get("invoice_date") or ""])
            writer.writerow(["Due Date", data.get("due_date") or ""])
            writer.writerow(["Currency", data.get("currency") or ""])
            writer.writerow(["Subtotal", data.get("subtotal") if data.get("subtotal") is not None else ""])
            writer.writerow(["Tax Amount", data.get("tax_amount") if data.get("tax_amount") is not None else ""])
            writer.writerow(["Total Amount", data.get("total_amount") if data.get("total_amount") is not None else ""])
            writer.writerow(["Notes", data.get("notes") or ""])
            writer.writerow([])

            line_items = data.get("line_items") or []
            if line_items:
                writer.writerow(["--- ITEMIZATION ---"])
                writer.writerow(["Item #", "Description", "Quantity", "Unit Price", "Total Price"])
                for idx, item in enumerate(line_items, 1):
                    writer.writerow([
                        idx,
                        item.get("description", ""),
                        item.get("quantity") if item.get("quantity") is not None else "",
                        item.get("unit_price") if item.get("unit_price") is not None else "",
                        item.get("total_price") if item.get("total_price") is not None else "",
                    ])
                writer.writerow([])

        elif profile == "resume":
            writer.writerow(["--- CANDIDATE DETAILS ---"])
            writer.writerow(["Candidate Name", data.get("candidate_name") or ""])
            contact = data.get("contact_details") or {}
            writer.writerow(["Email", contact.get("email") or ""])
            writer.writerow(["Phone", contact.get("phone") or ""])
            writer.writerow(["Location", contact.get("location") or ""])
            writer.writerow(["LinkedIn", contact.get("linkedin") or ""])
            writer.writerow(["Website", contact.get("website") or ""])
            writer.writerow(["Summary", data.get("summary") or ""])
            writer.writerow(["Skills", ", ".join(data.get("skills") or [])])
            writer.writerow(["Certifications", ", ".join(data.get("certifications") or [])])
            writer.writerow([])

            edu = data.get("education") or []
            if edu:
                writer.writerow(["--- EDUCATION ---"])
                writer.writerow(["Institution", "Degree", "Field of Study", "Graduation Year"])
                for e in edu:
                    writer.writerow([
                        e.get("institution", ""),
                        e.get("degree", ""),
                        e.get("field_of_study", ""),
                        e.get("graduation_year", ""),
                    ])
                writer.writerow([])

            exp = data.get("experience") or []
            if exp:
                writer.writerow(["--- EXPERIENCE ---"])
                writer.writerow(["Company", "Role", "Start Date", "End Date", "Responsibilities"])
                for x in exp:
                    resp_str = " | ".join(x.get("responsibilities") or [])
                    writer.writerow([
                        x.get("company", ""),
                        x.get("role", ""),
                        x.get("start_date", ""),
                        x.get("end_date", ""),
                        resp_str,
                    ])
                writer.writerow([])

        else:  # general
            writer.writerow(["--- GENERAL METADATA ---"])
            writer.writerow(["Document Type", data.get("document_type") or ""])
            writer.writerow(["Title", data.get("title") or ""])
            writer.writerow(["People", ", ".join(data.get("people") or [])])
            writer.writerow(["Organizations", ", ".join(data.get("organizations") or [])])
            writer.writerow(["Dates Mentioned", ", ".join(data.get("dates") or [])])
            writer.writerow([])

            facts = data.get("key_facts") or []
            if facts:
                writer.writerow(["--- KEY FACTS & FINDINGS ---"])
                writer.writerow(["#", "Fact"])
                for idx, fact in enumerate(facts, 1):
                    writer.writerow([idx, fact])
                writer.writerow([])

        # Provenance section for all profiles
        provenance = data.get("provenance") or {}
        if provenance:
            writer.writerow(["--- PROVENANCE / CITATIONS ---"])
            writer.writerow(["Field", "Supporting Quote from Document"])
            for field, quote in provenance.items():
                writer.writerow([field, quote])

        return output.getvalue()
