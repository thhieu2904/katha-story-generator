"""Offline checks for the Alembic revision graph."""

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_migration_graph_has_single_006_head() -> None:
    config = Config("alembic.ini")
    script = ScriptDirectory.from_config(config)
    rev_005 = script.get_revision("005")
    rev_006 = script.get_revision("006")

    assert rev_005 is not None
    assert rev_005.down_revision == "004"
    assert rev_006 is not None
    assert rev_006.down_revision == "005"
    assert script.get_current_head() == "006"
