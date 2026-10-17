PHASE 04 — AI SUMMARIZATION

Implement AI-powered document summarization using a configurable LLM provider.

Requirements:

1. Create an AI provider abstraction so the model provider can be changed without rewriting the application.
2. Implement one real provider using its official SDK or API.
3. Keep credentials out of source code, frontend bundles, logs, and packaged resources.
4. Provide a settings interface for provider configuration.
5. Store credentials using secure operating-system-backed storage where practical. Do not persist API keys as plaintext in SQLite or localStorage.
6. Explain that hosted AI processing sends document text to the configured provider and require appropriate user consent.
7. Implement a summarization service with:
   - concise overview
   - key points
   - important dates or figures when present
   - configurable summary length if practical
8. Handle long documents by using bounded text extraction, sensible chunking, and a map-reduce or equivalent summarization strategy when needed.
9. Do not silently truncate large documents and claim to summarize the entire file.
10. Set reasonable timeouts and handle rate limits, invalid credentials, network failures, and provider errors.
11. Validate the response and reject malformed or empty outputs.
12. Save summaries as AI result records linked to the correct document and record the model/provider metadata.
13. Support regenerating a summary without accidentally duplicating or overwriting unrelated results.

UI:
- Add a Generate Summary action to the document detail screen.
- Show progress, cancellation where feasible, and clear error states.
- Display the summary and key points.
- Allow the user to regenerate and copy the summary.

Testing:
- Mock the provider for automated tests.
- Test long input, malformed responses, missing credentials, rate limits, and network errors.
- Do not require a live API key for the ordinary test suite.

Update README.md with provider setup and privacy implications. Do not implement structured extraction in this phase. Stop after Phase 04.