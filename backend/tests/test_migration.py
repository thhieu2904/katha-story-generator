"""Tests for the initial database migration (001_initial_schema).

Uses testcontainers PostgreSQL with auth.users stub from conftest.py.
"""

import pytest
from sqlalchemy import text

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
