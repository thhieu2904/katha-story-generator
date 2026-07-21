"""Offline claim, fencing, and finalization tests for Phase 4 image jobs."""

from __future__ import annotations

import asyncio
from contextlib import AbstractAsyncContextManager
from datetime import datetime, timedelta, timezone
from threading import Event
from time import sleep
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, Mock, call
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from katha.features.characters.models import Character
from katha.features.stories.models import Story, StoryPage
from katha.features.story_images import runner, service
from katha.features.story_images.models import ImagePlanPageSnapshot, ImagePlanSnapshot
from katha.features.story_images.ports import (
    ImageProviderRejectedError,
    ImageProviderUnavailableError,
    ImageReferenceInvalidError,
)
from katha.features.story_images.schemas import CreateImagePlanRequest, GenerateImagesRequest


class AsyncSessionContext(AbstractAsyncContextManager):
    """Small async-factory stand-in used to exercise runner fencing without PostgreSQL."""

    def __init__(self, session: AsyncMock) -> None:
        self.session = session

    async def __aenter__(self) -> AsyncMock:
        return self.session

    async def __aexit__(self, exc_type, exc_value, traceback) -> bool:
        return False


def scalar_result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def row_result(value):
    result = MagicMock()
    result.one_or_none.return_value = value
    return result


def story_fixture(
    *,
    status: str = "text_confirmed",
    image_plan_revision: int = 4,
    claim_id: UUID | None = None,
    heartbeat_at: datetime | None = None,
    locked_at: datetime | None = None,
) -> Story:
    return Story(
        id=10,
        title_vi="Khu rừng nhỏ",
        description_vi="An và Thỏ khám phá khu rừng.",
        art_style_id=1,
        target_age="preschool",
        status=status,
        text_revision=3,
        image_plan_revision=image_plan_revision,
        image_plan_locked_at=locked_at,
        image_generation_claim_id=claim_id,
        image_generation_heartbeat_at=heartbeat_at,
    )


def page_fixture(
    *,
    page_id: int = 101,
    page_no: int = 1,
    image_status: str = "pending",
    character_ids: list[int] | None = None,
    image_url: str | None = None,
    attempts: int = 0,
) -> StoryPage:
    return StoryPage(
        id=page_id,
        story_id=10,
        page_no=page_no,
        text_vi="An đi trong rừng.",
        text_km="អាន ដើរ ក្នុង ព្រៃ។",
        text_en="An walks in the forest.",
        image_scene_en="An walks down a sunny forest path.",
        image_prompt_en="A safe prompt for a forest path.",
        image_character_ids=character_ids or [],
        image_status=image_status,
        image_url=image_url,
        image_attempt_count=attempts,
    )


def character_fixture(*, character_id: int = 1, urls: list[str] | None = None) -> Character:
    return Character(
        id=character_id,
        name="An",
        age=6,
        appearance_prompt_en="a child with a yellow raincoat",
        ref_image_urls=urls
        if urls is not None
        else ["https://assets.example.test/characters/an.webp"],
    )


def patch_start_dependencies(
    monkeypatch: pytest.MonkeyPatch,
    *,
    story: Story,
    pages: list[StoryPage],
    characters: list[Character],
    database_now: datetime,
) -> None:
    async def get_story(session, story_id: int, *, lock: bool = False) -> Story:
        assert story_id == 10
        assert lock is True
        return story

    async def get_pages(session, story_id: int, *, lock: bool = False) -> list[StoryPage]:
        assert story_id == 10
        assert lock is True
        return pages

    async def get_characters(session, story_id: int) -> list[Character]:
        assert story_id == 10
        return characters

    async def database_clock(session) -> datetime:
        return database_now

    monkeypatch.setattr(service, "_get_story", get_story)
    monkeypatch.setattr(service, "_get_pages", get_pages)
    monkeypatch.setattr(service, "_get_story_characters", get_characters)
    monkeypatch.setattr(service, "_database_now", database_clock)


@pytest.mark.asyncio
async def test_initial_start_commits_uuid_claim_and_locks_mapping_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    database_now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    story = story_fixture()
    pages = [page_fixture(character_ids=[1])]
    character = character_fixture()
    patch_start_dependencies(
        monkeypatch,
        story=story,
        pages=pages,
        characters=[character],
        database_now=database_now,
    )
    storage = Mock()
    storage.key_from_public_url.return_value = "characters/an.webp"

    response, should_schedule = await service.start_image_generation(
        session, 10, GenerateImagesRequest(expected_image_plan_revision=4), storage
    )

    assert should_schedule is True
    assert response.already_running is False
    assert response.job_id == story.image_generation_claim_id
    assert story.status == "generating_images"
    assert story.image_generation_heartbeat_at == database_now
    assert story.image_plan_locked_at == database_now
    session.commit.assert_awaited_once()
    session.rollback.assert_not_awaited()
    storage.key_from_public_url.assert_called_once_with(character.ref_image_urls[0])


