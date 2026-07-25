"""Story review and publish.

Revision ID: 006
Revises: 005
Create Date: 2026-07-25 03:08:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add Phase 5 story review, publishing, and sharing state."""

    # 1. Stories table - new columns
    op.execute("ALTER TABLE stories ADD COLUMN active_image_regeneration_page_id integer NULL")
    op.execute("ALTER TABLE stories ADD COLUMN published_at timestamptz NULL")
    op.execute("ALTER TABLE stories ADD COLUMN public_share_token varchar(43) NULL")
    op.execute("ALTER TABLE stories ADD COLUMN public_share_revision integer NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE stories ADD COLUMN public_share_activated_at timestamptz NULL")
    op.execute("ALTER TABLE stories ADD COLUMN public_share_revoked_at timestamptz NULL")

    # 3. Legacy published backfill (Before constraints)
    op.execute(
        "UPDATE stories "
        "SET published_at = COALESCE(updated_at, created_at, clock_timestamp()) "
        "WHERE status = 'published' AND published_at IS NULL"
    )

    # 2. Stories constraints
    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_active_regen_target_status_check "
        "CHECK (active_image_regeneration_page_id IS NULL OR ("
        "COALESCE(status = 'generating_images', false) "
        "AND image_generation_claim_id IS NOT NULL "
        "AND image_generation_heartbeat_at IS NOT NULL))"
    )

    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_published_at_check "
        "CHECK (status <> 'published' OR published_at IS NOT NULL)"
    )

    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_share_revision_check "
        "CHECK (public_share_revision >= 0)"
    )

    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_share_token_format_check "
        "CHECK (public_share_token IS NULL OR public_share_token ~ '^[A-Za-z0-9_-]{43}$')"
    )

    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_active_share_check "
        "CHECK (public_share_token IS NULL OR ("
        "COALESCE(status = 'published', false) "
        "AND public_share_activated_at IS NOT NULL "
        "AND public_share_revoked_at IS NULL))"
    )

    op.execute(
        "CREATE UNIQUE INDEX stories_share_token_unique "
        "ON stories (public_share_token) "
        "WHERE public_share_token IS NOT NULL"
    )

    # 4. story_pages.review_status hardening
    # Normalize safe NULLs first
    op.execute(
        "DO $$ BEGIN "
        "IF EXISTS (SELECT 1 FROM story_pages "
        "WHERE review_status IS NULL AND ("
        "reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_notes IS NOT NULL)) THEN "
        "RAISE EXCEPTION 'Cannot normalize review_status: found NULL status with non-NULL review "
        "metadata. Resolve these rows before retrying migration 006.'; "
        "END IF; END $$"
    )

    op.execute("UPDATE story_pages SET review_status = 'pending' WHERE review_status IS NULL")

    op.execute("ALTER TABLE story_pages ALTER COLUMN review_status SET NOT NULL")
    op.execute("ALTER TABLE story_pages ALTER COLUMN review_status SET DEFAULT 'pending'")

    op.execute(
        "ALTER TABLE story_pages ADD CONSTRAINT story_pages_review_pending_meta_check "
        "CHECK (review_status <> 'pending' OR ("
        "reviewed_by IS NULL AND reviewed_at IS NULL AND review_notes IS NULL))"
    )

    op.execute(
        "ALTER TABLE story_pages ADD CONSTRAINT story_pages_review_approved_meta_check "
        "CHECK (review_status <> 'approved' OR ("
        "reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_notes IS NULL))"
    )

    op.execute(
        "ALTER TABLE story_pages ADD CONSTRAINT story_pages_review_rejected_meta_check "
        "CHECK (review_status <> 'rejected' OR ("
        "reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL "
        "AND char_length(btrim(review_notes)) BETWEEN 5 AND 500))"
    )


def downgrade() -> None:
    """Remove Phase 5 story review and sharing state."""

    # 1. Drop story_pages review constraints
    op.execute(
        "ALTER TABLE story_pages DROP CONSTRAINT IF EXISTS story_pages_review_rejected_meta_check"
    )
    op.execute(
        "ALTER TABLE story_pages DROP CONSTRAINT IF EXISTS story_pages_review_approved_meta_check"
    )
    op.execute(
        "ALTER TABLE story_pages DROP CONSTRAINT IF EXISTS story_pages_review_pending_meta_check"
    )

    # 2. Allow NULL review_status again
    op.execute("ALTER TABLE story_pages ALTER COLUMN review_status DROP DEFAULT")
    op.execute("ALTER TABLE story_pages ALTER COLUMN review_status DROP NOT NULL")

    # 3. Drop stories share token unique index
    op.execute("DROP INDEX IF EXISTS stories_share_token_unique")

    # 4. Drop stories constraints
    op.execute("ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_active_share_check")
    op.execute("ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_share_token_format_check")
    op.execute("ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_share_revision_check")
    op.execute("ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_published_at_check")
    op.execute(
        "ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_active_regen_target_status_check"
    )

    # 5. Drop stories columns
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS public_share_revoked_at")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS public_share_activated_at")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS public_share_revision")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS public_share_token")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS published_at")
    op.execute("ALTER TABLE stories DROP COLUMN IF EXISTS active_image_regeneration_page_id")
