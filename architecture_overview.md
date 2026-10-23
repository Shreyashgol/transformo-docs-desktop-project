# Transformo Docs — System & Runtime Architecture

## High-Level Overview

Transformo Docs is a **macOS desktop application** for machine-readable document management. It combines an **Electron** shell (React frontend) with a **Python FastAPI** backend — both running locally on the user's Mac. AI features (summarization, extraction) are powered by **Groq Cloud API** over HTTPS.

```mermaid
graph TB
    subgraph "User's Mac"
        subgraph "Electron Process (Node.js)"
            MAIN["Main Process<br/>(electron/main.js)"]
            RENDERER["Renderer Process<br/>(React SPA)"]
            PRELOAD["Preload Bridge<br/>(preload.cjs)"]
        end
        subgraph "Python Child Process"
            FASTAPI["FastAPI Server<br/>(uvicorn on localhost)"]
            SQLITE[("SQLite DB +<br/>FTS5 Index")]
            FILES["Document Storage<br/>(~/Library/App Support/...)"]
        end
    end
    GROQ["Groq Cloud API<br/>(api.groq.com)"]
    
    RENDERER -->|"window.transformo.*"| PRELOAD
    PRELOAD -->|"IPC (ipcRenderer.invoke)"| MAIN
    MAIN -->|"HTTP localhost:PORT<br/>X-Transformo-Token"| FASTAPI
    FASTAPI --> SQLITE
    FASTAPI --> FILES
    FASTAPI -->|"HTTPS POST<br/>(Groq API Key)"| GROQ
```

---

## 1. Distribution & Installation

There are **two DMG installer options**, both targeting macOS 12+ on Apple Silicon (arm64):

### Option A: Full Offline DMG (~171 MB)
- File: [`TransformoDocs-0.1.0-arm64.dmg`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/release/TransformoDocs-0.1.0-arm64.dmg)
- Contains the complete `.app` bundle — Electron shell + PyInstaller backend binary
- Built by: `npm run desktop:dist:mac` (Vite build → electron-builder)

### Option B: Bootstrap DMG (308 KB)
- File: [`TransformoDocs-0.1.0-arm64-bootstrap.dmg`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/release/TransformoDocs-0.1.0-arm64-bootstrap.dmg)
- Contains a **native Swift launcher** ([`main.swift`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/bootstrap/main.swift)) that downloads the full DMG from Google Drive on first launch
- Designed for portals with < 50 MB upload limits

```mermaid
flowchart LR
    subgraph "Bootstrap DMG (308 KB)"
        SWIFT["Swift Launcher"]
    end
    subgraph "Google Drive"
        FULL["Full DMG (~171 MB)"]
    end
    subgraph "User's /Applications"
        APP["Transformo Docs.app"]
    end
    SWIFT -->|"Downloads"| FULL
    FULL -->|"Installs to"| APP
```

---

## 2. Application Startup Sequence

When the user double-clicks `Transformo Docs.app`:

```mermaid
sequenceDiagram
    participant User
    participant Electron as Electron Main Process
    participant BM as BackendManager
    participant Python as Python FastAPI
    participant React as React Renderer

    User->>Electron: Launch app
    Electron->>Electron: requestSingleInstanceLock()
    Electron->>Electron: applySecurityPolicies()
    Electron->>Electron: registerIpcHandlers()
    Electron->>React: createWindow() → load Vite bundle
    React->>React: Show "Starting document engine…"
    
    Electron->>BM: backend.start()
    BM->>BM: findFreePort() → random port
    BM->>BM: randomBytes(32) → auth token
    BM->>Python: spawn child process with env vars
    Note over BM,Python: TRANSFORMO_PORT, TRANSFORMO_TOKEN,<br/>TRANSFORMO_DATA_DIR, TRANSFORMO_PARENT_PID
    
    loop Health polling (every 300ms)
        BM->>Python: GET /api/health
        Python-->>BM: 200 OK
    end
    
    BM->>Electron: emit("status", {state: "ready"})
    Electron->>React: IPC → backendStatusChanged
    React->>React: Show Dashboard
```

### Key files in the startup chain:

