# Transformo Docs

A macOS desktop application for turning PDF, DOCX, and TXT documents into searchable, machine-readable data, with AI summaries and structured field extraction.

Built for **PS #95 — Transformo Docs Application: Empowering Machine-Readable Document Management System.**

> **Status:** Phases 01 through 05 complete. Full desktop foundation, document ingestion, SQLite FTS5 library, AI document summaries with Groq, and structured data extraction with JSON/CSV exports are implemented and tested. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for full details.

## Implemented Features

- **Document Ingestion:** Import PDF, DOCX, and TXT files with format validation, size limit checks, and SHA-256 content deduplication.
- **Parsing:** High-speed text extraction via PyMuPDF and python-docx, with scanned PDF detection and charset fallback.
- **SQLite Document Library:** Fast SQLite WAL storage with FTS5 full-text search, snippet highlighting, format/status filtering, and cascading deletion.
- **AI Document Summaries:** Multi-stage map-reduce summarization powered by Groq API (`openai/gpt-oss-120b`), caching, and user consent guardrails.
- **Structured Data Extraction:** Pydantic-validated extraction profiles for General Documents, Invoices/Receipts, and Resumes/CVs with provenance citations.
- **Review & Export:** Interactive review and editing UI with missing-field alerts, user verification badges, and RFC 4180 CSV / JSON exports.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron, electron-builder |
| UI | React, JavaScript, Vite, Tailwind CSS |
| Backend | Python 3.12, FastAPI, Pydantic |
| Storage | SQLite (FTS5) |
| Parsing | PyMuPDF, python-docx |
| AI | Provider abstraction; Groq API via official `groq` SDK |
| Backend packaging | PyInstaller |

## Repository layout

```
transformo-docs-project/
├── desktop/   Electron main/preload + React renderer
├── backend/   FastAPI service, extraction, DB, AI, tests
├── docs/      Implementation plan, release checklist, submission guide
├── prompts/   Phase instructions
└── release/   Generated DMG (git-ignored)
```

## Prerequisites (development only)

- macOS on Apple Silicon
- Node.js ≥ 20 and npm
- Python 3.12

### Setup

```bash
# 1. Backend virtual environment and dependencies
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

# Configure your Groq API key in backend/.env:
cp .env.example .env
# Edit .env and set your GROQ_API_KEY (e.g. gsk_...)

# 2. Desktop app dependencies
cd ../desktop
npm install
```

### Running in Development

```bash
# Start both the Python FastAPI backend and Electron desktop window:
cd desktop
npm run dev
```

### Type Checking & Testing

```bash
# Run backend tests
cd backend
source .venv/bin/activate
pytest

# Run desktop lint and tests
cd ../desktop
npm run lint
npm run test

# Build production bundle for desktop
npm run build
```

## Privacy

Documents and the database stay on your Mac under `~/Library/Application Support/Transformo Docs/`. Document text is sent to an external AI provider **only** when you have configured a provider, accepted the privacy notice, and started an AI action yourself.
