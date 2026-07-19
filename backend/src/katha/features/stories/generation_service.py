"""Transactional orchestration for Phase 3B story text generation."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import cast
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.config import get_settings
from katha.features.characters.models import Character
from katha.features.config_data.models import ArtStyle, StoryBackbone, StoryGenre
from katha.features.stories.generation_models import (
    AGE_RULES,
    ALLOWED_PAGE_COUNTS,
    CharacterSnapshot,
    DomainOutputError,
    GeneratedStoryVi,
    GenerationSnapshot,
    TranslatedStoryKm,
    validate_khmer,
    validate_vietnamese,
)
from katha.features.stories.models import Story, StoryCharacter, StoryPage
from katha.features.stories.prompts import build_khmer_prompt, build_vietnamese_prompt
from katha.features.stories.schemas import StoryTextResponse
from katha.integrations.openai_story_text import (
    ProviderOutputError,
    ProviderUnavailableError,
    StoryTextAI,
)

logger = logging.getLogger(__name__)
TEXT_READY_STATUSES = {
    "text_draft",
    "text_confirmed",
    "generating_images",
    "pending_review",
    "approved",
    "published",
}


async def generate_story_text(
    session: AsyncSession, story_id: int, provider: StoryTextAI
) -> StoryTextResponse:
    claim_id, snapshot = await _claim_generation(session, story_id)
    try:
        settings = get_settings()
        async with asyncio.timeout(settings.TEXT_OPERATION_TIMEOUT_SECONDS):
            vi_instructions, vi_prompt = build_vietnamese_prompt(snapshot)
            generated = await provider.generate_vietnamese(vi_instructions, vi_prompt)
            vietnamese = validate_vietnamese(generated, snapshot.target_age, snapshot.length_pref)
            km_instructions, km_prompt = build_khmer_prompt(vietnamese)
            translated = await provider.translate_khmer(km_instructions, km_prompt)
            khmer = validate_khmer(translated, vietnamese)
        return await _finalize_generation(session, story_id, claim_id, vietnamese, khmer)
    except TimeoutError as exc:
        await _reset_claim_safely(session, story_id, claim_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Story text generation timed out; please check story status before retrying",
        ) from exc
    except ProviderUnavailableError as exc:
        await _reset_claim_safely(session, story_id, claim_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Story text provider is temporarily unavailable",
        ) from exc
    except (ProviderOutputError, DomainOutputError) as exc:
        await _reset_claim_safely(session, story_id, claim_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Story text provider returned invalid content",
        ) from exc
    except Exception:
        await _reset_claim_safely(session, story_id, claim_id)
        raise


async def _claim_generation(
    session: AsyncSession, story_id: int
) -> tuple[UUID, GenerationSnapshot]:
    now = datetime.now(timezone.utc)
    story_result = await session.execute(
        select(Story).where(Story.id == story_id).with_for_update()
    )
    story = story_result.scalar_one_or_none()
    if story is None:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Story not found")

    if story.status == "generating_text":
        updated_at = story.updated_at
        if updated_at is not None and updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        stale_before = now - timedelta(seconds=get_settings().TEXT_GENERATION_STALE_SECONDS)
        if updated_at is not None and updated_at >= stale_before:
            await session.rollback()
            raise HTTPException(status_code=409, detail="Story text generation is already running")
    elif story.status != "draft":
        await session.rollback()
        raise HTTPException(status_code=409, detail="Story status does not allow text generation")

    snapshot = await _load_snapshot(session, story)
    claim_id = uuid4()
    story.status = "generating_text"  # type: ignore[assignment]
    story.text_generation_claim_id = claim_id  # type: ignore[assignment]
    story.updated_at = now  # type: ignore[assignment]
    await session.commit()
    return claim_id, snapshot


async def _load_snapshot(session: AsyncSession, story: Story) -> GenerationSnapshot:
    missing = [
        name
        for name, value in (
            ("backbone_id", story.backbone_id),
            ("genre_id", story.genre_id),
            ("art_style_id", story.art_style_id),
            ("target_age", story.target_age),
            ("length_pref", story.length_pref),
        )
        if value is None
    ]
    if missing:
        await session.rollback()
        raise HTTPException(status_code=422, detail=f"Incomplete story setup: {', '.join(missing)}")

    backbone_result = await session.execute(
        select(StoryBackbone).where(StoryBackbone.id == story.backbone_id)
    )
    genre_result = await session.execute(select(StoryGenre).where(StoryGenre.id == story.genre_id))
    art_style_result = await session.execute(
        select(ArtStyle).where(ArtStyle.id == story.art_style_id)
    )
    chars_result = await session.execute(
        select(Character)
        .join(StoryCharacter, StoryCharacter.character_id == Character.id)
        .where(StoryCharacter.story_id == story.id)
        .order_by(Character.id)
    )
    backbone = backbone_result.scalar_one_or_none()
    genre = genre_result.scalar_one_or_none()
    art_style = art_style_result.scalar_one_or_none()
    characters = list(chars_result.scalars().all())
    if (
        backbone is None
        or genre is None
        or art_style is None
        or story.target_age not in AGE_RULES
        or story.length_pref not in ALLOWED_PAGE_COUNTS
        or len(story.description_vi.strip()) < 10
        or len(characters) not in {2, 3}
    ):
        await session.rollback()
        raise HTTPException(status_code=422, detail="Story setup references are invalid")

    return GenerationSnapshot(
        story_id=cast(int, story.id),
        description_vi=cast(str, story.description_vi),
        backbone_prompt_en=cast(str, backbone.prompt_template_en),
        genre_prompt_en=cast(str, genre.prompt_modifier_en),
        target_age=cast(str, story.target_age),
        length_pref=cast(str, story.length_pref),
        characters=tuple(
            CharacterSnapshot(
                name=cast(str, character.name),
                age=cast(int | None, character.age),
                personality_vi=cast(str | None, character.personality_vi),
                appearance_vi=cast(str | None, character.appearance_vi),
                appearance_prompt_en=cast(str, character.appearance_prompt_en),
            )
            for character in characters
        ),
    )


async def _finalize_generation(
    session: AsyncSession,
    story_id: int,
    claim_id: UUID,
    vietnamese: GeneratedStoryVi,
    khmer: TranslatedStoryKm,
) -> StoryTextResponse:
    story_result = await session.execute(
        select(Story).where(Story.id == story_id).with_for_update()
    )
    story = story_result.scalar_one_or_none()
    if (
        story is None
        or story.status != "generating_text"
        or story.text_generation_claim_id != claim_id
    ):
        await session.rollback()
        raise HTTPException(status_code=409, detail="Story generation claim is no longer current")

    await session.execute(delete(StoryPage).where(StoryPage.story_id == story_id))
    khmer_by_page = {page.page_no: page.text_km for page in khmer.pages}
    pages: list[StoryPage] = []
    for page in vietnamese.pages:
        model = StoryPage(
            story_id=story_id,
            page_no=page.page_no,
            text_vi=page.text_vi,
            text_km=khmer_by_page[page.page_no],
            spellcheck_flags=[],
        )
        session.add(model)
        pages.append(model)

    now = datetime.now(timezone.utc)
    story.title_vi = vietnamese.title_vi  # type: ignore[assignment]
    story.title_km = khmer.title_km  # type: ignore[assignment]
    story.status = "text_draft"  # type: ignore[assignment]
    story.text_revision = 1  # type: ignore[assignment]
    story.text_generation_claim_id = None  # type: ignore[assignment]
    story.updated_at = now  # type: ignore[assignment]
    await session.flush()
    character_ids = await _load_character_ids(session, story_id)
    response = _to_text_response(story, pages, character_ids)
    await session.commit()
    return response


async def _reset_claim_safely(session: AsyncSession, story_id: int, claim_id: UUID) -> None:
    try:
        await session.rollback()
        result = await session.execute(select(Story).where(Story.id == story_id).with_for_update())
        story = result.scalar_one_or_none()
        if (
            story is not None
            and story.status == "generating_text"
            and story.text_generation_claim_id == claim_id
        ):
            story.status = "draft"  # type: ignore[assignment]
            story.text_generation_claim_id = None  # type: ignore[assignment]
            story.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
            await session.commit()
        else:
            await session.rollback()
    except Exception:
        logger.exception("Failed to reset story generation claim", extra={"story_id": story_id})
        await session.rollback()


async def get_story_text(session: AsyncSession, story_id: int) -> StoryTextResponse:
    result = await session.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.status not in TEXT_READY_STATUSES:
        raise HTTPException(status_code=409, detail="Story text is not ready")

    pages_result = await session.execute(
        select(StoryPage).where(StoryPage.story_id == story_id).order_by(StoryPage.page_no)
    )
    pages = list(pages_result.scalars().all())
    if not story.title_vi or not story.title_km or not pages:
        raise HTTPException(status_code=409, detail="Story text is not ready")
    character_ids = await _load_character_ids(session, story_id)
    return _to_text_response(story, pages, character_ids)


async def _load_character_ids(session: AsyncSession, story_id: int) -> list[int]:
    result = await session.execute(
        select(StoryCharacter.character_id)
        .where(StoryCharacter.story_id == story_id)
        .order_by(StoryCharacter.character_id)
    )
    return list(result.scalars().all())


def _to_text_response(
    story: Story, pages: list[StoryPage], character_ids: list[int]
) -> StoryTextResponse:
    return StoryTextResponse.model_validate(
        {
            "id": story.id,
            "title_vi": story.title_vi,
            "title_km": story.title_km,
            "description_vi": story.description_vi,
            "target_age": story.target_age,
            "length_pref": story.length_pref,
            "status": story.status,
            "text_revision": story.text_revision,
            "character_ids": character_ids,
            "updated_at": story.updated_at,
            "pages": pages,
        }
    )
