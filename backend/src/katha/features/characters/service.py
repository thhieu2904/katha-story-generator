"""Read-only Character Bank queries."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from katha.features.characters.models import Character


async def list_characters(session: AsyncSession) -> list[Character]:
    result = await session.execute(select(Character).order_by(Character.id.asc()))
    return list(result.scalars().all())


async def get_character(session: AsyncSession, character_id: int) -> Character | None:
    result = await session.execute(select(Character).where(Character.id == character_id))
    return result.scalar_one_or_none()
