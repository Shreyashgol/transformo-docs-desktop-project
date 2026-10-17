PHASE 08 — MACOS PRODUCTION PACKAGING AND DMG

Prepare Transformo Docs for distribution as a standalone macOS desktop application and generate a real .dmg installer.

First inspect the host environment, project configuration, target architecture, and existing build scripts. Build for the current supported Mac architecture unless the project explicitly requires another target.

A. Bundle the Python backend

1. Package the FastAPI backend using PyInstaller or an equivalent approach.
2. Include the Python runtime and all required dependencies.
3. Configure the backend as a standalone executable.
4. Resolve bundled resources and database paths correctly.
5. Ensure the backend executable and required resources are placed in Electron's application resources directory.
6. Do not bundle the user's documents, SQLite database, API keys, development virtual environment, or source secrets.
7. Verify all required parser libraries work in the packaged backend.

B. Electron integration

1. Update Electron's main process to launch the packaged backend executable in production.
2. Use the correct path under process.resourcesPath for packaged resources.
3. Preserve the development workflow separately.
4. Implement a robust readiness check and useful startup failure reporting.
5. Handle port conflicts safely. Prefer a dynamically assigned local port or another reliable local IPC strategy, with appropriate access controls.
6. Pass runtime configuration securely without exposing credentials to renderer content.
7. Terminate the child process correctly when the application exits.
8. Verify paths work when the app is installed in /Applications rather than the project directory.
9. Keep user data under the appropriate macOS per-user application-data directory.

C. electron-builder configuration

1. Configure the macOS application bundle and DMG target.
2. Set the correct application name, product name, bundle identifier, version, icon, and supported architecture.
3. Include the built frontend, Electron main/preload files, packaged backend, and only required production assets.
4. Exclude development dependencies, tests, temporary files, secrets, and local databases.
5. Configure appropriate macOS entitlements only if required.
6. Add scripts such as:
   - backend:package
   - desktop:build
   - desktop:dist:mac
   Adapt names to the repository's existing package scripts rather than duplicating conflicting scripts.

D. Build and verify

1. Run frontend production compilation.
2. Build the standalone Python backend.
3. Build the Electron application.
4. Generate the actual .dmg installer.
5. Confirm the DMG file exists and has a plausible nonzero size.
6. Inspect the DMG and mounted app contents.
7. Verify the packaged application launches from the installed .app bundle.
8. Verify the bundled backend starts without a separate Python installation or manual terminal command.
9. Import a sample PDF, extract text, search it, generate a summary using configured credentials, and extract structured data.
10. Verify local database persistence and application shutdown.
11. Inspect logs for missing resources, invalid paths, or backend startup failures.

E. Signing and distribution

- If signing and notarization credentials are configured, sign and notarize according to Apple's current requirements.
- If credentials are unavailable, generate an unsigned development/submission DMG and explicitly document the limitation.
- Never claim the app is signed, notarized, or compatible with another Mac architecture without verification.
- Do not bypass security controls or change system-wide security settings.

F. Deliverables

- The real .dmg installer.
- The built .app if useful for testing.
- A documented build command.
- A release note and known limitations.
- The exact absolute or repository-relative path and size of the generated DMG.
- Verification results for the packaged app.

If packaging fails, investigate and fix the root cause. Do not create a fake DMG or rename another archive to .dmg.

Stop only after reporting the actual build result and any unresolved blockers.