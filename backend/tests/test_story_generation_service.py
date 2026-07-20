"""State-machine tests for Phase 3B generation claims and atomic persistence."""

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.config import Settings
from katha.features.characters.models import Character
from katha.features.config_data.models import ArtStyle, StoryBackbone, StoryGenre
from katha.features.stories import generation_service
from katha.features.stories.generation_models import (
    GeneratedPageVi,
    GeneratedStoryVi,
    TranslatedPageKm,
    TranslatedStoryKm,
)
from katha.features.stories.models import Story, StoryPage
from katha.integrations.openai_story_text import ProviderOutputError


def scalar_result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def scalar_value(value):
    result = MagicMock()
    result.scalar_one.return_value = value
    return result


def scalars_result(values):
    result = MagicMock()
    result.scalars.return_value.all.return_value = values
    return result


def story_fixture(*, status: str = "draft", updated_at: datetime | None = None) -> Story:
    return Story(
        id=10,
        description_vi="Bé An và thỏ cùng tìm đường về nhà.",
        backbone_id=1,
        genre_id=2,
        art_style_id=3,
        target_age="preschool",
        length_pref="short",
        status=status,
        text_revision=0,
        updated_at=updated_at or datetime.now(timezone.utc),
    )


def reference_results() -> list[MagicMock]:
    backbone = StoryBackbone(
        id=1, name_vi="Ba hồi", name_en="Three act", prompt_template_en="Three acts"
    )
    genre = StoryGenre(id=2, name_vi="Ấm áp", name_en="Warm", prompt_modifier_en="Warm tone")
    art_style = ArtStyle(id=3, name_vi="Màu nước", name_en="Watercolor", prompt_modifier_en="")
    characters = [
        Character(id=1, name="An", age=6, appearance_prompt_en="short black hair"),
        Character(id=2, name="Thỏ", age=4, appearance_prompt_en="white rabbit"),
    ]
    return [
        scalar_result(backbone),
        scalar_result(genre),
        scalar_result(art_style),
        scalars_result(characters),
    ]


def draft_claim_results(story: Story, database_now: datetime) -> list[MagicMock]:
    return [scalar_result(story), *reference_results(), scalar_value(database_now)]


class SuccessfulProvider:
    async def generate_vietnamese(self, instructions: str, prompt: str) -> GeneratedStoryVi:
        return GeneratedStoryVi(
            title_vi="Đường về nhà",
            pages=[
                GeneratedPageVi(page_no=index, text_vi="An và Thỏ vui vẻ tìm đường về nhà.")
                for index in range(1, 5)
            ],
        )

    async def translate_khmer(self, instructions: str, prompt: str) -> TranslatedStoryKm:
        return TranslatedStoryKm(
            title_km="ផ្លូវទៅផ្ទះ",
            pages=[
                TranslatedPageKm(page_no=index, text_km="អាន និង ទន្សាយ រក ផ្លូវ ទៅ ផ្ទះ។")
                for index in range(1, 5)
            ],
        )


class GenerateFailureProvider(SuccessfulProvider):
    async def generate_vietnamese(self, instructions: str, prompt: str) -> GeneratedStoryVi:
        raise ProviderOutputError("refused")


class TranslationFailureProvider(SuccessfulProvider):
    async def translate_khmer(self, instructions: str, prompt: str) -> TranslatedStoryKm:
        raise ProviderOutputError("bad translation")


class SlowProvider(SuccessfulProvider):
    async def generate_vietnamese(self, instructions: str, prompt: str) -> GeneratedStoryVi:
        await asyncio.sleep(0.02)
        return await super().generate_vietnamese(instructions, prompt)


@pytest.mark.asyncio
async def test_non_stale_generation_uses_database_clock_and_cannot_be_claimed_twice() -> None:
    session = AsyncMock(spec=AsyncSession)
    database_now = datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc)
    story = story_fixture(status="generating_text", updated_at=database_now - timedelta(seconds=30))
    session.execute.side_effect = [scalar_result(story), scalar_value(database_now)]

    with pytest.raises(HTTPException) as exc_info:
        await generation_service._claim_generation(session, story.id)

    assert exc_info.value.status_code == 409
    assert "clock_timestamp" in str(session.execute.await_args_list[1].args[0])
    session.commit.assert_not_awaited()
    session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_stale_generation_gets_a_new_uuid_claim_from_database_time() -> None:
    session = AsyncMock(spec=AsyncSession)
    database_now = datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc)
    story = story_fixture(status="generating_text", updated_at=database_now - timedelta(minutes=20))
    old_claim = uuid4()
    story.text_generation_claim_id = old_claim
    session.execute.side_effect = [
        scalar_result(story),
        scalar_value(database_now),
        *reference_results(),
    ]

    claim_id, snapshot = await generation_service._claim_generation(session, story.id)

    assert claim_id != old_claim
    assert story.text_generation_claim_id == claim_id
    assert story.updated_at == database_now
    assert snapshot.story_id == story.id
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_success_persists_all_pages_and_clears_claim_atomically() -> None:
    session = AsyncMock(spec=AsyncSession)
    story = story_fixture()
    database_now = datetime.now(timezone.utc)
    session.execute.side_effect = [
        *draft_claim_results(story, database_now),
        scalar_result(story),
        MagicMock(),
        scalars_result([1, 2]),
    ]
    next_page_id = 100

    def assign_page_id(model) -> None:
        nonlocal next_page_id
        if isinstance(model, StoryPage):
            model.id = next_page_id
            next_page_id += 1

    session.add.side_effect = assign_page_id

    response = await generation_service.generate_story_text(session, story.id, SuccessfulProvider())

    assert response.status == "text_draft"
    assert response.text_revision == 1
    assert len(response.pages) == 4
    assert [page.page_no for page in response.pages] == [1, 2, 3, 4]
    assert story.text_generation_claim_id is None
    assert session.commit.await_count == 2


