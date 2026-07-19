"""Pydantic contracts for story editing and confirmation."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from katha.features.stories.schemas import StoryTextResponse

INSTRUCTION_MIN_CHARS = 5
INSTRUCTION_MAX_CHARS = 1000
EDIT_MAX_OUTPUT_TOKENS = 8000
ADD_PAGE_MAX_OUTPUT_TOKENS = 1500
RETRANSLATE_MAX_OUTPUT_TOKENS = 1500
QuickAction = Literal["shorten", "lengthen", "more_dramatic", "simplify"]


class QuickActionEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["quick_action"]
    action: QuickAction
    expected_revision: int = Field(ge=1)


class InstructionEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["instruction"]
    instruction_vi: str = Field(min_length=INSTRUCTION_MIN_CHARS, max_length=INSTRUCTION_MAX_CHARS)
    expected_revision: int = Field(ge=1)

    @field_validator("instruction_vi", mode="before")
    @classmethod
    def trim_instruction(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


EditRequest = Annotated[QuickActionEdit | InstructionEdit, Field(discriminator="kind")]


class AddPageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    after_page_id: int | None = Field(default=None, gt=0)
    instruction_vi: str | None = Field(
        default=None, min_length=INSTRUCTION_MIN_CHARS, max_length=INSTRUCTION_MAX_CHARS
    )
    expected_revision: int = Field(ge=1)

    @field_validator("instruction_vi", mode="before")
    @classmethod
    def trim_optional_instruction(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class ReorderPagesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_ids: list[int] = Field(min_length=1, max_length=16)
    expected_revision: int = Field(ge=1)

    @field_validator("page_ids")
    @classmethod
    def unique_positive_ids(cls, value: list[int]) -> list[int]:
        if any(page_id <= 0 for page_id in value) or len(set(value)) != len(value):
            raise ValueError("page_ids must be unique positive integers")
        return value


class ValidateKhmerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int = Field(ge=1)


class RetranslateTitleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target: Literal["title"]
    expected_revision: int = Field(ge=1)


class RetranslatePageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target: Literal["page"]
    page_id: int = Field(gt=0)
    expected_revision: int = Field(ge=1)


RetranslateRequest = Annotated[
    RetranslateTitleRequest | RetranslatePageRequest, Field(discriminator="target")
]


class ConfirmTextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int = Field(ge=1)
    acknowledge_khmer_warnings: bool = False


class RevisedPageVi(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_page_id: int | None
    text_vi: str


class RevisedStoryVi(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title_vi: str
    pages: list[RevisedPageVi]


class AddedPageVi(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text_vi: str


class RetranslatedTextKm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text_km: str


class ChangeSummary(BaseModel):
    has_changes: bool
    title_changed: bool
    edited_page_ids: list[int]
    added_page_ids: list[int]
    deleted_page_ids: list[int]
    order_changed: bool
    before_count: int
    after_count: int


class MutationResponse(BaseModel):
    story: StoryTextResponse
    changes: ChangeSummary
