"""Story editor Khmer validation metadata.

Revision ID: 004
Revises: 003
Create Date: 2026-07-20 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE story_pages ADD COLUMN khmer_validated_at timestamptz NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE story_pages DROP COLUMN IF EXISTS khmer_validated_at")
