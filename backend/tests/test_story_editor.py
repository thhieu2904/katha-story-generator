"""Offline tests for Phase 3C editor contracts and state transitions."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from katha.features.characters.models import Character
from katha.features.stories.generation_models import TranslatedPageKm, TranslatedStoryKm
from katha.features.stories.models import Story, StoryPage
from katha.features.story_editor import service
from katha.features.story_editor.diff import PageState, build_change_summary
from katha.features.story_editor.schemas import (
    InstructionEdit,
    QuickActionEdit,
    RevisedPageVi,
    RevisedStoryVi,
)
from katha.integrations.khmer.baseline import BaselineKhmerValidator
from katha.integrations.openai_story_text import ProviderOutputError


def scalar_result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def scalars_result(values):
    result = MagicMock()
    result.scalars.return_value.all.return_value = values
    return result


def make_story(*, revision: int = 3, status: str = "text_draft", count: int = 4):
    story = Story(
        id=10,
        title_vi="Chuyến đi nhỏ",
        title_km="ដំណើរតូច",
        description_vi="An và Thỏ cùng đi qua khu vườn xanh.",
        target_age="preschool",
        length_pref="short",
        status=status,
        text_revision=revision,
        updated_at=datetime.now(timezone.utc),
    )
    pages = [
        StoryPage(
            id=100 + index,
            story_id=10,
            page_no=index,
            text_vi=f"An và Thỏ vui chơi ở vườn trang {index}.",
            text_km=f"អាន និង ទន្សាយ លេង នៅ សួន {index}។",
            spellcheck_flags=[],
            khmer_validated_at=datetime.now(timezone.utc),
        )
        for index in range(1, count + 1)
    ]
    return story, pages


def snapshot_for(story, pages):
    return service.EditorSnapshot(
        story_id=story.id,
        title_vi=story.title_vi,
        title_km=story.title_km,
        description_vi=story.description_vi,
        target_age=story.target_age,
        length_pref=story.length_pref,
        revision=story.text_revision,
        pages=tuple(
            service.PageSnapshot(
                id=page.id,
                page_no=page.page_no,
                text_vi=page.text_vi,
                text_km=page.text_km,
                spellcheck_flags=page.spellcheck_flags,
                khmer_validated_at=page.khmer_validated_at,
            )
            for page in pages
        ),
        characters=(),
    )


class EditProvider:
    def __init__(self, revised: RevisedStoryVi, *, fail_translation: bool = False):
        self.revised = revised
        self.fail_translation = fail_translation
        self.translation_calls = 0

    async def revise_story(self, instructions: str, prompt: str) -> RevisedStoryVi:
        return self.revised

    async def translate_khmer(self, instructions: str, prompt: str) -> TranslatedStoryKm:
        self.translation_calls += 1
        if self.fail_translation:
            raise ProviderOutputError("bad translation")
        return TranslatedStoryKm(
            title_km="ដំណើរតូច",
            pages=[TranslatedPageKm(page_no=1, text_km="អាន និង ទន្សាយ ដើរ លឿន។")],
        )

    async def add_page(self, instructions: str, prompt: str):
        raise AssertionError("not used")

    async def retranslate_khmer(self, instructions: str, prompt: str):
        raise AssertionError("not used")


def exact_revision(pages, *, change_first: bool = False) -> RevisedStoryVi:
    return RevisedStoryVi(
        title_vi="Chuyến đi nhỏ",
        pages=[
            RevisedPageVi(
                source_page_id=page.id,
                text_vi=(
                    "An và Thỏ cùng bước nhanh về nhà."
                    if change_first and index == 0
                    else page.text_vi
                ),
            )
            for index, page in enumerate(pages)
        ],
    )


def test_instruction_contract_trims_and_rejects_short_or_extra_fields() -> None:
    request = InstructionEdit(
        kind="instruction", instruction_vi="  Làm rõ cao trào  ", expected_revision=3
    )
    assert request.instruction_vi == "Làm rõ cao trào"
    with pytest.raises(ValidationError):
        InstructionEdit(kind="instruction", instruction_vi="abc", expected_revision=3)
    with pytest.raises(ValidationError):
        InstructionEdit(
            kind="instruction",
            instruction_vi="Làm rõ cao trào",
            expected_revision=3,
            action="shorten",
        )


def test_quick_action_rejects_structural_output() -> None:
    story, pages = make_story()
    snapshot = snapshot_for(story, pages)
    revised = exact_revision(pages)
    revised.pages = revised.pages[:-1]
    request = QuickActionEdit(kind="quick_action", action="shorten", expected_revision=3)

    with pytest.raises(service.DomainOutputError, match="structure"):
        service._validate_revised_story(snapshot, revised, request)


def test_custom_instruction_allows_only_explicit_structural_request() -> None:
    story, pages = make_story()
    snapshot = snapshot_for(story, pages)
    revised = exact_revision(pages)
    revised.pages.insert(
        2, RevisedPageVi(source_page_id=None, text_vi="An dừng lại nghe chim hót.")
    )

    implicit = InstructionEdit(
        kind="instruction", instruction_vi="Làm câu chuyện hấp dẫn hơn", expected_revision=3
    )
    with pytest.raises(service.DomainOutputError, match="structure"):
        service._validate_revised_story(snapshot, revised, implicit)

    explicit = InstructionEdit(
        kind="instruction", instruction_vi="Thêm một trang trước đoạn kết", expected_revision=3
    )
    normalized = service._validate_revised_story(snapshot, revised, explicit)
    assert len(normalized.pages) == 5


def test_server_diff_is_not_model_declared() -> None:
    changes = build_change_summary(
        title_before="Cũ",
        title_after="Mới",
        pages_before=[PageState(1, "A"), PageState(2, "B")],
        pages_after=[PageState(2, "B2"), PageState(3, "C")],
    )
    assert changes.title_changed is True
    assert changes.edited_page_ids == [2]
    assert changes.added_page_ids == [3]
    assert changes.deleted_page_ids == [1]
    assert changes.order_changed is False


def test_baseline_khmer_validator_has_deterministic_codepoint_offsets() -> None:
    validator = BaselineKhmerValidator()
    flags = validator.validate("😀ខ្មែរ\ufffd\u0001")
    by_kind = {flag["kind"]: flag for flag in flags}
    assert by_kind["replacement_character"]["start"] == 6
    assert by_kind["disallowed_control"]["start"] == 7
    assert validator.validate("ឈ្មោះ Dara ១២៣។\u200b") == []


@pytest.mark.asyncio
async def test_edit_selectively_translates_changed_page_and_preserves_others() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    characters = [Character(id=1, name="An", age=6, appearance_prompt_en="child")]
    provider = EditProvider(exact_revision(pages, change_first=True))
    session.execute.side_effect = [
        scalar_result(story),
        scalars_result(pages),
        scalars_result(characters),
        scalar_result(story),
        scalars_result(pages),
        scalar_result(story),
        scalars_result(pages),
        scalars_result([1]),
    ]

    result = await service.edit_story(
        session,
        story.id,
        QuickActionEdit(kind="quick_action", action="shorten", expected_revision=3),
        provider,
        BaselineKhmerValidator(),
    )

    assert result.story.text_revision == 4
    assert result.changes.edited_page_ids == [pages[0].id]
    assert provider.translation_calls == 1
    assert pages[0].text_km == "អាន និង ទន្សាយ ដើរ លឿន។"
    assert pages[1].text_km.endswith("2។")
    assert session.commit.await_count == 1


@pytest.mark.asyncio
async def test_translation_failure_does_not_persist_vietnamese_partial() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    old_text = pages[0].text_vi
    provider = EditProvider(exact_revision(pages, change_first=True), fail_translation=True)
    session.execute.side_effect = [
        scalar_result(story),
        scalars_result(pages),
        scalars_result([]),
    ]

    with pytest.raises(HTTPException) as exc_info:
        await service.edit_story(
            session,
            story.id,
            QuickActionEdit(kind="quick_action", action="shorten", expected_revision=3),
            provider,
            BaselineKhmerValidator(),
        )

    assert exc_info.value.status_code == 502
    assert pages[0].text_vi == old_text
    assert story.text_revision == 3
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_stale_final_revision_cannot_overwrite() -> None:
    session = AsyncMock(spec=AsyncSession)
    snapshot_story, pages = make_story()
    current_story, _ = make_story(revision=4)
    provider = EditProvider(exact_revision(pages, change_first=True))
    session.execute.side_effect = [
        scalar_result(snapshot_story),
        scalars_result(pages),
        scalars_result([]),
        scalar_result(current_story),
    ]

    with pytest.raises(HTTPException) as exc_info:
        await service.edit_story(
            session,
            snapshot_story.id,
            QuickActionEdit(kind="quick_action", action="shorten", expected_revision=3),
            provider,
            BaselineKhmerValidator(),
        )

    assert exc_info.value.status_code == 409
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_validate_only_updates_metadata_without_revision_increment() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    for page in pages:
        page.khmer_validated_at = None
    session.execute.side_effect = [
        scalar_result(story),
        scalars_result(pages),
        scalars_result([]),
        scalar_result(story),
        scalars_result(pages),
        scalar_result(story),
        scalars_result(pages),
        scalars_result([]),
    ]

    result = await service.validate_khmer_snapshot(
        session,
        story.id,
        service.ValidateKhmerRequest(expected_revision=3),
        BaselineKhmerValidator(),
    )

    assert result.text_revision == 3
    assert all(page.khmer_validated_at is not None for page in pages)
    assert session.commit.await_count == 1


@pytest.mark.asyncio
async def test_confirm_allows_odd_count_in_band_and_does_not_increment_revision() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story(count=5)
    session.execute.side_effect = [
        scalar_result(story),
        scalars_result(pages),
        scalar_result(story),
        scalars_result(pages),
        scalars_result([]),
    ]

    result = await service.confirm_text(
        session,
        story.id,
        service.ConfirmTextRequest(expected_revision=3, acknowledge_khmer_warnings=False),
    )

    assert result.status == "text_confirmed"
    assert result.text_revision == 3
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_confirm_requires_ack_for_unvalidated_or_warning_pages() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    pages[0].khmer_validated_at = None
    session.execute.side_effect = [scalar_result(story), scalars_result(pages)]

    with pytest.raises(HTTPException) as exc_info:
        await service.confirm_text(
            session,
            story.id,
            service.ConfirmTextRequest(expected_revision=3, acknowledge_khmer_warnings=False),
        )

    assert exc_info.value.status_code == 422
    assert story.status == "text_draft"
    session.commit.assert_not_awaited()
