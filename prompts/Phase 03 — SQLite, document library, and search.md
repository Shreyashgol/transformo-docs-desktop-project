PHASE 03 — PERSISTENT DOCUMENT MANAGEMENT

Implement persistent local document management and full-text search.

Database requirements:

1. Create a SQLite database in the per-user application-data directory.
2. Add migrations or a versioned schema initialization strategy.
3. Create tables for:
   - documents
   - extracted document contents
   - AI results
4. Enforce foreign keys, indexes, and appropriate uniqueness constraints.
5. Store extracted text and metadata separately from original file contents.
6. Track processing states such as pending, processing, completed, and failed.
7. Store error details safely without exposing secrets.
8. Ensure deleting a document removes related database records and, when requested, its managed local file.

Search requirements:

1. Implement full-text search using SQLite FTS5 if supported by the deployed SQLite build.
2. Search extracted content, not only filenames.
3. Support case-insensitive queries and relevant result snippets.
4. Escape or safely handle search syntax and malformed queries.
5. Add pagination and sorting to document listing.
6. Support filtering by file type, processing status, and date where practical.

Frontend requirements:

1. Build a document library with search, filters, sorting, and pagination.
2. Show filename, format, import date, processing status, and available actions.
3. Add document detail navigation.
4. Implement delete confirmation and clear success/error feedback.
5. Display useful empty states and search result counts.

Testing:
- Verify persistence across application restarts.
- Verify full-text search against document contents.
- Verify filtering, pagination, sorting, and deletion.
- Verify database initialization on a fresh user profile.
- Verify failed imports do not leave inconsistent records.

Keep database operations behind repository/service layers. Update documentation and run all relevant checks. Stop after Phase 03.