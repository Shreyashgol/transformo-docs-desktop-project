# Release Checklist

The status column records **actual verification results only**. Values: `—` not started · `PASS` · `FAIL` · `N/A` (with reason).

| # | Check | Phase | Status | Evidence / notes |
|---|---|---|---|---|
| 1 | Electron security: `contextIsolation` on, `nodeIntegration` off, sandbox, narrow preload API | 01 | — | |
| 2 | Backend spawns on a free port, token-protected, readiness check, clean shutdown | 01 | — | |
| 3 | PDF / DOCX / TXT import with extension, size, and content validation | 02 | — | |
| 4 | Text and metadata extraction correct for sample files | 02 | — | |
| 5 | SQLite persistence survives app restart | 03 | — | |
| 6 | Full-text search returns correct results and snippets | 03 | — | |
| 7 | AI summary (mocked tests) | 04 | — | |
| 8 | AI summary (live provider) | 04 | — | Requires API key |
| 9 | API key stored via safeStorage; absent from DB, logs, bundle | 04 | — | |
| 10 | Structured extraction: General / Invoice / Resume validated | 05 | — | |
| 11 | JSON and CSV export (CSV escaping verified) | 05 | — | |
| 12 | All screens with loading/empty/error states; a11y basics | 06 | — | |
| 13 | Frontend typecheck, lint, and production build pass | 06 | — | |
| 14 | Backend test suite passes | 06 | — | |
| 15 | PyInstaller backend runs standalone | 08 | — | |
| 16 | Real `.dmg` generated (path and size recorded) | 08 | — | |
| 17 | App launches from `/Applications`, data written to userData only | 08/09 | — | |
| 18 | No secrets, databases, or private documents in the bundle | 09 | — | |
| 19 | Version, bundle ID, product name, and arch verified | 09 | — | |
| 20 | Signing / notarisation status documented | 09 | — | |
