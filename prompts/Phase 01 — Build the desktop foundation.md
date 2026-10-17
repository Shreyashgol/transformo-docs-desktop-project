PHASE 01 — DESKTOP FOUNDATION

Implement the Transformo Docs desktop application foundation according to the approved implementation plan.

Requirements:

1. Configure Electron, React, TypeScript, Vite, and Tailwind CSS.
2. Create an Electron main process and a secure preload script.
3. Enable contextIsolation and disable nodeIntegration.
4. Expose only the minimum necessary desktop APIs through contextBridge.
5. Create a Python FastAPI backend with:
   - GET /api/health
   - GET /api/version
6. Add a reliable development workflow for launching the desktop app and backend.
7. Implement backend readiness checks rather than assuming the server is ready immediately.
8. Handle backend startup failure and provide useful error messages.
9. Implement the initial Transformo Docs window with a polished application shell, sidebar, header, and navigation.
10. Add routes or equivalent navigation for Dashboard, Documents, AI Workspace, and Settings.
11. Create a consistent theme, reusable buttons, cards, dialogs, and loading indicators.
12. Add scripts for development, type checking, testing, and building the frontend.
13. Document exact setup and startup commands in README.md.

Constraints:
- Do not implement document processing or AI features yet.
- Do not expose arbitrary shell execution or filesystem access to the renderer.
- Avoid unnecessary dependencies.
- Preserve existing working code.

Verification:
- Install dependencies using the repository's package manager.
- Start the backend and Electron app.
- Verify the health endpoint from the desktop application.
- Run TypeScript checks and available tests.
- Fix all errors introduced by this phase.

Report the files changed, commands executed, actual results, and any blockers. Stop after Phase 01.