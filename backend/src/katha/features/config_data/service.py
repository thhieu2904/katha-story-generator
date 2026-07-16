"""Read-only queries for story configuration data."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from katha.features.config_data.models import ArtStyle, StoryBackbone, StoryGenre


async def list_backbones(session: AsyncSession) -> list[StoryBackbone]:
    result = await session.execute(select(StoryBackbone).order_by(StoryBackbone.id.asc()))
    return list(result.scalars().all())


async def list_genres(session: AsyncSession) -> list[StoryGenre]:
    result = await session.execute(select(StoryGenre).order_by(StoryGenre.id.asc()))
    return list(result.scalars().all())


async def list_art_styles(session: AsyncSession) -> list[ArtStyle]:
    result = await session.execute(select(ArtStyle).order_by(ArtStyle.id.asc()))
    return list(result.scalars().all())
