# Transformo Docs — Submission Guide

**Project:** Transformo Docs Application: Empowering Machine-Readable Document Management System  
**Problem Statement:** PS #95  
**Version:** 0.1.0  
**Target Platform:** macOS (Apple Silicon arm64, macOS 13+)  

---

## 1. Project Overview

Transformo Docs is a high-performance, offline-first macOS desktop application designed to bridge the gap between unstructured documents (PDF, DOCX, TXT) and machine-readable data pipelines. It enables enterprise users, analysts, and developers to ingest high-volume documents, extract pristine text, execute millisecond full-text searches (FTS5), generate AI summaries with structured field extraction (via Groq API), and export validated data to RFC 4180 CSV and JSON.

---

## 2. Key Features

- **Document Ingestion & Parsing:**
  - Multi-format support: PDF (via PyMuPDF), Word documents (python-docx), and plain text.
  - Automatic validation: 50 MB file size limit, MIME-type checks, and SHA-256 content deduplication.
  - Optical scanned PDF detection with user warnings.
- **Offline Full-Text Search (FTS5):**
  - Instant search across thousands of indexed documents with SQLite FTS5.
  - Highlighted snippet previews matching query terms.
  - Filterable by file type, extraction status, and date.
- **AI-Powered Summarization:**
  - Multi-stage map-reduce processing for long documents.
  - Provider abstraction with default high-throughput Groq integration (`openai/gpt-oss-120b`).
  - Strict privacy consent guardrails and deterministic caching.
- **Schema-Enforced Structured Extraction:**
  - Specialized Pydantic schema profiles:
    - *General Document*: Title, summary, key entities, dates, action items.
    - *Invoice / Receipt*: Vendor, invoice number, date, subtotal, tax, total, line items.
    - *Resume / CV*: Candidate name, email, phone, experience, education, skills.
  - Exact source text citation & character offset provenance for zero-hallucination verification.
- **Interactive Review & Data Export:**
  - In-app side-by-side review workbench with confidence indicators and missing-field alerts.
  - Export to clean JSON and RFC 4180-compliant CSV with nested schema flattening.

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| **Desktop Shell** | Electron 44, Node.js 24, electron-builder 26 |
| **Renderer / UI** | React 19, Vite 8, Tailwind CSS 4, Lucide Icons |
| **Backend Service** | Python 3.11/3.12, FastAPI, Uvicorn, Pydantic v2 |
| **Text Extraction** | PyMuPDF (fitz), python-docx |
| **Local Database** | SQLite with FTS5 Full-Text Search extension (WAL mode) |
| **AI Integration** | Groq API (`openai/gpt-oss-120b`), map-reduce chunking |
| **Packaging** | PyInstaller (standalone Python Mach-O bundle) + DMG installer |

---

## 4. Installation Instructions

1. Locate the packaged disk image file:
   ```
   desktop/release/TransformoDocs-0.1.0-arm64.dmg
   ```
2. Double-click the `.dmg` file to mount it.
3. Drag the **Transformo Docs** application icon into the **Applications** folder shortcut.
4. Eject the mounted disk image.

---

## 5. First-Launch Instructions

### Handling macOS Gatekeeper (Unsigned Development Build)
Because this submission is built in a local/evaluation environment without an active Apple Developer ID certificate:
1. Double-click **Transformo Docs** in `/Applications`.
2. macOS may show an alert indicating the developer cannot be verified.
3. To open:
   - Either **Right-click (Control-click)** the app icon and select **Open**, then click **Open** in the dialog.
   - Or go to **System Settings > Privacy & Security**, scroll down to the Security section, and click **Open Anyway**.
4. Upon launch, Electron will automatically spawn the bundled Python FastAPI backend process on an ephemeral loopback port (`127.0.0.1`) authenticated via a transient session token.

---

## 6. AI Provider Configuration

Transformo Docs is designed with a strict privacy-first architecture. It functions completely offline for ingestion, text extraction, library indexing, and search without any internet access or API key.

To use the AI Summarization and Structured Extraction features:
1. Obtain an API key from [Groq Console](https://console.groq.com/).
2. Open **Settings** (gear icon) in the Transformo Docs application, or place your API key in the environment / config:
   ```bash
   # User configuration path:
   ~/Library/Application Support/Transformo Docs/config.json
   ```
   Alternatively, when running in development mode, provide it in `backend/.env`:
   ```bash
   GROQ_API_KEY=gsk_...
   ```
3. When triggering an AI summary or extraction for the first time, acknowledge the external provider privacy dialog to proceed.

---

## 7. Privacy & Security Architecture

- **Local Storage by Default:** All documents, extracted raw text, metadata, and SQLite search indexes reside exclusively on your Mac in `~/Library/Application Support/Transformo Docs/`.
- **Zero Background Phoning:** No document data is transmitted externally unless explicitly commanded by the user for an AI task.
- **Process Isolation:** The Electron renderer runs with `contextIsolation: true`, `nodeIntegration: false`, and communicates with the backend solely via a secured preload IPC bridge.
- **Token-Authenticated Loopback:** The backend process binds to `127.0.0.1` only, requiring a cryptographically secure bearer token generated per session by Electron's main process.

---

## 8. Known Limitations

1. **Code Signing & Notarization:** The generated `.dmg` is unsigned and unnotarized (no Apple Developer ID installed on the build machine). It requires standard macOS developer-override approval on initial launch.
2. **Architecture:** The release build is compiled for Apple Silicon Macs (`arm64`). For Intel (`x64`) Macs, run the app in development mode or compile with an x64 target.
3. **Scanned Images / OCR:** Scanned PDFs lacking a digital text layer are flagged with a "Scanned PDF (No text found)" warning; OCR integration is scheduled for future minor releases.
4. **AI Features:** Offline summarization is not embedded; AI features require an active Groq API key and network connection to `api.groq.com`.
