# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the Transformo Docs backend (macOS arm64).
# Build with:  pyinstaller backend.spec
# from the backend/ directory.

import sys
from pathlib import Path
import pymupdf  # resolve the package location at spec-analysis time

block_cipher = None

# ── collect all hidden imports needed at runtime ───────────────────────────────
hidden_imports = [
    # FastAPI / Starlette
    "fastapi",
    "fastapi.routing",
    "fastapi.middleware",
    "fastapi.middleware.cors",
    "fastapi.responses",
    "starlette.middleware",
    "starlette.middleware.base",
    "starlette.routing",
    "starlette.responses",
    "starlette.applications",
    "starlette.requests",
    "starlette.background",
    "starlette.staticfiles",
    # Uvicorn
    "uvicorn",
    "uvicorn.config",
    "uvicorn.main",
    "uvicorn.lifespan",
    "uvicorn.lifespan.off",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    # Pydantic
    "pydantic",
    "pydantic.json_schema",
    "pydantic_core",
    # PyMuPDF
    "pymupdf",
    "fitz",
    # python-docx
    "docx",
    "docx.oxml",
    "docx.oxml.ns",
    # Groq
    "groq",
    "groq._client",
    # python-dotenv
    "dotenv",
    # multipart
    "multipart",
    "python_multipart",
    # stdlib
    "sqlite3",
    "json",
    "logging",
    "hashlib",
    "threading",
    "signal",
    # app modules
    "app",
    "app.main",
    "app.config",
    "app.api.ai",
    "app.api.documents",
    "app.api.health",
    "app.api.version",
    "app.ai.base",
    "app.ai.chunking",
    "app.ai.extraction_models",
    "app.ai.extraction_service",
    "app.ai.groq_provider",
    "app.ai.models",
    "app.ai.service",
    "app.db.connection",
    "app.db.repository",
    "app.db.schema",
    "app.extraction.docx",
    "app.extraction.pdf",
    "app.extraction.registry",
    "app.extraction.txt",
    "app.ingestion.models",
    "app.ingestion.service",
    "app.logging_setup",
    "app.models",
    "app.security",
]

# ── collect PyMuPDF binary data ────────────────────────────────────────────────
pymupdf_dir = Path(pymupdf.__file__).parent
datas = [
    (str(pymupdf_dir), "pymupdf"),
]

a = Analysis(
    ["app/__main__.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "numpy",
        "PIL",
        "test",
        "tests",
        ".venv",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="transformo-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="transformo-backend",
)
