"""Transactional contracts for Phase 4 image planning, mapping, and job claims."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Iterable, cast
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.config import get_settings
from katha.core.database import async_session_factory
from katha.features.characters.models import Character
from katha.features.config_data.models import ArtStyle
from katha.features.stories.models import Story, StoryCharacter, StoryPage
from katha.features.story_images.models import (
    ImageDomainError,
    ImagePlanCharacterSnapshot,
    ImagePlanPageSnapshot,
    ImagePlanSnapshot,
    PlannedImagePage,
    StoryImagePlanOutput,
    normalize_character_ids,
    validate_complete_mapping,
    validate_image_plan,
)
from katha.features.story_images.ports import (
    ImageProviderRejectedError,
    ImageProviderUnavailableError,
    StoryImageAI,
    StoryImageStorage,
)
from katha.features.story_images.prompts import (
    build_image_plan_instructions,
    build_image_plan_prompt,
    build_image_prompt,
)
from katha.features.story_images.schemas import (
    AvailableCharacterResponse,
    CreateImagePlanRequest,
    GenerateImagesRequest,
    GenerateImagesResponse,
    ImagePlanMappingPage,
    ImageProgressResponse,
    ImageStatus,
    StoryImagePageResponse,
    StoryImagesResponse,
    UpdateImagePlanRequest,
)

IMAGE_READY_STATUSES = {
    "text_confirmed",
    "generating_images",
    "pending_review",
    "approved",
    "published",
}


async def get_story_images(session: AsyncSession, story_id: int) -> StoryImagesResponse:
    """Return canonical image state without planning, scheduling, or recovering work."""

    story = await _get_story(session, story_id)
    _ensure_image_phase(story)
    pages = await _get_pages(session, story_id)
    characters = await _get_story_characters(session, story_id)
    database_now = await _database_now(session)
    return _to_image_state(story, pages, characters, database_now)


async def create_image_plan(
    session: AsyncSession,
    story_id: int,
    request: CreateImagePlanRequest,
    provider: StoryImageAI,
) -> StoryImagesResponse:
    """Plan every current page, then atomically materialize validated fields and prompts."""

    story = await _get_story(session, story_id)
    _ensure_unlocked_confirmed_story(
        story, request.expected_text_revision, request.expected_image_plan_revision
    )
    snapshot = await _load_plan_snapshot(session, story)
    # Snapshot reads can hold a transaction open; release it before the remote provider latency
    # window, then lock/recheck canonical revisions only when persisting the validated result.
    await session.rollback()
    instructions = build_image_plan_instructions()
    prompt = build_image_plan_prompt(snapshot)
    try:
        async with asyncio.timeout(get_settings().IMAGE_PLAN_OPERATION_TIMEOUT_SECONDS):
            candidate = await provider.plan_images(instructions, prompt)
        plan = validate_image_plan(candidate, snapshot)
    except TimeoutError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image plan generation timed out",
        ) from exc
    except ImageProviderUnavailableError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image plan provider is temporarily unavailable",
        ) from exc
    except (ImageProviderRejectedError, ImageDomainError) as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Image plan provider returned invalid content",
        ) from exc

    locked_story = await _get_story(session, story_id, lock=True)
    _ensure_unlocked_confirmed_story(
        locked_story,
        request.expected_text_revision,
        request.expected_image_plan_revision,
    )
    pages = await _get_pages(session, story_id, lock=True)
    if [(page.id, page.page_no) for page in pages] != [
        (page.id, page.page_no) for page in snapshot.pages
    ]:
        await _conflict(session, "Story pages changed while the image plan was being prepared")
    characters = await _get_story_characters(session, story_id)
    characters_by_id = _characters_by_id(characters)
    _persist_plan(
        locked_story, pages, plan, characters_by_id, await _get_art_style(session, locked_story)
    )
    locked_story.image_plan_revision = cast(int, locked_story.image_plan_revision) + 1  # type: ignore[assignment]
    locked_story.updated_at = await _database_now(session)  # type: ignore[assignment]
    await session.commit()
    return await get_story_images(session, story_id)


async def update_image_plan(
    session: AsyncSession,
    story_id: int,
    request: UpdateImagePlanRequest,
) -> StoryImagesResponse:
    """Atomically replace all page mappings and rebuild every affected deterministic prompt."""

    story = await _get_story(session, story_id, lock=True)
    _ensure_unlocked_confirmed_story(story, None, request.expected_image_plan_revision)
    pages = await _get_pages(session, story_id, lock=True)
    if not is_image_plan_ready(story, pages, await _get_story_characters(session, story_id)):
        await _conflict(session, "Image plan is not ready")
    characters = await _get_story_characters(session, story_id)
    characters_by_id = _characters_by_id(characters)
    mapping = _mapping_from_request(request.pages)
    try:
        normalized = validate_complete_mapping(
            mapping,
            expected_page_ids=[cast(int, page.id) for page in pages],
            allowed_character_ids=set(characters_by_id),
        )
    except ImageDomainError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    art_style = await _get_art_style(session, story)
    for page in pages:
        page_id = cast(int, page.id)
        character_ids = normalized[page_id]
        page.image_character_ids = list(character_ids)  # type: ignore[assignment]
        page.image_prompt_en = build_image_prompt(
            cast(str, page.image_scene_en),
            cast(str, art_style.prompt_modifier_en),
            tuple(characters_by_id[character_id] for character_id in character_ids),
        )  # type: ignore[assignment]
    story.image_plan_revision = cast(int, story.image_plan_revision) + 1  # type: ignore[assignment]
    story.updated_at = await _database_now(session)  # type: ignore[assignment]
    await session.commit()
    return await get_story_images(session, story_id)


async def start_image_generation(
    session: AsyncSession,
    story_id: int,
    request: GenerateImagesRequest,
    storage: StoryImageStorage,
) -> tuple[GenerateImagesResponse, bool]:
    """Commit a fenced UUID claim before a router schedules the in-process worker."""

    story = await _get_story(session, story_id, lock=True)
    if cast(int, story.image_plan_revision) != request.expected_image_plan_revision:
        await _conflict(session, "Image plan revision is stale")
    pages = await _get_pages(session, story_id, lock=True)
    characters = await _get_story_characters(session, story_id)
    if not is_image_plan_ready(story, pages, characters):
        await _unprocessable(session, "Image plan is not ready")
    database_now = await _database_now(session)

    if story.status == "generating_images":
        claim_id = cast(UUID | None, story.image_generation_claim_id)
        if claim_id is not None and not _is_job_stale(story, database_now):
            response = GenerateImagesResponse(
                job_id=claim_id,
                already_running=True,
                status="generating_images",
                progress=_progress(pages),
            )
            await session.rollback()
            return response, False
        # A stale job is explicitly reclaimed by a user action. Its in-flight pages become
        # retryable before reference preflight decides whether any provider work remains.
        for page in pages:
            if _page_status(page) == "generating":
                page.image_status = "failed"  # type: ignore[assignment]
                page.image_error_code = "STALE_JOB_INTERRUPTED"  # type: ignore[assignment]
        retryable_pages = [page for page in pages if _page_status(page) in {"pending", "failed"}]
        if retryable_pages:
            await _preflight_references(session, retryable_pages, characters, storage)
        if story.image_plan_locked_at is None:
            await _conflict(session, "Image generation claim is inconsistent")
    elif story.status == "text_confirmed":
        retryable_pages = [page for page in pages if _page_status(page) in {"pending", "failed"}]
        if not retryable_pages:
            await _conflict(session, "There are no images remaining to generate")
        await _preflight_references(session, retryable_pages, characters, storage)
        if story.image_plan_locked_at is None:
            story.image_plan_locked_at = database_now  # type: ignore[assignment]
    else:
        await _conflict(session, "Story status does not allow image generation")

    claim_id = uuid4()
    story.status = "generating_images"  # type: ignore[assignment]
    story.image_generation_claim_id = claim_id  # type: ignore[assignment]
    story.image_generation_heartbeat_at = database_now  # type: ignore[assignment]
    story.updated_at = database_now  # type: ignore[assignment]
    progress = _progress(pages)
    try:
        await session.commit()
    except Exception as commit_error:
        # PostgreSQL can durably commit while the client loses the acknowledgement. Never
        # leave that exact fresh claim unscheduled just because the request-side session is
        # uncertain: reread scalar canonical state through a fresh session before deciding.
        reconciled = await _reconcile_claim_commit(
            session,
            story_id,
            claim_id,
            progress,
        )
        if reconciled is not None:
            return reconciled, True
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image generation claim outcome could not be confirmed; retry the request",
        ) from commit_error
    return (
        GenerateImagesResponse(
            job_id=claim_id,
            already_running=False,
            status="generating_images",
            progress=progress,
        ),
        True,
    )


def is_image_plan_ready(
    story: Story, pages: Iterable[StoryPage], characters: Iterable[Character]
) -> bool:
    """Authoritative plan completeness rule; empty mapping alone never means plan-ready."""

    page_list = list(pages)
    character_ids = {cast(int, character.id) for character in characters}
    if cast(int, story.image_plan_revision) <= 0 or not page_list:
        return False
    for page in page_list:
        if not all(
            isinstance(value, str) and value.strip()
            for value in (page.text_en, page.image_scene_en, page.image_prompt_en)
        ):
            return False
        try:
            normalize_character_ids(
                cast(list[int] | None, page.image_character_ids) or [],
                allowed_character_ids=character_ids,
            )
        except ImageDomainError:
            return False
    return True


async def _load_plan_snapshot(session: AsyncSession, story: Story) -> ImagePlanSnapshot:
    pages = await _get_pages(session, cast(int, story.id))
    characters = await _get_story_characters(session, cast(int, story.id))
    art_style = await _get_art_style(session, story)
    if not story.title_vi or not story.description_vi or not story.target_age or not pages:
        await _unprocessable(session, "Story text is incomplete")
    if not characters:
        await _unprocessable(session, "Story has no available characters")
    try:
        return ImagePlanSnapshot(
            story_id=cast(int, story.id),
            text_revision=cast(int, story.text_revision),
            image_plan_revision=cast(int, story.image_plan_revision),
            title_vi=cast(str, story.title_vi),
            description_vi=cast(str, story.description_vi),
            target_age=cast(str, story.target_age),
            art_style_name=cast(str, art_style.name_en),
            art_style_modifier_en=cast(str, art_style.prompt_modifier_en),
            pages=tuple(
                ImagePlanPageSnapshot(
                    id=cast(int, page.id),
                    page_no=cast(int, page.page_no),
                    text_vi=cast(str, page.text_vi),
                )
                for page in pages
                if isinstance(page.text_vi, str) and page.text_vi.strip()
            ),
            characters=tuple(_to_character_snapshot(character) for character in characters),
        )
    except (TypeError, ValueError) as exc:
        await _unprocessable(session, "Story setup is incomplete")
        raise AssertionError("unreachable") from exc


def _persist_plan(
    story: Story,
    pages: list[StoryPage],
    plan: StoryImagePlanOutput,
    characters_by_id: dict[int, ImagePlanCharacterSnapshot],
    art_style: ArtStyle,
) -> None:
    plan_by_page = {page.page_id: page for page in plan.pages}
    for page in pages:
        planned = plan_by_page.get(cast(int, page.id))
        if planned is None:
            raise ImageDomainError("Validated image plan is missing a current page")
        _apply_planned_page(page, planned, characters_by_id, art_style)


def _apply_planned_page(
    page: StoryPage,
    planned: PlannedImagePage,
    characters_by_id: dict[int, ImagePlanCharacterSnapshot],
    art_style: ArtStyle,
) -> None:
    selected_ids = tuple(planned.character_ids)
    page.text_en = planned.text_en  # type: ignore[assignment]
    page.image_scene_en = planned.image_scene_en  # type: ignore[assignment]
    page.image_character_ids = list(selected_ids)  # type: ignore[assignment]
    page.image_prompt_en = build_image_prompt(
        planned.image_scene_en,
        cast(str, art_style.prompt_modifier_en),
        tuple(characters_by_id[character_id] for character_id in selected_ids),
    )  # type: ignore[assignment]


async def _preflight_references(
    session: AsyncSession,
    pages: list[StoryPage],
    characters: list[Character],
    storage: StoryImageStorage,
) -> None:
    characters_by_id = {cast(int, character.id): character for character in characters}
    selected_ids = {
        character_id
        for page in pages
        for character_id in (cast(list[int] | None, page.image_character_ids) or [])
    }
    for character_id in selected_ids:
        character = characters_by_id.get(character_id)
        urls = cast(list[str] | None, character.ref_image_urls) if character is not None else None
        url = next(
            (
                candidate
                for candidate in urls or []
                if isinstance(candidate, str)
                and candidate.strip()
                and storage.key_from_public_url(candidate) is not None
            ),
            None,
        )
        if url is None:
            await _unprocessable(session, "A selected character is missing a valid reference image")


def _to_image_state(
    story: Story,
    pages: list[StoryPage],
    characters: list[Character],
    database_now: datetime,
) -> StoryImagesResponse:
    plan_ready = is_image_plan_ready(story, pages, characters)
    story_status = cast(str, story.status)
    mapping_locked = story.image_plan_locked_at is not None
    job_stale = _is_job_stale(story, database_now)
    remaining = _has_retryable_page(pages)
    return StoryImagesResponse(
        story_id=cast(int, story.id),
        title_vi=cast(str | None, story.title_vi),
        status=story_status,
        text_revision=cast(int, story.text_revision),
        image_plan_revision=cast(int, story.image_plan_revision),
        image_plan_ready=plan_ready,
        mapping_locked=mapping_locked,
        job_id=cast(UUID | None, story.image_generation_claim_id),
        job_stale=job_stale,
        can_start=(
            story_status == "text_confirmed" and plan_ready and not mapping_locked and remaining
        ),
        can_retry=(
            story_status == "text_confirmed" and plan_ready and mapping_locked and remaining
        ),
        can_resume=job_stale,
        progress=_progress(pages),
        available_characters=[
            AvailableCharacterResponse(
                id=cast(int, character.id),
                name=cast(str, character.name),
                thumbnail_url=_first_reference_url(character),
            )
            for character in characters
        ],
        pages=[
            StoryImagePageResponse(
                id=cast(int, page.id),
                page_no=cast(int, page.page_no),
                text_vi=cast(str, page.text_vi),
                text_km=cast(str, page.text_km),
                text_en=cast(str | None, page.text_en),
                image_scene_en=cast(str | None, page.image_scene_en),
                image_prompt_en=cast(str | None, page.image_prompt_en),
                character_ids=list(cast(list[int] | None, page.image_character_ids) or []),
                image_status=_page_status(page),
                image_url=cast(str | None, page.image_url),
                image_attempt_count=cast(int, page.image_attempt_count or 0),
                image_error_code=cast(str | None, page.image_error_code),
                updated_at=cast(datetime | None, page.updated_at),
            )
            for page in pages
        ],
    )


def _progress(pages: Iterable[StoryPage]) -> ImageProgressResponse:
    counts = {"pending": 0, "generating": 0, "completed": 0, "failed": 0}
    for page in pages:
        current = _page_status(page)
        counts[current] += 1
    return ImageProgressResponse(total=sum(counts.values()), **counts)


def _page_status(page: StoryPage) -> ImageStatus:
    value = cast(str | None, page.image_status) or "pending"
    return cast(
        ImageStatus,
        value if value in {"pending", "generating", "completed", "failed"} else "pending",
    )


def _has_retryable_page(pages: Iterable[StoryPage]) -> bool:

    return any(_page_status(page) in {"pending", "failed"} for page in pages)


def _is_job_stale(story: Story, database_now: datetime) -> bool:
    if (
        story.status != "generating_images"
        or story.image_generation_claim_id is None
        or story.image_generation_heartbeat_at is None
    ):
        return False
    heartbeat = _as_utc(cast(datetime, story.image_generation_heartbeat_at))
    return (
        database_now - heartbeat
    ).total_seconds() > get_settings().IMAGE_GENERATION_STALE_SECONDS


async def _reconcile_claim_commit(
    session: AsyncSession,
    story_id: int,
    claim_id: UUID,
    progress: ImageProgressResponse,
) -> GenerateImagesResponse | None:
    """Prove an ambiguous claim commit without reading expired ORM state.

    A rollback expires ORM instances even when ``expire_on_commit`` is disabled, so this
    deliberately queries only scalar columns with a fresh session. Only the exact UUID
    written by this request is scheduleable; a different/no claim remains uncertain and
    the caller returns a retryable error instead of scheduling another owner's job.
    """

    try:
        await session.rollback()
    except Exception:
        # The original connection may already be invalid after a lost acknowledgement.
        pass

    try:
        async with async_session_factory() as canonical_session:
            result = await canonical_session.execute(
                select(Story.status, Story.image_generation_claim_id).where(Story.id == story_id)
            )
            canonical = result.one_or_none()
            await canonical_session.rollback()
    except Exception:
        return None

    if canonical is None:
        return None
    canonical_status, canonical_claim_id = canonical
    if canonical_status != "generating_images" or canonical_claim_id != claim_id:
        return None
    return GenerateImagesResponse(
        job_id=claim_id,
        already_running=False,
        status="generating_images",
        progress=progress,
    )


async def _get_story(session: AsyncSession, story_id: int, *, lock: bool = False) -> Story:
    statement = select(Story).where(Story.id == story_id)
    if lock:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    story = result.scalar_one_or_none()
    if story is None:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    return story


async def _get_pages(
    session: AsyncSession, story_id: int, *, lock: bool = False
) -> list[StoryPage]:
    statement = select(StoryPage).where(StoryPage.story_id == story_id).order_by(StoryPage.page_no)
    if lock:
        statement = statement.with_for_update()
    result = await session.execute(statement)
    return list(result.scalars().all())


async def _get_story_characters(session: AsyncSession, story_id: int) -> list[Character]:
    result = await session.execute(
        select(Character)
        .join(StoryCharacter, StoryCharacter.character_id == Character.id)
        .where(StoryCharacter.story_id == story_id)
        .order_by(Character.id)
    )
    return list(result.scalars().all())


async def _get_art_style(session: AsyncSession, story: Story) -> ArtStyle:
    if story.art_style_id is None:
        await _unprocessable(session, "Story art style is missing")
    result = await session.execute(select(ArtStyle).where(ArtStyle.id == story.art_style_id))
    art_style = result.scalar_one_or_none()
    if art_style is None:
        await _unprocessable(session, "Story art style is invalid")
    return cast(ArtStyle, art_style)


async def _database_now(session: AsyncSession) -> datetime:
    result = await session.execute(select(func.clock_timestamp()))
    return _as_utc(cast(datetime, result.scalar_one()))


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _ensure_image_phase(story: Story) -> None:
    if story.status not in IMAGE_READY_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Story has not reached the image phase",
                "canonical_status": story.status,
            },
        )


def _ensure_unlocked_confirmed_story(
    story: Story,
    expected_text_revision: int | None,
    expected_image_plan_revision: int,
) -> None:
    if story.status != "text_confirmed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Story is not text confirmed"
        )
    if story.image_plan_locked_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Image mapping is locked")
    if (
        expected_text_revision is not None
        and cast(int, story.text_revision) != expected_text_revision
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Text revision is stale")
    if cast(int, story.image_plan_revision) != expected_image_plan_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Image plan revision is stale"
        )


async def _conflict(session: AsyncSession, detail: str) -> None:
    await session.rollback()
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


async def _unprocessable(session: AsyncSession, detail: str) -> None:
    await session.rollback()
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=detail)


def _characters_by_id(characters: Iterable[Character]) -> dict[int, ImagePlanCharacterSnapshot]:
    return {snapshot.id: snapshot for snapshot in map(_to_character_snapshot, characters)}


def _to_character_snapshot(character: Character) -> ImagePlanCharacterSnapshot:
    return ImagePlanCharacterSnapshot(
        id=cast(int, character.id),
        name=cast(str, character.name),
        personality_vi=cast(str | None, character.personality_vi),
        appearance_prompt_en=cast(str, character.appearance_prompt_en),
        ref_image_urls=tuple(cast(list[str] | None, character.ref_image_urls) or []),
    )


def _first_reference_url(character: Character) -> str | None:
    return next(
        (
            url
            for url in cast(list[str] | None, character.ref_image_urls) or []
            if isinstance(url, str) and url.strip()
        ),
        None,
    )


def _mapping_from_request(pages: Iterable[ImagePlanMappingPage]) -> dict[int, list[int]]:
    return {page.page_id: page.character_ids for page in pages}
