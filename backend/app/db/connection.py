from __future__ import annotations

from pathlib import Path
import sqlite3


def get_db_path(data_dir: Path) -> Path:
    return data_dir / "transformo.db"


def connect_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(
        str(db_path),
        timeout=30.0,
        check_same_thread=False,
        isolation_level=None,  # Autocommit mode by default; explicit transactions when needed
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn
