"""Offline checks for the Alembic revision graph."""

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_migration_graph_has_single_002_head() -> None:
    config = Config("alembic.ini")
    script = ScriptDirectory.from_config(config)
    revision = script.get_revision("002")

    assert revision is not None
    assert revision.down_revision == "001"
    assert script.get_current_head() == "002"
