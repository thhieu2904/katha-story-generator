"""Contract tests for Phase 3A stories API."""

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


_UNSET = object()


def result_for(
    items: list[object] | None = None,
    detail: object = _UNSET,
) -> MagicMock:
    result = MagicMock()
    if items is not None:
        result.scalars.return_value.all.return_value = items
    if detail is not _UNSET:
        result.scalar_one_or_none.return_value = detail
        result.scalar_one.return_value = detail
    return result


def install_overrides(session_mock, user: TokenUser = ADMIN) -> None:
    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield session_mock

    async def override_admin() -> TokenUser:
        return user

    async def override_current() -> TokenUser:
        return user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_admin_user] = override_admin
    app.dependency_overrides[get_current_user] = override_current


@pytest.fixture(autouse=True)
def clean_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_reader_calling_endpoint_returns_403():
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session, user=READER)
    # Only mock get_current_user; let get_admin_user raise 403.
    app.dependency_overrides.pop(get_admin_user, None)

    with TestClient(app) as client:
        response = client.get("/api/stories")

    assert response.status_code == 403


def test_unauth_calling_endpoint_returns_401():
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        response = client.get("/api/stories")

    assert response.status_code == 401


def test_create_valid_story():
    session = AsyncMock(spec=AsyncSession)

    # Mock sequence: backbone, genre, art_style, characters
    backbone_res = result_for(detail=MagicMock(id=1))
    genre_res = result_for(detail=MagicMock(id=1))
    art_style_res = result_for(detail=MagicMock(id=1))
    chars_res = result_for(items=[MagicMock(id=1), MagicMock(id=2)])

    session.execute.side_effect = [backbone_res, genre_res, art_style_res, chars_res]

    # Set fake id on added object
    def mock_add(obj):
        if isinstance(obj, Story):
            obj.id = 1
            obj.created_at = datetime.now(timezone.utc)
            obj.updated_at = datetime.now(timezone.utc)

    session.add.side_effect = mock_add

    install_overrides(session)

    payload = {
        "description_vi": "This is a long description",
        "backbone_id": 1,
        "genre_id": 1,
        "art_style_id": 1,
        "target_age": "preschool",
        "length_pref": "short",
        "character_ids": [1, 2],
    }

    with TestClient(app) as client:
        response = client.post("/api/stories", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "draft"
    assert data["created_by"] == str(ADMIN.id)
    assert data["character_ids"] == [1, 2]
    assert data["description_vi"] == "This is a long description"


def test_create_invalid_character_count():
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    payload = {
        "description_vi": "This is a long description",
        "backbone_id": 1,
        "genre_id": 1,
        "art_style_id": 1,
        "target_age": "preschool",
        "length_pref": "short",
        "character_ids": [1],  # Too few
    }

    with TestClient(app) as client:
        response = client.post("/api/stories", json=payload)
    assert response.status_code == 422

    payload["character_ids"] = [1, 2, 3, 4]  # Too many
    with TestClient(app) as client:
        response = client.post("/api/stories", json=payload)
    assert response.status_code == 422

    payload["character_ids"] = [1, 1]  # Duplicates
    with TestClient(app) as client:
        response = client.post("/api/stories", json=payload)
    assert response.status_code == 422


def test_create_invalid_enums():
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    payload = {
        "description_vi": "This is a long description",
        "backbone_id": 1,
        "genre_id": 1,
        "art_style_id": 1,
        "target_age": "invalid",
        "length_pref": "short",
        "character_ids": [1, 2],
    }

    with TestClient(app) as client:
        response = client.post("/api/stories", json=payload)
    assert response.status_code == 422

    payload["target_age"] = "preschool"
    payload["length_pref"] = "invalid"

    with TestClient(app) as client:
        response = client.post("/api/stories", json=payload)
    assert response.status_code == 422


def test_create_invalid_description():
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    payload = {
        "description_vi": "too short",
        "backbone_id": 1,
        "genre_id": 1,
        "art_style_id": 1,
        "target_age": "preschool",
        "length_pref": "short",
        "character_ids": [1, 2],
    }

    with TestClient(app) as client:
        response = client.post("/api/stories", json=payload)
    assert response.status_code == 422


def test_list_stories():
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="desc", status="draft")
    s2 = Story(id=2, description_vi="desc", status="text_draft")

    session.execute.return_value = result_for(items=[s1, s2])
    install_overrides(session)

    with TestClient(app) as client:
        response = client.get("/api/stories")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_story():
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="desc", status="draft")

    # query 1: story, query 2: character ids
    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])
    session.execute.side_effect = [story_res, chars_res]

    install_overrides(session)

    with TestClient(app) as client:
        response = client.get("/api/stories/1")

    assert response.status_code == 200
    assert response.json()["character_ids"] == [1, 2]


