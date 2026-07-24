"""API tests for story route key resolution, auth precedence, and route_key in DTOs."""

from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user, get_current_user
from katha.features.auth.schemas import TokenUser
from katha.features.stories.models import Story
from katha.features.stories.route_keys import encode_story_route_key
from katha.main import app

ADMIN = TokenUser(
    id=UUID("00000000-0000-0000-0000-000000000001"),
    email="admin@example.com",
    app_role="admin",
)
READER = TokenUser(
    id=UUID("00000000-0000-0000-0000-000000000002"),
    email="reader@example.com",
    app_role="reader",
)


def mock_story(story_id: int = 1) -> Story:
    s = MagicMock(spec=Story)
    s.id = story_id
    s.title_vi = "Truyện cổ tích"
    s.title_km = "រឿងព្រេង"
    s.description_vi = "Mô tả câu chuyện đủ dài cho test"
    s.backbone_id = 1
    s.genre_id = 1
    s.art_style_id = 1
    s.target_age = "preschool"
    s.length_pref = "short"
    s.status = "draft"
    s.cover_image_url = None
    s.text_revision = 0
    s.created_by = ADMIN.id
    s.character_ids = [1, 2]
    s.created_at = datetime.now(timezone.utc)
    s.updated_at = datetime.now(timezone.utc)
    return s


@pytest.fixture(autouse=True)
def clean_overrides() -> AsyncGenerator[None, None]:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_auth_error_precedence_unauthenticated() -> None:
    """Unauthenticated request with malformed route key returns 401, not 404/422."""
    client = TestClient(app)
    resp = client.get("/api/stories/by-route-key/invalid_key")
    assert resp.status_code == 401


def test_auth_error_precedence_reader() -> None:
    """Reader user request with malformed route key returns 403, not 404/422."""

    async def override_reader() -> TokenUser:
        return READER

    app.dependency_overrides[get_current_user] = override_reader

    client = TestClient(app)
    resp = client.get("/api/stories/by-route-key/invalid_key")
    assert resp.status_code == 403


def test_admin_invalid_or_malformed_route_key_returns_404() -> None:
    """Admin user request with malformed or random key returns 404."""
    session_mock = AsyncMock(spec=AsyncSession)

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield session_mock

    async def override_admin() -> TokenUser:
        return ADMIN

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_admin_user] = override_admin
    app.dependency_overrides[get_current_user] = override_admin

    client = TestClient(app)

    # Malformed key
    resp1 = client.get("/api/stories/by-route-key/invalid_key")
    assert resp1.status_code == 404

    # Valid format, non-existent ID
    non_existent_key = encode_story_route_key(99999)
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    session_mock.execute.return_value = result_mock

    resp2 = client.get(f"/api/stories/by-route-key/{non_existent_key}")
    assert resp2.status_code == 404


def test_admin_valid_route_key_returns_200() -> None:
    """Admin user request with valid existing route key returns 200 and story detail."""
    session_mock = AsyncMock(spec=AsyncSession)
    story = mock_story(1)

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = story
    session_mock.execute.return_value = result_mock

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield session_mock

    async def override_admin() -> TokenUser:
        return ADMIN

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_admin_user] = override_admin
    app.dependency_overrides[get_current_user] = override_admin

    client = TestClient(app)
    valid_key = encode_story_route_key(1)

    resp = client.get(f"/api/stories/by-route-key/{valid_key}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert data["route_key"] == "s1_UkLWZg9D"
