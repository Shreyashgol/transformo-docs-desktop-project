from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, Field

ExtractionProfile = Literal["general", "invoice", "resume"]


# ============================================================================
# Profile 1: General Document Schema
# ============================================================================

class GeneralExtraction(BaseModel):
    document_type: str | None = Field(default=None, description="Type of document (e.g. Contract, Report, Memorandum)")
    title: str | None = Field(default=None, description="Document title if present")
    people: list[str] = Field(default_factory=list, description="Key individuals mentioned")
    organizations: list[str] = Field(default_factory=list, description="Companies or organizations mentioned")
    dates: list[str] = Field(default_factory=list, description="Important dates found in the document")
    key_facts: list[str] = Field(default_factory=list, description="Core facts, findings, or clauses")
    provenance: dict[str, str] = Field(
        default_factory=dict,
        description="Text quotes or citations from the source document supporting key fields"
    )


# ============================================================================
# Profile 2: Invoice / Receipt Schema
# ============================================================================

class InvoiceLineItem(BaseModel):
    description: str = Field(..., description="Description of the product or service")
    quantity: float | None = Field(default=None, description="Quantity billed")
    unit_price: float | None = Field(default=None, description="Price per unit")
    total_price: float | None = Field(default=None, description="Total line amount")


class InvoiceExtraction(BaseModel):
    vendor_name: str | None = Field(default=None, description="Name of seller or vendor")
    vendor_address: str | None = Field(default=None, description="Vendor physical or mailing address")
    customer_name: str | None = Field(default=None, description="Customer or billed entity name")
    invoice_number: str | None = Field(default=None, description="Unique invoice or bill identifier")
    invoice_date: str | None = Field(default=None, description="Date invoice was issued")
    due_date: str | None = Field(default=None, description="Payment due date")
    currency: str | None = Field(default=None, description="Currency code or symbol (e.g. USD, EUR, INR)")
    subtotal: float | None = Field(default=None, description="Subtotal amount before tax")
    tax_amount: float | None = Field(default=None, description="Tax or VAT amount")
    total_amount: float | None = Field(default=None, description="Final total amount payable")
    line_items: list[InvoiceLineItem] = Field(default_factory=list, description="Itemized billing rows")
    notes: str | None = Field(default=None, description="Payment instructions or terms")
    provenance: dict[str, str] = Field(
        default_factory=dict,
        description="Quotes from the document showing where totals or numbers were found"
    )


# ============================================================================
# Profile 3: Resume / CV Schema
# ============================================================================

class ResumeContactDetails(BaseModel):
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    website: str | None = None


class ResumeEducation(BaseModel):
    institution: str = Field(..., description="School, College, or University name")
    degree: str | None = Field(default=None, description="Degree or qualification (e.g. B.S., M.S.)")
    field_of_study: str | None = Field(default=None, description="Major or specialization")
    graduation_year: str | None = Field(default=None, description="Graduation year or date range")


class ResumeExperience(BaseModel):
    company: str = Field(..., description="Employer or organization name")
    role: str | None = Field(default=None, description="Job title or role")
    start_date: str | None = None
    end_date: str | None = None
    responsibilities: list[str] = Field(default_factory=list, description="Key duties or achievements")


class ResumeExtraction(BaseModel):
    candidate_name: str | None = Field(default=None, description="Full name of the candidate")
    contact_details: ResumeContactDetails = Field(default_factory=ResumeContactDetails)
    summary: str | None = Field(default=None, description="Professional summary or objective statement")
    skills: list[str] = Field(default_factory=list, description="Technical and domain skills")
    education: list[ResumeEducation] = Field(default_factory=list, description="Academic history")
    experience: list[ResumeExperience] = Field(default_factory=list, description="Employment history")
    certifications: list[str] = Field(default_factory=list, description="Certifications and licenses")
    provenance: dict[str, str] = Field(
        default_factory=dict,
        description="Quotes from the document supporting candidate identity or skills"
    )


# ============================================================================
# Top-level Request & Response Schemas
# ============================================================================

class ExtractionRequest(BaseModel):
    profile: ExtractionProfile = "general"
    force_regenerate: bool = False


class ExtractionUpdateRequest(BaseModel):
    data: dict[str, Any]
    is_verified: bool = False
    user_notes: str | None = None


class ExtractionResult(BaseModel):
    document_id: str
    profile: ExtractionProfile
    data: dict[str, Any]
    is_verified: bool = False
    user_notes: str | None = None
    provider: str
    model: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    warnings: list[str] = Field(default_factory=list)
