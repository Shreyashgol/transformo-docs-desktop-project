PHASE 09 — FINAL SUBMISSION AUDIT

Prepare the final Transformo Docs submission.

1. Locate the actual generated .dmg file and verify its existence and size.
2. Verify the DMG contains the intended application and opens correctly.
3. Install the application into /Applications on a compatible test Mac or use an appropriate clean test environment.
4. Launch the installed app without relying on the source repository, development server, Python virtual environment, or globally installed development dependencies.
5. Verify backend startup, document import, text extraction, search, AI summary generation, structured extraction, JSON/CSV export, persistence, and clean shutdown.
6. Verify the app uses a writable user-data directory and does not attempt to write into its read-only installation resources.
7. Confirm no API keys, test documents containing private information, local databases, debug files, or development credentials are embedded in the submission.
8. Verify application version, bundle identifier, product name, and architecture.
9. Document any signing/notarization limitations and any functionality that requires the user to configure an external AI provider.
10. Create docs/SUBMISSION_GUIDE.md with:
    - project overview
    - key features
    - technology stack
    - installation instructions
    - first-launch instructions
    - AI provider configuration
    - privacy notes
    - limitations
11. Create a final checklist with pass/fail status based on actual verification.
12. Provide the exact location and size of the final DMG.

Do not report a clean-install test as successful if it was not actually performed. Distinguish verified tests from tests that could not be performed.

The final deliverable must be the real .dmg installer, accompanied by the submission guide and a concise verification report. Do not add unrelated features at this stage.