| Step | File | Role |
|---|---|---|
| 1 | [`electron/main.js`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/electron/main.js) | Entry point — creates window, starts backend |
| 2 | [`electron/backend-manager.js`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/electron/backend-manager.js) | Spawns Python, manages lifecycle |
| 3 | [`electron/backend-command.js`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/electron/backend-command.js) | Resolves correct Python path (dev vs packaged) |
| 4 | [`electron/port.js`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/electron/port.js) | Finds a free TCP port |
| 5 | [`backend/app/__main__.py`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/__main__.py) | Python entry — loads settings, starts uvicorn |
| 6 | [`backend/app/config.py`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/config.py) | Reads env vars into `Settings` dataclass |
| 7 | [`backend/app/main.py`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/main.py) | Creates FastAPI app, registers routes |

---

## 3. Security Model

The backend is **localhost-only** with per-launch authentication:

```mermaid
flowchart LR
    subgraph "Electron Main Process"
        TOKEN["Random 64-char hex token<br/>(generated each launch)"]
        PORT["Dynamic free port<br/>(1024-65535)"]
    end
    subgraph "Security Middleware"
        AUTH["LocalAuthMiddleware"]
    end
    
    TOKEN -->|"env: TRANSFORMO_TOKEN"| AUTH
    PORT -->|"env: TRANSFORMO_PORT"| AUTH
    AUTH -->|"Validates every request"| CHECKS
    
    subgraph CHECKS["Checks"]
        H1["Host header = 127.0.0.1:PORT"]
        H2["X-Transformo-Token = token"]
    end
```

