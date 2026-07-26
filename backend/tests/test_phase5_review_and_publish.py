"""Tests for Phase 5 review, single-page regeneration, publish, share, and public stories."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from katha.core.dependencies import get_db
from katha.features.stories.models import Story, StoryPage
from katha.features.story_review import router as review_router
from katha.features.story_review import service as review_service
from katha.features.story_review.prompts import EffectivePromptTooLongError, build_effective_prompt
from katha.features.story_review.schemas import (
    ArchiveStoryRequest,
    RegenerateImageRequest,
    RegenerateImageResponse,
)
from katha.features.story_review.service import _build_review_state, _database_now
from katha.main import app


def test_effective_prompt_builder():
    prompt = build_effective_prompt("A cheerful monkey in a jungle", "Change the sky to sunset")
    assert "A cheerful monkey in a jungle" in prompt
    assert "Change the sky to sunset" in prompt

    with pytest.raises(EffectivePromptTooLongError):
        build_effective_prompt("x" * 7000, "y" * 2000)


def test_public_story_token_regex():
    from katha.features.public_stories.service import _TOKEN_REGEX

    assert _TOKEN_REGEX.match("a" * 43)
    assert _TOKEN_REGEX.match("A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v")
    assert not _TOKEN_REGEX.match("short_token")
    assert not _TOKEN_REGEX.match("a" * 42)
    assert not _TOKEN_REGEX.match("a" * 44)
    assert not _TOKEN_REGEX.match("token_with_invalid_char!")


def test_archive_request_backward_compatibility():
    req = ArchiveStoryRequest()
    assert req.expected_status is None
    assert req.expected_share_revision is None

    req_with_vals = ArchiveStoryRequest(expected_status="draft", expected_share_revision=0)
    assert req_with_vals.expected_status == "draft"
    assert req_with_vals.expected_share_revision == 0


@pytest.mark.asyncio
async def test_database_clock_errors_are_not_replaced_with_application_time():
    session = AsyncMock()
    session.execute.side_effect = RuntimeError("database clock unavailable")

    with pytest.raises(RuntimeError, match="database clock unavailable"):
        await _database_now(session)


def test_regeneration_response_contract_does_not_expose_claim_metadata():
    assert set(RegenerateImageResponse.model_fields) == {"already_running", "review"}


@pytest.mark.asyncio
async def test_schedule_failure_invokes_fenced_reset(monkeypatch: pytest.MonkeyPatch):
    claim_id = UUID("00000000-0000-0000-0000-000000000777")
    result = MagicMock()
    result.response.already_running = False
    result.claim_id = claim_id
    start = AsyncMock(return_value=result)
    reset = AsyncMock(return_value=True)
    monkeypatch.setattr(review_service, "start_regeneration", start)
    monkeypatch.setattr(review_service, "reset_regeneration_after_schedule_failure", reset)
    background_tasks = MagicMock()
    background_tasks.add_task.side_effect = RuntimeError("scheduler unavailable")
    session = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await review_router.regenerate_page_image(
            10,
            101,
            RegenerateImageRequest(
                expected_text_revision=3,
                expected_review_status="rejected",
                expected_image_attempt_count=1,
                expected_image_url="https://assets.example.test/old.webp",
            ),
            background_tasks,
            session,
            MagicMock(id=UUID("00000000-0000-0000-0000-000000000501")),
            MagicMock(),
            MagicMock(),
        )

    assert exc_info.value.status_code == 503
    reset.assert_awaited_once_with(10, claim_id, 101)


@pytest.mark.asyncio
async def test_fenced_schedule_reset_leaves_page_retryable_with_old_review_metadata():
    claim_id = UUID("00000000-0000-0000-0000-000000000778")
    story = Story(
        id=10,
        title_vi="Truyện retry",
        title_km="រឿងសាកល្បង",
        target_age="preschool",
        status="generating_images",
        text_revision=3,
        image_plan_locked_at=datetime.now(timezone.utc),
        image_generation_claim_id=claim_id,
        image_generation_heartbeat_at=datetime.now(timezone.utc),
        active_image_regeneration_page_id=101,
        public_share_revision=0,
    )
    page = StoryPage(
        id=101,
        story_id=10,
        page_no=1,
        text_vi="Trang retry.",
        text_km="ទំព័រសាកល្បង។",
        spellcheck_flags=[],
        khmer_validated_at=datetime.now(timezone.utc),
        image_status="pending",
        image_url="https://assets.example.test/old.webp",
        image_attempt_count=1,
        image_prompt_en="A safe storybook scene",
        image_character_ids=[],
        image_error_code=None,
        review_status="rejected",
        review_notes="Cần đổi bố cục ảnh",
        reviewed_by=UUID("00000000-0000-0000-0000-000000000501"),
        reviewed_at=datetime.now(timezone.utc),
    )
    story_result = MagicMock()
    story_result.scalar_one_or_none.return_value = story
    page_result = MagicMock()
    page_result.scalar_one_or_none.return_value = page
    clock_result = MagicMock()
    clock_result.scalar_one.return_value = datetime.now(timezone.utc)
    session = AsyncMock()
    session.execute.side_effect = [story_result, page_result, clock_result]

    assert await review_service._fenced_reset_regeneration_after_schedule_failure(
        session, 10, claim_id, 101
    )
    assert story.status == "pending_review"
    assert story.image_generation_claim_id is None
    assert page.image_status == "failed"
    assert page.image_error_code == "SCHEDULE_FAILED"
    assert page.image_url == "https://assets.example.test/old.webp"
    assert page.review_status == "rejected"
    assert page.review_notes == "Cần đổi bố cục ảnh"
    retryable = _build_review_state(story, [page], datetime.now(timezone.utc))
    assert retryable.pages[0].can_regenerate is True

    pages_result = MagicMock()
    pages_result.scalars.return_value.all.return_value = [page]
    empty_ids_result = MagicMock()
    empty_ids_result.scalars.return_value.all.return_value = []
    session.execute.side_effect = [
        story_result,
        clock_result,
        pages_result,
        empty_ids_result,
    ]
    retry = await review_service.start_regeneration(
        session,
        10,
        101,
        RegenerateImageRequest(
            expected_text_revision=3,
            expected_review_status="rejected",
            expected_image_attempt_count=1,
            expected_image_url="https://assets.example.test/old.webp",
        ),
        UUID("00000000-0000-0000-0000-000000000501"),
        MagicMock(),
    )
    assert retry.response.already_running is False
    assert retry.claim_id != claim_id
    assert retry.response.review.pages[0].image_status == "pending"
    assert session.commit.await_count == 2


def test_public_stories_security_headers_on_404():
    with TestClient(app) as client:
        res = client.get("/api/public/shared-stories/invalid_token_format")
        assert res.status_code == 404
        assert res.headers.get("Cache-Control") == "private, no-store"
        assert res.headers.get("Referrer-Policy") == "no-referrer"
        assert res.headers.get("X-Robots-Tag") == "noindex, nofollow, noarchive"
        assert res.json() == {"detail": "Story not found"}


def test_public_stories_security_headers_on_nonexistent_token():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_session
    try:
        with TestClient(app) as client:
            valid_length_fake_token = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v"
            res = client.get(f"/api/public/shared-stories/{valid_length_fake_token}")
            assert res.status_code == 404
            assert res.headers.get("Cache-Control") == "private, no-store"
            assert res.headers.get("Referrer-Policy") == "no-referrer"
            assert res.headers.get("X-Robots-Tag") == "noindex, nofollow, noarchive"
    finally:
        app.dependency_overrides.clear()
