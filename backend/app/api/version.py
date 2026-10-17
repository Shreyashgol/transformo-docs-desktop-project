from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app import API_VERSION, __version__

router = APIRouter()


class VersionResponse(BaseModel):
    version: str
    api_version: int
    name: str


@router.get("/api/version", response_model=VersionResponse)
def version() -> VersionResponse:
    return VersionResponse(
        version=__version__,
        api_version=API_VERSION,
        name="Transformo Docs Backend",
    )
