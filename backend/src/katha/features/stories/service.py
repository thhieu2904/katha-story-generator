"""Story management service (Phase 3A)."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from katha.features.characters.models import Character
from katha.features.config_data.models import ArtStyle, StoryBackbone, StoryGenre
from katha.features.stories.models import Story, StoryCharacter
from katha.features.stories.schemas import StoryCreate, StoryUpdate


async def create_story(session: AsyncSession, data: StoryCreate, created_by: UUID) -> Story:
    # Validate backbone_id
    backbone = await session.execute(
        select(StoryBackbone).where(StoryBackbone.id == data.backbone_id)
    )
    if not backbone.scalar_one_or_none():
        raise HTTPException(status_code=422, detail="Invalid backbone_id")

    # Validate genre_id
    genre = await session.execute(select(StoryGenre).where(StoryGenre.id == data.genre_id))
    if not genre.scalar_one_or_none():
        raise HTTPException(status_code=422, detail="Invalid genre_id")

    # Validate art_style_id
    art_style = await session.execute(select(ArtStyle).where(ArtStyle.id == data.art_style_id))
    if not art_style.scalar_one_or_none():
        raise HTTPException(status_code=422, detail="Invalid art_style_id")

    # Validate character_ids
    chars = await session.execute(select(Character).where(Character.id.in_(data.character_ids)))
    if len(chars.scalars().all()) != len(data.character_ids):
        raise HTTPException(status_code=422, detail="Invalid character_ids")

    try:
        story = Story(
            description_vi=data.description_vi,
            backbone_id=data.backbone_id,
            genre_id=data.genre_id,
            art_style_id=data.art_style_id,
            target_age=data.target_age,
            length_pref=data.length_pref,
            status="draft",
            created_by=created_by,
        )
        session.add(story)
        await session.flush()

        for char_id in data.character_ids:
            session.add(StoryCharacter(story_id=story.id, character_id=char_id))

        await session.commit()
    except SQLAlchemyError:
        await session.rollback()
        raise

    story.character_ids = data.character_ids  # type: ignore[attr-defined]
    return story


async def list_stories(session: AsyncSession, include_archived: bool = False) -> list[Story]:
    query = select(Story)
    if not include_archived:
        query = query.where(Story.status != "archived")
    query = query.order_by(Story.created_at.desc(), Story.id.desc())

    result = await session.execute(query)
    return list(result.scalars().all())


async def get_story(session: AsyncSession, story_id: int) -> Story | None:
    result = await session.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if not story:
        return None

    chars_result = await session.execute(
        select(StoryCharacter.character_id).where(StoryCharacter.story_id == story_id)
    )
    story.character_ids = list(chars_result.scalars().all())  # type: ignore[attr-defined]
    return story


async def update_story(session: AsyncSession, story_id: int, data: StoryUpdate) -> Story:
    # NOTE: MVP uses last-write-wins for concurrent admin edits.
    # No row-level locking or conditional update in this phase.
    story = await get_story(session, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    if story.status != "draft":
        raise HTTPException(status_code=409, detail="Story setup is locked")

    if data.backbone_id is not None:
        backbone = await session.execute(
            select(StoryBackbone).where(StoryBackbone.id == data.backbone_id)
        )
        if not backbone.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Invalid backbone_id")

    if data.genre_id is not None:
        genre = await session.execute(select(StoryGenre).where(StoryGenre.id == data.genre_id))
        if not genre.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Invalid genre_id")

    if data.art_style_id is not None:
        art_style = await session.execute(select(ArtStyle).where(ArtStyle.id == data.art_style_id))
        if not art_style.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Invalid art_style_id")

    if data.character_ids is not None:
        chars = await session.execute(select(Character).where(Character.id.in_(data.character_ids)))
        if len(chars.scalars().all()) != len(data.character_ids):
            raise HTTPException(status_code=422, detail="Invalid character_ids")

    try:
        update_data = data.model_dump(exclude_unset=True, exclude={"character_ids"})
        for key, value in update_data.items():
            setattr(story, key, value)

        if data.character_ids is not None:
            # Replace character associations atomically
            await session.execute(delete(StoryCharacter).where(StoryCharacter.story_id == story.id))
            for char_id in data.character_ids:
                session.add(StoryCharacter(story_id=story.id, character_id=char_id))
            story.character_ids = data.character_ids  # type: ignore[attr-defined]

        story.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
        await session.flush()
        await session.commit()
    except SQLAlchemyError:
        await session.rollback()
        raise

    return story


async def archive_story(session: AsyncSession, story_id: int) -> Story:
    story = await get_story(session, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    if story.status == "archived":
        return story

    if story.status != "draft":
        raise HTTPException(
            status_code=409, detail="Only draft stories can be archived in this phase"
        )

    try:
        story.status = "archived"  # type: ignore[assignment]
        story.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
        await session.flush()
        await session.commit()
    except SQLAlchemyError:
        await session.rollback()
        raise

    return story
