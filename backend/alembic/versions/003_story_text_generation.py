"""Story text generation state.

Revision ID: 003
Revises: 002
Create Date: 2026-07-20 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "003"
down_revision: str | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_status_check")
    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_status_check CHECK (status IN ("
        "'draft', 'generating_text', 'text_draft', 'text_confirmed', "
        "'generating_images', 'pending_review', 'approved', 'published', 'archived'))"
    )
    op.execute("ALTER TABLE stories ADD COLUMN text_revision integer NOT NULL DEFAULT 0")
    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_text_revision_check CHECK (text_revision >= 0)"
    )
    op.execute("ALTER TABLE stories ADD COLUMN text_generation_claim_id uuid")
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM story_pages WHERE story_id IS NULL) THEN "
        "RAISE EXCEPTION 'Cannot make story_pages.story_id NOT NULL: orphan rows exist'; "
        "END IF; END $$"
    )
    op.execute("ALTER TABLE story_pages ALTER COLUMN story_id SET NOT NULL")


def downgrade() -> None:
    op.execute("UPDATE stories SET status = 'draft' WHERE status = 'generating_text'")
    op.execute("ALTER TABLE story_pages ALTER COLUMN story_id DROP NOT NULL")
    op.execute("ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_text_revision_check")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS text_generation_claim_id")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS text_revision")
    op.execute("ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_status_check")
    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_status_check CHECK (status IN ("
        "'draft', 'text_draft', 'text_confirmed', 'generating_images', "
        "'pending_review', 'approved', 'published', 'archived'))"
    )
