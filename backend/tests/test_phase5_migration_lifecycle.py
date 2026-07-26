"""Real PostgreSQL lifecycle and constraint coverage for migration 006."""

from __future__ import annotations

import os
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from alembic import command

pytestmark = pytest.mark.integration


def _alembic_config(postgres_url: str) -> Config:
    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    config = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    config.set_main_option("sqlalchemy.url", sync_url)
    return config


def test_migration_006_lifecycle_normalizes_review_and_keeps_legacy_publish_inactive(
    postgres_url: str,
    run_migrations: None,
) -> None:
    config = _alembic_config(postgres_url)
    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    marker = f"phase5 migration lifecycle {uuid4()}"
    try:
        command.upgrade(config, "006")
        command.downgrade(config, "005")
        with engine.begin() as connection:
            pending_id = connection.execute(
                text(
                    "INSERT INTO stories "
                    "(title_vi, title_km, description_vi, target_age, length_pref, status) "
                    "VALUES ('Tieu de', 'ចំណងជើង', :description, 'preschool', 'short', "
                    "'pending_review') RETURNING id"
                ),
                {"description": marker},
            ).scalar_one()
            connection.execute(
                text(
                    "INSERT INTO story_pages "
                    "(story_id, page_no, text_vi, text_km, image_status, image_url, "
                    "review_status, reviewed_by, reviewed_at, review_notes) VALUES "
                    "(:story_id, 1, 'Trang', 'ទំព័រ។', 'completed', :url, NULL, NULL, NULL, NULL)"
                ),
                {"story_id": pending_id, "url": "https://assets.example.test/legacy.webp"},
            )
            connection.execute(
                text(
                    "INSERT INTO stories "
                    "(title_vi, title_km, description_vi, target_age, length_pref, status) "
                    "VALUES ('Published', 'បានបោះពុម្ព', :description, 'preschool', 'short', "
                    "'published')"
                ),
                {"description": f"{marker}-published"},
            )

        command.upgrade(config, "006")
        with engine.connect() as connection:
            review_status = connection.execute(
                text("SELECT review_status FROM story_pages WHERE story_id=:story_id"),
                {"story_id": pending_id},
            ).scalar_one()
            published = connection.execute(
                text(
                    "SELECT published_at IS NOT NULL, public_share_token "
                    "FROM stories WHERE description_vi=:description"
                ),
                {"description": f"{marker}-published"},
            ).one()
        assert review_status == "pending"
        assert tuple(published) == (True, None)

        command.downgrade(config, "005")
        with engine.connect() as connection:
            assert (
                connection.execute(
                    text(
                        "SELECT count(*) FROM information_schema.columns "
                        "WHERE table_name='stories' AND column_name='public_share_token'"
                    )
                ).scalar_one()
                == 0
            )
        command.upgrade(config, "006")
    finally:
        command.upgrade(config, "006")
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM stories WHERE description_vi LIKE :marker"),
                {"marker": f"{marker}%"},
            )
        engine.dispose()


def test_migration_006_rejects_conflicting_legacy_review_metadata(
    postgres_url: str,
    run_migrations: None,
) -> None:
    config = _alembic_config(postgres_url)
    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    marker = f"phase5 invalid legacy review {uuid4()}"
    try:
        command.upgrade(config, "006")
        command.downgrade(config, "005")
        with engine.begin() as connection:
            story_id = connection.execute(
                text(
                    "INSERT INTO stories (description_vi, target_age, length_pref, status) "
                    "VALUES (:description, 'preschool', 'short', 'pending_review') RETURNING id"
                ),
                {"description": marker},
            ).scalar_one()
            connection.execute(
                text(
                    "INSERT INTO story_pages "
                    "(story_id, page_no, text_vi, image_status, image_url, "
                    "review_status, reviewed_at) VALUES "
                    "(:story_id, 1, 'Trang', 'completed', :url, NULL, clock_timestamp())"
                ),
                {"story_id": story_id, "url": "https://assets.example.test/legacy.webp"},
            )

        with pytest.raises(Exception, match="Cannot normalize review_status"):
            command.upgrade(config, "006")
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM stories WHERE description_vi=:description"),
                {"description": marker},
            )
        command.upgrade(config, "006")
        engine.dispose()


def test_migration_006_enforces_review_regeneration_and_share_constraints(
    postgres_url: str,
    run_migrations: None,
) -> None:
    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)
    marker = f"phase5 constraints {uuid4()}"
    token = "A" * 43
    try:
        with engine.begin() as connection:
            story_id = connection.execute(
                text(
                    "INSERT INTO stories "
                    "(description_vi, target_age, length_pref, status) "
                    "VALUES (:description, 'preschool', 'short', 'pending_review') RETURNING id"
                ),
                {"description": marker},
            ).scalar_one()

            with pytest.raises(IntegrityError), connection.begin_nested():
                connection.execute(
                    text(
                        "UPDATE stories SET active_image_regeneration_page_id=999999 "
                        "WHERE id=:story_id"
                    ),
                    {"story_id": story_id},
                )

            with pytest.raises(IntegrityError), connection.begin_nested():
                connection.execute(
                    text("UPDATE stories SET status='published' WHERE id=:story_id"),
                    {"story_id": story_id},
                )

            with pytest.raises(IntegrityError), connection.begin_nested():
                connection.execute(
                    text("UPDATE stories SET public_share_token='bad-token' WHERE id=:story_id"),
                    {"story_id": story_id},
                )

            first = connection.execute(
                text(
                    "INSERT INTO stories "
                    "(description_vi, target_age, length_pref, status, published_at, "
                    "public_share_token, public_share_activated_at) VALUES "
                    "(:description, 'preschool', 'short', 'published', clock_timestamp(), "
                    ":token, clock_timestamp()) RETURNING id"
                ),
                {"description": f"{marker}-published-1", "token": token},
            ).scalar_one()
            with pytest.raises(IntegrityError), connection.begin_nested():
                connection.execute(
                    text(
                        "INSERT INTO stories "
                        "(description_vi, target_age, length_pref, status, published_at, "
                        "public_share_token, public_share_activated_at) VALUES "
                        "(:description, 'preschool', 'short', 'published', clock_timestamp(), "
                        ":token, clock_timestamp())"
                    ),
                    {"description": f"{marker}-published-2", "token": token},
                )

            with pytest.raises(IntegrityError), connection.begin_nested():
                connection.execute(
                    text(
                        "INSERT INTO story_pages "
                        "(story_id, page_no, review_status, reviewed_at) "
                        "VALUES (:story_id, 1, 'pending', clock_timestamp())"
                    ),
                    {"story_id": first},
                )
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM stories WHERE description_vi LIKE :marker"),
                {"marker": f"{marker}%"},
            )
        engine.dispose()
