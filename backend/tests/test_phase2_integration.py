"""Docker-backed Phase 2 API verification against the real migrated schema."""

from collections.abc import AsyncGenerator

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user
from katha.features.auth.schemas import TokenUser
from katha.features.config_data.seed import run_seed
from katha.main import app


@pytest.mark.asyncio
async def test_seeded_phase2_read_api(
    session: AsyncSession,
    postgres_url: str,
    admin_user: TokenUser,
):
    await run_seed(database_url=postgres_url)

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    async def override_admin() -> TokenUser:
        return admin_user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_admin_user] = override_admin

    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            backbones = await client.get("/api/backbones")
            genres = await client.get("/api/genres")
            art_styles = await client.get("/api/art-styles")
            characters = await client.get("/api/characters")

            assert backbones.status_code == 200
            assert genres.status_code == 200
            assert art_styles.status_code == 200
            assert characters.status_code == 200
            assert len(backbones.json()) == 3
            assert len(genres.json()) == 4
            assert len(art_styles.json()) == 3
            assert len(characters.json()) == 7

            assert "prompt_template_en" not in backbones.json()[0]
            assert "prompt_modifier_en" not in genres.json()[0]
            assert "prompt_modifier_en" not in art_styles.json()[0]
            assert "appearance_prompt_en" not in characters.json()[0]

            character_ids = [item["id"] for item in characters.json()]
            assert character_ids == sorted(character_ids)

            detail = await client.get(f"/api/characters/{character_ids[0]}")
            assert detail.status_code == 200
            assert "appearance_prompt_en" in detail.json()

            missing = await client.get("/api/characters/2147483647")
            assert missing.status_code == 404
            assert missing.json() == {"detail": "Character not found"}
    finally:
        app.dependency_overrides.clear()
