"""Story image-generation plan and job state.

Revision ID: 005
Revises: 004
Create Date: 2026-07-21 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add durable per-page image-plan and in-process job state.

    Existing image URLs predate the Phase 4 state machine and cannot safely be
    inferred as completed while the mapping remains unlocked. Stop explicitly
    so the product owner can choose a preservation/import strategy.
    """
    op.execute(
        "DO $$ BEGIN "
        "IF EXISTS (SELECT 1 FROM story_pages "
        "WHERE NULLIF(btrim(image_url), '') IS NOT NULL) THEN "
        "RAISE EXCEPTION 'Cannot upgrade to Phase 4 while legacy "
        "story_pages.image_url values exist'; "
        "END IF; END $$"
    )

    op.execute(
        "DO $$ BEGIN "
        "IF EXISTS (SELECT 1 FROM stories "
        "WHERE status IN ('pending_review', 'approved', 'published')) THEN "
        "RAISE EXCEPTION 'Cannot upgrade to Phase 4 while legacy downstream "
        "story statuses exist without Phase 4 image state; explicitly normalize "
        "or archive them before retrying'; "
        "END IF; END $$"
    )

    # A pre-Phase-4 generating_images status has no claim/heartbeat owner.
    op.execute("UPDATE stories SET status = 'text_confirmed' WHERE status = 'generating_images'")

    op.execute("ALTER TABLE stories ADD COLUMN image_plan_revision integer NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE stories ADD COLUMN image_plan_locked_at timestamptz NULL")
    op.execute("ALTER TABLE stories ADD COLUMN image_generation_claim_id uuid NULL")
    op.execute("ALTER TABLE stories ADD COLUMN image_generation_heartbeat_at timestamptz NULL")
    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_image_plan_revision_check "
        "CHECK (image_plan_revision >= 0)"
    )
    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_image_generation_claim_heartbeat_check "
        "CHECK ((image_generation_claim_id IS NULL AND image_generation_heartbeat_at IS NULL) "
        "OR (image_generation_claim_id IS NOT NULL AND image_generation_heartbeat_at IS NOT NULL))"
    )
    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_image_generation_claim_status_check "
        "CHECK (image_generation_claim_id IS NULL "
        "OR COALESCE(status = 'generating_images', false))"
    )

    op.execute("ALTER TABLE story_pages ADD COLUMN image_scene_en text NULL")
    op.execute(
        "ALTER TABLE story_pages ADD COLUMN image_character_ids integer[] "
        "NOT NULL DEFAULT '{}'::integer[]"
    )
    op.execute("ALTER TABLE story_pages ADD COLUMN image_status text NOT NULL DEFAULT 'pending'")
    op.execute("ALTER TABLE story_pages ADD COLUMN image_attempt_count integer NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE story_pages ADD COLUMN image_error_code text NULL")
    op.execute(
        "ALTER TABLE story_pages ADD CONSTRAINT story_pages_image_status_check "
        "CHECK (image_status IN ('pending', 'generating', 'completed', 'failed'))"
    )
    op.execute(
        "ALTER TABLE story_pages ADD CONSTRAINT story_pages_image_attempt_count_check "
        "CHECK (image_attempt_count >= 0)"
    )
    op.execute(
        "ALTER TABLE story_pages ADD CONSTRAINT story_pages_image_character_ids_check "
        "CHECK (cardinality(image_character_ids) <= 3)"
    )
    op.execute(
        "ALTER TABLE story_pages ADD CONSTRAINT story_pages_completed_image_url_check "
        "CHECK (image_status <> 'completed' OR NULLIF(btrim(image_url), '') IS NOT NULL)"
    )


def downgrade() -> None:
    """Remove Phase 4 state without changing pre-existing image columns."""
    op.execute(
        "ALTER TABLE story_pages DROP CONSTRAINT IF EXISTS story_pages_completed_image_url_check"
    )
    op.execute(
        "ALTER TABLE story_pages DROP CONSTRAINT IF EXISTS story_pages_image_character_ids_check"
    )
    op.execute(
        "ALTER TABLE story_pages DROP CONSTRAINT IF EXISTS story_pages_image_attempt_count_check"
    )
    op.execute("ALTER TABLE story_pages DROP CONSTRAINT IF EXISTS story_pages_image_status_check")
    op.execute("ALTER TABLE story_pages DROP COLUMN IF EXISTS image_error_code")
    op.execute("ALTER TABLE story_pages DROP COLUMN IF EXISTS image_attempt_count")
    op.execute("ALTER TABLE story_pages DROP COLUMN IF EXISTS image_status")
    op.execute("ALTER TABLE story_pages DROP COLUMN IF EXISTS image_character_ids")
    op.execute("ALTER TABLE story_pages DROP COLUMN IF EXISTS image_scene_en")

    op.execute(
        "ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_image_generation_claim_status_check"
    )
    op.execute(
        "ALTER TABLE stories DROP CONSTRAINT IF EXISTS "
        "stories_image_generation_claim_heartbeat_check"
    )
    op.execute("ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_image_plan_revision_check")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS image_generation_heartbeat_at")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS image_generation_claim_id")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS image_plan_locked_at")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS image_plan_revision")
