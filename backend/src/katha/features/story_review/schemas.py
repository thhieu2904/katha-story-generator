from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class ReviewPageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    page_no: int
    text_km: str
    text_vi: str
    spellcheck_flags: list[dict]
    khmer_validated_at: datetime | None
    image_url: str | None
    image_status: str
    image_attempt_count: int
    image_error_code: str | None
    review_status: str  # pending | approved | rejected
    review_notes: str | None
    reviewed_at: datetime | None

    # per-page capabilities
    can_approve: bool
    can_reject: bool
    can_regenerate: bool


class ReviewProgressResponse(BaseModel):
    total: int
    pending: int
    approved: int
    rejected: int


class ReviewJobResponse(BaseModel):
    kind: str | None  # "review_regeneration" | null
    active_page_id: int | None
    is_running: bool
    is_stale: bool
    can_resume: bool


class ReviewShareResponse(BaseModel):
    active: bool
    revision: int
    token: str | None
    path: str | None
    activated_at: datetime | None
    revoked_at: datetime | None


class ReviewCapabilitiesResponse(BaseModel):
    can_edit_khmer: bool
    can_review_pages: bool
    can_complete_review: bool
    can_publish: bool
    can_create_share_link: bool
    can_revoke_share_link: bool
    can_archive: bool
    read_only: bool


class ReviewStoryResponse(BaseModel):
    id: int
    title_vi: str | None
    title_km: str | None
    status: str
    text_revision: int
    target_age: str | None
    genre: dict | None  # {id, name_vi, name_en}
    published_at: datetime | None


class ReviewStateResponse(BaseModel):
    story: ReviewStoryResponse
    progress: ReviewProgressResponse
    job: ReviewJobResponse
    share: ReviewShareResponse
    capabilities: ReviewCapabilitiesResponse
    pages: list[ReviewPageResponse]


class EditKhmerTitleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text_km: str = Field(..., min_length=1, max_length=160)
    expected_text_revision: int = Field(..., ge=0)


class EditKhmerPageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text_km: str = Field(..., min_length=1, max_length=1200)
    expected_text_revision: int = Field(..., ge=0)


class ApprovePageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["approve"]
    acknowledge_khmer_warnings: bool = False
    expected_text_revision: int = Field(..., ge=0)
    expected_review_status: str
    expected_image_attempt_count: int = Field(..., ge=0)
    expected_image_url: str


class RejectPageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["reject"]
    reason: str = Field(..., min_length=5, max_length=500)
    expected_text_revision: int = Field(..., ge=0)
    expected_review_status: str
    expected_image_attempt_count: int = Field(..., ge=0)
    expected_image_url: str


ReviewPageRequest = Annotated[
    ApprovePageRequest | RejectPageRequest, Field(discriminator="decision")
]


class CompleteReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_text_revision: int = Field(..., ge=0)


class RegenerateImageRequest(BaseModel):
    expected_text_revision: int
    expected_review_status: str
    expected_image_attempt_count: int
    expected_image_url: str


class RegenerateImageResponse(BaseModel):
    job_id: str
    already_running: bool
    active_page_id: int
