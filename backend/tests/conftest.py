"""Shared test fixtures — PostgreSQL testcontainer, migrations, async sessions."""

import os
import sys

import pytest
import pytest_asyncio
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from testcontainers.postgres import PostgresContainer

# Ensure the project src/ is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


@pytest.fixture(scope="session")
def postgres_url():
    """Start a PostgreSQL testcontainer and create the auth.users stub table."""
    with PostgresContainer("postgres:16-alpine") as pg:
        sync_url = pg.get_connection_url()
        # Create auth schema + stub table before running migrations
        engine = create_engine(sync_url)
        with engine.begin() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS auth"))
            conn.execute(text("CREATE TABLE auth.users (id uuid PRIMARY KEY)"))
        engine.dispose()
        # Yield async-compatible URL
        yield sync_url.replace("postgresql://", "postgresql+asyncpg://").replace(
            "psycopg2", "asyncpg"
        )


@pytest.fixture(scope="session")
def run_migrations(postgres_url):
    """Run Alembic migrations against the testcontainer database."""
    from alembic.config import Config

    from alembic import command

    sync_url = postgres_url.replace("postgresql+asyncpg://", "postgresql://")
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", sync_url)
    command.upgrade(alembic_cfg, "head")


@pytest_asyncio.fixture
async def session(postgres_url, run_migrations):
    """Yield an async SQLAlchemy session connected to the testcontainer."""
    engine = create_async_engine(postgres_url)
    async with AsyncSession(engine) as s:
        yield s
    await engine.dispose()
