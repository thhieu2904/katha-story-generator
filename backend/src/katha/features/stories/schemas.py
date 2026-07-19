from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TargetAge = Literal["preschool", "early_primary", "late_primary"]
LengthPref = Literal["short", "medium", "long"]


class StoryCreate(BaseModel):
    description_vi: str = Field(..., max_length=2000)
    backbone_id: int = Field(..., gt=0)
    genre_id: int = Field(..., gt=0)
    art_style_id: int = Field(..., gt=0)
    target_age: TargetAge
    length_pref: LengthPref
    character_ids: list[int] = Field(..., min_length=2, max_length=3)

    @field_validator("description_vi", mode="before")
    @classmethod
    def strip_and_validate_description(cls, v: str) -> str:
        if not isinstance(v, str):
            return v  # let Pydantic handle type error
        stripped = v.strip()
        if len(stripped) < 10:
            raise ValueError("description_vi must be at least 10 characters after trimming")
        return stripped

    @field_validator("character_ids")
    @classmethod
    def unique_character_ids(cls, v: list[int]) -> list[int]:
        if len(set(v)) != len(v):
            raise ValueError("character_ids must be unique")
        if any(cid <= 0 for cid in v):
            raise ValueError("character_ids must be positive integers")
        return v


class StoryUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description_vi: str | None = Field(None, max_length=2000)
    backbone_id: int | None = Field(None, gt=0)
    genre_id: int | None = Field(None, gt=0)
    art_style_id: int | None = Field(None, gt=0)
    target_age: TargetAge | None = None
    length_pref: LengthPref | None = None
    character_ids: list[int] | None = Field(None, min_length=2, max_length=3)

    @model_validator(mode="before")
    @classmethod
    def reject_nulls_and_empty(cls, values: dict) -> dict:  # type: ignore[type-arg]
        if not isinstance(values, dict):
            return values
        # Reject empty body — at least one field must be provided
        if not values:
            raise ValueError("At least one field must be provided")
        # Reject explicit null for any field
        null_keys = [k for k, v in values.items() if v is None]
        if null_keys:
            raise ValueError(f"Explicit null not allowed for: {', '.join(sorted(null_keys))}")
        return values

    @field_validator("description_vi", mode="before")
    @classmethod
    def strip_and_validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not isinstance(v, str):
            return v
        stripped = v.strip()
        if len(stripped) < 10:
            raise ValueError("description_vi must be at least 10 characters after trimming")
        return stripped

    @field_validator("character_ids")
    @classmethod
    def unique_character_ids(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return v
        if len(set(v)) != len(v):
            raise ValueError("character_ids must be unique")
        if any(cid <= 0 for cid in v):
            raise ValueError("character_ids must be positive integers")
        return v


class StoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title_vi: str | None
    title_km: str | None
    description_vi: str
    backbone_id: int | None
    genre_id: int | None
    art_style_id: int | None
    target_age: str | None
    length_pref: str | None
    status: str
    cover_image_url: str | None
    created_by: UUID | None
    character_ids: list[int]
    created_at: datetime | None
    updated_at: datetime | None


class StoryListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title_vi: str | None
    title_km: str | None
    description_vi: str
    target_age: str | None
    length_pref: str | None
    status: str
    created_by: UUID | None
    created_at: datetime | None
    updated_at: datetime | None
