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
        # Phase 5: active regeneration target requires generating_images with claim
        CheckConstraint(
            "active_image_regeneration_page_id IS NULL "
            "OR (COALESCE(status = 'generating_images', false) "
            "AND image_generation_claim_id IS NOT NULL "
            "AND image_generation_heartbeat_at IS NOT NULL)",
            name="stories_active_regen_target_status_check",
        ),
        # Phase 5: published_at required when published
        CheckConstraint(
            "status <> 'published' OR published_at IS NOT NULL",
            name="stories_published_at_check",
        ),
        # Phase 5: share revision non-negative
        CheckConstraint(
            "public_share_revision >= 0",
            name="stories_share_revision_check",
        ),
        # Phase 5: token format when present
        CheckConstraint(
            "public_share_token IS NULL OR public_share_token ~ '^[A-Za-z0-9_-]{43}$'",
            name="stories_share_token_format_check",
        ),
        # Phase 5: active token requires published + activated + not revoked
        CheckConstraint(
            "public_share_token IS NULL "
            "OR (COALESCE(status = 'published', false) "
            "AND public_share_activated_at IS NOT NULL "
            "AND public_share_revoked_at IS NULL)",
            name="stories_active_share_check",
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
    # Phase 5: manual regeneration target — integer, no FK to avoid circular dependency
    active_image_regeneration_page_id = Column(Integer, nullable=True)
    # Phase 5: publish and share lifecycle
    published_at = Column(TIMESTAMP(timezone=True), nullable=True)
    public_share_token = Column(Text, nullable=True)  # varchar(43) enforced by CHECK
    public_share_revision = Column(Integer, nullable=False, default=0, server_default="0")
    public_share_activated_at = Column(TIMESTAMP(timezone=True), nullable=True)
    public_share_revoked_at = Column(TIMESTAMP(timezone=True), nullable=True)
    # FK to auth.users handled in raw SQL migration — no SQLAlchemy ForeignKey
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    characters = relationship("Character", secondary="story_characters")
    backbone = relationship("StoryBackbone")
    genre = relationship("StoryGenre")
    art_style = relationship("ArtStyle")
    pages = relationship(
        "StoryPage",
        order_by="StoryPage.page_no",
        cascade="all, delete-orphan",
        back_populates="story",
    )


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
    review_status = Column(Text, nullable=False, default="pending", server_default="pending")
    # FK to auth.users handled in raw SQL migration — no SQLAlchemy ForeignKey
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    story = relationship("Story", back_populates="pages")
