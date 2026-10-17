from __future__ import annotations

import os

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app import API_VERSION, __version__

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str
    api_version: int
    data_dir: str
    data_dir_writable: bool


@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    data_dir = request.app.state.settings.data_dir
    return HealthResponse(
        status="ok",
        version=__version__,
        api_version=API_VERSION,
        data_dir=str(data_dir),
        data_dir_writable=os.access(data_dir, os.W_OK),
    )
