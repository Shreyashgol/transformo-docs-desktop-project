import pytest

from app.config import ConfigError, load_settings

VALID = {
    "TRANSFORMO_PORT": "50000",
    "TRANSFORMO_TOKEN": "a" * 64,
    "TRANSFORMO_DATA_DIR": "/var/empty/transformo-test",
}


def test_valid_settings():
    s = load_settings({**VALID, "TRANSFORMO_PARENT_PID": "123"})
    assert s.port == 50000
    assert s.parent_pid == 123
    assert str(s.log_dir).endswith("logs")


@pytest.mark.parametrize(
    "override",
    [
        {"TRANSFORMO_PORT": "abc"},
        {"TRANSFORMO_PORT": "80"},
        {"TRANSFORMO_PORT": "70000"},
        {"TRANSFORMO_TOKEN": "short"},
        {"TRANSFORMO_DATA_DIR": ""},
        {"TRANSFORMO_DATA_DIR": "relative/path"},
        {"TRANSFORMO_PARENT_PID": "nope"},
    ],
)
def test_invalid_settings(override):
    with pytest.raises(ConfigError):
        load_settings({**VALID, **override})


def test_missing_everything():
    with pytest.raises(ConfigError):
        load_settings({})