def test_get_story_not_found():
    session = AsyncMock(spec=AsyncSession)
    session.execute.return_value = result_for(detail=None)
    install_overrides(session)

    with TestClient(app) as client:
        response = client.get("/api/stories/999")

    assert response.status_code == 404


def test_update_draft_story():
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="old desc", status="draft")

    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])
    # Validate new chars + delete old chars
    new_chars_res = result_for(items=[MagicMock(id=3), MagicMock(id=4)])
    delete_res = MagicMock()  # delete(StoryCharacter) result

    session.execute.side_effect = [story_res, chars_res, new_chars_res, delete_res]
    install_overrides(session)

    payload = {"description_vi": "new description is long enough", "character_ids": [3, 4]}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)

    assert response.status_code == 200
    assert s1.description_vi == "new description is long enough"


def test_update_non_draft_story_fails():
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="old", status="text_draft")

    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])

    session.execute.side_effect = [story_res, chars_res]
    install_overrides(session)

    payload = {"description_vi": "new description is long enough"}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)

    assert response.status_code == 409


def test_archive_draft():
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="desc", status="draft")

    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])

    clock_res = result_for(detail=datetime.now(timezone.utc))
    session.execute.side_effect = [story_res, chars_res, clock_res]
    install_overrides(session)

    with TestClient(app) as client:
        response = client.post("/api/stories/1/archive")

    assert response.status_code == 200
    assert s1.status == "archived"


def test_archive_idempotent():
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="desc", status="archived")

    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])

    session.execute.side_effect = [story_res, chars_res]
    install_overrides(session)

    with TestClient(app) as client:
        response = client.post("/api/stories/1/archive")

    assert response.status_code == 200
    assert s1.status == "archived"


def test_archive_non_draft():
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="desc", status="text_draft")

    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])

    session.execute.side_effect = [story_res, chars_res]
    install_overrides(session)

    with TestClient(app) as client:
        response = client.post("/api/stories/1/archive")

    assert response.status_code == 409


# ─── New tests: whitespace, null, empty, extra, FKs, archived, sort ────


def test_create_whitespace_only_description():
    """POST: whitespace-only description (>= 10 chars) → 422 after strip."""
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    payload = {
        "description_vi": "          ",  # 10 spaces
        "backbone_id": 1,
        "genre_id": 1,
        "art_style_id": 1,
        "target_age": "preschool",
        "length_pref": "short",
        "character_ids": [1, 2],
    }

    with TestClient(app) as client:
        response = client.post("/api/stories", json=payload)
    assert response.status_code == 422


def test_update_whitespace_only_description():
    """PATCH: whitespace-only description → 422."""
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    payload = {"description_vi": "          "}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)
    assert response.status_code == 422


def test_update_explicit_null_description():
    """PATCH: explicit null description_vi → 422."""
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    payload = {"description_vi": None}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)
    assert response.status_code == 422


def test_update_explicit_null_backbone():
    """PATCH: explicit null backbone_id → 422."""
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    payload = {"backbone_id": None}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)
    assert response.status_code == 422


def test_update_explicit_null_multiple_fields():
    """PATCH: multiple explicit nulls → 422."""
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    payload = {"target_age": None, "length_pref": None}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)
    assert response.status_code == 422


def test_update_empty_body():
    """PATCH: empty body {} → 422."""
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json={})
    assert response.status_code == 422


