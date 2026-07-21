"""Pure Phase 4 image-plan models, snapshots, and validation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

from pydantic import BaseModel, ConfigDict, Field, field_validator

TEXT_EN_MAX_CHARS = 1_800
IMAGE_SCENE_MAX_CHARS = 2_000
IMAGE_PROMPT_MAX_CHARS = 8_000


class ImageDomainError(ValueError):
    """A structured provider result or mapping violates the image domain contract."""


class PlannedImagePage(BaseModel):
    """One provider-proposed image-plan item before domain validation."""

    model_config = ConfigDict(extra="forbid")

    page_id: int = Field(gt=0)
    page_no: int = Field(gt=0)
    text_en: str = Field(max_length=TEXT_EN_MAX_CHARS)
    image_scene_en: str = Field(max_length=IMAGE_SCENE_MAX_CHARS)
    character_ids: list[int] = Field(default_factory=list, max_length=3)

    @field_validator("character_ids")
    @classmethod
    def validate_character_ids(cls, value: list[int]) -> list[int]:
        if any(character_id <= 0 for character_id in value):
            raise ValueError("character_ids must contain positive integers")
        if len(set(value)) != len(value):
            raise ValueError("character_ids must not contain duplicates")
        return value


class StoryImagePlanOutput(BaseModel):
    """Strict structured image-plan payload returned by the text model."""

    model_config = ConfigDict(extra="forbid")

    pages: list[PlannedImagePage]


@dataclass(frozen=True)
class ImagePlanPageSnapshot:
    id: int
    page_no: int
    text_vi: str


@dataclass(frozen=True)
class ImagePlanCharacterSnapshot:
    id: int
    name: str
    personality_vi: str | None
    appearance_prompt_en: str
    ref_image_urls: tuple[str, ...]


@dataclass(frozen=True)
class ImagePlanSnapshot:
    story_id: int
    text_revision: int
    image_plan_revision: int
    title_vi: str
    description_vi: str
    target_age: str
    art_style_name: str
    art_style_modifier_en: str
    pages: tuple[ImagePlanPageSnapshot, ...]
    characters: tuple[ImagePlanCharacterSnapshot, ...]


@dataclass(frozen=True)
class ImagePageSnapshot:
    """A page detached from a DB session for a single runner attempt."""

    story_id: int
    page_id: int
    page_no: int
    prompt_en: str
    reference_urls: tuple[str, ...]
    attempt_count: int


def clean_text(value: str, label: str, max_chars: int) -> str:
    """Normalize whitespace and reject empty/capped provider text."""

    cleaned = " ".join(value.split())
    if not cleaned:
        raise ImageDomainError(f"{label} is empty")
    if len(cleaned) > max_chars:
        raise ImageDomainError(f"{label} exceeds {max_chars} characters")
    return cleaned


def normalize_character_ids(
    character_ids: Iterable[int], *, allowed_character_ids: set[int]
) -> tuple[int, ...]:
    """Return a deterministic mapping after enforcing the Phase 4 subset rules."""

    normalized = tuple(character_ids)
    if len(normalized) > 3:
        raise ImageDomainError("A page can contain at most three selected characters")
    if any(character_id <= 0 for character_id in normalized):
        raise ImageDomainError("Character IDs must be positive")
    if len(set(normalized)) != len(normalized):
        raise ImageDomainError("Character IDs must be unique")
    unknown = set(normalized).difference(allowed_character_ids)
    if unknown:
        raise ImageDomainError("Character mapping contains a character outside the story cast")
    return tuple(sorted(normalized))


def validate_image_plan(
    payload: StoryImagePlanOutput,
    snapshot: ImagePlanSnapshot,
) -> StoryImagePlanOutput:
    """Validate exact page identity/order and all provider-proposed mappings atomically."""

    expected_pages = snapshot.pages
    if len(payload.pages) != len(expected_pages):
        raise ImageDomainError("Image plan page count does not match the current story")
    expected_ids = [page.id for page in expected_pages]
    expected_numbers = [page.page_no for page in expected_pages]
    if [page.page_id for page in payload.pages] != expected_ids:
        raise ImageDomainError("Image plan page IDs must exactly match current page order")
    if [page.page_no for page in payload.pages] != expected_numbers:
        raise ImageDomainError("Image plan page numbers must exactly match current page order")

    allowed_character_ids = {character.id for character in snapshot.characters}
    pages: list[PlannedImagePage] = []
    for page in payload.pages:
        pages.append(
            PlannedImagePage(
                page_id=page.page_id,
                page_no=page.page_no,
                text_en=clean_text(page.text_en, f"page {page.page_no} text_en", TEXT_EN_MAX_CHARS),
                image_scene_en=clean_text(
                    page.image_scene_en,
                    f"page {page.page_no} image_scene_en",
                    IMAGE_SCENE_MAX_CHARS,
                ),
                character_ids=list(
                    normalize_character_ids(
                        page.character_ids,
                        allowed_character_ids=allowed_character_ids,
                    )
                ),
            )
        )
    return StoryImagePlanOutput(pages=pages)


def validate_complete_mapping(
    mapping: Mapping[int, Sequence[int]],
    *,
    expected_page_ids: Sequence[int],
    allowed_character_ids: set[int],
) -> dict[int, tuple[int, ...]]:
    """Validate a full replacement mapping rather than accepting partial patches."""

    if set(mapping) != set(expected_page_ids) or len(mapping) != len(expected_page_ids):
        raise ImageDomainError("Image mapping must contain the exact current page set")
    return {
        page_id: normalize_character_ids(
            mapping[page_id],
            allowed_character_ids=allowed_character_ids,
        )
        for page_id in expected_page_ids
    }