@pytest.mark.parametrize("provider", [GenerateFailureProvider(), TranslationFailureProvider()])
@pytest.mark.asyncio
async def test_provider_failure_resets_only_current_claim(provider) -> None:
    session = AsyncMock(spec=AsyncSession)
    story = story_fixture()
    session.execute.side_effect = [
        *draft_claim_results(story, datetime.now(timezone.utc)),
        scalar_result(story),
    ]

    with pytest.raises(HTTPException) as exc_info:
        await generation_service.generate_story_text(session, story.id, provider)

    assert exc_info.value.status_code == 502
    assert story.status == "draft"
    assert story.text_generation_claim_id is None
    assert session.commit.await_count == 2


@pytest.mark.asyncio
async def test_outer_timeout_resets_claim(monkeypatch: pytest.MonkeyPatch) -> None:
    session = AsyncMock(spec=AsyncSession)
    story = story_fixture()
    session.execute.side_effect = [
        *draft_claim_results(story, datetime.now(timezone.utc)),
        scalar_result(story),
    ]
    monkeypatch.setattr(
        generation_service,
        "get_settings",
        lambda: SimpleNamespace(TEXT_OPERATION_TIMEOUT_SECONDS=0.001),
    )

    with pytest.raises(HTTPException) as exc_info:
        await generation_service.generate_story_text(session, story.id, SlowProvider())

    assert exc_info.value.status_code == 503
    assert story.status == "draft"
    assert story.text_generation_claim_id is None


@pytest.mark.asyncio
async def test_old_request_cannot_finalize_after_reclaim() -> None:
    session = AsyncMock(spec=AsyncSession)
    story = story_fixture(status="generating_text")
    story.text_generation_claim_id = uuid4()
    session.execute.return_value = scalar_result(story)
    vietnamese = await SuccessfulProvider().generate_vietnamese("", "")
    khmer = await SuccessfulProvider().translate_khmer("", "")

    with pytest.raises(HTTPException) as exc_info:
        await generation_service._finalize_generation(session, story.id, uuid4(), vietnamese, khmer)

    assert exc_info.value.status_code == 409
    session.add.assert_not_called()
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_old_failure_cannot_reset_newer_claim() -> None:
    session = AsyncMock(spec=AsyncSession)
    story = story_fixture(status="generating_text")
    current_claim = uuid4()
    story.text_generation_claim_id = current_claim
    session.execute.return_value = scalar_result(story)

    await generation_service._reset_claim_safely(session, story.id, uuid4())

    assert story.status == "generating_text"
    assert story.text_generation_claim_id == current_claim
    session.commit.assert_not_awaited()
    assert session.rollback.await_count == 2


@pytest.mark.asyncio
async def test_finalize_database_failure_rolls_back_and_resets_claim(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    story = story_fixture()
    persisted_claim = story_fixture(status="generating_text")
    claim_id = uuid4()
    persisted_claim.text_generation_claim_id = claim_id
    monkeypatch.setattr(generation_service, "uuid4", lambda: claim_id)
    session.execute.side_effect = [
        *draft_claim_results(story, datetime.now(timezone.utc)),
        scalar_result(story),
        MagicMock(),
        scalar_result(persisted_claim),
    ]
    session.flush.side_effect = RuntimeError("database failure")

    with pytest.raises(RuntimeError, match="database failure"):
        await generation_service.generate_story_text(session, story.id, SuccessfulProvider())

    assert persisted_claim.status == "draft"
    assert persisted_claim.text_generation_claim_id is None
    assert session.rollback.await_count >= 1


def test_stale_timeout_must_exceed_operation_timeout() -> None:
    with pytest.raises(ValidationError, match="must exceed"):
        Settings(TEXT_OPERATION_TIMEOUT_SECONDS=270, TEXT_GENERATION_STALE_SECONDS=270)

    settings = Settings(TEXT_OPERATION_TIMEOUT_SECONDS=270, TEXT_GENERATION_STALE_SECONDS=600)
    assert settings.TEXT_GENERATION_STALE_SECONDS > settings.TEXT_OPERATION_TIMEOUT_SECONDS
