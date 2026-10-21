# Transformo Docs — Release Readiness Checklist (Phase 07)

**Audit Date:** 2026-10-17  
**Auditor:** Phase 07 automated audit  
**Status: PASS — No blocking issues found**

---

## 1. Test Results

### Backend Tests

| Suite | Tests | Result |
|---|---|---|
| test_ai_summaries.py | 7 | PASS |
| test_config.py | 9 | PASS |
| test_extraction_and_ingestion.py | 13 | PASS |
| test_integration_phase07.py | 24 | PASS |
| test_persistence_and_search.py | 6 | PASS |
| test_security_and_health.py | 9 | PASS |
| test_structured_extraction.py | 8 | PASS |
| **Total** | **76 / 76** | **ALL PASS** |

### Frontend

| Check | Result |
|---|---|
| ESLint (zero errors) | PASS |
| Vite production build | PASS — 319 kB / 90 kB gzip |

---

## 2. Electron Security

| Control | Status | Evidence |
|---|---|---|
| contextIsolation: true | VERIFIED | electron/main.js line 72 |
| nodeIntegration: false | VERIFIED | electron/main.js line 73 |
| sandbox: true | VERIFIED | electron/main.js line 74 |
| webSecurity: true | VERIFIED | electron/main.js line 75 |
| devTools disabled in production | VERIFIED | !app.isPackaged gate |
| contextBridge exposeInMainWorld restricts surface | VERIFIED | electron/preload.cjs exposes named API only |
| All IPC handlers validate sender frame URL | VERIFIED | electron/ipc.js isTrustedRendererUrl() guard on every handle() |
| No arbitrary shell execution from renderer | VERIFIED | No shell.exec / child_process in IPC handlers |
| External URL opened via shell.openExternal only | VERIFIED | isSafeExternalUrl() filter in electron/trust.js |
| Renderer navigation restricted to trusted origins | VERIFIED | will-navigate + will-attach-webview handlers |
| Permission requests denied by default | VERIFIED | setPermissionRequestHandler returns false |
| Single-instance lock enforced | VERIFIED | app.requestSingleInstanceLock() |

---

## 3. Backend Security

| Control | Status | Evidence |
|---|---|---|
| Bearer token authentication on every request | VERIFIED | LocalAuthMiddleware applied in app/main.py |
| DNS-rebinding protection (Host header check) | VERIFIED | test_foreign_host_rejected passes |
| Interactive API docs disabled | VERIFIED | docs_url=None, redoc_url=None, openapi_url=None |
| Upload size limit (50 MB) | VERIFIED | MAX_FILE_SIZE_BYTES in ingestion/service.py; 413 in tests |
| Extension allowlist (.pdf, .docx, .txt only) | VERIFIED | ALLOWED_EXTENSIONS; 400 on .xlsx, .png, etc. |
| File content signature validation (magic bytes) | VERIFIED | validate_file_content() checks PDF header, DOCX ZIP magic, TXT null-byte scan |
| Parameterized SQL everywhere | VERIFIED | All queries use ? placeholders; no string interpolation |
| FTS5 query sanitisation | VERIFIED | _sanitize_fts_query() in db/repository.py; fuzz test passes |
| Duplicate detection via SHA-256 content hash | VERIFIED | 409 on re-import verified in tests |
| Safe error responses (no stack traces to client) | VERIFIED | Exceptions mapped to typed HTTP codes |
| Document files stored with mode 0o700 | VERIFIED | docs_dir.mkdir(mode=0o700) in ingestion/service.py |
| Stored files use content-hash filename | VERIFIED | stored_path = docs_dir / f"{content_hash}{ext}" |
| Document ID derived from hash, not user input | VERIFIED | generate_document_id(content_hash) |
| Path traversal impossible in doc-ID routes | VERIFIED | encodeURIComponent(docId) in IPC; path param not used as fs path |

---

## 4. Secrets Management

| Check | Status | Notes |
|---|---|---|
| backend/.env excluded from Git | PASS | .gitignore has .env and .env.* |
| .env never appears in git history | PASS | git log returns empty |
| .env.example committed (no real values) | PASS | Contains placeholder descriptions only |
| API key not embedded in Vite bundle | PASS | Key is read server-side only; no VITE_GROQ_* vars |
| API key not present in Electron logs | PASS | Logger writes process events only |
| *.pem, *.key, *.p12 excluded | PASS | Covered in .gitignore |

---

## 5. AI Consent and Privacy

| Check | Status |
|---|---|
| User consent required before any AI call | PASS — SummarizationService checks user_consent flag |
| Consent persisted to SQLite | PASS |
| Settings page shows current AI provider/model info | PASS |
| About dialog describes data flow and academic scope | PASS |
| Privacy messaging in AI Workspace onboarding banner | PASS |

---

## 6. Data Storage Location

| Check | Status | Path |
|---|---|---|
| User documents stored outside install dir | PASS | app.getPath('userData') -> ~/Library/Application Support/Transformo Docs/ |
| Dev data separated from production data | PASS | "Transformo Docs Dev" suffix in dev mode |
| SQLite database in userData, not app path | PASS | get_db_path(settings.data_dir) |
| SQLite and document files excluded from Git | PASS | *.sqlite, *.db, .data/ in .gitignore |

---

## 7. Application Lifecycle Tests

| Scenario | Status |
|---|---|
| Import -> summary -> extract -> export JSON | PASS: test_full_workflow_txt |
| Import -> summary -> extract -> export CSV | PASS: test_full_workflow_docx |
| Repeated import of same file returns 409 | PASS: test_upload_repeated_import_returns_409 |
| Persistence across simulated restarts | PASS: test_sqlite_persistence_across_restarts |
| Failed backend startup | PASS: BackendManager emits error status; UI shows error banner |
| Graceful shutdown | PASS: before-quit handler in electron/main.js |

---

## 8. Dependency Vulnerability Audit

| Tool | Scope | Result |
|---|---|---|
| npm audit | Node / Electron / React | 0 vulnerabilities |
| pip-audit | Python backend (requirements.txt) | No known vulnerabilities found |

---

## 9. Warnings / Minor Items (Non-Blocking)

| Item | Severity | Notes |
|---|---|---|
| HTTP_413_REQUEST_ENTITY_TOO_LARGE deprecation | Low | FastAPI/Starlette renamed to HTTP_413_CONTENT_TOO_LARGE. Still works; update at next dep bump. |
| httpx + starlette.testclient deprecation | Low | Test-only warning. Switch to httpx2 when upgrading Starlette. |
| Groq model openai/gpt-oss-120b in .env | Info | Non-standard model path; verify with Groq dashboard before production release. |
| Scanned PDFs produce empty extraction | Info | OCR deferred to future phase. In-app warning shown to user. |

---

## 10. Blocking Issues

None. All essential workflow tests pass. The application is ready for packaging review.

---

## 11. Pre-Packaging Checklist

Before running electron-builder:

- [ ] Set TRANSFORMO_PYTHON to the bundled Python interpreter path
- [ ] Verify backend-command.js resolves correct binary path for macOS arm64 / x64
- [ ] Replace .env with production key (never commit)
- [ ] Confirm Groq model name is valid in production environment
- [ ] Run npm run build -> confirm clean build
- [ ] Run pytest -> confirm 76/76 pass
- [ ] Sign and notarise the macOS .app bundle (Apple Developer ID required)
