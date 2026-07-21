"""FastAPI request/response schemas for Phase 4 image planning and jobs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

ImageStatus = Literal["pending", "generating", "completed", "failed"]


class CreateImagePlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_text_revision: int = Field(ge=0)
    expected_image_plan_revision: int = Field(ge=0)


class ImagePlanMappingPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_id: int = Field(gt=0)
    character_ids: list[int] = Field(default_factory=list, max_length=3)

    @field_validator("character_ids")
    @classmethod
    def validate_ids(cls, value: list[int]) -> list[int]:
        if any(character_id <= 0 for character_id in value):
            raise ValueError("character_ids must be positive integers")
        if len(set(value)) != len(value):
            raise ValueError("character_ids must be unique")
        return value


class UpdateImagePlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_image_plan_revision: int = Field(ge=0)
    pages: list[ImagePlanMappingPage] = Field(min_length=1)

    @field_validator("pages")
    @classmethod
    def page_ids_must_be_unique(
        cls, value: list[ImagePlanMappingPage]
    ) -> list[ImagePlanMappingPage]:
        if len({page.page_id for page in value}) != len(value):
            raise ValueError("pages must not contain duplicate page_id values")
        return value


class GenerateImagesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_image_plan_revision: int = Field(ge=0)


class ImageProgressResponse(BaseModel):
    total: int = Field(ge=0)
    pending: int = Field(ge=0)
    generating: int = Field(ge=0)
    completed: int = Field(ge=0)
    failed: int = Field(ge=0)


class AvailableCharacterResponse(BaseModel):
    id: int
    name: str
    thumbnail_url: str | None


class StoryImagePageResponse(BaseModel):
    id: int
    page_no: int
    text_vi: str
    text_km: str
    text_en: str | None
    image_scene_en: str | None
    image_prompt_en: str | None
    character_ids: list[int]
    image_status: ImageStatus
    image_url: str | None
    image_attempt_count: int = Field(ge=0)
    image_error_code: str | None
    updated_at: datetime | None


class StoryImagesResponse(BaseModel):
    story_id: int
    title_vi: str | None
    status: str
    text_revision: int = Field(ge=0)
    image_plan_revision: int = Field(ge=0)
    image_plan_ready: bool
    mapping_locked: bool
    job_id: UUID | None
    job_stale: bool
    can_start: bool
    can_retry: bool
    can_resume: bool
    progress: ImageProgressResponse
    available_characters: list[AvailableCharacterResponse]
    pages: list[StoryImagePageResponse]


class GenerateImagesResponse(BaseModel):
    job_id: UUID
    already_running: bool
    status: Literal["generating_images"]
    progress: ImageProgressResponse
