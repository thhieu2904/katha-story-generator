"""Tests for the initial database migration (001_initial_schema).

Uses testcontainers PostgreSQL with auth.users stub from conftest.py.
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.integration

EXPECTED_TABLES = [
    "story_backbones",
    "story_genres",
    "art_styles",
    "characters",
    "stories",
    "story_characters",
    "story_pages",
]

EXPECTED_INDEXES = [
    "idx_story_pages_story_id",
    "idx_stories_status",
    "idx_stories_created_by",
]


@pytest.mark.asyncio
async def test_all_tables_exist(session):
    """All 7 tables should be created by the migration."""
    result = await session.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        )
    )
    tables = [row[0] for row in result.fetchall()]
    # Filter out alembic_version
    app_tables = [t for t in tables if t != "alembic_version"]

    for expected in EXPECTED_TABLES:
        assert expected in app_tables, f"Table '{expected}' not found. Got: {app_tables}"

    assert len(app_tables) == len(EXPECTED_TABLES)


@pytest.mark.asyncio
async def test_indexes_exist(session):
    """Custom indexes should be created by the migration."""
    result = await session.execute(
        text(
            "SELECT indexname FROM pg_indexes "
            "WHERE schemaname = 'public' AND indexname LIKE 'idx_%'"
        )
    )
    indexes = [row[0] for row in result.fetchall()]

    for expected in EXPECTED_INDEXES:
        assert expected in indexes, f"Index '{expected}' not found. Got: {indexes}"


@pytest.mark.asyncio
async def test_foreign_keys_exist(session):
    """FK constraints should exist for stories → backbones/genres/art_styles and auth.users."""
    result = await session.execute(
        text(
            "SELECT tc.constraint_name, tc.table_name, "
            "ccu.table_name AS foreign_table_name "
            "FROM information_schema.table_constraints tc "
            "JOIN information_schema.constraint_column_usage ccu "
            "  ON tc.constraint_name = ccu.constraint_name "
            "WHERE tc.constraint_type = 'FOREIGN KEY' "
            "  AND tc.table_schema = 'public'"
        )
    )
    fks = result.fetchall()
    fk_pairs = [(row[1], row[2]) for row in fks]

    # stories should reference story_backbones, story_genres, art_styles
    assert ("stories", "story_backbones") in fk_pairs
    assert ("stories", "story_genres") in fk_pairs
    assert ("stories", "art_styles") in fk_pairs

    # story_characters should reference stories and characters
    assert ("story_characters", "stories") in fk_pairs
    assert ("story_characters", "characters") in fk_pairs

    # story_pages should reference stories
    assert ("story_pages", "stories") in fk_pairs


@pytest.mark.asyncio
async def test_check_constraints_exist(session):
    """CHECK constraints should exist on stories.status, stories.length_pref,
    story_pages.review_status.
    """
    result = await session.execute(
        text(
            "SELECT tc.table_name, tc.constraint_name "
            "FROM information_schema.table_constraints tc "
            "WHERE tc.constraint_type = 'CHECK' "
            "  AND tc.table_schema = 'public' "
            "  AND tc.table_name IN ('stories', 'story_pages')"
        )
    )
    checks = result.fetchall()
    check_tables = [row[0] for row in checks]

    # stories should have at least 2 CHECK constraints (status + length_pref)
    stories_checks = [t for t in check_tables if t == "stories"]
    assert len(stories_checks) >= 2, f"Expected >=2 CHECK on stories, got {len(stories_checks)}"

    # story_pages should have at least 1 CHECK constraint (review_status)
    pages_checks = [t for t in check_tables if t == "story_pages"]
    assert len(pages_checks) >= 1, f"Expected >=1 CHECK on story_pages, got {len(pages_checks)}"


@pytest.mark.asyncio
async def test_unique_constraint_story_pages(session):
    """story_pages should have a UNIQUE constraint on (story_id, page_no)."""
    result = await session.execute(
        text(
            "SELECT tc.constraint_name "
            "FROM information_schema.table_constraints tc "
            "WHERE tc.constraint_type = 'UNIQUE' "
            "  AND tc.table_schema = 'public' "
            "  AND tc.table_name = 'story_pages'"
        )
    )
    uniques = result.fetchall()
    assert len(uniques) >= 1, "Expected UNIQUE constraint on story_pages"


# ─── Migration 002: target_age integer → text ────


class Test002TargetAgeGroups:
    """Tests for migration 002: target_age groups."""

    @pytest.mark.asyncio
    async def test_target_age_column_is_text(self, session):
        """After migration 002, target_age column should be TEXT."""
        result = await session.execute(
            text(
                "SELECT data_type FROM information_schema.columns "
                "WHERE table_name = 'stories' AND column_name = 'target_age'"
            )
        )
        row = result.fetchone()
        assert row is not None
        assert row[0] == "text"

    @pytest.mark.asyncio
    async def test_target_age_check_constraint_exists(self, session):
        """stories_target_age_check constraint should exist."""
        result = await session.execute(
            text(
                "SELECT constraint_name "
                "FROM information_schema.table_constraints "
                "WHERE constraint_type = 'CHECK' "
                "  AND table_schema = 'public' "
                "  AND table_name = 'stories' "
                "  AND constraint_name = 'stories_target_age_check'"
            )
        )
        assert result.fetchone() is not None, "stories_target_age_check constraint not found"

    @pytest.mark.asyncio
    async def test_valid_enum_values_accepted(self, session):
        """Insert preschool/early_primary/late_primary should succeed."""
        for val in ("preschool", "early_primary", "late_primary"):
            await session.execute(
                text(
                    "INSERT INTO stories "
                    "(description_vi, target_age, status, length_pref) "
                    "VALUES (:desc, :age, 'draft', 'short')"
                ),
                {"desc": f"test story {val}", "age": val},
            )
        await session.rollback()

    @pytest.mark.asyncio
    async def test_invalid_enum_rejected(self, session):
        """Insert invalid target_age value should raise IntegrityError."""
        with pytest.raises(IntegrityError):
            await session.execute(
                text(
                    "INSERT INTO stories "
                    "(description_vi, target_age, status, length_pref) "
                    "VALUES ('test', 'invalid_value', 'draft', 'short')"
                ),
            )
        await session.rollback()

    @pytest.mark.asyncio
    async def test_null_target_age_accepted(self, session):
        """Insert NULL target_age should succeed (nullable column)."""
        await session.execute(
            text(
                "INSERT INTO stories "
                "(description_vi, target_age, status, length_pref) "
                "VALUES ('test null', NULL, 'draft', 'short')"
            ),
        )
        await session.rollback()


class Test002MigrationLifecycle:
    """Test the full migration 002 lifecycle: upgrade → data mapping → downgrade.

    Requires the conftest fixture to be at 'head'. This test temporarily
    downgrades to 001, seeds legacy data, upgrades to 002, verifies mapping,
    downgrades back, then restores to head.
    """

    def test_migration_002_data_mapping(self, postgres_url, run_migrations):
        """Legacy integer values map correctly to text enums."""
        import os

        from alembic.config import Config

        from alembic import command

        sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        alembic_cfg.set_main_option("sqlalchemy.url", sync_url)
        engine = create_engine(sync_url)
        descriptions = [
            "r3 preschool lower",
            "r3 preschool upper",
            "r3 early lower",
            "r3 early upper",
            "r3 late lower",
            "r3 late upper",
            "r3 unmapped",
            "r3 null",
        ]

        try:
            command.upgrade(alembic_cfg, "head")

            # Downgrade to 001 (before target_age text migration)
            command.downgrade(alembic_cfg, "001")

            # Insert legacy values in a short, committed transaction.
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "INSERT INTO stories "
                        "(description_vi, target_age, status, length_pref) "
                        "VALUES "
                        "('r3 preschool lower', 3, 'draft', 'short'),"
                        "('r3 preschool upper', 5, 'draft', 'short'),"
                        "('r3 early lower', 6, 'draft', 'medium'),"
                        "('r3 early upper', 7, 'draft', 'medium'),"
                        "('r3 late lower', 9, 'draft', 'long'),"
                        "('r3 late upper', 10, 'draft', 'long'),"
                        "('r3 unmapped', 15, 'draft', 'short'),"
                        "('r3 null', NULL, 'draft', 'short')"
                    )
                )

            # Upgrade to 002
            command.upgrade(alembic_cfg, "002")

            # Verify the new type and all representative mappings.
            with engine.connect() as connection:
                data_type = connection.execute(
                    text(
                        "SELECT data_type FROM information_schema.columns "
                        "WHERE table_name = 'stories' AND column_name = 'target_age'"
                    )
                ).scalar_one()
                rows = connection.execute(
                    text(
                        "SELECT description_vi, target_age FROM stories "
                        "WHERE description_vi LIKE 'r3 %' ORDER BY description_vi"
                    )
                ).fetchall()

            mapping = dict(rows)
            assert data_type == "text"
            assert mapping["r3 preschool lower"] == "preschool"
            assert mapping["r3 preschool upper"] == "preschool"
            assert mapping["r3 early lower"] == "early_primary"
            assert mapping["r3 early upper"] == "early_primary"
            assert mapping["r3 late lower"] == "late_primary"
            assert mapping["r3 late upper"] == "late_primary"
            assert mapping["r3 unmapped"] is None
            assert mapping["r3 null"] is None

            # All valid enum values are accepted.
            with engine.begin() as connection:
                for value in ("preschool", "early_primary", "late_primary"):
                    connection.execute(
                        text(
                            "INSERT INTO stories "
                            "(description_vi, target_age, status, length_pref) "
                            "VALUES (:description, :target_age, 'draft', 'short')"
                        ),
                        {
                            "description": f"r3 valid {value}",
                            "target_age": value,
                        },
                    )

            # Close the failed transaction before running more Alembic DDL.
            with pytest.raises(IntegrityError), engine.begin() as connection:
                connection.execute(
                    text(
                        "INSERT INTO stories "
                        "(description_vi, target_age, status, length_pref) "
                        "VALUES ('r3 invalid', 'invalid', 'draft', 'short')"
                    )
                )

            # Downgrade back to 001 and verify integer restoration
            command.downgrade(alembic_cfg, "001")
            with engine.connect() as connection:
                data_type = connection.execute(
                    text(
                        "SELECT data_type FROM information_schema.columns "
                        "WHERE table_name = 'stories' AND column_name = 'target_age'"
                    )
                ).scalar_one()
                rows = connection.execute(
                    text(
                        "SELECT description_vi, target_age FROM stories "
                        "WHERE description_vi LIKE 'r3 %'"
                    )
                ).fetchall()

            downgraded = dict(rows)
            assert data_type == "integer"
            assert downgraded["r3 preschool lower"] == 4
            assert downgraded["r3 early lower"] == 7
            assert downgraded["r3 late lower"] == 10
        finally:
            # Restore only after every previous transaction and connection is closed.
            command.upgrade(alembic_cfg, "head")
            with engine.begin() as connection:
                connection.execute(
                    text("DELETE FROM stories WHERE description_vi = ANY(:descriptions)"),
                    {
                        "descriptions": descriptions
                        + [
                            f"r3 valid {value}"
                            for value in ("preschool", "early_primary", "late_primary")
                        ]
                    },
                )
            engine.dispose()


class Test003StoryTextGeneration:
    """Schema invariants introduced for atomic text generation."""

    @pytest.mark.asyncio
    async def test_generation_columns_and_page_fk_invariant(self, session):
        result = await session.execute(
            text(
                "SELECT column_name, data_type, is_nullable, column_default "
                "FROM information_schema.columns "
                "WHERE table_name IN ('stories', 'story_pages') "
                "AND column_name IN "
                "('text_revision', 'text_generation_claim_id', 'story_id')"
            )
        )
        columns = {row[0]: row[1:] for row in result.fetchall()}

        assert columns["text_revision"][0] == "integer"
        assert columns["text_revision"][1] == "NO"
        assert columns["text_generation_claim_id"][0] == "uuid"
        assert columns["story_id"][1] == "NO"

    @pytest.mark.asyncio
    async def test_generating_text_status_is_accepted(self, session):
        await session.execute(
            text(
                "INSERT INTO stories (description_vi, status, text_revision) "
                "VALUES ('generation status test', 'generating_text', 0)"
            )
        )
        await session.rollback()

    @pytest.mark.asyncio
    async def test_negative_text_revision_is_rejected(self, session):
        with pytest.raises(IntegrityError):
            await session.execute(
                text(
                    "INSERT INTO stories (description_vi, status, text_revision) "
                    "VALUES ('negative revision test', 'draft', -1)"
                )
            )
        await session.rollback()


class Test004StoryEditorValidation:
    """Schema invariant for explicit Khmer validation state."""

    @pytest.mark.asyncio
    async def test_khmer_validated_at_is_nullable_timestamptz(self, session):
        result = await session.execute(
            text(
                "SELECT data_type, is_nullable FROM information_schema.columns "
                "WHERE table_name = 'story_pages' "
                "AND column_name = 'khmer_validated_at'"
            )
        )
        row = result.fetchone()
        assert row is not None
        assert row[0] == "timestamp with time zone"
        assert row[1] == "YES"


class Test003004MigrationLifecycle:
    """Exercise Phase 3 generation/editor migration upgrade and downgrade boundaries."""

    def test_phase3_migrations_upgrade_and_downgrade(self, postgres_url, run_migrations):
        import os

        from alembic.config import Config

        from alembic import command

        sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
        config = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        config.set_main_option("sqlalchemy.url", sync_url)
        engine = create_engine(sync_url)

        try:
            command.upgrade(config, "head")
            command.downgrade(config, "002")
            with engine.connect() as connection:
                generation_columns = connection.execute(
                    text(
                        "SELECT count(*) FROM information_schema.columns "
                        "WHERE table_name='stories' "
                        "AND column_name IN ('text_revision', 'text_generation_claim_id')"
                    )
                ).scalar_one()
                assert generation_columns == 0

            command.upgrade(config, "004")
            with engine.connect() as connection:
                generation_columns = connection.execute(
                    text(
                        "SELECT count(*) FROM information_schema.columns "
                        "WHERE table_name='stories' "
                        "AND column_name IN ('text_revision', 'text_generation_claim_id')"
                    )
                ).scalar_one()
                editor_column = connection.execute(
                    text(
                        "SELECT count(*) FROM information_schema.columns "
                        "WHERE table_name='story_pages' "
                        "AND column_name='khmer_validated_at'"
                    )
                ).scalar_one()
                assert generation_columns == 2
                assert editor_column == 1

            command.downgrade(config, "003")
            with engine.connect() as connection:
                editor_column = connection.execute(
                    text(
                        "SELECT count(*) FROM information_schema.columns "
                        "WHERE table_name='story_pages' "
                        "AND column_name='khmer_validated_at'"
                    )
                ).scalar_one()
                assert editor_column == 0
        finally:
            command.upgrade(config, "head")
            engine.dispose()
