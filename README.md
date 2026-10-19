# Transformo Docs

A macOS desktop application for turning PDF, DOCX, and TXT documents into searchable, machine-readable data, with AI summaries and structured field extraction.

Built for **PS #95 — Transformo Docs Application: Empowering Machine-Readable Document Management System.**

> **Status:** Phase 00 (planning) complete. Application code starts in Phase 01. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the architecture and phase plan.

## Features (planned)

- Import PDF, DOCX, and TXT files, with validation by extension, size, and file content
- Text and metadata extraction (PyMuPDF, python-docx)
- Local SQLite library with full-text search (FTS5)
- AI summaries (Groq API using official SDK), with explicit privacy consent
- Structured extraction (General / Invoice / Resume) validated against Pydantic schemas
- JSON and CSV export
- Distributed as a standalone macOS `.dmg`. End users do not need Python or Node.

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
