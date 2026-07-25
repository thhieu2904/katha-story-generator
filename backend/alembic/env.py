"""Alembic environment configuration.

Adds project src/ to sys.path, imports all models via model_registry,
and loads DATABASE_URL from Settings (not alembic.ini).
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Add project src/ to path so katha package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Import model registry to register all models with Base.metadata
import katha.db.model_registry  # noqa: F401
from katha.db.base import Base

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    """Exclude objects from Supabase-managed schemas."""
    if type_ == "table" and hasattr(object, "schema"):
        if object.schema in ("auth", "storage", "realtime", "extensions"):
            return False
    return True


def get_url() -> str:
    """Get database URL from Settings or alembic config override."""
    # Allow override from alembic_cfg.set_main_option (used in tests)
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url

    # Otherwise load from application settings
    from katha.core.config import Settings

    settings = Settings()
    # Alembic runs synchronously — convert asyncpg URL to psycopg2/sync
    return settings.DATABASE_URL.replace("+asyncpg", "")


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generates SQL without connecting."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connects to the database."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
