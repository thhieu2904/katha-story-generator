"""Tests for Phase 5 review, single-page regeneration, publish, share, and public stories."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from katha.core.dependencies import get_db
from katha.features.story_review.prompts import EffectivePromptTooLongError, build_effective_prompt
from katha.features.story_review.schemas import (
    ArchiveStoryRequest,
)
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
