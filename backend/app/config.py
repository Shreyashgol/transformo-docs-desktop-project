"""Runtime configuration supplied by the Electron main process via environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

MIN_TOKEN_LENGTH = 32


class ConfigError(ValueError):
    """Raised when the backend is started with missing or invalid configuration."""


@dataclass(frozen=True)
class Settings:
    port: int
    token: str
    data_dir: Path
    parent_pid: int | None = None

    @property
    def log_dir(self) -> Path:
        return self.data_dir / "logs"


def load_settings(env: dict[str, str] | None = None) -> Settings:
    env = dict(os.environ) if env is None else env

    raw_port = env.get("TRANSFORMO_PORT", "")
    try:
        port = int(raw_port)
    except ValueError as exc:
        raise ConfigError("TRANSFORMO_PORT must be an integer") from exc
    if not 1024 <= port <= 65535:
        raise ConfigError("TRANSFORMO_PORT must be between 1024 and 65535")

    token = env.get("TRANSFORMO_TOKEN", "")
    if len(token) < MIN_TOKEN_LENGTH:
        raise ConfigError(f"TRANSFORMO_TOKEN must be at least {MIN_TOKEN_LENGTH} characters")

    raw_dir = env.get("TRANSFORMO_DATA_DIR", "")
    if not raw_dir:
        raise ConfigError("TRANSFORMO_DATA_DIR is required")
    data_dir = Path(raw_dir).expanduser()
    if not data_dir.is_absolute():
        raise ConfigError("TRANSFORMO_DATA_DIR must be an absolute path")

    parent_pid: int | None = None
    if env.get("TRANSFORMO_PARENT_PID"):
        try:
            parent_pid = int(env["TRANSFORMO_PARENT_PID"])
        except ValueError as exc:
            raise ConfigError("TRANSFORMO_PARENT_PID must be an integer") from exc

    return Settings(port=port, token=token, data_dir=data_dir, parent_pid=parent_pid)


def ensure_data_dirs(settings: Settings) -> None:
    for path in (settings.data_dir, settings.log_dir):
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
