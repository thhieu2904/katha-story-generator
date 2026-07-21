"""PostgreSQL integration coverage for Phase 4 claim and fencing invariants.

These tests deliberately use fresh sessions for every job mutation.  The
in-process runner is not started against OpenAI or R2 here; provider/storage
contracts remain unit-tested with fakes.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from katha.features.story_images import runner, service
from katha.features.story_images.schemas import GenerateImagesRequest

pytestmark = pytest.mark.integration


async def _seed_ready_story(
    session: AsyncSession,
    *,
    status: str,
    claim_id: UUID | None = None,
    heartbeat_at: datetime | None = None,
    locked_at: datetime | None = None,
    page_status: str = "pending",
) -> tuple[int, int]:
    """Persist one plan-ready page without character references."""

    story_id = (
        await session.execute(
            text(
                "INSERT INTO stories (description_vi, target_age, length_pref, status, "
                "text_revision, image_plan_revision, image_plan_locked_at, "
                "image_generation_claim_id, image_generation_heartbeat_at) "
                "VALUES (:description, 'preschool', 'short', :status, 1, 1, :locked_at, "
                ":claim_id, :heartbeat_at) RETURNING id"
            ),
            {
                "description": f"phase4 integration {uuid4()}",
                "status": status,
                "locked_at": locked_at,
                "claim_id": claim_id,
                "heartbeat_at": heartbeat_at,
            },
        )
    ).scalar_one()
    page_id = (
        await session.execute(
            text(
                "INSERT INTO story_pages (story_id, page_no, text_vi, text_en, text_km, "
                "image_scene_en, image_prompt_en, image_character_ids, image_status) "
                "VALUES (:story_id, 1, 'Một trang kiểm thử.', 'A test page.', "
                "'ទំព័រសាកល្បង។', 'A bright, safe test scene.', "
                "'A bright, safe test scene in a gentle storybook style.', "
                "'{}'::integer[], :page_status) RETURNING id"
            ),
            {"story_id": story_id, "page_status": page_status},
        )
    ).scalar_one()
    await session.commit()
    return story_id, page_id


async def _delete_story(session: AsyncSession, story_id: int) -> None:
    await session.execute(text("DELETE FROM stories WHERE id = :story_id"), {"story_id": story_id})
    await session.commit()


def _session_factory(session: AsyncSession) -> async_sessionmaker[AsyncSession]:
    bind = session.bind
    assert bind is not None
    return async_sessionmaker(bind, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_postgres_claim_race_has_one_scheduler_and_one_fresh_duplicate(
    session: AsyncSession,
) -> None:
    """Two concurrent requests serialize on the story row and share one UUID claim."""

    story_id, _ = await _seed_ready_story(session, status="text_confirmed")
    factory = _session_factory(session)
    request = GenerateImagesRequest(expected_image_plan_revision=1)
    try:
        async with factory() as first, factory() as second:
            outcomes = await asyncio.gather(
                service.start_image_generation(first, story_id, request, Mock()),
                service.start_image_generation(second, story_id, request, Mock()),
            )

        (first_response, first_schedules), (second_response, second_schedules) = outcomes
        assert sorted((first_schedules, second_schedules)) == [False, True]
        assert first_response.job_id == second_response.job_id
        assert {first_response.already_running, second_response.already_running} == {False, True}
    finally:
        await _delete_story(session, story_id)


@pytest.mark.asyncio
async def test_postgres_stale_claim_reclaim_resets_only_generating_page(
    session: AsyncSession,
) -> None:
    """A user-triggered reclaim gets a new owner and leaves a retryable durable page."""

    old_claim = uuid4()
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=20)
    story_id, page_id = await _seed_ready_story(
        session,
        status="generating_images",
        claim_id=old_claim,
        heartbeat_at=stale_time,
        locked_at=stale_time,
        page_status="generating",
    )
    try:
        response, should_schedule = await service.start_image_generation(
            session,
            story_id,
            GenerateImagesRequest(expected_image_plan_revision=1),
            Mock(),
        )

        assert should_schedule is True
        assert response.already_running is False
        assert response.job_id != old_claim
        page = (
            await session.execute(
                text("SELECT image_status, image_error_code FROM story_pages WHERE id = :page_id"),
                {"page_id": page_id},
            )
        ).one()
        assert tuple(page) == ("failed", "STALE_JOB_INTERRUPTED")
    finally:
        await _delete_story(session, story_id)


@pytest.mark.asyncio
async def test_postgres_page_completion_is_durable_across_a_fresh_session(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The completion write is observable from another session after its commit."""

    claim_id = uuid4()
    now = datetime.now(timezone.utc)
    story_id, page_id = await _seed_ready_story(
        session,
        status="generating_images",
        claim_id=claim_id,
        heartbeat_at=now,
        locked_at=now,
        page_status="generating",
    )
    factory = _session_factory(session)
    monkeypatch.setattr(runner, "async_session_factory", factory)
    image_url = "https://assets.example.test/stories/one.webp"
    try:
        assert await runner._complete_page(story_id, page_id, claim_id, image_url) is True
        async with factory() as verify:
            row = (
                await verify.execute(
                    text("SELECT image_status, image_url FROM story_pages WHERE id = :page_id"),
                    {"page_id": page_id},
                )
            ).one()
            await verify.rollback()
        assert tuple(row) == ("completed", image_url)
    finally:
        await _delete_story(session, story_id)


@pytest.mark.asyncio
async def test_postgres_reclaimed_claim_cannot_complete_page_from_old_session(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A second session can fence an old UUID before it attempts its final write."""

    old_claim = uuid4()
    new_claim = uuid4()
    now = datetime.now(timezone.utc)
    story_id, page_id = await _seed_ready_story(
        session,
        status="generating_images",
        claim_id=old_claim,
        heartbeat_at=now,
        locked_at=now,
        page_status="generating",
    )
    factory = _session_factory(session)
    monkeypatch.setattr(runner, "async_session_factory", factory)
    try:
        async with factory() as reclaimer:
            await reclaimer.execute(
                text(
                    "UPDATE stories SET image_generation_claim_id = :new_claim, "
                    "image_generation_heartbeat_at = clock_timestamp() WHERE id = :story_id"
                ),
                {"new_claim": new_claim, "story_id": story_id},
            )
            await reclaimer.commit()

        assert (
            await runner._complete_page(
                story_id,
                page_id,
                old_claim,
                "https://assets.example.test/stories/late.webp",
            )
            is False
        )
        async with factory() as verify:
            row = (
                await verify.execute(
                    text(
                        "SELECT image_status, image_url, image_generation_claim_id "
                        "FROM story_pages JOIN stories ON stories.id = story_pages.story_id "
                        "WHERE story_pages.id = :page_id"
                    ),
                    {"page_id": page_id},
                )
            ).one()
            await verify.rollback()
        assert tuple(row) == ("generating", None, new_claim)
    finally:
        await _delete_story(session, story_id)
