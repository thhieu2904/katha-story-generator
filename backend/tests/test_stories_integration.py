"""Integration tests for stories CRUD on real PostgreSQL."""

from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user
from katha.features.auth.schemas import TokenUser
from katha.features.stories.schemas import StoryCreate
from katha.features.stories.service import create_story
from katha.main import app

pytestmark = pytest.mark.integration

ADMIN_A = TokenUser(
    id=UUID("00000000-0000-0000-0000-000000000101"),
    email="admin-a@example.com",
    app_role="admin",
)
ADMIN_B = TokenUser(
    id=UUID("00000000-0000-0000-0000-000000000102"),
    email="admin-b@example.com",
    app_role="admin",
)

BACKBONE_IDS = (101, 102)
GENRE_IDS = (101, 102)
ART_STYLE_IDS = (101, 102)
CHARACTER_IDS = (101, 102, 103)


@pytest_asyncio.fixture
async def integration_session(
    postgres_url: str,
    run_migrations: None,
) -> AsyncGenerator[AsyncSession, None]:
    """Yield a production-like session with a clean stories state."""
    engine = create_async_engine(postgres_url)
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_factory() as session:
        await session.execute(text("DELETE FROM story_characters"))
        await session.execute(text("DELETE FROM stories"))
        await session.commit()
        yield session
        await session.rollback()
        await session.execute(text("DELETE FROM story_characters"))
        await session.execute(text("DELETE FROM stories"))
        await session.commit()

    await engine.dispose()


@pytest_asyncio.fixture
async def seed_story_dependencies(integration_session: AsyncSession) -> None:
    """Seed auth users plus two real choices per config group and three characters."""
    statements = (
        (
            """
            INSERT INTO auth.users (id)
            VALUES (:admin_a), (:admin_b)
            ON CONFLICT (id) DO NOTHING
            """,
            {"admin_a": ADMIN_A.id, "admin_b": ADMIN_B.id},
        ),
        (
            """
            INSERT INTO story_backbones (id, name_vi, name_en, prompt_template_en)
            VALUES
                (101, 'Ngụ ngôn', 'Fable', 'Write a fable'),
                (102, 'Ba hồi', 'Three-act', 'Write a three-act story')
            ON CONFLICT (id) DO UPDATE SET
                name_vi = EXCLUDED.name_vi,
                name_en = EXCLUDED.name_en,
                prompt_template_en = EXCLUDED.prompt_template_en
            """,
            {},
        ),
        (
            """
            INSERT INTO story_genres (id, name_vi, name_en, prompt_modifier_en)
            VALUES
                (101, 'Cổ tích', 'Fairy tale', 'Use a fairy-tale tone'),
                (102, 'Hài hước', 'Comedy', 'Use a playful tone')
            ON CONFLICT (id) DO UPDATE SET
                name_vi = EXCLUDED.name_vi,
                name_en = EXCLUDED.name_en,
                prompt_modifier_en = EXCLUDED.prompt_modifier_en
            """,
            {},
        ),
        (
            """
            INSERT INTO art_styles (id, name_vi, name_en, prompt_modifier_en)
            VALUES
                (101, 'Màu nước', 'Watercolor', 'Soft watercolor illustration'),
                (102, 'Cắt giấy', 'Paper cut', 'Layered paper-cut illustration')
            ON CONFLICT (id) DO UPDATE SET
                name_vi = EXCLUDED.name_vi,
                name_en = EXCLUDED.name_en,
                prompt_modifier_en = EXCLUDED.prompt_modifier_en
            """,
            {},
        ),
        (
            """
            INSERT INTO characters (id, name, appearance_prompt_en)
            VALUES
                (101, 'Srey', 'A curious Cambodian girl'),
                (102, 'Dara', 'A kind Cambodian boy'),
                (103, 'Malis', 'A clever young friend')
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                appearance_prompt_en = EXCLUDED.appearance_prompt_en
            """,
            {},
        ),
    )

    for statement, params in statements:
        await integration_session.execute(text(statement), params)
    await integration_session.commit()


