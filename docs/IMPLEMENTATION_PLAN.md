# Transformo Docs — Implementation Plan

PS #95: *Transformo Docs Application: Empowering Machine-Readable Document Management System.*

This document records the architecture decisions and the phase plan. It is updated at the end of every phase.

## 1. Environment (verified 2026-10-17)

| Item | Value |
|---|---|
| Host | macOS 27.0.1, Apple Silicon (`arm64`) |
| Node / npm | v26.10.0 / 11.19.1 |
| Python | 3.12.14 chosen for the backend (3.14 is also installed, but parser and PyInstaller wheels are most reliable on 3.12) |
| Xcode | Full Xcode at `/Applications/Xcode.app` |
| Build target | `arm64` DMG only. Intel/universal builds are out of scope unless requested. |

## 2. Architecture

```
┌──────────────────────── Electron app (Transformo Docs.app) ────────────────────────┐
│                                                                                    │
│  Renderer (React + TS + Tailwind)                                                  │
│    │  window.transformo.*  (named, typed functions only — no generic fetch/fs)     │
│    ▼                                                                               │
│  Preload (contextBridge, contextIsolation=true, nodeIntegration=false, sandbox)    │
│    │  ipcRenderer.invoke('<allow-listed channel>', validatedArgs)                  │
│    ▼                                                                               │
│  Main process                                                                      │
│    • Spawns backend child process on 127.0.0.1:<free port>                         │
│    • Generates a per-launch random auth token → backend requires it on every call  │
│    • Polls GET /health for readiness; reports startup failures in a dialog         │
│    • Owns native dialogs (open file / save export); renderer never sends raw paths │
│    • Stores API key with Electron safeStorage (macOS Keychain-backed encryption)   │
│    • Kills backend on quit (SIGTERM → timeout → SIGKILL)                           │
│    │  HTTP + X-Transformo-Token                                                    │
│    ▼                                                                               │
│  Backend (FastAPI, Python; PyInstaller binary in production)                       │
│    • Ingestion: PyMuPDF (PDF), python-docx (DOCX), TXT with encoding detection     │
│    • SQLite (stdlib sqlite3, parameterised SQL, FK on, WAL) + FTS5 full-text search│
│    • AI provider abstraction → Gemini (google-genai SDK)                           │
│    • Pydantic schemas for API I/O and AI output validation                         │
│    • JSON / CSV export                                                             │
└────────────────────────────────────────────────────────────────────────────────────┘

User data: ~/Library/Application Support/Transformo Docs/
  ├── transformo.db        SQLite database
  ├── documents/           managed copies of imported files (content-addressed)
  ├── logs/                main + backend logs (no secrets, no document text)
  └── credentials.bin      safeStorage-encrypted API key
```

### Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Renderer ↔ backend | Through main-process IPC, not direct `fetch` | The auth token and backend port never reach the renderer. Each IPC channel is allow-listed and validated. |
| Port | Main asks the OS for a free port (`listen(0)`), passes it to the backend, then waits for readiness | Avoids hardcoded ports and conflicts |
| Backend access control | 32-byte random token per launch, bound to `127.0.0.1` only | Stops other local processes or web pages from calling the API |
| Database layer | stdlib `sqlite3` with a small repository module and migrations table | Minimal dependencies; FTS5 is built in |
| Search | SQLite FTS5 virtual table over extracted text, with snippets | No vector DB needed (master rule) |
| File intake | Extension allow-list (`.pdf .docx .txt`), size cap (default 50 MB), magic-byte/structure check, SHA-256 dedupe | Covers the master security requirements |
| Credentials | `safeStorage`-encrypted file in userData. Main decrypts it and pushes the key to the backend over the token-protected channel, where it is held **in memory only**. Dev fallback: `GEMINI_API_KEY` env var. | Keeps the key out of SQLite, localStorage, logs, and the bundle |
| AI consent | AI actions disabled until the user accepts a privacy notice in Settings; the notice is shown again before the first send | Meets the "no silent transmission" rule |
| AI output | Requests JSON-schema-constrained output and validates it with Pydantic. Retries once on invalid output, then reports a clear error | No fabricated values |
| Long documents | Token-bounded chunking with map-reduce summarisation. The UI states when map-reduce was used | No silent truncation |
| Backend packaging | PyInstaller `--onedir` (faster start than `--onefile`, no temp extraction), placed in `Contents/Resources/backend/` via electron-builder `extraResources` | Reliable startup in a read-only `/Applications` install |
| Desktop scaffold | Vite + React + TS, compiled separately for main/preload (`vite-plugin-electron` or plain `tsc`, chosen in Phase 01 after checking Node 26 compatibility) | Standard stack per master |

