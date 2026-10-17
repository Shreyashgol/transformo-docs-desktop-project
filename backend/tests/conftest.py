from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, ensure_data_dirs
from app.main import create_app

TEST_TOKEN = "t" * 48
TEST_PORT = 48123


@pytest.fixture
def settings(tmp_path) -> Settings:
    s = Settings(port=TEST_PORT, token=TEST_TOKEN, data_dir=tmp_path / "data")
    ensure_data_dirs(s)
    return s


@pytest.fixture
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings), base_url=f"http://127.0.0.1:{TEST_PORT}")


@pytest.fixture
def auth() -> dict[str, str]:
    return {"X-Transformo-Token": TEST_TOKEN}
