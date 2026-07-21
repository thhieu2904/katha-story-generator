"""Offline domain tests for Phase 4 image planning and deterministic prompts."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from katha.features.stories.models import Story
from katha.features.story_images import service
from katha.features.story_images.models import (
    IMAGE_SCENE_MAX_CHARS,
    TEXT_EN_MAX_CHARS,
    ImageDomainError,
    ImagePlanCharacterSnapshot,
    ImagePlanPageSnapshot,
    ImagePlanSnapshot,
    PlannedImagePage,
    StoryImagePlanOutput,
    clean_text,
    validate_complete_mapping,
    validate_image_plan,
)
from katha.features.story_images.ports import ImageProviderUnavailableError
from katha.features.story_images.prompts import (
    build_image_plan_prompt,
    build_image_prompt,
)
from katha.features.story_images.schemas import CreateImagePlanRequest


def image_snapshot() -> ImagePlanSnapshot:
    return ImagePlanSnapshot(
        story_id=41,
        text_revision=3,
        image_plan_revision=0,
        title_vi="Chuyến đi trong rừng",
        description_vi="An và Thỏ đi tìm hoa.",
        target_age="preschool",
        art_style_name="Watercolor",
        art_style_modifier_en="soft watercolor textures, warm forest palette",
        pages=(
            ImagePlanPageSnapshot(id=101, page_no=1, text_vi="An bước vào rừng."),
            ImagePlanPageSnapshot(id=102, page_no=2, text_vi="Thỏ chỉ một bông hoa."),
        ),
        characters=(
            ImagePlanCharacterSnapshot(
                id=2,
                name="An",
                personality_vi="Tò mò",
                appearance_prompt_en="a young child with a yellow raincoat",
                ref_image_urls=("https://assets.example.test/characters/an.webp",),
            ),
            ImagePlanCharacterSnapshot(
                id=7,
                name="Thỏ",
                personality_vi="Vui vẻ",
                appearance_prompt_en="a small white rabbit with a blue scarf",
                ref_image_urls=("https://assets.example.test/characters/rabbit.webp",),
            ),
            ImagePlanCharacterSnapshot(
                id=9,
                name="Bình",
                personality_vi="Điềm tĩnh",
                appearance_prompt_en="a child with a green backpack",
                ref_image_urls=("https://assets.example.test/characters/binh.webp",),
            ),
        ),
    )


def valid_plan() -> StoryImagePlanOutput:
    return StoryImagePlanOutput(
        pages=[
            PlannedImagePage(
                page_id=101,
                page_no=1,
                text_en="An walks into the forest.",
                image_scene_en="An looks at the tall trees on a forest path.",
                character_ids=[7, 2],
            ),
            PlannedImagePage(
                page_id=102,
                page_no=2,
                text_en="The rabbit points at a flower.",
                image_scene_en="The rabbit points to a bright flower beside An.",
                character_ids=[],
            ),
        ]
    )


@pytest.mark.asyncio
async def test_create_image_plan_ends_snapshot_transaction_before_provider_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    story = Story(
        id=41,
        status="text_confirmed",
        text_revision=3,
        image_plan_revision=0,
        image_plan_locked_at=None,
    )

    async def get_story(session_arg, story_id: int, *, lock: bool = False) -> Story:
        assert session_arg is session
        assert story_id == 41
        assert lock is False
        return story

    async def load_snapshot(session_arg, story_arg: Story) -> ImagePlanSnapshot:
        assert session_arg is session
        assert story_arg is story
        return image_snapshot()

    async def provider_call(instructions: str, prompt: str) -> StoryImagePlanOutput:
        assert instructions
        assert prompt
        assert session.rollback.await_count == 1
        raise ImageProviderUnavailableError("offline")

    monkeypatch.setattr(service, "_get_story", get_story)
    monkeypatch.setattr(service, "_load_plan_snapshot", load_snapshot)
    monkeypatch.setattr(
        service,
        "get_settings",
        lambda: SimpleNamespace(IMAGE_PLAN_OPERATION_TIMEOUT_SECONDS=1),
    )

    provider = SimpleNamespace(plan_images=provider_call)
    with pytest.raises(HTTPException) as exc_info:
        await service.create_image_plan(
            session,
            41,
            CreateImagePlanRequest(expected_text_revision=3, expected_image_plan_revision=0),
            provider,
        )

    assert exc_info.value.status_code == 503
    assert session.rollback.await_count == 2


def test_valid_image_plan_requires_exact_pages_and_normalizes_reference_order() -> None:
    validated = validate_image_plan(valid_plan(), image_snapshot())

    assert [(page.page_id, page.page_no) for page in validated.pages] == [(101, 1), (102, 2)]
    assert validated.pages[0].character_ids == [2, 7]
    assert validated.pages[1].character_ids == []


@pytest.mark.parametrize(
    ("pages", "message"),
    [
        (lambda plan: plan.pages[:1], "page count"),
        (lambda plan: [*plan.pages, plan.pages[1]], "page count"),
        (lambda plan: [plan.pages[1], plan.pages[0]], "page IDs"),
        (
            lambda plan: [
                plan.pages[0],
                PlannedImagePage(
                    page_id=101,
                    page_no=2,
                    text_en="A second translation.",
                    image_scene_en="A second visual moment.",
                    character_ids=[],
                ),
            ],
            "page IDs",
        ),
    ],
)
def test_image_plan_rejects_missing_extra_duplicate_or_reordered_pages(pages, message: str) -> None:
    plan = valid_plan()
    invalid = StoryImagePlanOutput(pages=pages(plan))

    with pytest.raises(ImageDomainError, match=message):
        validate_image_plan(invalid, image_snapshot())


def test_image_plan_rejects_blank_faithful_fields() -> None:
    plan = valid_plan()
    plan.pages[0].text_en = " \n\t "

    with pytest.raises(ImageDomainError, match="text_en is empty"):
        validate_image_plan(plan, image_snapshot())


@pytest.mark.parametrize(
    ("value", "limit", "label"),
    [
        ("x" * (TEXT_EN_MAX_CHARS + 1), TEXT_EN_MAX_CHARS, "text_en"),
        ("x" * (IMAGE_SCENE_MAX_CHARS + 1), IMAGE_SCENE_MAX_CHARS, "image_scene_en"),
    ],
)
def test_clean_text_rejects_over_cap_values(value: str, limit: int, label: str) -> None:
    with pytest.raises(ImageDomainError, match="exceeds"):
        clean_text(value, label, limit)


def test_schema_rejects_invalid_character_mappings_before_domain_persistence() -> None:
    kwargs = {
        "page_id": 101,
        "page_no": 1,
        "text_en": "A valid translation.",
        "image_scene_en": "A valid visual moment.",
    }

    for character_ids in ([2, 2], [0], [2, 7, 9, 10]):
        with pytest.raises(ValidationError):
            PlannedImagePage(**kwargs, character_ids=character_ids)

    unknown = valid_plan()
    unknown.pages[0].character_ids = [404]
    with pytest.raises(ImageDomainError, match="outside the story cast"):
        validate_image_plan(unknown, image_snapshot())


def test_complete_mapping_requires_exact_page_set_and_stable_character_order() -> None:
    validated = validate_complete_mapping(
        {101: [7, 2], 102: []},
        expected_page_ids=[101, 102],
        allowed_character_ids={2, 7, 9},
    )

    assert validated == {101: (2, 7), 102: ()}

    with pytest.raises(ImageDomainError, match="exact current page set"):
        validate_complete_mapping(
            {101: []}, expected_page_ids=[101, 102], allowed_character_ids={2, 7, 9}
        )


def test_image_plan_prompt_exposes_cast_anchors_but_never_storage_urls() -> None:
    prompt = build_image_plan_prompt(image_snapshot())
    payload = json.loads(prompt)

    assert [page["page_id"] for page in payload["pages"]] == [101, 102]
    assert [character["id"] for character in payload["allowed_cast"]] == [2, 7, 9]
    assert all("ref_image_urls" not in character for character in payload["allowed_cast"])
    assert "assets.example.test" not in prompt


def test_image_prompt_only_anchors_selected_characters_in_stable_reference_order() -> None:
    snapshot = image_snapshot()
    by_id = {character.id: character for character in snapshot.characters}

    prompt = build_image_prompt(
        "An and the rabbit discover a flower.",
        snapshot.art_style_modifier_en,
        (by_id[2], by_id[7]),
    )

    assert "Art direction: soft watercolor textures, warm forest palette" in prompt
    assert "Reference image 1 is An (character ID 2)" in prompt
    assert "Reference image 2 is Thỏ (character ID 7)" in prompt
    assert prompt.index("Reference image 1") < prompt.index("Reference image 2")
    assert "Bình" not in prompt
    assert "character ID 9" not in prompt
    assert "wide 16:9" in prompt
    assert "Do not include text, captions, logos, watermarks, UI, or typography" in prompt


def test_image_prompt_for_no_character_scene_uses_no_reference_clause() -> None:
    prompt = build_image_prompt(
        "Sunlight falls on an empty forest path.",
        image_snapshot().art_style_modifier_en,
        (),
    )

    assert "intentionally has no recurring story character reference images" in prompt
    assert "Reference image 1" not in prompt