### Data model (initial; refined in Phase 03)

- `documents`: id, original_name, stored_path, mime_type, extension, size_bytes, sha256 (unique), page_count, word_count, metadata_json, status (`pending|processing|ready|failed`), error, created_at, updated_at
- `document_text`: document_id (FK, cascade), text, per-page offsets
- `documents_fts`: FTS5 over (original_name, text)
- `ai_results`: id, document_id (FK, cascade), kind (`summary|extraction`), profile (nullable), provider, model, params_json, result_json, status, error, created_at. Regenerating creates a new row and marks it current for that (document, kind, profile), so earlier results are not destroyed by accident.

## 3. Phase plan

Each phase ends with tests, a build check, a status report, and **a stop for your approval**.

| Phase | Title | Source prompt | Scope summary |
|---|---|---|---|
| 00 | Foundation planning | Master | This plan, README, .gitignore, release checklist, directory layout |
| 01 | Desktop foundation | *File is empty — scope inferred from title* | Electron + React + TS + Vite + Tailwind scaffold; secure preload; FastAPI skeleton with `/health`; main-process backend spawn, free port, token, readiness, and shutdown; dev scripts; lint/typecheck/pytest wired |
| 02 | Ingestion & text extraction | *File is empty — scope inferred* | Import via native dialog and drag-drop; validation (extension, size, real file check); PyMuPDF, python-docx, and TXT extractors; metadata; managed file storage; error handling; tests with generated fixtures |
| 03 | SQLite, library & search | *File is empty — scope inferred* | Schema + migrations, repositories, FTS5 search with snippets, list/detail/delete endpoints, Library + Detail + Search UI, persistence across restart |
| 04 | AI summaries | Prompt 04 | Provider abstraction, Gemini provider, safeStorage key, consent, map-reduce, error handling, summary UI, mocked tests |
| 05 | Structured extraction & export | Prompt 05 | General/Invoice/Resume schemas, provenance, review/edit UI, JSON/CSV export, isolation tests |
| 06 | Complete desktop experience | Prompt 06 | Dashboard, AI Workspace, Settings, About, a11y, states, confirmations, full workflow test |
| 07 | *Missing prompt* | — | **No Phase 07 prompt exists.** Proposed: hardening (security review of IPC/preload, logging hygiene, error-path tests, performance on large PDFs). To be confirmed by you. |
| 08 | Packaging & DMG | Prompt 08 | PyInstaller backend, electron-builder arm64 DMG, installed-app verification |
| 09 | Final submission audit | Prompt 09 | Clean-install verification, SUBMISSION_GUIDE.md, pass/fail checklist |

## 4. Known constraints and open questions

1. **Phases 01–03 have empty prompt files.** I will implement them from the master requirements and the scopes above, unless you provide prompt text.
2. **Phase 07 has no prompt.** The proposed scope is listed above.
3. **Signing / notarisation:** no Apple Developer ID credentials are known. Unless they are provided, the DMG will be unsigned (or ad-hoc signed) and documented as such. Gatekeeper will then need right-click → Open on first launch.
4. **Live AI verification** needs a Gemini API key. Automated tests mock the provider and never need one.
5. **Git:** this folder currently sits untracked inside a repository rooted at `~/Desktop`. A dedicated repository for this project is recommended (needs your approval).

## 5. Phase log

| Phase | Status | Date | Notes |
|---|---|---|---|
| 00 | Complete — awaiting approval | 2026-10-17 | Planning docs and directory layout created; no application code |
