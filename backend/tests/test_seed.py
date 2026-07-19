"""Tests for the idempotent seed script."""

import pytest
from sqlalchemy import text

from katha.features.config_data.seed import run_seed

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_seed_inserts_all_records(session, postgres_url):
    """First seed run should insert all expected records."""
    counts = await run_seed(database_url=postgres_url)

    assert counts["backbones"] == 3
    assert counts["genres"] == 4
    assert counts["art_styles"] == 3
    assert counts["characters"] == 7

    # Verify actual DB counts
    result = await session.execute(text("SELECT count(*) FROM story_backbones"))
    assert result.scalar() == 3

    result = await session.execute(text("SELECT count(*) FROM story_genres"))
    assert result.scalar() == 4

    result = await session.execute(text("SELECT count(*) FROM art_styles"))
    assert result.scalar() == 3

    result = await session.execute(text("SELECT count(*) FROM characters"))
    assert result.scalar() == 7


@pytest.mark.asyncio
async def test_seed_is_idempotent(session, postgres_url):
    """Second seed run should insert 0 new records (idempotent)."""
    # First run (may or may not have run in previous test — either way is fine)
    await run_seed(database_url=postgres_url)

    # Second run — should be all zeros
    counts = await run_seed(database_url=postgres_url)

    assert counts["backbones"] == 0
    assert counts["genres"] == 0
    assert counts["art_styles"] == 0
    assert counts["characters"] == 0
