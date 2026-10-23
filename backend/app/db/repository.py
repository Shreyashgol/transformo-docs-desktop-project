from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import re
import sqlite3
from typing import Any

from pydantic import BaseModel, Field

from app.models import DocumentDetail, DocumentMetadata

logger = logging.getLogger("transformo.db.repository")


class DocumentListItem(BaseModel):
    metadata: DocumentMetadata
    snippet: str | None = None


class PaginatedDocuments(BaseModel):
    items: list[DocumentListItem]
    total_count: int
    page: int
    page_size: int
    total_pages: int


def sanitize_fts_query(query: str) -> str:
    """Sanitize user query for SQLite FTS5 prefix match search."""
    tokens = re.findall(r"[\w]+", query)
    if not tokens:
        return ""
    # Safe prefix matching for each term: "word"*
    return " AND ".join(f'"{token}"*' for token in tokens)


class DocumentRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def find_by_content_hash(self, content_hash: str) -> DocumentMetadata | None:
        row = self.conn.execute(
            "SELECT * FROM documents WHERE content_hash = ? LIMIT 1;",
            (content_hash,),
        ).fetchone()
        if not row:
            return None
        return self._row_to_metadata(row)

    def create_document(
        self,
        doc_id: str,
        original_filename: str,
        extension: str,
        file_size_bytes: int,
        content_hash: str,
        stored_path: str,
        page_count: int,
        extracted_text: str,
        format_metadata: dict[str, Any] | None = None,
        warnings: list[str] | None = None,
        is_scanned: bool = False,
        status: str = "completed",
        error_message: str | None = None,
    ) -> DocumentDetail:
        now = datetime.now(timezone.utc).isoformat()
        format_json = json.dumps(format_metadata or {})
        warnings_json = json.dumps(warnings or [])
        char_count = len(extracted_text)
        word_count = len(extracted_text.split())

        with self.conn:
            self.conn.execute(
                """
                INSERT INTO documents (
                    id, original_filename, extension, file_size_bytes, content_hash,
                    stored_path, page_count, status, error_message, format_metadata,
                    warnings, is_scanned, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    doc_id,
                    original_filename,
                    extension,
                    file_size_bytes,
                    content_hash,
                    stored_path,
                    page_count,
                    status,
                    error_message,
                    format_json,
                    warnings_json,
                    1 if is_scanned else 0,
                    now,
                    now,
                ),
            )
            self.conn.execute(
                """
                INSERT INTO document_contents (
                    document_id, extracted_text, char_count, word_count
                ) VALUES (?, ?, ?, ?);
                """,
                (doc_id, extracted_text, char_count, word_count),
            )

        metadata = DocumentMetadata(
            id=doc_id,
            original_filename=original_filename,
            extension=extension,
            file_size_bytes=file_size_bytes,
            content_hash=content_hash,
            page_count=page_count,
            created_at=now,
            format_metadata=format_metadata or {},
            warnings=warnings or [],
            is_scanned=is_scanned,
        )
        return DocumentDetail(metadata=metadata, extracted_text=extracted_text)

    def get_document(self, doc_id: str) -> DocumentDetail | None:
        row = self.conn.execute(
            """
            SELECT d.*, c.extracted_text
            FROM documents d
            LEFT JOIN document_contents c ON d.id = c.document_id
            WHERE d.id = ?;
            """,
            (doc_id,),
        ).fetchone()
        if not row:
            return None

        metadata = self._row_to_metadata(row)
        return DocumentDetail(
            metadata=metadata,
            extracted_text=row["extracted_text"] or "",
        )

    def list_documents(
        self,
        query: str | None = None,
        extension: str | None = None,
        status: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedDocuments:
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        offset = (page - 1) * page_size

        fts_query = sanitize_fts_query(query) if query and query.strip() else None

        allowed_sort_fields = {
            "created_at": "d.created_at",
            "filename": "d.original_filename",
            "size": "d.file_size_bytes",
            "pages": "d.page_count",
        }
        order_col = allowed_sort_fields.get(sort_by, "d.created_at")
        order_dir = "ASC" if sort_order.lower() == "asc" else "DESC"

        conditions: list[str] = []
        params: list[Any] = []

        if extension:
            ext = extension.lower() if extension.startswith(".") else f".{extension.lower()}"
            conditions.append("d.extension = ?")
            params.append(ext)

        if status:
            if status == "scanned":
                conditions.append("d.is_scanned = 1")
            else:
                conditions.append("d.status = ?")
                params.append(status)

        if fts_query:
            # Full-Text Search using FTS5
            where_sql = " AND ".join(conditions)
            if where_sql:
                where_sql = f"AND {where_sql}"

            count_sql = f"""
                SELECT COUNT(*) as count
                FROM documents_fts fts
                JOIN documents d ON d.id = fts.document_id
                WHERE documents_fts MATCH ? {where_sql};
            """
            count_params = [fts_query] + params
            total_count = self.conn.execute(count_sql, count_params).fetchone()["count"]

            select_sql = f"""
                SELECT
                    d.*,
                    snippet(documents_fts, 2, '<mark>', '</mark>', '…', 15) as fts_snippet
                FROM documents_fts fts
                JOIN documents d ON d.id = fts.document_id
                WHERE documents_fts MATCH ? {where_sql}
                ORDER BY {order_col} {order_dir}
                LIMIT ? OFFSET ?;
            """
            select_params = [fts_query] + params + [page_size, offset]
            rows = self.conn.execute(select_sql, select_params).fetchall()
        else:
            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

            count_sql = f"SELECT COUNT(*) as count FROM documents d {where_clause};"
            total_count = self.conn.execute(count_sql, params).fetchone()["count"]

            select_sql = f"""
                SELECT d.*, NULL as fts_snippet
                FROM documents d
                {where_clause}
                ORDER BY {order_col} {order_dir}
                LIMIT ? OFFSET ?;
            """
            select_params = params + [page_size, offset]
            rows = self.conn.execute(select_sql, select_params).fetchall()

        items = [
            DocumentListItem(
                metadata=self._row_to_metadata(r),
                snippet=r["fts_snippet"],
            )
            for r in rows
        ]
        total_pages = max(1, (total_count + page_size - 1) // page_size) if total_count > 0 else 1

        return PaginatedDocuments(
            items=items,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def delete_document(self, doc_id: str) -> str | None:
        """Deletes document record from database. Returns stored_path if found."""
        row = self.conn.execute("SELECT stored_path FROM documents WHERE id = ?;", (doc_id,)).fetchone()
        if not row:
            return None
        stored_path = row["stored_path"]
        with self.conn:
            self.conn.execute("DELETE FROM documents WHERE id = ?;", (doc_id,))
        return stored_path

    def get_stats(self) -> dict[str, int]:
        def _count(sql: str, params: tuple = ()) -> int:
            row = self.conn.execute(sql, params).fetchone()
            if row is None:
                return 0
            val = row[0] if not hasattr(row, "keys") else (row["count"] if "count" in row.keys() else row[0])
            return int(val) if val is not None else 0

        def _sum(sql: str) -> int:
            row = self.conn.execute(sql).fetchone()
            if row is None:
                return 0
            val = row[0] if not hasattr(row, "keys") else (row["total"] if "total" in row.keys() else row[0])
            return int(val) if val is not None else 0

        return {
            "total_documents":      _count("SELECT COUNT(*) as count FROM documents;"),
            "scanned_documents":    _count("SELECT COUNT(*) as count FROM documents WHERE is_scanned = 1;"),
            "ready_documents":      _count("SELECT COUNT(*) as count FROM documents WHERE status = 'completed';"),
            "summaries_generated":  _count("SELECT COUNT(DISTINCT document_id) as count FROM ai_results WHERE type = 'summary';"),
            "extractions_generated": _count("SELECT COUNT(DISTINCT document_id) as count FROM ai_results WHERE type LIKE 'extraction%';"),
            "total_storage_bytes":  _sum("SELECT COALESCE(SUM(file_size_bytes), 0) as total FROM documents;"),
            "pdf_count":            _count("SELECT COUNT(*) as count FROM documents WHERE extension = '.pdf';"),
            "docx_count":           _count("SELECT COUNT(*) as count FROM documents WHERE extension = '.docx';"),
            "txt_count":            _count("SELECT COUNT(*) as count FROM documents WHERE extension = '.txt';"),
        }

    def _row_to_metadata(self, row: sqlite3.Row) -> DocumentMetadata:
        format_meta = {}
        if row["format_metadata"]:
            try:
                format_meta = json.loads(row["format_metadata"])
            except Exception:
                pass

        warnings_list = []
        if row["warnings"]:
            try:
                warnings_list = json.loads(row["warnings"])
            except Exception:
                pass

        return DocumentMetadata(
            id=row["id"],
            original_filename=row["original_filename"],
            extension=row["extension"],
            file_size_bytes=row["file_size_bytes"],
            content_hash=row["content_hash"],
            page_count=row["page_count"],
            created_at=row["created_at"],
            format_metadata=format_meta,
            warnings=warnings_list,
            is_scanned=bool(row["is_scanned"]),
        )
