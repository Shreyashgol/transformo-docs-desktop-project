from __future__ import annotations

from datetime import datetime, timezone
import logging
import sqlite3

logger = logging.getLogger("transformo.db.schema")

CURRENT_SCHEMA_VERSION = 1

MIGRATION_V1 = """
-- Version 1: Core document tables and FTS5 search index

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    original_filename TEXT NOT NULL,
    extension TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    stored_path TEXT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'completed',
    error_message TEXT,
    format_metadata TEXT NOT NULL DEFAULT '{}',
    warnings TEXT NOT NULL DEFAULT '[]',
    is_scanned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_extension ON documents(extension);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

CREATE TABLE IF NOT EXISTS document_contents (
    document_id TEXT PRIMARY KEY,
    extracted_text TEXT NOT NULL,
    char_count INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_results (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_results_doc_type ON ai_results(document_id, type);

-- Full-Text Search (FTS5) table
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    document_id UNINDEXED,
    filename,
    content,
    tokenize = 'porter unicode61'
);

-- Triggers to maintain FTS5 synchronization
CREATE TRIGGER IF NOT EXISTS trg_documents_contents_insert AFTER INSERT ON document_contents
BEGIN
    INSERT INTO documents_fts (document_id, filename, content)
    SELECT
        new.document_id,
        d.original_filename,
        new.extracted_text
    FROM documents d
    WHERE d.id = new.document_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_delete AFTER DELETE ON documents
BEGIN
    DELETE FROM documents_fts WHERE document_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_update AFTER UPDATE OF original_filename ON documents
BEGIN
    UPDATE documents_fts
    SET filename = new.original_filename
    WHERE document_id = new.id;
END;
"""


def init_db(conn: sqlite3.Connection) -> None:
    """Initialize database and apply versioned migrations."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
        """
    )

    row = conn.execute("SELECT MAX(version) as max_v FROM schema_migrations").fetchone()
    current_v = row["max_v"] if row and row["max_v"] is not None else 0

    if current_v < 1:
        logger.info("Applying database migration V1...")
        conn.executescript(MIGRATION_V1)
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
            (1, now),
        )
        logger.info("Database migration V1 applied successfully.")
