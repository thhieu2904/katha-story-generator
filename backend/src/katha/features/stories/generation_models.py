"""Structured AI payloads and deterministic domain validation for Phase 3B."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field

TITLE_MAX_CHARS = 160
PAGE_TEXT_MAX_CHARS = 1200
GENERATION_MAX_OUTPUT_TOKENS = 6000
TRANSLATION_MAX_OUTPUT_TOKENS = 8000

ALLOWED_PAGE_COUNTS: dict[str, set[int]] = {
    "short": {4, 6},
    "medium": {8, 10},
    "long": {12, 14},
}
AGE_RULES: dict[str, tuple[str, str, int]] = {
    "preschool": ("1-2", "12-30", 45),
    "early_primary": ("2-4", "30-60", 80),
    "late_primary": ("3-5", "50-90", 120),
}
AGE_LABELS: dict[str, str] = {
    "preschool": "for preschool children aged 3-5",
    "early_primary": "for early primary children aged 6-8",
    "late_primary": "for late primary children aged 9-12",
}


class DomainOutputError(ValueError):
    """Provider output parsed structurally but violates story domain rules."""


class GeneratedPageVi(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_no: int = Field(gt=0)
    text_vi: str


class GeneratedStoryVi(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title_vi: str
    pages: list[GeneratedPageVi]


class TranslatedPageKm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page_no: int = Field(gt=0)
    text_km: str


class TranslatedStoryKm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title_km: str
    pages: list[TranslatedPageKm]


@dataclass(frozen=True)
class CharacterSnapshot:
    name: str
    age: int | None
    personality_vi: str | None
    appearance_vi: str | None
    appearance_prompt_en: str


@dataclass(frozen=True)
class GenerationSnapshot:
    story_id: int
    description_vi: str
    backbone_prompt_en: str
    genre_prompt_en: str
    target_age: str
    length_pref: str
    characters: tuple[CharacterSnapshot, ...]


def count_words(text: str) -> int:
    """Count Unicode word groups, excluding standalone punctuation."""

    return len(re.findall(r"\w+", text, flags=re.UNICODE))


def _clean_text(value: str, label: str, max_chars: int) -> str:
    value = " ".join(value.split())
    if not value:
        raise DomainOutputError(f"{label} is empty")
    if len(value) > max_chars:
        raise DomainOutputError(f"{label} exceeds {max_chars} characters")
    return value


def validate_vietnamese(
    payload: GeneratedStoryVi, target_age: str, length_pref: str
) -> GeneratedStoryVi:
    allowed_counts = ALLOWED_PAGE_COUNTS.get(length_pref)
    age_rule = AGE_RULES.get(target_age)
    if allowed_counts is None or age_rule is None:
        raise DomainOutputError("Unsupported story setup")
    if len(payload.pages) not in allowed_counts:
        raise DomainOutputError("Generated page count is outside the selected length band")

    expected_page_numbers = list(range(1, len(payload.pages) + 1))
    if [page.page_no for page in payload.pages] != expected_page_numbers:
        raise DomainOutputError("Vietnamese page numbers must be ordered and contiguous")

    title = _clean_text(payload.title_vi, "title_vi", TITLE_MAX_CHARS)
    hard_word_max = age_rule[2]
    pages: list[GeneratedPageVi] = []
    for page in payload.pages:
        text = _clean_text(page.text_vi, f"page {page.page_no} text_vi", PAGE_TEXT_MAX_CHARS)
        if count_words(text) > hard_word_max:
            raise DomainOutputError(
                f"page {page.page_no} exceeds the {hard_word_max}-word hard maximum"
            )
        pages.append(GeneratedPageVi(page_no=page.page_no, text_vi=text))
    return GeneratedStoryVi(title_vi=title, pages=pages)


def _normalize_khmer(value: str, label: str, max_chars: int) -> str:
    value = unicodedata.normalize("NFC", value.strip())
    value = re.sub(r"[ \t]+", " ", value)
    if not value:
        raise DomainOutputError(f"{label} is empty")
    if len(value) > max_chars:
        raise DomainOutputError(f"{label} exceeds {max_chars} characters")
    if "\ufffd" in value:
        raise DomainOutputError(f"{label} contains a replacement character")
    for char in value:
        if unicodedata.category(char).startswith("C") and char not in {"\n", "\t", "\u200b"}:
            raise DomainOutputError(f"{label} contains an invalid control character")
    if not re.search(r"[\u1780-\u17b3]", value):
        raise DomainOutputError(f"{label} does not contain Khmer script")
    return value


def validate_khmer(payload: TranslatedStoryKm, vietnamese: GeneratedStoryVi) -> TranslatedStoryKm:
    vi_page_numbers = [page.page_no for page in vietnamese.pages]
    if [page.page_no for page in payload.pages] != vi_page_numbers:
        raise DomainOutputError("Khmer page numbers do not match the Vietnamese payload")

    title = _normalize_khmer(payload.title_km, "title_km", TITLE_MAX_CHARS)
    pages = [
        TranslatedPageKm(
            page_no=page.page_no,
            text_km=_normalize_khmer(
                page.text_km, f"page {page.page_no} text_km", PAGE_TEXT_MAX_CHARS
            ),
        )
        for page in payload.pages
    ]
    return TranslatedStoryKm(title_km=title, pages=pages)
