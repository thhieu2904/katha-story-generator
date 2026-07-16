"""Admin-only read endpoints for configuration data."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user
from katha.features.auth.schemas import TokenUser
from katha.features.config_data import service
from katha.features.config_data.models import ArtStyle, StoryBackbone, StoryGenre
from katha.features.config_data.schemas import ArtStyleOut, BackboneOut, GenreOut

router = APIRouter()


@router.get("/backbones", response_model=list[BackboneOut])
async def read_backbones(
    session: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> list[StoryBackbone]:
    return await service.list_backbones(session)


@router.get("/genres", response_model=list[GenreOut])
async def read_genres(
    session: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> list[StoryGenre]:
    return await service.list_genres(session)


@router.get("/art-styles", response_model=list[ArtStyleOut])
async def read_art_styles(
    session: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> list[ArtStyle]:
    return await service.list_art_styles(session)
