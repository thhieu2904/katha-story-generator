"""Initial schema — all 7 tables for Katha Story Generator.

Revision ID: 001
Revises: None
Create Date: 2024-01-01 00:00:00.000000

Uses raw SQL via op.execute() for full control, especially for FK to auth.users.
Each op.execute() contains exactly 1 CREATE TABLE / CREATE INDEX statement.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Config tables ──────────────────────────────────────────────────

    op.execute("""CREATE TABLE story_backbones (
        id              serial PRIMARY KEY,
        name_vi         text NOT NULL,
        name_en         text NOT NULL,
        description_vi  text,
        prompt_template_en text NOT NULL,
        created_at      timestamptz DEFAULT now()
    );""")

    op.execute("""CREATE TABLE story_genres (
        id              serial PRIMARY KEY,
        name_vi         text NOT NULL,
        name_en         text NOT NULL,
        description_vi  text,
        prompt_modifier_en text NOT NULL,
        created_at      timestamptz DEFAULT now()
    );""")

    op.execute("""CREATE TABLE art_styles (
        id              serial PRIMARY KEY,
        name_vi         text NOT NULL,
        name_en         text NOT NULL,
        prompt_modifier_en text NOT NULL,
        sample_image_url text,
        created_at      timestamptz DEFAULT now()
    );""")

    # ── Core tables with FK to auth.users ──────────────────────────────

    op.execute("""CREATE TABLE characters (
        id                   serial PRIMARY KEY,
        name                 text NOT NULL,
        age                  int,
        personality_vi       text,
        appearance_vi        text,
        appearance_prompt_en text NOT NULL,
        ref_image_urls       text[] DEFAULT '{}',
        created_by           uuid REFERENCES auth.users(id),
        created_at           timestamptz DEFAULT now(),
        updated_at           timestamptz DEFAULT now()
    );""")

    op.execute("""CREATE TABLE stories (
        id              serial PRIMARY KEY,
        title_vi        text,
        title_km        text,
        description_vi  text NOT NULL,
        backbone_id     int REFERENCES story_backbones(id),
        genre_id        int REFERENCES story_genres(id),
        art_style_id    int REFERENCES art_styles(id),
        target_age      int,
        length_pref     text CHECK (length_pref IN ('short', 'medium', 'long')),
        status          text DEFAULT 'draft'
                        CHECK (status IN (
                            'draft', 'text_draft', 'text_confirmed',
                            'generating_images', 'pending_review',
                            'approved', 'published', 'archived'
                        )),
        cover_image_url text,
        created_by      uuid REFERENCES auth.users(id),
        created_at      timestamptz DEFAULT now(),
        updated_at      timestamptz DEFAULT now()
    );""")

    op.execute("""CREATE TABLE story_characters (
        story_id        int REFERENCES stories(id) ON DELETE CASCADE,
        character_id    int REFERENCES characters(id),
        PRIMARY KEY (story_id, character_id)
    );""")

    op.execute("""CREATE TABLE story_pages (
        id              serial PRIMARY KEY,
        story_id        int REFERENCES stories(id) ON DELETE CASCADE,
        page_no         int NOT NULL,
        text_vi         text,
        text_en         text,
        text_km         text,
        image_prompt_en text,
        image_url       text,
        spellcheck_flags jsonb DEFAULT '[]',
        review_status   text DEFAULT 'pending'
                        CHECK (review_status IN ('pending', 'approved', 'rejected')),
        reviewed_by     uuid REFERENCES auth.users(id),
        reviewed_at     timestamptz,
        review_notes    text,
        created_at      timestamptz DEFAULT now(),
        updated_at      timestamptz DEFAULT now(),
        UNIQUE (story_id, page_no)
    );""")

    # ── Indexes ────────────────────────────────────────────────────────

    op.execute("CREATE INDEX idx_story_pages_story_id ON story_pages(story_id);")
    op.execute("CREATE INDEX idx_stories_status ON stories(status);")
    op.execute("CREATE INDEX idx_stories_created_by ON stories(created_by);")


def downgrade() -> None:
    # Reverse order, no CASCADE
    op.execute("DROP TABLE IF EXISTS story_pages;")
    op.execute("DROP TABLE IF EXISTS story_characters;")
    op.execute("DROP TABLE IF EXISTS stories;")
    op.execute("DROP TABLE IF EXISTS characters;")
    op.execute("DROP TABLE IF EXISTS art_styles;")
    op.execute("DROP TABLE IF EXISTS story_genres;")
    op.execute("DROP TABLE IF EXISTS story_backbones;")
