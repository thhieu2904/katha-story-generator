"""SQLAlchemy model for the characters table."""

from sqlalchemy import Column, Integer, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, TIMESTAMP, UUID

from katha.db.base import Base


class Character(Base):
    """A character that can appear in stories."""

    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False)
    age = Column(Integer, nullable=True)
    personality_vi = Column(Text, nullable=True)
    appearance_vi = Column(Text, nullable=True)
    appearance_prompt_en = Column(Text, nullable=False)
    ref_image_urls: Column[list[str]] = Column(ARRAY(Text), server_default="{}")
    # FK to auth.users handled in raw SQL migration — no SQLAlchemy ForeignKey
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
