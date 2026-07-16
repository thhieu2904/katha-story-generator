"""Contract tests for Phase 2 read-only endpoints without Docker."""

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
from katha.features.characters.models import Character
from katha.features.config_data.models import ArtStyle, StoryBackbone, StoryGenre
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


def result_for(items: list[object], detail: object | None = None) -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.all.return_value = items
    result.scalar_one_or_none.return_value = detail
    return result


def install_overrides(result: MagicMock, user: TokenUser = ADMIN) -> None:
    session = AsyncMock(spec=AsyncSession)
    session.execute.return_value = result

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    async def override_admin() -> TokenUser:
        return user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_admin_user] = override_admin


@pytest.fixture(autouse=True)
def clean_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("path", "record", "hidden_field"),
    [
        (
            "/api/backbones",
            StoryBackbone(
                id=1,
                name_vi="Ngụ ngôn",
                name_en="Fable",
                description_vi="Mô tả",
                prompt_template_en="internal",
            ),
            "prompt_template_en",
        ),
        (
            "/api/genres",
            StoryGenre(
                id=1,
                name_vi="Cổ tích",
                name_en="Fairy tale",
                description_vi="Mô tả",
                prompt_modifier_en="internal",
            ),
            "prompt_modifier_en",
        ),
        (
            "/api/art-styles",
            ArtStyle(
                id=1,
                name_vi="Màu nước",
                name_en="Watercolor",
                sample_image_url=None,
                prompt_modifier_en="internal",
            ),
            "prompt_modifier_en",
        ),
    ],
)
def test_config_endpoints_are_admin_only_and_hide_prompts(path, record, hidden_field):
    install_overrides(result_for([record]))

    with TestClient(app) as client:
        response = client.get(path)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert hidden_field not in response.json()[0]


def test_character_list_hides_internal_prompt():
    character = Character(
        id=2,
        name="Dara",
        age=9,
        personality_vi="Can đảm",
        appearance_vi="Trang phục Khmer",
        appearance_prompt_en="internal visual anchor",
        ref_image_urls=["https://cdn.example/dara.png"],
    )
    install_overrides(result_for([character]))

    with TestClient(app) as client:
        response = client.get("/api/characters")

    assert response.status_code == 200
    assert response.json()[0]["id"] == 2
    assert "appearance_prompt_en" not in response.json()[0]


def test_character_detail_exposes_detail_fields():
    created_at = datetime.now(timezone.utc)
    character = Character(
        id=3,
        name="Yeay",
        age=67,
        personality_vi="Hiền hậu",
        appearance_vi="Khăn rằn",
        appearance_prompt_en="elderly Khmer grandmother",
        ref_image_urls=[],
        created_at=created_at,
    )
    install_overrides(result_for([], detail=character))

    with TestClient(app) as client:
        response = client.get("/api/characters/3")

    assert response.status_code == 200
    assert response.json()["appearance_prompt_en"] == "elderly Khmer grandmother"
    assert response.json()["created_at"] is not None


def test_missing_character_returns_stable_404():
    install_overrides(result_for([], detail=None))

    with TestClient(app) as client:
        response = client.get("/api/characters/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Character not found"}


def test_character_id_must_be_positive():
    install_overrides(result_for([]))

    with TestClient(app) as client:
        response = client.get("/api/characters/0")

    assert response.status_code == 422


def test_admin_endpoint_without_token_returns_401():
    with TestClient(app) as client:
        response = client.get("/api/characters")

    assert response.status_code == 401


def test_reader_is_forbidden_from_admin_endpoint():
    async def override_reader() -> TokenUser:
        return READER

    app.dependency_overrides[get_current_user] = override_reader

    with TestClient(app) as client:
        response = client.get("/api/characters")

    assert response.status_code == 403


def test_auth_me_returns_only_trusted_user_fields():
    async def override_user() -> TokenUser:
        return ADMIN

    app.dependency_overrides[get_current_user] = override_user

    with TestClient(app) as client:
        response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": str(ADMIN.id),
        "email": ADMIN.email,
        "app_role": "admin",
    }