@pytest.mark.asyncio
async def test_full_cross_admin_crud_flow(
    integration_session: AsyncSession,
    seed_story_dependencies: None,
) -> None:
    """Exercise API CRUD, replacement, stable sort, and archive preservation."""
    current_admin = {"user": ADMIN_A}

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield integration_session

    async def override_admin() -> TokenUser:
        return current_admin["user"]

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_admin_user] = override_admin

    create_payload = {
        "description_vi": "Câu chuyện về Srey và Dara học cách chia sẻ",
        "backbone_id": BACKBONE_IDS[0],
        "genre_id": GENRE_IDS[0],
        "art_style_id": ART_STYLE_IDS[0],
        "target_age": "preschool",
        "length_pref": "short",
        "character_ids": [CHARACTER_IDS[0], CHARACTER_IDS[1]],
    }

    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            created_response = await client.post("/api/stories", json=create_payload)
            assert created_response.status_code == 201
            created = created_response.json()
            story_id = created["id"]
            assert created["status"] == "draft"
            assert created["created_by"] == str(ADMIN_A.id)

            persisted = (
                await integration_session.execute(
                    text("SELECT status, created_by FROM stories WHERE id = :story_id"),
                    {"story_id": story_id},
                )
            ).one()
            assert persisted.status == "draft"
            assert persisted.created_by == ADMIN_A.id

            current_admin["user"] = ADMIN_B
            listed = await client.get("/api/stories")
            detailed = await client.get(f"/api/stories/{story_id}")
            assert listed.status_code == 200
            assert story_id in [item["id"] for item in listed.json()]
            assert detailed.status_code == 200
            assert detailed.json()["created_by"] == str(ADMIN_A.id)

            update_payload = {
                "description_vi": "Câu chuyện đã được Admin B cập nhật đầy đủ",
                "backbone_id": BACKBONE_IDS[1],
                "genre_id": GENRE_IDS[1],
                "art_style_id": ART_STYLE_IDS[1],
                "target_age": "early_primary",
                "length_pref": "medium",
                "character_ids": [CHARACTER_IDS[1], CHARACTER_IDS[2]],
            }
            updated_response = await client.patch(
                f"/api/stories/{story_id}",
                json=update_payload,
            )
            assert updated_response.status_code == 200

            updated_row = (
                await integration_session.execute(
                    text(
                        "SELECT backbone_id, genre_id, art_style_id, description_vi "
                        "FROM stories WHERE id = :story_id"
                    ),
                    {"story_id": story_id},
                )
            ).one()
            assert updated_row.backbone_id == BACKBONE_IDS[1]
            assert updated_row.genre_id == GENRE_IDS[1]
            assert updated_row.art_style_id == ART_STYLE_IDS[1]
            assert updated_row.description_vi == update_payload["description_vi"]

            associations = (
                (
                    await integration_session.execute(
                        text(
                            "SELECT character_id FROM story_characters "
                            "WHERE story_id = :story_id ORDER BY character_id"
                        ),
                        {"story_id": story_id},
                    )
                )
                .scalars()
                .all()
            )
            assert associations == [CHARACTER_IDS[1], CHARACTER_IDS[2]]

            second_payload = {
                **create_payload,
                "description_vi": "Câu chuyện thứ hai để kiểm tra sắp xếp",
            }
            third_payload = {
                **create_payload,
                "description_vi": "Câu chuyện thứ ba để kiểm tra sắp xếp",
            }
            second_response = await client.post("/api/stories", json=second_payload)
            third_response = await client.post("/api/stories", json=third_payload)
            assert second_response.status_code == 201
            assert third_response.status_code == 201
            second_id = second_response.json()["id"]
            third_id = third_response.json()["id"]

            older = datetime(2026, 7, 18, tzinfo=timezone.utc)
            tied = datetime(2026, 7, 19, tzinfo=timezone.utc)
            await integration_session.execute(
                text("UPDATE stories SET created_at = :created_at WHERE id = :story_id"),
                {"created_at": older, "story_id": story_id},
            )
            for tied_id in (second_id, third_id):
                await integration_session.execute(
                    text("UPDATE stories SET created_at = :created_at WHERE id = :story_id"),
                    {"created_at": tied, "story_id": tied_id},
                )
            await integration_session.commit()
            integration_session.expire_all()

            sorted_response = await client.get("/api/stories")
            assert sorted_response.status_code == 200
            assert [item["id"] for item in sorted_response.json()] == [
                max(second_id, third_id),
                min(second_id, third_id),
                story_id,
            ]

            archived_response = await client.post(f"/api/stories/{story_id}/archive")
            assert archived_response.status_code == 200
            assert archived_response.json()["status"] == "archived"

            archived_row = (
                await integration_session.execute(
                    text("SELECT status FROM stories WHERE id = :story_id"),
                    {"story_id": story_id},
                )
            ).one()
            archived_associations = (
                (
                    await integration_session.execute(
                        text(
                            "SELECT character_id FROM story_characters "
                            "WHERE story_id = :story_id ORDER BY character_id"
                        ),
                        {"story_id": story_id},
                    )
                )
                .scalars()
                .all()
            )
            assert archived_row.status == "archived"
            assert archived_associations == [CHARACTER_IDS[1], CHARACTER_IDS[2]]

            default_list = await client.get("/api/stories")
            archived_list = await client.get(
                "/api/stories",
                params={"include_archived": True},
            )
            assert story_id not in [item["id"] for item in default_list.json()]
            assert story_id in [item["id"] for item in archived_list.json()]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_fk_failure_rolls_back_story_row(
    integration_session: AsyncSession,
    seed_story_dependencies: None,
) -> None:
    """A PostgreSQL FK failure cannot leave a partially-created story."""
    data = StoryCreate(
        description_vi="Câu chuyện dùng admin không tồn tại để buộc rollback",
        backbone_id=BACKBONE_IDS[0],
        genre_id=GENRE_IDS[0],
        art_style_id=ART_STYLE_IDS[0],
        target_age="preschool",
        length_pref="short",
        character_ids=[CHARACTER_IDS[0], CHARACTER_IDS[1]],
    )
    missing_admin = UUID("00000000-0000-0000-0000-000000000199")

    with pytest.raises(IntegrityError):
        await create_story(integration_session, data, missing_admin)

    count = (
        await integration_session.execute(
            text("SELECT count(*) FROM stories WHERE description_vi = :description"),
            {"description": data.description_vi},
        )
    ).scalar_one()
    assert count == 0
