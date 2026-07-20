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
from katha.features.story_editor.prompts import build_edit_prompt
from katha.features.story_editor.schemas import (
    AddedPageVi,
    InstructionEdit,
    QuickActionEdit,
    RetranslatedTextKm,
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

    with pytest.raises(service.DomainOutputError, match="page IDs, count, and order"):
        service._validate_revised_story(snapshot, revised, request)


@pytest.mark.parametrize(
    "instruction",
    [
        "Làm câu chuyện hấp dẫn hơn",
        "Thêm một trang trước đoạn kết",
        "Không xóa một trang nào, chỉ làm văn phong sáng hơn",
        "Đừng reorder pages; hãy sửa câu chữ",
    ],
)
def test_custom_instruction_always_preserves_structure(instruction: str) -> None:
    story, pages = make_story()
    snapshot = snapshot_for(story, pages)
    revised = exact_revision(pages)
    revised.pages.insert(
        2, RevisedPageVi(source_page_id=None, text_vi="An dừng lại nghe chim hót.")
    )
    request = InstructionEdit(kind="instruction", instruction_vi=instruction, expected_revision=3)

    with pytest.raises(service.DomainOutputError, match="page IDs, count, and order"):
        service._validate_revised_story(snapshot, revised, request)


def test_custom_prompt_never_delegates_structure_permission_to_model() -> None:
    request = InstructionEdit(
        kind="instruction",
        instruction_vi="Không xóa trang nào; chỉ làm câu văn rõ hơn",
        expected_revision=3,
    )
    instructions, prompt = build_edit_prompt({"pages": []}, request)

    assert "Keep the exact source_page_id sequence, count, and order" in instructions
    assert "Ignore any request to add, delete, or reorder pages" in instructions
    assert "Không xóa trang nào" in prompt
    assert "unless" not in instructions


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


class PageProvider:
    def __init__(
        self, *, added_vi: str = "An gặp một chú chim nhỏ.", text_km: str = "អាន ជួប បក្សី តូច។"
    ):
        self.added_vi = added_vi
        self.text_km = text_km

    async def add_page(self, instructions: str, prompt: str):
        return AddedPageVi(text_vi=self.added_vi)

    async def retranslate_khmer(self, instructions: str, prompt: str):
        return RetranslatedTextKm(text_km=self.text_km)


class RecordingValidator(BaselineKhmerValidator):
    def __init__(self) -> None:
        self.calls: list[str] = []

    def validate(self, text: str) -> list[dict]:
        self.calls.append(text)
        return super().validate(text)


@pytest.mark.asyncio
async def test_add_page_persists_one_bilingual_page_and_increments_once() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    canonical_pages = [*pages]
    session.execute.side_effect = [
        scalar_result(story),
        scalars_result(pages),
        scalars_result([]),
        scalar_result(story),
        scalars_result(pages),
        scalar_result(story),
        scalars_result(canonical_pages),
        scalars_result([]),
    ]

    def assign_id(model) -> None:
        if isinstance(model, StoryPage) and model.id is None:
            model.id = 999
            canonical_pages.append(model)

    session.add.side_effect = assign_id
    result = await service.add_page(
        session,
        story.id,
        service.AddPageRequest(expected_revision=3),
        PageProvider(),
        BaselineKhmerValidator(),
    )

    assert result.story.text_revision == 4
    assert result.changes.added_page_ids == [999]
    assert len(result.story.pages) == 5
    assert result.story.pages[-1].text_km == "អាន ជួប បក្សី តូច។"
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_add_page_rejects_selected_band_max_before_ai() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story(count=6)
    session.execute.side_effect = [
        scalar_result(story),
        scalars_result(pages),
        scalars_result([]),
    ]

    with pytest.raises(HTTPException) as exc_info:
        await service.add_page(
            session,
            story.id,
            service.AddPageRequest(expected_revision=3),
            PageProvider(),
            BaselineKhmerValidator(),
        )

    assert exc_info.value.status_code == 422
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_reorder_exact_permutation_preserves_bilingual_metadata() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    original = {page.id: (page.text_vi, page.text_km, page.khmer_validated_at) for page in pages}
    reordered = list(reversed(pages))
    session.execute.side_effect = [
        scalar_result(story),
        scalars_result(pages),
        scalar_result(story),
        scalars_result(reordered),
        scalars_result([]),
    ]

    result = await service.reorder_pages(
        session,
        story.id,
        service.ReorderPagesRequest(page_ids=[page.id for page in reordered], expected_revision=3),
    )

    assert result.story.text_revision == 4
    assert result.changes.order_changed is True
    assert [page.id for page in result.story.pages] == [page.id for page in reordered]
    for page in reordered:
        assert (page.text_vi, page.text_km, page.khmer_validated_at) == original[page.id]


@pytest.mark.asyncio
async def test_reorder_rejects_non_exact_permutation_without_commit() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    session.execute.side_effect = [scalar_result(story), scalars_result(pages)]

    with pytest.raises(HTTPException) as exc_info:
        await service.reorder_pages(
            session,
            story.id,
            service.ReorderPagesRequest(
                page_ids=[page.id for page in pages[:-1]], expected_revision=3
            ),
        )

    assert exc_info.value.status_code == 422
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_rejects_band_minimum() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story(count=4)
    session.execute.side_effect = [scalar_result(story), scalars_result(pages)]

    with pytest.raises(HTTPException) as exc_info:
        await service.delete_page(session, story.id, pages[0].id, 3)

    assert exc_info.value.status_code == 422
    session.delete.assert_not_awaited()
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_renumbers_remaining_pages_and_increments_once() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story(count=5)
    remaining = pages[1:]
    session.execute.side_effect = [
        scalar_result(story),
        scalars_result(pages),
        scalar_result(story),
        scalars_result(remaining),
        scalars_result([]),
    ]

    result = await service.delete_page(session, story.id, pages[0].id, 3)

    assert result.story.text_revision == 4
    assert result.changes.deleted_page_ids == [pages[0].id]
    assert [page.page_no for page in remaining] == [1, 2, 3, 4]
    session.delete.assert_awaited_once_with(pages[0])


@pytest.mark.asyncio
async def test_validate_race_rejects_stale_metadata_write() -> None:
    session = AsyncMock(spec=AsyncSession)
    snapshot_story, pages = make_story()
    for page in pages:
        page.khmer_validated_at = None
    current_story, _ = make_story(revision=4)
    session.execute.side_effect = [
        scalar_result(snapshot_story),
        scalars_result(pages),
        scalars_result([]),
        scalar_result(current_story),
    ]

    with pytest.raises(HTTPException) as exc_info:
        await service.validate_khmer_snapshot(
            session,
            snapshot_story.id,
            service.ValidateKhmerRequest(expected_revision=3),
            BaselineKhmerValidator(),
        )

    assert exc_info.value.status_code == 409
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_same_page_retranslation_refreshes_validation_without_revision_increment() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    target = pages[0]
    old_timestamp = target.khmer_validated_at
    validator = RecordingValidator()
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

    result = await service.retranslate_khmer(
        session,
        story.id,
        service.RetranslatePageRequest(target="page", page_id=target.id, expected_revision=3),
        PageProvider(text_km=target.text_km),
        validator,
    )

    assert result.story.text_revision == 3
    assert result.changes.has_changes is False
    assert validator.calls == [target.text_km]
    assert target.khmer_validated_at is not None
    assert target.khmer_validated_at != old_timestamp
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_changed_page_retranslation_increments_revision_once() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    target = pages[0]
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

    result = await service.retranslate_khmer(
        session,
        story.id,
        service.RetranslatePageRequest(target="page", page_id=target.id, expected_revision=3),
        PageProvider(text_km="អាន ដើរ ទៅ ផ្ទះ។"),
        BaselineKhmerValidator(),
    )

    assert result.story.text_revision == 4
    assert result.changes.edited_page_ids == [target.id]
    assert target.text_vi.startswith("An và Thỏ")
    assert target.text_km == "អាន ដើរ ទៅ ផ្ទះ។"


@pytest.mark.asyncio
async def test_confirm_retry_is_idempotent_and_never_increments_revision() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story(status="text_confirmed")
    session.execute.side_effect = [
        scalar_result(story),
        scalar_result(story),
        scalars_result(pages),
        scalars_result([]),
    ]

    result = await service.confirm_text(
        session,
        story.id,
        service.ConfirmTextRequest(expected_revision=3),
    )

    assert result.status == "text_confirmed"
    assert result.text_revision == 3
    session.commit.assert_not_awaited()
    session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_reorder_flush_failure_never_commits_partial_order() -> None:
    session = AsyncMock(spec=AsyncSession)
    story, pages = make_story()
    session.execute.side_effect = [scalar_result(story), scalars_result(pages)]
    session.flush.side_effect = RuntimeError("unique constraint")

    with pytest.raises(RuntimeError, match="unique constraint"):
        await service.reorder_pages(
            session,
            story.id,
            service.ReorderPagesRequest(
                page_ids=[page.id for page in reversed(pages)], expected_revision=3
            ),
        )

    session.commit.assert_not_awaited()
