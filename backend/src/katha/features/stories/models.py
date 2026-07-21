"""SQLAlchemy models for stories, story_pages, and story_characters tables."""

from typing import Any

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import relationship

from katha.db.base import Base


class Story(Base):
    """A generated story with metadata and status tracking."""

    __tablename__ = "stories"
    __table_args__ = (
        CheckConstraint("text_revision >= 0", name="stories_text_revision_check"),
        CheckConstraint("image_plan_revision >= 0", name="stories_image_plan_revision_check"),
        CheckConstraint(
            "(image_generation_claim_id IS NULL AND image_generation_heartbeat_at IS NULL) "
            "OR (image_generation_claim_id IS NOT NULL "
            "AND image_generation_heartbeat_at IS NOT NULL)",
            name="stories_image_generation_claim_heartbeat_check",
        ),
        CheckConstraint(
            "image_generation_claim_id IS NULL OR COALESCE(status = 'generating_images', false)",
            name="stories_image_generation_claim_status_check",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    title_vi = Column(Text, nullable=True)
    title_km = Column(Text, nullable=True)
    description_vi = Column(Text, nullable=False)
    backbone_id = Column(Integer, ForeignKey("story_backbones.id"), nullable=True)
    genre_id = Column(Integer, ForeignKey("story_genres.id"), nullable=True)
    art_style_id = Column(Integer, ForeignKey("art_styles.id"), nullable=True)
    target_age = Column(Text, nullable=True)
    length_pref = Column(Text, nullable=True)  # CHECK constraint in SQL migration
    status = Column(Text, server_default="draft")  # CHECK constraint in SQL migration
    cover_image_url = Column(Text, nullable=True)
    text_revision = Column(Integer, nullable=False, default=0, server_default="0")
    text_generation_claim_id = Column(UUID(as_uuid=True), nullable=True)
    image_plan_revision = Column(Integer, nullable=False, default=0, server_default="0")
    image_plan_locked_at = Column(TIMESTAMP(timezone=True), nullable=True)
    image_generation_claim_id = Column(UUID(as_uuid=True), nullable=True)
    image_generation_heartbeat_at = Column(TIMESTAMP(timezone=True), nullable=True)
    # FK to auth.users handled in raw SQL migration — no SQLAlchemy ForeignKey
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    characters = relationship("Character", secondary="story_characters")
    backbone = relationship("StoryBackbone")
    genre = relationship("StoryGenre")
    art_style = relationship("ArtStyle")


class StoryCharacter(Base):
    """Many-to-many association between stories and characters."""

    __tablename__ = "story_characters"

    story_id = Column(
        Integer,
        ForeignKey("stories.id", ondelete="CASCADE"),
        primary_key=True,
    )
    character_id = Column(
        Integer,
        ForeignKey("characters.id"),
        primary_key=True,
    )


class StoryPage(Base):
    """Individual pages within a story, with text, images, and review status."""

    __tablename__ = "story_pages"
    __table_args__ = (
        CheckConstraint(
            "image_status IN ('pending', 'generating', 'completed', 'failed')",
            name="story_pages_image_status_check",
        ),
        CheckConstraint(
            "image_attempt_count >= 0",
            name="story_pages_image_attempt_count_check",
        ),
        CheckConstraint(
            "cardinality(image_character_ids) <= 3",
            name="story_pages_image_character_ids_check",
        ),
        CheckConstraint(
            "image_status <> 'completed' OR NULLIF(btrim(image_url), '') IS NOT NULL",
            name="story_pages_completed_image_url_check",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    story_id = Column(
        Integer,
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=False,
    )
    page_no = Column(Integer, nullable=False)
    text_vi = Column(Text, nullable=True)
    text_en = Column(Text, nullable=True)
    text_km = Column(Text, nullable=True)
    image_scene_en = Column(Text, nullable=True)
    image_prompt_en = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    image_character_ids: Any = Column(
        ARRAY(Integer),
        nullable=False,
        default=list,
        server_default=text("'{}'::integer[]"),
    )
    image_status = Column(Text, nullable=False, default="pending", server_default="pending")
    image_attempt_count = Column(Integer, nullable=False, default=0, server_default="0")
    image_error_code = Column(Text, nullable=True)
    spellcheck_flags = Column(JSONB, server_default="[]")
    khmer_validated_at = Column(TIMESTAMP(timezone=True), nullable=True)
    review_status = Column(Text, server_default="pending")  # CHECK in SQL migration
    # FK to auth.users handled in raw SQL migration — no SQLAlchemy ForeignKey
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
