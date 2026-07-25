"""Real Alembic lifecycle coverage for the Phase 4 migration guards."""

from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text

from alembic import command
from alembic.config import Config

pytestmark = pytest.mark.integration


def _alembic_config(postgres_url: str) -> Config:
    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    config = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    config.set_main_option("sqlalchemy.url", sync_url)
    return config


def test_migration_005_upgrades_and_downgrades_a_phase3_story(
    postgres_url: str,
    run_migrations: None,
) -> None:
    """Exercise the normal 004 -> 005 -> 004 boundary with persisted Phase 3 data."""

    config = _alembic_config(postgres_url)
    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    marker = f"phase4 migration lifecycle {uuid4()}"
    try:
        command.upgrade(config, "head")
        command.downgrade(config, "004")
        with engine.begin() as connection:
            story_id = connection.execute(
                text(
                    "INSERT INTO stories (description_vi, target_age, length_pref, status) "
                    "VALUES (:description, 'preschool', 'short', 'text_confirmed') RETURNING id"
                ),
                {"description": marker},
            ).scalar_one()
            connection.execute(
                text(
                    "INSERT INTO story_pages "
                    "(story_id, page_no, text_vi, text_en, text_km, image_prompt_en) "
                    "VALUES (:story_id, 1, 'Trang cu.', 'Legacy page.', 'ទំព័រចាស់។', "
                    "'Legacy prompt.')"
                ),
                {"story_id": story_id},
            )

        command.upgrade(config, "005")
        with engine.connect() as connection:
            story = connection.execute(
                text(
                    "SELECT status, image_plan_revision, image_generation_claim_id "
                    "FROM stories WHERE description_vi = :description"
                ),
                {"description": marker},
            ).one()
            page = connection.execute(
                text(
                    "SELECT image_status, image_attempt_count, image_scene_en "
                    "FROM story_pages WHERE story_id = :story_id"
                ),
                {"story_id": story_id},
            ).one()
        assert tuple(story) == ("text_confirmed", 0, None)
        assert tuple(page) == ("pending", 0, None)

        command.downgrade(config, "004")
        with engine.connect() as connection:
            image_column_count = connection.execute(
                text(
                    "SELECT count(*) FROM information_schema.columns "
                    "WHERE table_name = 'story_pages' AND column_name = 'image_status'"
                )
            ).scalar_one()
        assert image_column_count == 0
    finally:
        # The legacy table layout is sufficient for the cleanup whether the test failed
        # before or after the Phase 4 upgrade.
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM stories WHERE description_vi = :description"),
                {"description": marker},
            )
        command.upgrade(config, "head")
        engine.dispose()


def test_migration_005_rejects_legacy_downstream_story_without_image_urls(
    postgres_url: str,
    run_migrations: None,
) -> None:
    """Do not silently strand a pre-Phase-4 review/published lifecycle state."""

    config = _alembic_config(postgres_url)
    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    marker = f"phase4 downstream guard {uuid4()}"
    try:
        command.upgrade(config, "head")
        command.downgrade(config, "004")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO stories (description_vi, target_age, length_pref, status) "
                    "VALUES (:description, 'preschool', 'short', 'pending_review')"
                ),
                {"description": marker},
            )

        with pytest.raises(Exception, match="legacy downstream"):
            command.upgrade(config, "005")
    finally:
        # The guard runs before all 005 DDL, so cleanup is valid even after the expected error.
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM stories WHERE description_vi = :description"),
                {"description": marker},
            )
        command.upgrade(config, "head")
        engine.dispose()


def test_migration_005_rejects_legacy_image_url_before_schema_changes(
    postgres_url: str,
    run_migrations: None,
) -> None:
    """Legacy assets require an explicit preserve/import decision before Phase 4."""

    config = _alembic_config(postgres_url)
    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    marker = f"phase4 legacy image guard {uuid4()}"
    try:
        command.upgrade(config, "head")
        command.downgrade(config, "004")
        with engine.begin() as connection:
            story_id = connection.execute(
                text(
                    "INSERT INTO stories (description_vi, target_age, length_pref, status) "
                    "VALUES (:description, 'preschool', 'short', 'text_confirmed') RETURNING id"
                ),
                {"description": marker},
            ).scalar_one()
            connection.execute(
                text(
                    "INSERT INTO story_pages (story_id, page_no, text_vi, image_url) "
                    "VALUES (:story_id, 1, 'Trang cu.', 'https://legacy.example/image.webp')"
                ),
                {"story_id": story_id},
            )

        with pytest.raises(Exception, match="legacy story_pages.image_url"):
            command.upgrade(config, "005")

        with engine.connect() as connection:
            image_status_column_count = connection.execute(
                text(
                    "SELECT count(*) FROM information_schema.columns "
                    "WHERE table_name = 'story_pages' AND column_name = 'image_status'"
                )
            ).scalar_one()
        assert image_status_column_count == 0
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM stories WHERE description_vi = :description"),
                {"description": marker},
            )
        command.upgrade(config, "head")
        engine.dispose()


def test_migration_005_normalizes_unowned_generating_images_story(
    postgres_url: str,
    run_migrations: None,
) -> None:
    """A pre-claim generating state becomes retryable instead of remaining orphaned."""

    config = _alembic_config(postgres_url)
    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    marker = f"phase4 generating normalization {uuid4()}"
    try:
        command.upgrade(config, "head")
        command.downgrade(config, "004")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO stories (description_vi, target_age, length_pref, status) "
                    "VALUES (:description, 'preschool', 'short', 'generating_images')"
                ),
                {"description": marker},
            )

        command.upgrade(config, "005")
        with engine.connect() as connection:
            story = connection.execute(
                text(
                    "SELECT status, image_generation_claim_id, "
                    "image_generation_heartbeat_at FROM stories "
                    "WHERE description_vi = :description"
                ),
                {"description": marker},
            ).one()
        assert tuple(story) == ("text_confirmed", None, None)
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM stories WHERE description_vi = :description"),
                {"description": marker},
            )
        command.upgrade(config, "head")
        engine.dispose()