@pytest.mark.asyncio
async def test_claim_commit_ack_loss_rereads_exact_claim_and_schedules_runner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    session.commit.side_effect = ConnectionError("commit acknowledgement lost")
    canonical_session = AsyncMock(spec=AsyncSession)
    claim_id = uuid4()
    canonical_session.execute.return_value = row_result(("generating_images", claim_id))
    database_now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    story = story_fixture()
    pages = [page_fixture()]
    patch_start_dependencies(
        monkeypatch,
        story=story,
        pages=pages,
        characters=[],
        database_now=database_now,
    )
    monkeypatch.setattr(service, "uuid4", lambda: claim_id)
    monkeypatch.setattr(
        service,
        "async_session_factory",
        lambda: AsyncSessionContext(canonical_session),
    )

    response, should_schedule = await service.start_image_generation(
        session,
        10,
        GenerateImagesRequest(expected_image_plan_revision=4),
        Mock(),
    )

    assert should_schedule is True
    assert response.job_id == claim_id
    assert response.already_running is False
    session.rollback.assert_awaited_once()
    canonical_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_claim_commit_ack_loss_never_schedules_a_different_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    session.commit.side_effect = ConnectionError("commit acknowledgement lost")
    canonical_session = AsyncMock(spec=AsyncSession)
    canonical_session.execute.return_value = row_result(("generating_images", uuid4()))
    database_now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    story = story_fixture()
    pages = [page_fixture()]
    patch_start_dependencies(
        monkeypatch,
        story=story,
        pages=pages,
        characters=[],
        database_now=database_now,
    )
    monkeypatch.setattr(
        service,
        "async_session_factory",
        lambda: AsyncSessionContext(canonical_session),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.start_image_generation(
            session,
            10,
            GenerateImagesRequest(expected_image_plan_revision=4),
            Mock(),
        )

    assert exc_info.value.status_code == 503
    canonical_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_fresh_duplicate_start_returns_same_claim_without_new_commit_or_schedule(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    database_now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    claim_id = uuid4()
    story = story_fixture(
        status="generating_images",
        claim_id=claim_id,
        heartbeat_at=database_now - timedelta(seconds=10),
        locked_at=database_now - timedelta(minutes=1),
    )
    pages = [page_fixture(image_status="generating", character_ids=[1])]
    patch_start_dependencies(
        monkeypatch,
        story=story,
        pages=pages,
        characters=[character_fixture()],
        database_now=database_now,
    )

    response, should_schedule = await service.start_image_generation(
        session, 10, GenerateImagesRequest(expected_image_plan_revision=4), Mock()
    )

    assert should_schedule is False
    assert response.already_running is True
    assert response.job_id == claim_id
    assert story.image_generation_claim_id == claim_id
    session.commit.assert_not_awaited()
    session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_stale_reclaim_uses_new_claim_and_resets_only_stale_generating_pages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    database_now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    old_claim = uuid4()
    new_claim = uuid4()
    story = story_fixture(
        status="generating_images",
        claim_id=old_claim,
        heartbeat_at=database_now - timedelta(seconds=901),
        locked_at=database_now - timedelta(minutes=3),
    )
    generating = page_fixture(image_status="generating", character_ids=[1], attempts=1)
    completed = page_fixture(
        page_id=102,
        page_no=2,
        image_status="completed",
        image_url="https://assets.example.test/complete.webp",
        attempts=1,
    )
    patch_start_dependencies(
        monkeypatch,
        story=story,
        pages=[generating, completed],
        characters=[character_fixture()],
        database_now=database_now,
    )
    monkeypatch.setattr(service, "uuid4", lambda: new_claim)

    response, should_schedule = await service.start_image_generation(
        session, 10, GenerateImagesRequest(expected_image_plan_revision=4), Mock()
    )

    assert should_schedule is True
    assert response.job_id == new_claim
    assert story.image_generation_claim_id == new_claim
    assert generating.image_status == "failed"
    assert generating.image_error_code == "STALE_JOB_INTERRUPTED"
    assert completed.image_status == "completed"
    assert completed.image_url == "https://assets.example.test/complete.webp"
    assert story.image_plan_locked_at == database_now - timedelta(minutes=3)
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_stale_reclaim_with_only_completed_pages_skips_reference_preflight(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    database_now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    old_claim = uuid4()
    story = story_fixture(
        status="generating_images",
        claim_id=old_claim,
        heartbeat_at=database_now - timedelta(seconds=901),
        locked_at=database_now - timedelta(minutes=3),
    )
    completed = page_fixture(
        image_status="completed",
        image_url="https://assets.example.test/complete.webp",
        character_ids=[1],
        attempts=1,
    )
    patch_start_dependencies(
        monkeypatch,
        story=story,
        pages=[completed],
        characters=[character_fixture(urls=[])],
        database_now=database_now,
    )
    storage = Mock()

    response, should_schedule = await service.start_image_generation(
        session, 10, GenerateImagesRequest(expected_image_plan_revision=4), storage
    )

    assert should_schedule is True
    assert response.already_running is False
    assert response.progress.completed == 1
    assert story.image_generation_claim_id != old_claim
    storage.key_from_public_url.assert_not_called()
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_retry_preflight_ignores_references_from_completed_pages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    database_now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    lock_time = database_now - timedelta(minutes=3)
    story = story_fixture(locked_at=lock_time)
    retryable = page_fixture(image_status="failed", character_ids=[1], attempts=1)
    completed = page_fixture(
        page_id=102,
        page_no=2,
        image_status="completed",
        image_url="https://assets.example.test/complete.webp",
        character_ids=[2],
        attempts=1,
    )
    valid_reference = "https://assets.example.test/characters/an.webp"
    patch_start_dependencies(
        monkeypatch,
        story=story,
        pages=[retryable, completed],
        characters=[
            character_fixture(character_id=1, urls=[valid_reference]),
            character_fixture(character_id=2, urls=["https://untrusted.example.test/old.webp"]),
        ],
        database_now=database_now,
    )
    storage = Mock()
    storage.key_from_public_url.side_effect = lambda url: (
        "characters/an.webp" if url == valid_reference else None
    )

    response, should_schedule = await service.start_image_generation(
        session, 10, GenerateImagesRequest(expected_image_plan_revision=4), storage
    )

    assert should_schedule is True
    assert response.already_running is False
    assert story.image_plan_locked_at == lock_time
    storage.key_from_public_url.assert_called_once_with(valid_reference)
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_start_preflight_selects_first_valid_r2_reference_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    database_now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    invalid_reference = "https://untrusted.example.test/characters/an.webp"
    valid_reference = "https://assets.example.test/characters/an.webp"
    story = story_fixture()
    patch_start_dependencies(
        monkeypatch,
        story=story,
        pages=[page_fixture(character_ids=[1])],
        characters=[character_fixture(urls=[invalid_reference, valid_reference])],
        database_now=database_now,
    )
    storage = Mock()
    storage.key_from_public_url.side_effect = lambda url: (
        "characters/an.webp" if url == valid_reference else None
    )

    response, should_schedule = await service.start_image_generation(
        session,
        10,
        GenerateImagesRequest(expected_image_plan_revision=4),
        storage,
    )

    assert should_schedule is True
    assert response.already_running is False
    assert storage.key_from_public_url.call_args_list == [
        call(invalid_reference),
        call(valid_reference),
    ]
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_start_with_missing_reference_rejects_before_claim_commit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    database_now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    story = story_fixture()
    pages = [page_fixture(character_ids=[1])]
    patch_start_dependencies(
        monkeypatch,
        story=story,
        pages=pages,
        characters=[character_fixture(urls=[])],
        database_now=database_now,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.start_image_generation(
            session, 10, GenerateImagesRequest(expected_image_plan_revision=4), Mock()
        )

    assert exc_info.value.status_code == 422
    assert story.status == "text_confirmed"
    assert story.image_generation_claim_id is None
    assert story.image_plan_locked_at is None
    session.commit.assert_not_awaited()
    session.rollback.assert_awaited_once()


def test_plan_readiness_requires_revision_nonempty_fields_and_valid_mapping() -> None:
    story = story_fixture()
    page = page_fixture(character_ids=[1])

    assert service.is_image_plan_ready(story, [page], [character_fixture()]) is True

    page.image_character_ids = [404]
    assert service.is_image_plan_ready(story, [page], [character_fixture()]) is False
    page.image_character_ids = [1]
    page.image_scene_en = ""
    assert service.is_image_plan_ready(story, [page], [character_fixture()]) is False


@pytest.mark.asyncio
async def test_runner_process_local_same_claim_duplicate_stops_before_any_provider_or_db_work() -> (
    None
):
    claim_id = uuid4()
    key = (10, claim_id)
    runner._active_runner_keys.add(key)
    provider = SimpleNamespace(generate_image=AsyncMock())
    storage = Mock()
    try:
        await runner.run_image_generation(10, claim_id, provider, storage)
    finally:
        runner._active_runner_keys.discard(key)

    provider.generate_image.assert_not_awaited()
    assert storage.method_calls == []


@pytest.mark.asyncio
async def test_runner_executes_primary_orchestration_through_finalization(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    snapshot = runner.ImagePageSnapshot(
        story_id=10,
        page_id=101,
        page_no=1,
        prompt_en="A safe prompt.",
        reference_urls=(),
        attempt_count=1,
    )
    semaphore = asyncio.Semaphore(1)
    acquire = AsyncMock(return_value=True)
    snapshot_targets = AsyncMock(return_value=(101,))
    claim_page = AsyncMock(return_value=snapshot)
    generate = AsyncMock(return_value=b"valid-webp-bytes")
    heartbeat = AsyncMock(return_value=True)
    upload = AsyncMock(return_value="https://assets.example.test/generated.webp")
    complete = AsyncMock(return_value=True)
    finalize = AsyncMock(return_value=True)
    monkeypatch.setattr(runner, "_semaphore_for_current_settings", lambda: semaphore)
    monkeypatch.setattr(runner, "_acquire_with_heartbeat", acquire)
    monkeypatch.setattr(runner, "_snapshot_target_pages", snapshot_targets)
    monkeypatch.setattr(runner, "_claim_page", claim_page)
    monkeypatch.setattr(runner, "_generate_page_image", generate)
    monkeypatch.setattr(runner, "_heartbeat", heartbeat)
    monkeypatch.setattr(runner, "_upload_once_with_retry", upload)
    monkeypatch.setattr(runner, "_complete_page", complete)
    monkeypatch.setattr(runner, "_finalize_claim", finalize)

    provider = Mock()
    storage = Mock()
    await runner.run_image_generation(10, claim_id, provider, storage)

    acquire.assert_awaited_once_with(semaphore, 10, claim_id)
    snapshot_targets.assert_awaited_once_with(10, claim_id)
    claim_page.assert_awaited_once_with(10, 101, claim_id, storage)
    generate.assert_awaited_once()
    heartbeat.assert_awaited_once_with(10, claim_id)
    upload.assert_awaited_once()
    complete.assert_awaited_once_with(
        10, 101, claim_id, "https://assets.example.test/generated.webp"
    )
    finalize.assert_awaited_once_with(10, claim_id)
    assert (10, claim_id) not in runner._active_runner_keys


@pytest.mark.asyncio
async def test_runner_local_page_failure_continues_to_next_target(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    first = runner.ImagePageSnapshot(10, 101, 1, "Rejected prompt", (), 1)
    second = runner.ImagePageSnapshot(10, 102, 2, "Safe prompt", (), 1)
    semaphore = asyncio.Semaphore(1)
    storage = Mock()
    claim_page = AsyncMock(side_effect=[first, second])
    generate = AsyncMock(side_effect=[ImageProviderRejectedError("moderated"), b"second-page-webp"])
    mark_failed = AsyncMock(return_value=True)
    upload = AsyncMock(return_value="https://assets.example.test/second.webp")
    complete = AsyncMock(return_value=True)
    finalize = AsyncMock(return_value=True)
    monkeypatch.setattr(runner, "_semaphore_for_current_settings", lambda: semaphore)
    monkeypatch.setattr(runner, "_acquire_with_heartbeat", AsyncMock(return_value=True))
    monkeypatch.setattr(runner, "_snapshot_target_pages", AsyncMock(return_value=(101, 102)))
    monkeypatch.setattr(runner, "_claim_page", claim_page)
    monkeypatch.setattr(runner, "_generate_page_image", generate)
    monkeypatch.setattr(runner, "_mark_page_failed", mark_failed)
    monkeypatch.setattr(runner, "_heartbeat", AsyncMock(return_value=True))
    monkeypatch.setattr(runner, "_upload_once_with_retry", upload)
    monkeypatch.setattr(runner, "_complete_page", complete)
    monkeypatch.setattr(runner, "_finalize_claim", finalize)

    await runner.run_image_generation(10, claim_id, Mock(), storage)

    assert claim_page.await_args_list == [
        call(10, 101, claim_id, storage),
        call(10, 102, claim_id, storage),
    ]
    assert generate.await_count == 2
    mark_failed.assert_awaited_once_with(10, 101, claim_id, "PROVIDER_REJECTED")
    upload.assert_awaited_once()
    complete.assert_awaited_once_with(
        10,
        102,
        claim_id,
        "https://assets.example.test/second.webp",
    )
    finalize.assert_awaited_once_with(10, claim_id)


@pytest.mark.asyncio
async def test_runner_systemic_provider_failure_stops_later_targets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    first = runner.ImagePageSnapshot(10, 101, 1, "Safe prompt", (), 1)
    semaphore = asyncio.Semaphore(1)
    storage = Mock()
    claim_page = AsyncMock(return_value=first)
    generate = AsyncMock(side_effect=ImageProviderUnavailableError("provider unavailable"))
    mark_then_finalize = AsyncMock()
    finalize = AsyncMock(return_value=True)
    monkeypatch.setattr(runner, "_semaphore_for_current_settings", lambda: semaphore)
    monkeypatch.setattr(runner, "_acquire_with_heartbeat", AsyncMock(return_value=True))
    monkeypatch.setattr(runner, "_snapshot_target_pages", AsyncMock(return_value=(101, 102)))
    monkeypatch.setattr(runner, "_claim_page", claim_page)
    monkeypatch.setattr(runner, "_generate_page_image", generate)
    monkeypatch.setattr(runner, "_mark_then_finalize", mark_then_finalize)
    monkeypatch.setattr(runner, "_finalize_claim", finalize)

    await runner.run_image_generation(10, claim_id, Mock(), storage)

    claim_page.assert_awaited_once_with(10, 101, claim_id, storage)
    generate.assert_awaited_once()
    mark_then_finalize.assert_awaited_once_with(
        10,
        claim_id,
        101,
        "PROVIDER_UNAVAILABLE",
    )
    finalize.assert_not_awaited()


@pytest.mark.asyncio
async def test_runner_skips_page_completed_after_target_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    semaphore = asyncio.Semaphore(1)
    storage = Mock()
    generate = AsyncMock()
    upload = AsyncMock()
    complete = AsyncMock()
    finalize = AsyncMock(return_value=True)
    monkeypatch.setattr(runner, "_semaphore_for_current_settings", lambda: semaphore)
    monkeypatch.setattr(runner, "_acquire_with_heartbeat", AsyncMock(return_value=True))
    monkeypatch.setattr(runner, "_snapshot_target_pages", AsyncMock(return_value=(101,)))
    monkeypatch.setattr(
        runner,
        "_claim_page",
        AsyncMock(side_effect=runner.PageAlreadyCompleted()),
    )
    monkeypatch.setattr(runner, "_generate_page_image", generate)
    monkeypatch.setattr(runner, "_upload_once_with_retry", upload)
    monkeypatch.setattr(runner, "_complete_page", complete)
    monkeypatch.setattr(runner, "_finalize_claim", finalize)

    await runner.run_image_generation(10, claim_id, Mock(), storage)

    generate.assert_not_awaited()
    upload.assert_not_awaited()
    complete.assert_not_awaited()
    finalize.assert_awaited_once_with(10, claim_id)


@pytest.mark.asyncio
async def test_runner_upload_retry_reuses_bytes_without_second_provider_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    snapshot = runner.ImagePageSnapshot(10, 101, 1, "Safe prompt", (), 1)
    semaphore = asyncio.Semaphore(1)
    image_bytes = b"one-provider-result"
    image_url = "https://assets.example.test/retried.webp"
    provider = SimpleNamespace(generate_image=AsyncMock(return_value=image_bytes))
    storage = Mock()
    storage.upload_image.side_effect = [OSError("temporary R2 failure"), image_url]
    complete = AsyncMock(return_value=True)
    finalize = AsyncMock(return_value=True)
    monkeypatch.setattr(runner, "_semaphore_for_current_settings", lambda: semaphore)
    monkeypatch.setattr(runner, "_acquire_with_heartbeat", AsyncMock(return_value=True))
    monkeypatch.setattr(runner, "_snapshot_target_pages", AsyncMock(return_value=(101,)))
    monkeypatch.setattr(runner, "_claim_page", AsyncMock(return_value=snapshot))
    monkeypatch.setattr(runner, "_heartbeat", AsyncMock(return_value=True))
    monkeypatch.setattr(runner, "_validate_generated_image", lambda *args: None)
    monkeypatch.setattr(runner, "_complete_page", complete)
    monkeypatch.setattr(runner, "_finalize_claim", finalize)

    await runner.run_image_generation(10, claim_id, provider, storage)

    provider.generate_image.assert_awaited_once_with("Safe prompt", ())
    key = f"stories/10/pages/101/{claim_id}-1.webp"
    assert storage.upload_image.call_args_list == [
        call(key, image_bytes),
        call(key, image_bytes),
    ]
    complete.assert_awaited_once_with(10, 101, claim_id, image_url)
    finalize.assert_awaited_once_with(10, claim_id)


@pytest.mark.asyncio
async def test_snapshot_detects_same_claim_generating_page_and_never_finalizes_or_clears_claim(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    claim_id = uuid4()
    story = story_fixture(
        status="generating_images",
        claim_id=claim_id,
        heartbeat_at=datetime.now(timezone.utc),
        locked_at=datetime.now(timezone.utc),
    )
    generating = page_fixture(image_status="generating")
    monkeypatch.setattr(runner, "async_session_factory", lambda: AsyncSessionContext(session))

    async def current(session_arg, story_id: int, claim: UUID) -> Story:
        return story

    async def pages(session_arg, story_id: int) -> list[StoryPage]:
        return [generating]

    monkeypatch.setattr(runner, "_locked_current_story", current)
    monkeypatch.setattr(runner, "_locked_pages", pages)

    with pytest.raises(runner.DuplicateSameClaim):
        await runner._snapshot_target_pages(10, claim_id)

    assert story.image_generation_claim_id == claim_id
    assert story.image_generation_heartbeat_at is not None
    assert generating.image_status == "generating"
    session.rollback.assert_awaited_once()
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_old_claim_cannot_complete_or_mark_failed_against_new_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    old_claim = uuid4()
    new_claim = uuid4()
    story = story_fixture(
        status="generating_images",
        claim_id=new_claim,
        heartbeat_at=datetime.now(timezone.utc),
    )
    page = page_fixture(image_status="generating", image_url=None)
    monkeypatch.setattr(runner, "async_session_factory", lambda: AsyncSessionContext(session))

    async def current(session_arg, story_id: int, claim: UUID) -> Story:
        if claim != new_claim:
            raise runner.ClaimLost()
        return story

    monkeypatch.setattr(runner, "_locked_current_story", current)

    completed = await runner._complete_page(
        10, page.id, old_claim, "https://assets.example.test/late.webp"
    )
    assert completed is False
    assert await runner._mark_page_failed(10, page.id, old_claim, "INTERNAL_ERROR") is False
    assert page.image_status == "generating"
    assert page.image_url is None
    assert story.image_generation_claim_id == new_claim
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_old_claim_cannot_finalize_or_clear_new_claim(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    old_claim = uuid4()
    new_claim = uuid4()
    story = story_fixture(
        status="generating_images",
        claim_id=new_claim,
        heartbeat_at=datetime.now(timezone.utc),
    )
    monkeypatch.setattr(runner, "async_session_factory", lambda: AsyncSessionContext(session))

    async def current(session_arg, story_id: int, claim: UUID) -> Story:
        raise runner.ClaimLost()

    monkeypatch.setattr(runner, "_locked_current_story", current)

    assert await runner._finalize_claim(10, old_claim) is False
    assert story.status == "generating_images"
    assert story.image_generation_claim_id == new_claim
    assert story.image_generation_heartbeat_at is not None
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_finalizer_transitions_all_completed_to_pending_review_and_clears_claim(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    claim_id = uuid4()
    now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    story = story_fixture(
        status="generating_images", claim_id=claim_id, heartbeat_at=now, locked_at=now
    )
    pages = [
        page_fixture(image_status="completed", image_url="https://assets.example.test/one.webp"),
        page_fixture(
            page_id=102,
            page_no=2,
            image_status="completed",
            image_url="https://assets.example.test/two.webp",
        ),
    ]
    monkeypatch.setattr(runner, "async_session_factory", lambda: AsyncSessionContext(session))

    async def current(session_arg, story_id: int, claim: UUID) -> Story:
        return story

    async def locked_pages(session_arg, story_id: int) -> list[StoryPage]:
        return pages

    async def database_clock(session_arg) -> datetime:
        return now

    monkeypatch.setattr(runner, "_locked_current_story", current)
    monkeypatch.setattr(runner, "_locked_pages", locked_pages)
    monkeypatch.setattr(runner, "_database_now", database_clock)

    assert await runner._finalize_claim(10, claim_id) is True
    assert story.status == "pending_review"
    assert story.image_generation_claim_id is None
    assert story.image_generation_heartbeat_at is None
    assert story.image_plan_locked_at == now
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_partial_finalizer_keeps_mapping_locked_and_preserves_completed_urls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    claim_id = uuid4()
    now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    lock_time = now - timedelta(minutes=2)
    story = story_fixture(
        status="generating_images", claim_id=claim_id, heartbeat_at=now, locked_at=lock_time
    )
    completed = page_fixture(
        image_status="completed", image_url="https://assets.example.test/one.webp"
    )
    in_flight = page_fixture(page_id=102, page_no=2, image_status="generating")
    monkeypatch.setattr(runner, "async_session_factory", lambda: AsyncSessionContext(session))

    async def current(session_arg, story_id: int, claim: UUID) -> Story:
        return story

    async def locked_pages(session_arg, story_id: int) -> list[StoryPage]:
        return [completed, in_flight]

    async def database_clock(session_arg) -> datetime:
        return now

    monkeypatch.setattr(runner, "_locked_current_story", current)
    monkeypatch.setattr(runner, "_locked_pages", locked_pages)
    monkeypatch.setattr(runner, "_database_now", database_clock)

    assert await runner._finalize_claim(10, claim_id) is True
    assert story.status == "text_confirmed"
    assert story.image_generation_claim_id is None
    assert story.image_generation_heartbeat_at is None
    assert story.image_plan_locked_at == lock_time
    assert completed.image_status == "completed"
    assert completed.image_url == "https://assets.example.test/one.webp"
    assert in_flight.image_status == "failed"
    assert in_flight.image_error_code == "JOB_INTERRUPTED"


def test_runner_uses_immutable_claim_scoped_object_key() -> None:
    claim_id = UUID("00000000-0000-0000-0000-000000000123")

    assert runner._image_object_key(10, 101, claim_id, 2) == (
        "stories/10/pages/101/00000000-0000-0000-0000-000000000123-2.webp"
    )


@pytest.mark.asyncio
async def test_completion_commit_ack_loss_reads_canonical_completed_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    candidate_url = "https://assets.example.test/generated.webp"
    story = story_fixture(status="generating_images", claim_id=claim_id, heartbeat_at=now)
    write_page = page_fixture(image_status="generating")
    write_session = AsyncMock(spec=AsyncSession)
    write_session.execute.return_value = scalar_result(write_page)
    write_session.commit.side_effect = ConnectionError("commit acknowledgement lost")
    read_session = AsyncMock(spec=AsyncSession)
    read_session.execute.return_value = row_result(("completed", candidate_url))
    sessions = [AsyncSessionContext(write_session), AsyncSessionContext(read_session)]
    monkeypatch.setattr(runner, "async_session_factory", lambda: sessions.pop(0))

    async def current(session_arg, story_id: int, claim: UUID) -> Story:
        return story

    async def database_clock(session_arg) -> datetime:
        return now

    monkeypatch.setattr(runner, "_locked_current_story", current)
    monkeypatch.setattr(runner, "_database_now", database_clock)

    assert await runner._complete_page(10, 101, claim_id, candidate_url) is True
    read_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_failed_page_commit_ack_loss_reads_canonical_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    error_code = "PROVIDER_REJECTED"
    story = story_fixture(status="generating_images", claim_id=claim_id, heartbeat_at=now)
    write_session = AsyncMock(spec=AsyncSession)
    write_session.execute.return_value = scalar_result(page_fixture(image_status="generating"))
    write_session.commit.side_effect = ConnectionError("commit acknowledgement lost")
    read_session = AsyncMock(spec=AsyncSession)
    read_session.execute.return_value = row_result(("failed", error_code))
    sessions = [AsyncSessionContext(write_session), AsyncSessionContext(read_session)]
    monkeypatch.setattr(runner, "async_session_factory", lambda: sessions.pop(0))

    async def current(session_arg, story_id: int, claim: UUID) -> Story:
        return story

    async def database_clock(session_arg) -> datetime:
        return now

    monkeypatch.setattr(runner, "_locked_current_story", current)
    monkeypatch.setattr(runner, "_database_now", database_clock)

    assert await runner._mark_page_failed(10, 101, claim_id, error_code) is True
    write_session.rollback.assert_awaited_once()
    read_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_completion_commit_mismatch_becomes_fenced_known_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    candidate_url = "https://assets.example.test/generated.webp"
    story = story_fixture(status="generating_images", claim_id=claim_id, heartbeat_at=now)
    write_page = page_fixture(image_status="generating")
    # The matching URL alone is insufficient: only a completed canonical page proves the commit.
    write_session = AsyncMock(spec=AsyncSession)
    write_session.execute.return_value = scalar_result(write_page)
    write_session.commit.side_effect = ConnectionError("commit acknowledgement lost")
    read_session = AsyncMock(spec=AsyncSession)
    read_session.execute.return_value = row_result(("generating", candidate_url))
    sessions = [AsyncSessionContext(write_session), AsyncSessionContext(read_session)]
    monkeypatch.setattr(runner, "async_session_factory", lambda: sessions.pop(0))

    async def current(session_arg, story_id: int, claim: UUID) -> Story:
        return story

    async def database_clock(session_arg) -> datetime:
        return now

    monkeypatch.setattr(runner, "_locked_current_story", current)
    monkeypatch.setattr(runner, "_database_now", database_clock)

    with pytest.raises(runner.CompletionNotPersisted):
        await runner._complete_page(10, 101, claim_id, candidate_url)


@pytest.mark.asyncio
async def test_completion_commit_unreadable_state_keeps_asset_for_reconciliation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    story = story_fixture(status="generating_images", claim_id=claim_id, heartbeat_at=now)
    write_session = AsyncMock(spec=AsyncSession)
    write_session.execute.return_value = scalar_result(page_fixture(image_status="generating"))
    write_session.commit.side_effect = ConnectionError("commit acknowledgement lost")
    read_session = AsyncMock(spec=AsyncSession)
    read_session.execute.side_effect = ConnectionError("database unavailable")
    sessions = [AsyncSessionContext(write_session), AsyncSessionContext(read_session)]
    monkeypatch.setattr(runner, "async_session_factory", lambda: sessions.pop(0))

    async def current(session_arg, story_id: int, claim: UUID) -> Story:
        return story

    async def database_clock(session_arg) -> datetime:
        return now

    monkeypatch.setattr(runner, "_locked_current_story", current)
    monkeypatch.setattr(runner, "_database_now", database_clock)

    with pytest.raises(runner.CompletionOutcomeUncertain):
        await runner._complete_page(10, 101, claim_id, "https://assets.example.test/generated.webp")


@pytest.mark.asyncio
async def test_orphan_cleanup_with_lost_upload_ack_uses_canonical_key_before_deleting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    session.execute.return_value = scalar_result("https://assets.example.test/object.webp")
    monkeypatch.setattr(runner, "async_session_factory", lambda: AsyncSessionContext(session))
    storage = Mock()
    storage.key_from_public_url.return_value = "stories/10/pages/101/claim-1.webp"

    await runner._cleanup_orphan_if_safe(
        storage,
        10,
        101,
        "stories/10/pages/101/claim-1.webp",
        None,
    )

    storage.delete_object.assert_not_called()


@pytest.mark.asyncio
async def test_create_plan_releases_snapshot_transaction_before_provider_latency(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    story = story_fixture()
    snapshot = ImagePlanSnapshot(
        story_id=10,
        text_revision=3,
        image_plan_revision=4,
        title_vi="Khu rừng nhỏ",
        description_vi="An và Thỏ khám phá khu rừng.",
        target_age="preschool",
        art_style_name="Watercolor",
        art_style_modifier_en="soft watercolor",
        pages=(ImagePlanPageSnapshot(id=101, page_no=1, text_vi="An đi trong rừng."),),
        characters=(),
    )

    async def get_story(session_arg, story_id: int, *, lock: bool = False) -> Story:
        assert lock is False
        return story

    async def load_snapshot(session_arg, story_arg: Story) -> ImagePlanSnapshot:
        return snapshot

    async def plan_images(instructions: str, prompt: str):
        assert session.rollback.await_count == 1
        raise ImageProviderUnavailableError("temporary")

    monkeypatch.setattr(service, "_get_story", get_story)
    monkeypatch.setattr(service, "_load_plan_snapshot", load_snapshot)
    provider = SimpleNamespace(plan_images=plan_images)

    with pytest.raises(HTTPException) as exc_info:
        await service.create_image_plan(
            session,
            10,
            CreateImagePlanRequest(expected_text_revision=3, expected_image_plan_revision=4),
            provider,
        )

    assert exc_info.value.status_code == 503
    assert session.rollback.await_count == 2


@pytest.mark.asyncio
async def test_runner_maps_invalid_reference_to_systemic_reference_failure() -> None:
    snapshot = runner.ImagePageSnapshot(
        story_id=10,
        page_id=101,
        page_no=1,
        prompt_en="A safe prompt.",
        reference_urls=(),
        attempt_count=1,
    )
    provider = SimpleNamespace(
        generate_image=AsyncMock(side_effect=ImageReferenceInvalidError("invalid reference"))
    )

    with pytest.raises(runner.ReferenceUnavailable):
        await runner._generate_page_image(snapshot, provider, Mock())


@pytest.mark.asyncio
async def test_runner_preserves_unexpected_provider_exception_for_internal_failure() -> None:
    snapshot = runner.ImagePageSnapshot(
        story_id=10,
        page_id=101,
        page_no=1,
        prompt_en="A safe prompt.",
        reference_urls=(),
        attempt_count=1,
    )
    provider = SimpleNamespace(
        generate_image=AsyncMock(side_effect=RuntimeError("unexpected provider bug"))
    )

    with pytest.raises(RuntimeError, match="unexpected provider bug"):
        await runner._generate_page_image(snapshot, provider, Mock())


@pytest.mark.asyncio
async def test_runner_marks_unexpected_provider_exception_as_internal_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim_id = uuid4()
    snapshot = runner.ImagePageSnapshot(10, 101, 1, "Safe prompt", (), 1)
    semaphore = asyncio.Semaphore(1)
    provider = SimpleNamespace(
        generate_image=AsyncMock(side_effect=RuntimeError("unexpected provider bug"))
    )
    storage = Mock()
    mark_then_finalize = AsyncMock()
    claim_page = AsyncMock(return_value=snapshot)
    monkeypatch.setattr(runner, "_semaphore_for_current_settings", lambda: semaphore)
    monkeypatch.setattr(runner, "_acquire_with_heartbeat", AsyncMock(return_value=True))
    monkeypatch.setattr(runner, "_snapshot_target_pages", AsyncMock(return_value=(101, 102)))
    monkeypatch.setattr(runner, "_claim_page", claim_page)
    monkeypatch.setattr(runner, "_mark_then_finalize", mark_then_finalize)

    await runner.run_image_generation(10, claim_id, provider, storage)

    claim_page.assert_awaited_once_with(10, 101, claim_id, storage)
    provider.generate_image.assert_awaited_once_with("Safe prompt", ())
    mark_then_finalize.assert_awaited_once_with(10, claim_id, 101, "INTERNAL_ERROR")


def test_runner_selects_first_valid_r2_reference_url() -> None:
    invalid_reference = "https://untrusted.example.test/characters/an.webp"
    valid_reference = "https://assets.example.test/characters/an.webp"
    storage = Mock()
    storage.key_from_public_url.side_effect = lambda url: (
        "characters/an.webp" if url == valid_reference else None
    )

    assert runner._reference_urls(
        [character_fixture(urls=[invalid_reference, valid_reference])],
        [1],
        storage,
    ) == (valid_reference,)
    assert storage.key_from_public_url.call_args_list == [
        call(invalid_reference),
        call(valid_reference),
    ]


@pytest.mark.asyncio
async def test_upload_timeout_drains_background_thread_before_returning() -> None:
    finished = Event()

    def slow_upload(key: str, data: bytes) -> str:
        sleep(0.03)
        finished.set()
        return "https://assets.example.test/late.webp"

    storage = SimpleNamespace(upload_image=slow_upload)

    with pytest.raises(runner.UploadOutcomeUncertain):
        await runner._upload_once_with_retry(
            storage,
            "stories/10/pages/101/claim-1.webp",
            b"same-image-bytes",
            timeout_seconds=0.001,
        )

    assert finished.is_set()
