"""target age groups

Revision ID: 002
Revises: 001
Create Date: 2026-07-19 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Alter target_age to text
    op.execute("ALTER TABLE stories ALTER COLUMN target_age TYPE TEXT USING target_age::TEXT")

    # 2. Map existing data
    op.execute("UPDATE stories SET target_age = 'preschool' WHERE target_age IN ('3', '4', '5')")
    op.execute(
        "UPDATE stories SET target_age = 'early_primary' WHERE target_age IN ('6', '7', '8')"
    )
    op.execute(
        "UPDATE stories SET target_age = 'late_primary' WHERE target_age IN ('9', '10', '11', '12')"
    )
    op.execute(
        "UPDATE stories SET target_age = NULL"
        " WHERE target_age NOT IN"
        " ('preschool', 'early_primary', 'late_primary')"
    )

    # 3. Add CHECK constraint
    op.execute(
        "ALTER TABLE stories ADD CONSTRAINT stories_target_age_check"
        " CHECK (target_age IS NULL OR target_age IN"
        " ('preschool', 'early_primary', 'late_primary'))"
    )


def downgrade() -> None:
    # 1. Drop CHECK constraint
    op.execute("ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_target_age_check")

    # 2. Map data back to integer
    op.execute("UPDATE stories SET target_age = '4' WHERE target_age = 'preschool'")
    op.execute("UPDATE stories SET target_age = '7' WHERE target_age = 'early_primary'")
    op.execute("UPDATE stories SET target_age = '10' WHERE target_age = 'late_primary'")

    # 3. Alter target_age back to integer
    op.execute("ALTER TABLE stories ALTER COLUMN target_age TYPE INTEGER USING target_age::INTEGER")
