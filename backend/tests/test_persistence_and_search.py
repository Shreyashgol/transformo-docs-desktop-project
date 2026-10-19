import pytest
from app.db.connection import connect_db, get_db_path
from app.db.repository import DocumentRepository
from app.db.schema import init_db
from app.ingestion.service import IngestionService


def test_persistence_across_reconnection(tmp_path):
    db_path = tmp_path / "test.db"

    # First session: connect, init schema, and insert document
    conn1 = connect_db(db_path)
    init_db(conn1)
    repo1 = DocumentRepository(conn1)

    repo1.create_document(
        doc_id="doc_persist1",
        original_filename="financial_report.pdf",
        extension=".pdf",
        file_size_bytes=1024,
        content_hash="hash1234567890",
        stored_path=str(tmp_path / "dummy.pdf"),
        page_count=3,
        extracted_text="Q3 revenue increased by 25 percent driven by enterprise SaaS subscriptions.",
    )
    conn1.close()

    # Second session: reconnect and verify data persists
    conn2 = connect_db(db_path)
    init_db(conn2)
    repo2 = DocumentRepository(conn2)

    doc = repo2.get_document("doc_persist1")
    assert doc is not None
    assert doc.metadata.original_filename == "financial_report.pdf"
    assert "Q3 revenue increased by 25 percent" in doc.extracted_text
    conn2.close()


def test_fts5_search_and_snippets(tmp_path):
    db_path = tmp_path / "test.db"
    conn = connect_db(db_path)
    init_db(conn)
    repo = DocumentRepository(conn)

    repo.create_document(
        doc_id="doc_1",
        original_filename="invoice_acme.pdf",
        extension=".pdf",
        file_size_bytes=2048,
        content_hash="h1",
        stored_path=str(tmp_path / "f1.pdf"),
        page_count=1,
        extracted_text="Invoice #9901 from Acme Corporation for consulting services totaling $5,000.",
    )
    repo.create_document(
        doc_id="doc_2",
        original_filename="resume_john.docx",
        extension=".docx",
        file_size_bytes=4096,
        content_hash="h2",
        stored_path=str(tmp_path / "f2.docx"),
        page_count=2,
        extracted_text="John Doe Software Engineer with extensive experience in Python, FastAPI, and Electron.",
    )

    # Search for "Acme"
    res1 = repo.list_documents(query="Acme")
    assert res1.total_count == 1
    assert res1.items[0].metadata.id == "doc_1"
    assert "<mark>Acme</mark>" in res1.items[0].snippet

    # Search for "FastAPI" (case-insensitive)
    res2 = repo.list_documents(query="fastapi")
    assert res2.total_count == 1
    assert res2.items[0].metadata.id == "doc_2"
    assert "<mark>FastAPI</mark>" in res2.items[0].snippet

    # Search query matching both or non-matching
    res_none = repo.list_documents(query="NonExistentKeyword999")
    assert res_none.total_count == 0

    # Malformed search query safety (unclosed quotes, symbols)
    res_safe = repo.list_documents(query='"""(())):::;;;!!! Acme ???')
    assert res_safe.total_count == 1
    assert res_safe.items[0].metadata.id == "doc_1"

    conn.close()


def test_filtering_and_sorting(tmp_path):
    db_path = tmp_path / "test.db"
    conn = connect_db(db_path)
    init_db(conn)
    repo = DocumentRepository(conn)

    repo.create_document(
        doc_id="doc_a",
        original_filename="alpha.txt",
        extension=".txt",
        file_size_bytes=100,
        content_hash="ha",
        stored_path=str(tmp_path / "a.txt"),
        page_count=1,
        extracted_text="Alpha content",
        is_scanned=False,
    )
    repo.create_document(
        doc_id="doc_b",
        original_filename="beta.pdf",
        extension=".pdf",
        file_size_bytes=500,
        content_hash="hb",
        stored_path=str(tmp_path / "b.pdf"),
        page_count=5,
        extracted_text="Beta content",
        is_scanned=True,
    )

    # Filter by extension
    txt_docs = repo.list_documents(extension=".txt")
    assert txt_docs.total_count == 1
    assert txt_docs.items[0].metadata.id == "doc_a"

    # Filter by scanned status
    scanned_docs = repo.list_documents(status="scanned")
    assert scanned_docs.total_count == 1
    assert scanned_docs.items[0].metadata.id == "doc_b"

    # Sort by filename asc
    sorted_asc = repo.list_documents(sort_by="filename", sort_order="asc")
    assert sorted_asc.items[0].metadata.original_filename == "alpha.txt"
    assert sorted_asc.items[1].metadata.original_filename == "beta.pdf"

    # Sort by size desc
    sorted_size = repo.list_documents(sort_by="size", sort_order="desc")
    assert sorted_size.items[0].metadata.file_size_bytes == 500

    conn.close()


def test_pagination(tmp_path):
    db_path = tmp_path / "test.db"
    conn = connect_db(db_path)
    init_db(conn)
    repo = DocumentRepository(conn)

    for i in range(5):
        repo.create_document(
            doc_id=f"doc_{i}",
            original_filename=f"file_{i}.txt",
            extension=".txt",
            file_size_bytes=100 + i,
            content_hash=f"hash_{i}",
            stored_path=str(tmp_path / f"{i}.txt"),
            page_count=1,
            extracted_text=f"Text for document {i}",
        )

    # Page 1, size 2
    p1 = repo.list_documents(page=1, page_size=2, sort_by="filename", sort_order="asc")
    assert p1.total_count == 5
    assert p1.total_pages == 3
    assert len(p1.items) == 2
    assert p1.items[0].metadata.id == "doc_0"
    assert p1.items[1].metadata.id == "doc_1"

    # Page 2, size 2
    p2 = repo.list_documents(page=2, page_size=2, sort_by="filename", sort_order="asc")
    assert len(p2.items) == 2
    assert p2.items[0].metadata.id == "doc_2"
    assert p2.items[1].metadata.id == "doc_3"

    conn.close()


def test_api_deletion_flow(client, auth):
    # Import a document via API
    content = b"Content to be deleted."
    files = {"file": ("delete_me.txt", content, "text/plain")}
    res = client.post("/api/documents/import", headers=auth, files=files)
    assert res.status_code == 201
    doc_id = res.json()["metadata"]["id"]

    # Verify search finds it
    search_res = client.get("/api/documents?q=deleted", headers=auth)
    assert search_res.status_code == 200
    assert any(item["metadata"]["id"] == doc_id for item in search_res.json()["items"])

    # Delete it
    del_res = client.delete(f"/api/documents/{doc_id}", headers=auth)
    assert del_res.status_code == 204

    # Verify 404 on get
    get_res = client.get(f"/api/documents/{doc_id}", headers=auth)
    assert get_res.status_code == 404

    # Verify search no longer finds it
    search_after = client.get("/api/documents?q=deleted", headers=auth)
    assert not any(item["metadata"]["id"] == doc_id for item in search_after.json()["items"])


def test_api_stats(client, auth):
    res = client.get("/api/documents/stats", headers=auth)
    assert res.status_code == 200
    body = res.json()
    assert "total_documents" in body
    assert "scanned_documents" in body
    assert "ready_documents" in body
