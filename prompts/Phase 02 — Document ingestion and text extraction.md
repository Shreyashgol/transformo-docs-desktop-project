PHASE 02 — DOCUMENT INGESTION AND EXTRACTION

Implement reliable document importing and text extraction.

Supported formats:
- PDF
- DOCX
- TXT

Backend requirements:

1. Create modular extractors for each supported format.
2. Use PyMuPDF for PDF extraction and python-docx for DOCX extraction.
3. Implement TXT decoding with appropriate encoding detection or safe fallback behavior.
4. Extract useful metadata such as filename, extension, file size, page count where available, and timestamps.
5. Validate file type, file size, file contents, and parsing errors.
6. Generate a stable document ID for each imported document.
7. Prevent duplicate imports using a documented policy, preferably a content hash.
8. Store original files in a per-user application-data directory, not in the source tree or installed application's resources.
9. Keep the original filename for display, but use safe internal filenames for storage.
10. Return a structured processing result and meaningful errors.
11. Design the ingestion service so future OCR support can be added without rewriting the extraction pipeline.
12. Treat scanned PDFs as a supported limitation for now: detect likely empty-text PDFs and explain that OCR is not yet available.

Frontend requirements:

1. Implement document import using a safe Electron file-selection API.
2. Support drag and drop if feasible.
3. Display supported formats and size restrictions.
4. Show import progress and success or failure messages.
5. Display extracted text on a document detail screen.
6. Show document processing status.

Testing:
- Test a text-based PDF, a DOCX, and a TXT file.
- Test malformed files, unsupported formats, empty documents, and duplicate imports.
- Verify the original files remain intact.
- Verify the UI displays backend errors correctly.

Do not implement AI summaries or structured AI extraction yet. Complete the import-to-preview workflow, update documentation, run tests, and stop.