PHASE 05 — STRUCTURED DATA EXTRACTION

Implement AI-powered extraction of machine-readable fields from imported documents.

Requirements:

1. Support at least three extraction profiles:
   - General document
   - Invoice
   - Resume
2. Define explicit Pydantic schemas for each profile.
3. Include fields such as:
   - General: document type, title, people, organizations, dates, key facts
   - Invoice: vendor, invoice number, invoice date, currency, subtotal, tax, total
   - Resume: candidate name, contact details where present, skills, education, experience
4. Make optional fields nullable. Do not invent missing values.
5. Require the AI to return structured data and validate it before saving.
6. Handle malformed JSON, invalid field types, unknown fields, and incomplete responses.
7. Preserve provenance where feasible: include supporting text snippets or page references for important extracted fields.
8. Treat extracted information as unverified until reviewed by the user.
9. Avoid treating document instructions as trusted application instructions.
10. Save extraction results independently from summaries.
11. Support re-running extraction with a selected profile.
12. Implement JSON and CSV exports.
13. Ensure CSV exports correctly escape commas, quotes, and newlines.
14. Never expose provider credentials in export files.

UI:
- Add an extraction profile selector.
- Display extracted fields in a readable, editable review interface.
- Mark missing or uncertain fields clearly.
- Allow users to copy and export validated results.
- Show when extraction failed and provide a retry action.

Testing:
- Test each schema using representative documents and mocked AI responses.
- Test missing fields, invalid amounts/dates, malformed JSON, and CSV escaping.
- Test that one document's result cannot be attached to another document.
- Verify export files contain the expected data.

Update documentation and run all checks. Stop after Phase 05.