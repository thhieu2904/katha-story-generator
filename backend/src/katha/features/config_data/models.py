"""SQLAlchemy models for configuration/lookup data tables."""

from sqlalchemy import Column, Integer, Text, func
from sqlalchemy.dialects.postgresql import TIMESTAMP

from katha.db.base import Base


class StoryBackbone(Base):
    """Story structure templates (e.g., Fable, Three-Act, Cumulative)."""

    __tablename__ = "story_backbones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name_vi = Column(Text, nullable=False)
    name_en = Column(Text, nullable=False)
    description_vi = Column(Text, nullable=True)
    prompt_template_en = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class StoryGenre(Base):
    """Story genre/tone modifiers (e.g., Fairy Tale, Hero, Comedy, Moral)."""

    __tablename__ = "story_genres"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name_vi = Column(Text, nullable=False)
    name_en = Column(Text, nullable=False)
    description_vi = Column(Text, nullable=True)
    prompt_modifier_en = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class ArtStyle(Base):
    """Art style options for image generation (e.g., Watercolor, Flat, 3D Cartoon)."""

    __tablename__ = "art_styles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name_vi = Column(Text, nullable=False)
    name_en = Column(Text, nullable=False)
    prompt_modifier_en = Column(Text, nullable=False)
    sample_image_url = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