- **Port & token are never exposed to the renderer** — all HTTP calls go through the Electron main process
- [`security.py`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/security.py): `LocalAuthMiddleware` validates `Host` header + `X-Transformo-Token` on every request
- Renderer sandbox is enabled (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`)

---

## 4. IPC Communication Layer

The renderer (React) talks to the backend through a **three-hop chain**:

```mermaid
flowchart LR
    subgraph "Renderer (Sandboxed)"
        API["window.transformo.documents.list()"]
    end
    subgraph "Preload Script"
        IPC_R["ipcRenderer.invoke('documents:list')"]
    end
    subgraph "Main Process"
        HANDLER["ipcMain.handle('documents:list')"]
        HTTP["fetch('http://127.0.0.1:PORT/api/documents')"]
    end
    subgraph "Python Backend"
        ROUTE["/api/documents → IngestionService"]
    end
    
    API --> IPC_R --> HANDLER --> HTTP --> ROUTE
```

### IPC Channel Map

| Namespace | Channels | Backend Routes |
|---|---|---|
| `app:` | `get-info` | *(Electron-only, no backend call)* |
| `backend:` | `get-status`, `restart`, `health`, `status-changed` | `GET /api/health` |
| `documents:` | `select-and-import`, `upload-buffer`, `list`, `get`, `delete`, `stats` | `POST/GET/DELETE /api/documents/*` |
| `ai:` | `get-settings`, `update-settings`, `validate`, `set-consent`, `generate-summary`, `get-summary`, `extract-document`, `get-extraction`, `update-extraction`, `export-extraction` | `GET/POST /api/ai/*` |

Key files:
- [`shared/api.js`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/shared/api.js) — Channel name constants
- [`electron/preload.cjs`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/electron/preload.cjs) — Bridge (`contextBridge.exposeInMainWorld`)
- [`electron/ipc.js`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/electron/ipc.js) — Main process handlers (HTTP calls to backend)

---

## 5. Backend Architecture

```mermaid
graph TB
    subgraph "FastAPI Application"
        MW["LocalAuthMiddleware"]
        subgraph "API Routers"
            HEALTH["/api/health"]
            VER["/api/version"]
            DOCS["/api/documents/*"]
            AI["/api/ai/*"]
        end
        subgraph "Services"
            INGEST["IngestionService"]
            SUMM["SummarizationService"]
            EXTRACT["ExtractionService"]
        end
        subgraph "Data Layer"
            REPO["DocumentRepository"]
            SQLITE_DB[("SQLite + FTS5")]
            STORAGE["File Storage"]
        end
        subgraph "AI Layer"
            PROVIDER["GroqProvider (shared)"]
            CHUNKER["TextChunker"]
        end
    end
    
    MW --> HEALTH
    MW --> VER
    MW --> DOCS --> INGEST --> REPO --> SQLITE_DB
    INGEST --> STORAGE
    MW --> AI --> SUMM --> PROVIDER
    AI --> EXTRACT --> PROVIDER
    SUMM --> REPO
    EXTRACT --> REPO
    PROVIDER --> CHUNKER
```

### Backend modules:

| Module | Path | Purpose |
|---|---|---|
| **config** | [`config.py`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/config.py) | `Settings` dataclass from env vars |
| **security** | [`security.py`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/security.py) | Per-request auth middleware |
| **ingestion** | [`ingestion/`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/ingestion) | Document upload, OCR, text extraction |
| **db** | [`db/`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/db) | SQLite repository, FTS5 search, migrations |
| **ai** | [`ai/`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/ai) | Groq provider, summarization, extraction, chunking |
| **api** | [`api/`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/api) | FastAPI routers (health, documents, ai, version) |

### Shared GroqProvider

A **single `GroqProvider` instance** ([`groq_provider.py`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/backend/app/ai/groq_provider.py)) is shared between `SummarizationService` and `ExtractionService`. This ensures:
- API key changes via Settings UI apply to both services immediately
- Key is persisted to `TRANSFORMO_DATA_DIR/.env` (survives app restarts)

---

## 6. Frontend Architecture

```mermaid
graph TB
    subgraph "React SPA (Vite-built)"
        MAIN_JSX["main.jsx"]
        APP["App.jsx"]
        subgraph "Pages"
            DASH["DashboardPage"]
            DOC["DocumentsPage"]
            AIWS["AIWorkspacePage"]
            SETTINGS["SettingsPage"]
            OVERVIEW["OverviewPage"]
        end
        subgraph "Components"
            SIDEBAR["Sidebar"]
            UI["UI Kit (Button, Card, Badge...)"]
            BACKEND_FAIL["BackendFailure"]
            ABOUT["AboutDialog"]
        end
        subgraph "Hooks"
            HOOK["useBackendStatus"]
        end
    end
    
    MAIN_JSX --> APP
    APP --> SIDEBAR
    APP --> DASH
    APP --> DOC
    APP --> AIWS
    APP --> SETTINGS
    APP --> OVERVIEW
    APP --> HOOK
```

### Page routing

The app uses **state-based routing** (no React Router). [`App.jsx`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/src/App.jsx) manages the current page via `useState`:

| Page | Component | What it does |
|---|---|---|
| `dashboard` | [`DashboardPage`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/src/pages/DashboardPage.jsx) | Overview stats, recent docs, quick actions |
| `documents` | [`DocumentsPage`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/src/pages/DocumentsPage.jsx) | Document list, search, upload, delete |
| `ai-workspace` | [`AIWorkspacePage`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/src/pages/AIWorkspacePage.jsx) | AI summaries + field extraction |
| `settings` | [`SettingsPage`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/src/pages/SettingsPage.jsx) | API key config, theme, privacy info |
| `overview` | [`OverviewPage`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/src/pages/OverviewPage.jsx) | Backend status + system health |

### Keyboard shortcuts: `⌘K` → Documents, `⌘,` → Settings, `⌘/` → About

---

## 7. Data Flow — Document Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant React as React UI
    participant Electron as Electron Main
    participant FastAPI as Python Backend
    participant SQLite as SQLite DB
    participant Groq as Groq API

    User->>React: Drop/select files
    React->>Electron: documents:upload-buffer
    Electron->>FastAPI: POST /api/documents/upload
    FastAPI->>FastAPI: Validate file (type, size)
    FastAPI->>FastAPI: Extract text (PDF/DOCX/TXT)
    FastAPI->>SQLite: INSERT document + FTS5 index
    FastAPI-->>Electron: {id, title, status}
    Electron-->>React: Document card appears

    User->>React: Click "Generate Summary"
    React->>Electron: ai:generate-summary
    Electron->>FastAPI: POST /api/ai/summarize/{id}
    FastAPI->>FastAPI: Chunk text (TextChunker)
    FastAPI->>Groq: POST /openai/v1/chat/completions
    Groq-->>FastAPI: Summary text
    FastAPI->>SQLite: SAVE ai_results
    FastAPI-->>Electron: {summary}
    Electron-->>React: Summary displayed

    User->>React: Click "Extract Fields"
    React->>Electron: ai:extract-document
    Electron->>FastAPI: POST /api/ai/extract/{id}
    FastAPI->>Groq: POST /openai/v1/chat/completions
    Groq-->>FastAPI: Structured JSON
    FastAPI->>SQLite: SAVE ai_results
    FastAPI-->>React: {fields: [...]}
```

---

## 8. Data Storage Layout

All persistent data lives under `~/Library/Application Support/Transformo Docs/`:

```
~/Library/Application Support/Transformo Docs/
├── .env                     ← Groq API key (persisted by SettingsPage)
├── logs/
│   └── app.log              ← Electron file logger output
├── documents.db             ← SQLite database
│   ├── documents table      ← File metadata, status, text content
│   ├── documents_fts        ← FTS5 full-text search index
│   └── ai_results table     ← Summaries and extractions
└── storage/
    └── <uuid>/              ← Original uploaded files
        └── filename.pdf
```

> [!NOTE]
> In development mode, data is stored under `~/Library/Application Support/Transformo Docs Dev/` to keep it separate from the production installation.

---

## 9. Packaging Pipeline

```mermaid
flowchart TD
    subgraph "Step 1: Backend Binary"
        PY_SRC["Python source<br/>(backend/app/)"] --> PYINSTALLER["PyInstaller<br/>(backend.spec)"]
        PYINSTALLER --> BINARY["backend/dist/transformo-backend/<br/>(standalone binary + _internal/)"]
    end
    
    subgraph "Step 2: Frontend Bundle"
        REACT_SRC["React source<br/>(desktop/src/)"] --> VITE["Vite build"]
        VITE --> DIST["desktop/dist/<br/>(index.html + JS/CSS)"]
    end
    
    subgraph "Step 3: Electron App"
        DIST --> EB["electron-builder"]
        BINARY -->|"extraResources"| EB
        ELECTRON_SRC["Electron source<br/>(desktop/electron/)"] --> EB
        EB --> DMG["TransformoDocs-0.1.0-arm64.dmg"]
    end
    
    subgraph "Step 4: Bootstrap (optional)"
        SWIFT_SRC["Swift launcher<br/>(desktop/bootstrap/)"] --> SWIFTC["swiftc compile"]
        SWIFTC --> HDIUTIL["hdiutil create"]
        HDIUTIL --> BOOTSTRAP["*-bootstrap.dmg (308 KB)"]
    end
```

### Build commands:

```bash
# 1. Package Python backend
cd backend && python -m PyInstaller backend.spec --noconfirm

# 2. Build Vite + create DMG
cd desktop && npm run desktop:dist:mac

# 3. (Optional) Build bootstrap DMG
bash desktop/bootstrap/build_bootstrap_dmg.sh
```

---

## 10. Technology Stack Summary

| Layer | Technology | Version |
|---|---|---|
| **Desktop Shell** | Electron | 44.x |
| **Frontend** | React + Vite | React 19, Vite 8 |
| **Styling** | Tailwind CSS | v4 |
| **Icons** | Lucide React | 1.59+ |
| **Backend** | Python + FastAPI + Uvicorn | Python 3.11, FastAPI latest |
| **Database** | SQLite + FTS5 | Built-in |
| **AI Provider** | Groq Cloud API | OpenAI-compatible SDK |
| **AI Model** | `openai/gpt-oss-120b` | (configurable in Settings) |
| **Doc Parsing** | python-docx, PyPDF2, lxml | — |
| **Packaging** | PyInstaller + electron-builder | — |
| **Bootstrap Installer** | Native Swift (AppKit) | — |
| **Platform** | macOS 12+ (Apple Silicon arm64) | — |