def test_update_extra_field_status():
    """PATCH: sending 'status' field → 422 (extra=forbid)."""
    session = AsyncMock(spec=AsyncSession)
    install_overrides(session)

    payload = {"status": "published"}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)
    assert response.status_code == 422


def test_create_invalid_fk_backbone():
    """POST: non-existent backbone_id → 422."""
    session = AsyncMock(spec=AsyncSession)

    backbone_res = result_for(detail=None)  # backbone not found
    session.execute.side_effect = [backbone_res]
    install_overrides(session)

    payload = {
        "description_vi": "This is a long description",
        "backbone_id": 999,
        "genre_id": 1,
        "art_style_id": 1,
        "target_age": "preschool",
        "length_pref": "short",
        "character_ids": [1, 2],
    }

    with TestClient(app) as client:
        response = client.post("/api/stories", json=payload)
    assert response.status_code == 422
    assert "backbone_id" in response.json()["detail"].lower()


def test_update_invalid_fk_genre():
    """PATCH: non-existent genre_id → 422."""
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="old desc", status="draft")
    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])
    genre_res = result_for(detail=None)  # genre not found

    session.execute.side_effect = [story_res, chars_res, genre_res]
    install_overrides(session)

    payload = {"genre_id": 999}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)
    assert response.status_code == 422
    assert "genre_id" in response.json()["detail"].lower()


def test_update_invalid_character_ids():
    """PATCH: character_ids with non-existent IDs → 422."""
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="old desc", status="draft")
    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])
    # Only 1 of 2 characters found
    new_chars_res = result_for(items=[MagicMock(id=1)])

    session.execute.side_effect = [story_res, chars_res, new_chars_res]
    install_overrides(session)

    payload = {"character_ids": [1, 999]}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)
    assert response.status_code == 422
    assert "character_ids" in response.json()["detail"].lower()


ADMIN_B = TokenUser(
    id=UUID("00000000-0000-0000-0000-000000000003"),
    email="admin_b@example.com",
    app_role="admin",
)


def test_cross_admin_visibility():
    """Admin B can see stories created by Admin A."""
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(
        id=1,
        description_vi="story by admin A",
        status="draft",
        created_by=ADMIN.id,
    )
    session.execute.return_value = result_for(items=[s1])
    install_overrides(session, user=ADMIN_B)

    with TestClient(app) as client:
        response = client.get("/api/stories")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["created_by"] == str(ADMIN.id)


def test_archive_keeps_character_ids():
    """After archiving, story detail still returns character_ids."""
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="desc", status="draft")
    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])

    # Archive call
    clock_res = result_for(detail=datetime.now(timezone.utc))
    session.execute.side_effect = [story_res, chars_res, clock_res]
    install_overrides(session)

    with TestClient(app) as client:
        response = client.post("/api/stories/1/archive")

    assert response.status_code == 200
    assert s1.status == "archived"

    # Now fetch the archived story — should still have character_ids
    story_res2 = result_for(detail=s1)
    chars_res2 = result_for(items=[1, 2])
    session.execute.side_effect = [story_res2, chars_res2]

    with TestClient(app) as client:
        response = client.get("/api/stories/1")

    assert response.status_code == 200
    assert response.json()["character_ids"] == [1, 2]
    assert response.json()["status"] == "archived"


def test_update_non_draft_does_not_modify():
    """PATCH on non-draft story → 409, record unchanged."""
    session = AsyncMock(spec=AsyncSession)

    s1 = Story(id=1, description_vi="original desc text", status="text_draft")
    story_res = result_for(detail=s1)
    chars_res = result_for(items=[1, 2])

    session.execute.side_effect = [story_res, chars_res]
    install_overrides(session)

    payload = {"description_vi": "new description should not apply"}

    with TestClient(app) as client:
        response = client.patch("/api/stories/1", json=payload)

    assert response.status_code == 409
    # Verify the story description was NOT changed
    assert s1.description_vi == "original desc text"
    # Verify commit was NOT called after the error
    session.commit.assert_not_called()
