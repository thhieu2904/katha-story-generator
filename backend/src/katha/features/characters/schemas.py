"""Response schemas for the seed-only Character Bank."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CharacterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    age: int | None
    personality_vi: str | None
    appearance_vi: str | None
    ref_image_urls: list[str] = Field(default_factory=list)

    @field_validator("ref_image_urls", mode="before")
    @classmethod
    def normalize_image_urls(cls, value: object) -> object:
        return [] if value is None else value


class CharacterDetailOut(CharacterOut):
    appearance_prompt_en: str
    created_at: datetime | None
