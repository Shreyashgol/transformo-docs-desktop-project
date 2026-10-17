from app import API_VERSION, __version__
from tests.conftest import TEST_PORT


def test_health_ok_with_token(client, auth, settings):
    res = client.get("/health", headers=auth)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["version"] == __version__
    assert body["api_version"] == API_VERSION
    assert body["data_dir"] == str(settings.data_dir)
    assert body["data_dir_writable"] is True


def test_api_health_ok_with_token(client, auth, settings):
    res = client.get("/api/health", headers=auth)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"


def test_api_version_ok_with_token(client, auth):
    res = client.get("/api/version", headers=auth)
    assert res.status_code == 200
    body = res.json()
    assert body["version"] == __version__
    assert body["api_version"] == API_VERSION
    assert body["name"] == "Transformo Docs Backend"


def test_missing_token_rejected(client):
    assert client.get("/health").status_code == 401


def test_wrong_token_rejected(client):
    res = client.get("/health", headers={"X-Transformo-Token": "x" * 48})
    assert res.status_code == 401


def test_foreign_host_rejected(client, auth):
    # DNS-rebinding style request: correct token but non-loopback Host header.
    res = client.get("/health", headers={**auth, "Host": f"evil.example:{TEST_PORT}"})
    assert res.status_code == 400


def test_localhost_host_allowed(client, auth):
    res = client.get("/health", headers={**auth, "Host": f"localhost:{TEST_PORT}"})
    assert res.status_code == 200


def test_unknown_route_still_requires_token(client):
    assert client.get("/does-not-exist").status_code == 401


def test_api_docs_disabled(client, auth):
    assert client.get("/docs", headers=auth).status_code == 404
    assert client.get("/openapi.json", headers=auth).status_code == 404
