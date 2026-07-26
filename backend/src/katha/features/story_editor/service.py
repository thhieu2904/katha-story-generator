"""Story editor domain service with optimistic concurrency and atomic writes."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable, TypeVar, cast

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.config import get_settings
from katha.features.characters.models import Character
from katha.features.stories import generation_service
from katha.features.stories.generation_models import (
    AGE_RULES,
    PAGE_TEXT_MAX_CHARS,
    TITLE_MAX_CHARS,
    DomainOutputError,
    GeneratedPageVi,
    GeneratedStoryVi,
    TranslatedStoryKm,
    count_words,
    validate_khmer,
)
from katha.features.stories.models import Story, StoryCharacter, StoryPage
from katha.features.stories.schemas import StoryTextResponse
from katha.features.story_editor.diff import PageState, build_change_summary
from katha.features.story_editor.ports import KhmerValidator, StoryEditorAI
from katha.features.story_editor.prompts import (
    build_add_page_prompt,
    build_edit_prompt,
    build_retranslate_prompt,
)
from katha.features.story_editor.schemas import (
    AddedPageVi,
    AddPageRequest,
    ChangeSummary,
    ConfirmTextRequest,
    EditRequest,
    MutationResponse,
    ReorderPagesRequest,
    RetranslatePageRequest,
    RetranslateRequest,
    RevisedPageVi,
    RevisedStoryVi,
    ValidateKhmerRequest,
)
from katha.integrations.openai_story_text import ProviderOutputError, ProviderUnavailableError

BANDS: dict[str, tuple[int, int]] = {
    "short": (4, 6),
    "medium": (8, 10),
    "long": (12, 14),
}
T = TypeVar("T")


@dataclass(frozen=True)
class PageSnapshot:
    id: int
    page_no: int
    text_vi: str
    text_km: str
    spellcheck_flags: list[dict]
    khmer_validated_at: datetime | None


@dataclass(frozen=True)
class EditorSnapshot:
    story_id: int
    title_vi: str
    title_km: str
    description_vi: str
    target_age: str
    length_pref: str
    revision: int
    pages: tuple[PageSnapshot, ...]
    characters: tuple[dict, ...]

    def prompt_payload(self) -> dict:
        return {
            "title_vi": self.title_vi,
            "description_vi": self.description_vi,
            "target_age": self.target_age,
            "length_pref": self.length_pref,
            "characters": self.characters,
            "pages": [
                {"page_id": page.id, "page_no": page.page_no, "text_vi": page.text_vi}
                for page in self.pages
            ],
        }


async def edit_story(
    session: AsyncSession,
    story_id: int,
    request: EditRequest,
    provider: StoryEditorAI,
    validator: KhmerValidator,
) -> MutationResponse:
    snapshot = await _load_snapshot(session, story_id, request.expected_revision)
    await session.rollback()
    instructions, prompt = build_edit_prompt(snapshot.prompt_payload(), request)

    async def operation() -> tuple[RevisedStoryVi, TranslatedStoryKm | None, bool]:
        revised = await provider.revise_story(instructions, prompt)
        normalized = _validate_revised_story(snapshot, revised, request)
        changed_pages = _changed_revised_pages(snapshot, normalized)
        title_changed = normalized.title_vi != snapshot.title_vi
        has_changes = bool(
            changed_pages or title_changed or not _same_structure(snapshot, normalized)
        )
        if not has_changes:
            return normalized, None, False
        if not changed_pages and not title_changed:
            return normalized, None, True
        generated = GeneratedStoryVi(
            title_vi=normalized.title_vi,
            pages=[
                GeneratedPageVi(page_no=index, text_vi=page.text_vi)
                for index, page in enumerate(changed_pages, start=1)
            ],
        )
        km_instructions, km_prompt = generation_service.build_khmer_prompt(generated)
        translated = await provider.translate_khmer(km_instructions, km_prompt)
        return normalized, validate_khmer(translated, generated), True

    revised, translated, has_changes = await _run_ai(operation)
    if not has_changes:
        return await _no_change_response(session, snapshot)

    title_changed = revised.title_vi != snapshot.title_vi
    translated_page_texts = (
        [] if translated is None else [page.text_km for page in translated.pages]
    )
    title_km = (
        translated.title_km if title_changed and translated is not None else snapshot.title_km
    )
    return await _persist_revision(
        session,
        snapshot,
        revised,
        title_km,
        translated_page_texts,
        validator,
    )


async def add_page(
    session: AsyncSession,
    story_id: int,
    request: AddPageRequest,
    provider: StoryEditorAI,
    validator: KhmerValidator,
) -> MutationResponse:
    snapshot = await _load_snapshot(session, story_id, request.expected_revision)
    _, maximum = _band(snapshot.length_pref)
    if len(snapshot.pages) >= maximum:
        raise HTTPException(
            status_code=422, detail="Selected length band does not allow another page"
        )
    if request.after_page_id is not None and request.after_page_id not in {
        page.id for page in snapshot.pages
    }:
        raise HTTPException(status_code=404, detail="Insertion page not found")
    await session.rollback()
    instructions, prompt = build_add_page_prompt(
        snapshot.prompt_payload(), request.after_page_id, request.instruction_vi
    )

    async def operation() -> tuple[AddedPageVi, str]:
        added = await provider.add_page(instructions, prompt)
        text_vi = _validate_page_text(added.text_vi, snapshot.target_age, "new page")
        km_instructions, km_prompt = build_retranslate_prompt(text_vi, "page")
        translated = await provider.retranslate_khmer(km_instructions, km_prompt)
        text_km = _validate_single_khmer(translated.text_km, text_vi)
        return AddedPageVi(text_vi=text_vi), text_km

    added, text_km = await _run_ai(operation)
    story = await _lock_story(session, story_id, request.expected_revision)
    pages = await _load_pages(session, story_id)
    _ensure_page_snapshot(pages, snapshot)
    before = _page_states(snapshot.pages)
    insert_index = len(pages)
    if request.after_page_id is not None:
        insert_index = (
            next(index for index, page in enumerate(pages) if page.id == request.after_page_id) + 1
        )
    await _move_to_temporary_numbers(session, pages)
    new_page = StoryPage(
        story_id=story_id,
        page_no=insert_index + 1,
        text_vi=added.text_vi,
        text_km=text_km,
        spellcheck_flags=validator.validate(text_km),
        khmer_validated_at=datetime.now(timezone.utc),
    )
    session.add(new_page)
    ordered = [*pages[:insert_index], new_page, *pages[insert_index:]]
    for page_no, page in enumerate(ordered, start=1):
        page.page_no = page_no  # type: ignore[assignment]
    _increment_revision(story)
    await session.flush()
    after = [PageState(id=cast(int, page.id), text_vi=cast(str, page.text_vi)) for page in ordered]
    changes = build_change_summary(
        title_before=snapshot.title_vi,
        title_after=snapshot.title_vi,
        pages_before=before,
        pages_after=after,
    )
    await session.commit()
    canonical = await generation_service.get_story_text(session, story_id)
    return MutationResponse(story=canonical, changes=changes)


async def reorder_pages(
    session: AsyncSession, story_id: int, request: ReorderPagesRequest
) -> MutationResponse:
    story = await _lock_story(session, story_id, request.expected_revision)
    pages = await _load_pages(session, story_id)
    current_ids = [cast(int, page.id) for page in pages]
    if set(request.page_ids) != set(current_ids) or len(request.page_ids) != len(current_ids):
        raise HTTPException(status_code=422, detail="page_ids must be an exact page permutation")
    before = [PageState(id=cast(int, page.id), text_vi=cast(str, page.text_vi)) for page in pages]
    if request.page_ids == current_ids:
        await session.rollback()
        canonical = await generation_service.get_story_text(session, story_id)
        return MutationResponse(
            story=canonical,
            changes=_empty_changes(len(pages)),
        )
    by_id = {cast(int, page.id): page for page in pages}
    ordered = [by_id[page_id] for page_id in request.page_ids]
    await _move_to_temporary_numbers(session, pages)
    for page_no, page in enumerate(ordered, start=1):
        page.page_no = page_no  # type: ignore[assignment]
    _increment_revision(story)
    await session.flush()
    after = [
        PageState(id=page_id, text_vi=cast(str, by_id[page_id].text_vi))
        for page_id in request.page_ids
    ]
    changes = build_change_summary(
        title_before=cast(str, story.title_vi),
        title_after=cast(str, story.title_vi),
        pages_before=before,
        pages_after=after,
    )
    await session.commit()
    return MutationResponse(
        story=await generation_service.get_story_text(session, story_id), changes=changes
    )


async def delete_page(
    session: AsyncSession, story_id: int, page_id: int, expected_revision: int
) -> MutationResponse:
    story = await _lock_story(session, story_id, expected_revision)
    pages = await _load_pages(session, story_id)
    target = next((page for page in pages if page.id == page_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Story page not found")
    minimum, _ = _band(cast(str, story.length_pref))
    if len(pages) <= minimum:
        raise HTTPException(status_code=422, detail="Selected length band requires more pages")
    before = [PageState(id=cast(int, page.id), text_vi=cast(str, page.text_vi)) for page in pages]
    await _move_to_temporary_numbers(session, pages)
    await session.delete(target)
    remaining = [page for page in pages if page.id != page_id]
    for page_no, page in enumerate(remaining, start=1):
        page.page_no = page_no  # type: ignore[assignment]
    _increment_revision(story)
    await session.flush()
    after = [
        PageState(id=cast(int, page.id), text_vi=cast(str, page.text_vi)) for page in remaining
    ]
    changes = build_change_summary(
        title_before=cast(str, story.title_vi),
        title_after=cast(str, story.title_vi),
        pages_before=before,
        pages_after=after,
    )
    await session.commit()
    return MutationResponse(
        story=await generation_service.get_story_text(session, story_id), changes=changes
    )


async def validate_khmer_snapshot(
    session: AsyncSession,
    story_id: int,
    request: ValidateKhmerRequest,
    validator: KhmerValidator,
) -> StoryTextResponse:
    snapshot = await _load_snapshot_for_validation(session, story_id, request.expected_revision)
    if all(
        page.khmer_validated_at is not None and not page.spellcheck_flags for page in snapshot.pages
    ):
        await session.rollback()
        return await generation_service.get_story_text(session, story_id)
    await session.rollback()
    results = {page.id: validator.validate(page.text_km) for page in snapshot.pages}
    await _lock_story_for_validation(session, story_id, request.expected_revision)
    pages = await _load_pages(session, story_id)
    _ensure_page_snapshot(pages, snapshot)
    validated_at = datetime.now(timezone.utc)
    for page in pages:
        page.spellcheck_flags = results[cast(int, page.id)]  # type: ignore[assignment]
        page.khmer_validated_at = validated_at  # type: ignore[assignment]
    await session.commit()
    return await generation_service.get_story_text(session, story_id)


async def retranslate_khmer(
    session: AsyncSession,
    story_id: int,
    request: RetranslateRequest,
    provider: StoryEditorAI,
    validator: KhmerValidator,
) -> MutationResponse:
    snapshot = await _load_snapshot(session, story_id, request.expected_revision)
    page_snapshot: PageSnapshot | None = None
    if isinstance(request, RetranslatePageRequest):
        page_snapshot = next((page for page in snapshot.pages if page.id == request.page_id), None)
        if page_snapshot is None:
            raise HTTPException(status_code=404, detail="Story page not found")
        source_text = page_snapshot.text_vi
    else:
        source_text = snapshot.title_vi
    await session.rollback()
    instructions, prompt = build_retranslate_prompt(source_text, request.target)

    async def operation() -> str:
        translated = await provider.retranslate_khmer(instructions, prompt)
        return _validate_single_khmer(translated.text_km, source_text)

    text_km = await _run_ai(operation)
    current_km = snapshot.title_km if page_snapshot is None else page_snapshot.text_km
    if text_km == current_km:
        if page_snapshot is None:
            return await _no_change_response(session, snapshot)
        await _lock_story(session, story_id, request.expected_revision)
        pages = await _load_pages(session, story_id)
        _ensure_page_snapshot(pages, snapshot)
        page = next(page for page in pages if page.id == page_snapshot.id)
        page.spellcheck_flags = validator.validate(text_km)  # type: ignore[assignment]
        page.khmer_validated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
        await session.commit()
        return MutationResponse(
            story=await generation_service.get_story_text(session, story_id),
            changes=_empty_changes(len(snapshot.pages)),
        )
    story = await _lock_story(session, story_id, request.expected_revision)
    pages = await _load_pages(session, story_id)
    _ensure_page_snapshot(pages, snapshot)
    before = _page_states(snapshot.pages)
    if page_snapshot is None:
        story.title_km = text_km  # type: ignore[assignment]
    else:
        page = next(page for page in pages if page.id == page_snapshot.id)
        page.text_km = text_km  # type: ignore[assignment]
        page.spellcheck_flags = validator.validate(text_km)  # type: ignore[assignment]
        page.khmer_validated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    _increment_revision(story)
    await session.commit()
    canonical = await generation_service.get_story_text(session, story_id)
    changes = ChangeSummary(
        has_changes=True,
        title_changed=page_snapshot is None,
        edited_page_ids=[] if page_snapshot is None else [page_snapshot.id],
        added_page_ids=[],
        deleted_page_ids=[],
        order_changed=False,
        before_count=len(before),
        after_count=len(before),
    )
    return MutationResponse(story=canonical, changes=changes)


async def confirm_text(
    session: AsyncSession, story_id: int, request: ConfirmTextRequest
) -> StoryTextResponse:
    result = await session.execute(select(Story).where(Story.id == story_id).with_for_update())
    story = result.scalar_one_or_none()
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.text_revision != request.expected_revision:
        raise HTTPException(status_code=409, detail="Story text revision is stale")
    if story.status == "text_confirmed":
        await session.rollback()
        return await generation_service.get_story_text(session, story_id)
    if story.status != "text_draft":
        raise HTTPException(status_code=409, detail="Story text is locked")
    pages = await _load_pages(session, story_id)
    if (
        not story.title_vi
        or not str(story.title_vi).strip()
        or not story.title_km
        or not str(story.title_km).strip()
    ):
        raise HTTPException(
            status_code=422, detail="Story titles must be complete before confirmation"
        )
    if [page.page_no for page in pages] != list(range(1, len(pages) + 1)):
        raise HTTPException(status_code=422, detail="Story page numbers must be contiguous")
    minimum, maximum = _band(cast(str, story.length_pref))
    if not minimum <= len(pages) <= maximum:
        raise HTTPException(status_code=422, detail="Story page count is outside the selected band")
    if any(
        not page.text_vi
        or not str(page.text_vi).strip()
        or not page.text_km
        or not str(page.text_km).strip()
        for page in pages
    ):
        raise HTTPException(
            status_code=422, detail="Every page must contain Vietnamese and Khmer text"
        )
    needs_acknowledgment = any(
        page.khmer_validated_at is None or bool(page.spellcheck_flags) for page in pages
    )
    if needs_acknowledgment and not request.acknowledge_khmer_warnings:
        raise HTTPException(
            status_code=422,
            detail="Acknowledge Khmer warnings or unvalidated pages before confirmation",
        )
    story.status = "text_confirmed"  # type: ignore[assignment]
    story.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    await session.commit()
    return await generation_service.get_story_text(session, story_id)


async def _persist_revision(
    session: AsyncSession,
    snapshot: EditorSnapshot,
    revised: RevisedStoryVi,
    title_km: str,
    translated_page_texts: list[str],
    validator: KhmerValidator,
) -> MutationResponse:
    story = await _lock_story(session, snapshot.story_id, snapshot.revision)
    pages = await _load_pages(session, snapshot.story_id)
    _ensure_page_snapshot(pages, snapshot)
    before = _page_states(snapshot.pages)
    existing = {cast(int, page.id): page for page in pages}
    translated_iter = iter(translated_page_texts)
    before_text_by_id = {page.id: page.text_vi for page in snapshot.pages}
    await _move_to_temporary_numbers(session, pages)
    keep_ids = {page.source_page_id for page in revised.pages if page.source_page_id is not None}
    for page_id, model in existing.items():
        if page_id not in keep_ids:
            await session.delete(model)
    ordered: list[StoryPage] = []
    validated_at = datetime.now(timezone.utc)
    for page_no, revised_page in enumerate(revised.pages, start=1):
        if revised_page.source_page_id is None:
            model = StoryPage(story_id=snapshot.story_id)
            session.add(model)
        else:
            model = existing[revised_page.source_page_id]
        model.page_no = page_no  # type: ignore[assignment]
        model.text_vi = revised_page.text_vi  # type: ignore[assignment]
        is_changed = (
            revised_page.source_page_id is None
            or before_text_by_id[revised_page.source_page_id] != revised_page.text_vi
        )
        if is_changed:
            text_km = next(translated_iter)
            model.text_km = text_km  # type: ignore[assignment]
            model.spellcheck_flags = validator.validate(text_km)  # type: ignore[assignment]
            model.khmer_validated_at = validated_at  # type: ignore[assignment]
        ordered.append(model)
    story.title_vi = revised.title_vi  # type: ignore[assignment]
    story.title_km = title_km  # type: ignore[assignment]
    _increment_revision(story)
    await session.flush()
    after = [PageState(id=cast(int, page.id), text_vi=cast(str, page.text_vi)) for page in ordered]
    changes = build_change_summary(
        title_before=snapshot.title_vi,
        title_after=revised.title_vi,
        pages_before=before,
        pages_after=after,
    )
    await session.commit()
    return MutationResponse(
        story=await generation_service.get_story_text(session, snapshot.story_id),
        changes=changes,
    )


async def _load_snapshot(
    session: AsyncSession, story_id: int, expected_revision: int
) -> EditorSnapshot:
    result = await session.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.status != "text_draft":
        raise HTTPException(status_code=409, detail="Story text is locked")
    if story.text_revision != expected_revision:
        raise HTTPException(status_code=409, detail="Story text revision is stale")
    pages = await _load_pages(session, story_id)
    characters_result = await session.execute(
        select(Character)
        .join(StoryCharacter, StoryCharacter.character_id == Character.id)
        .where(StoryCharacter.story_id == story_id)
        .order_by(Character.id)
    )
    characters = tuple(
        {
            "name": character.name,
            "age": character.age,
            "personality_vi": character.personality_vi,
        }
        for character in characters_result.scalars().all()
    )
    if not story.title_vi or not story.title_km or not pages:
        raise HTTPException(status_code=422, detail="Canonical story text is incomplete")
    return EditorSnapshot(
        story_id=cast(int, story.id),
        title_vi=cast(str, story.title_vi),
        title_km=cast(str, story.title_km),
        description_vi=cast(str, story.description_vi),
        target_age=cast(str, story.target_age),
        length_pref=cast(str, story.length_pref),
        revision=cast(int, story.text_revision),
        pages=tuple(
            PageSnapshot(
                id=cast(int, page.id),
                page_no=cast(int, page.page_no),
                text_vi=cast(str, page.text_vi),
                text_km=cast(str, page.text_km),
                spellcheck_flags=list(page.spellcheck_flags or []),
                khmer_validated_at=cast(datetime | None, page.khmer_validated_at),
            )
            for page in pages
        ),
        characters=characters,
    )


async def _lock_story(session: AsyncSession, story_id: int, expected_revision: int) -> Story:
    result = await session.execute(select(Story).where(Story.id == story_id).with_for_update())
    story = result.scalar_one_or_none()
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.status != "text_draft":
        raise HTTPException(status_code=409, detail="Story text is locked")
    if story.text_revision != expected_revision:
        raise HTTPException(status_code=409, detail="Story text revision is stale")
    return story


# Phase 5: validation-only variants that accept pending_review in addition to text_draft.
# These do NOT increment revision or change status — they only write spellcheck results.
_VALIDATION_STATUSES = {"text_draft", "pending_review"}


async def _load_snapshot_for_validation(
    session: AsyncSession, story_id: int, expected_revision: int
) -> EditorSnapshot:
    """Load snapshot for validate-only ops (no AI, no revision bump)."""
    result = await session.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.status not in _VALIDATION_STATUSES:
        raise HTTPException(status_code=409, detail="Story text is locked")
    if story.text_revision != expected_revision:
        raise HTTPException(status_code=409, detail="Story text revision is stale")
    pages = await _load_pages(session, story_id)
    characters_result = await session.execute(
        select(Character)
        .join(StoryCharacter, StoryCharacter.character_id == Character.id)
        .where(StoryCharacter.story_id == story_id)
        .order_by(Character.id)
    )
    characters = tuple(
        {
            "name": character.name,
            "age": character.age,
            "personality_vi": character.personality_vi,
        }
        for character in characters_result.scalars().all()
    )
    if not story.title_vi or not story.title_km or not pages:
        raise HTTPException(status_code=422, detail="Canonical story text is incomplete")
    return EditorSnapshot(
        story_id=cast(int, story.id),
        title_vi=cast(str, story.title_vi),
        title_km=cast(str, story.title_km),
        description_vi=cast(str, story.description_vi),
        target_age=cast(str, story.target_age),
        length_pref=cast(str, story.length_pref),
        revision=cast(int, story.text_revision),
        pages=tuple(
            PageSnapshot(
                id=cast(int, page.id),
                page_no=cast(int, page.page_no),
                text_vi=cast(str, page.text_vi),
                text_km=cast(str, page.text_km),
                spellcheck_flags=list(page.spellcheck_flags or []),
                khmer_validated_at=cast(datetime | None, page.khmer_validated_at),
            )
            for page in pages
        ),
        characters=characters,
    )


async def _lock_story_for_validation(
    session: AsyncSession, story_id: int, expected_revision: int
) -> Story:
    """Lock story for validate-only ops (text_draft or pending_review)."""
    result = await session.execute(select(Story).where(Story.id == story_id).with_for_update())
    story = result.scalar_one_or_none()
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.status not in _VALIDATION_STATUSES:
        raise HTTPException(status_code=409, detail="Story text is locked")
    if story.text_revision != expected_revision:
        raise HTTPException(status_code=409, detail="Story text revision is stale")
    return story


async def _load_pages(session: AsyncSession, story_id: int) -> list[StoryPage]:
    result = await session.execute(
        select(StoryPage).where(StoryPage.story_id == story_id).order_by(StoryPage.page_no)
    )
    return list(result.scalars().all())


async def _move_to_temporary_numbers(session: AsyncSession, pages: list[StoryPage]) -> None:
    for index, page in enumerate(pages, start=1):
        page.page_no = -index  # type: ignore[assignment]
    await session.flush()


def _ensure_page_snapshot(pages: list[StoryPage], snapshot: EditorSnapshot) -> None:
    current = [
        (cast(int, page.id), cast(str, page.text_vi), cast(str, page.text_km)) for page in pages
    ]
    expected = [(page.id, page.text_vi, page.text_km) for page in snapshot.pages]
    if current != expected:
        raise HTTPException(status_code=409, detail="Story pages changed during operation")


def _validate_revised_story(
    snapshot: EditorSnapshot, revised: RevisedStoryVi, _request: EditRequest
) -> RevisedStoryVi:
    title = _clean(revised.title_vi, "title_vi", TITLE_MAX_CHARS)
    valid_ids = {page.id for page in snapshot.pages}
    ids = [page.source_page_id for page in revised.pages if page.source_page_id is not None]
    if len(ids) != len(set(ids)) or any(page_id not in valid_ids for page_id in ids):
        raise DomainOutputError("Revised story contains duplicate or foreign source page IDs")
    normalized = RevisedStoryVi(
        title_vi=title,
        pages=[
            RevisedPageVi(
                source_page_id=page.source_page_id,
                text_vi=_validate_page_text(page.text_vi, snapshot.target_age, "revised page"),
            )
            for page in revised.pages
        ],
    )
    current_ids = [page.id for page in snapshot.pages]
    output_ids = [page.source_page_id for page in normalized.pages]
    if output_ids != current_ids:
        raise DomainOutputError(
            "Edit operations must preserve page IDs, count, and order; use page controls"
        )
    minimum, maximum = _band(snapshot.length_pref)
    if not minimum <= len(normalized.pages) <= maximum:
        raise DomainOutputError("Edited page count is outside the selected length band")
    return normalized


def _changed_revised_pages(
    snapshot: EditorSnapshot, revised: RevisedStoryVi
) -> list[RevisedPageVi]:
    before = {page.id: page.text_vi for page in snapshot.pages}
    return [
        page
        for page in revised.pages
        if page.source_page_id is None or before[page.source_page_id] != page.text_vi
    ]


def _same_structure(snapshot: EditorSnapshot, revised: RevisedStoryVi) -> bool:
    return [page.id for page in snapshot.pages] == [page.source_page_id for page in revised.pages]


def _validate_page_text(value: str, target_age: str, label: str) -> str:
    text = _clean(value, label, PAGE_TEXT_MAX_CHARS)
    hard_max = AGE_RULES[target_age][2]
    if count_words(text) > hard_max:
        raise DomainOutputError(f"{label} exceeds the {hard_max}-word hard maximum")
    return text


def _validate_single_khmer(value: str, source_vi: str) -> str:
    generated = GeneratedStoryVi(title_vi=source_vi, pages=[])
    translated = TranslatedStoryKm(title_km=value, pages=[])
    return validate_khmer(translated, generated).title_km


def _clean(value: str, label: str, max_chars: int) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        raise DomainOutputError(f"{label} is empty")
    if len(cleaned) > max_chars:
        raise DomainOutputError(f"{label} exceeds {max_chars} characters")
    return cleaned


def _band(length_pref: str) -> tuple[int, int]:
    band = BANDS.get(length_pref)
    if band is None:
        raise HTTPException(status_code=422, detail="Story length preference is invalid")
    return band


def _increment_revision(story: Story) -> None:
    story.text_revision = cast(int, story.text_revision) + 1  # type: ignore[assignment]
    story.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]


def _page_states(pages: tuple[PageSnapshot, ...]) -> list[PageState]:
    return [PageState(id=page.id, text_vi=page.text_vi) for page in pages]


def _empty_changes(count: int) -> ChangeSummary:
    return ChangeSummary(
        has_changes=False,
        title_changed=False,
        edited_page_ids=[],
        added_page_ids=[],
        deleted_page_ids=[],
        order_changed=False,
        before_count=count,
        after_count=count,
    )


async def _no_change_response(session: AsyncSession, snapshot: EditorSnapshot) -> MutationResponse:
    await _lock_story(session, snapshot.story_id, snapshot.revision)
    await session.rollback()
    return MutationResponse(
        story=await generation_service.get_story_text(session, snapshot.story_id),
        changes=_empty_changes(len(snapshot.pages)),
    )


async def _run_ai(operation: Callable[[], Awaitable[T]]) -> T:
    try:
        async with asyncio.timeout(get_settings().TEXT_OPERATION_TIMEOUT_SECONDS):
            return await operation()
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Text operation timed out"
        ) from exc
    except ProviderUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI provider is temporarily unavailable",
        ) from exc
    except (ProviderOutputError, DomainOutputError, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI provider returned invalid content"
        ) from exc
