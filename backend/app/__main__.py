"""Backend entry point: `python -m app` (development) or the packaged executable (production)."""

from __future__ import annotations

import logging
import os
import signal
import sys
import threading
import time

import uvicorn

from app import __version__
from app.config import ConfigError, Settings, ensure_data_dirs, load_settings
from app.logging_setup import configure_logging
from app.main import create_app

log = logging.getLogger("transformo")


def _watch_parent(parent_pid: int, interval: float = 2.0) -> None:
    """Shut down if the Electron parent disappears (e.g. it was force-killed)."""

    def run() -> None:
        while True:
            time.sleep(interval)
            if os.getppid() != parent_pid:
                log.warning("Parent process %s exited; shutting down", parent_pid)
                os.kill(os.getpid(), signal.SIGTERM)
                return

    threading.Thread(target=run, name="parent-watchdog", daemon=True).start()


def run(settings: Settings) -> None:
    ensure_data_dirs(settings)
    configure_logging(settings.log_dir)
    log.info("Starting Transformo backend %s on 127.0.0.1:%s", __version__, settings.port)

    if settings.parent_pid is not None:
        _watch_parent(settings.parent_pid)

    config = uvicorn.Config(
        create_app(settings),
        host="127.0.0.1",
        port=settings.port,
        log_config=None,
        access_log=False,
        server_header=False,
        date_header=False,
    )
    uvicorn.Server(config).run()
    log.info("Backend stopped")


def main() -> int:
    try:
        settings = load_settings()
    except ConfigError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 2
    run(settings)
    return 0


if __name__ == "__main__":
    sys.exit(main())
