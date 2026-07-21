"""Deterministic prompts for image planning and per-page image generation."""

from __future__ import annotations

import json

from katha.features.story_images.models import (
    ImagePlanCharacterSnapshot,
    ImagePlanSnapshot,
    clean_text,
)


def build_image_plan_instructions() -> str:
    """Instructions paired with strict structured output parsing."""

    return (
        "You are planning illustrations for a Vietnamese children's story. "
        "Return exactly one image-plan item for every supplied page, in the supplied order. "
        "Translate each page faithfully into English without adding plot. "
        "Describe one clear, age-appropriate visual moment per page. "
        "Only select IDs from the allowed story cast for characters actually visible; "
        "an empty character_ids list is correct for scenes without cast members. "
        "Never propose a cover, typography, captions, logos, watermarks, or text in an image."
    )


def build_image_plan_prompt(snapshot: ImagePlanSnapshot) -> str:
    """Serialize the immutable snapshot without leaking storage references or credentials."""

    payload = {
        "story": {
            "id": snapshot.story_id,
            "title_vi": snapshot.title_vi,
            "description_vi": snapshot.description_vi,
            "target_age": snapshot.target_age,
            "art_style": {
                "name": snapshot.art_style_name,
                "modifier": snapshot.art_style_modifier_en,
            },
        },
        "pages": [
            {"page_id": page.id, "page_no": page.page_no, "text_vi": page.text_vi}
            for page in snapshot.pages
        ],
        "allowed_cast": [
            {
                "id": character.id,
                "name": character.name,
                "personality_vi": character.personality_vi,
                "appearance_prompt_en": character.appearance_prompt_en,
            }
            for character in snapshot.characters
        ],
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def build_image_prompt(
    image_scene_en: str,
    art_style_modifier_en: str,
    selected_characters: tuple[ImagePlanCharacterSnapshot, ...],
) -> str:
    """Build a stateless, reference-order-stable prompt for a single page."""

    scene = clean_text(image_scene_en, "image_scene_en", 2_000)
    style = clean_text(art_style_modifier_en, "art style modifier", 2_000)
    blocks = [
        "Create one polished children's-book illustration for this story page.",
        f"Scene: {scene}",
        f"Art direction: {style}",
    ]
    if selected_characters:
        blocks.append("Use only these selected recurring characters when they are in the scene:")
        for index, character in enumerate(selected_characters, start=1):
            appearance = clean_text(
                character.appearance_prompt_en,
                f"appearance for character {character.id}",
                2_000,
            )
            blocks.append(
                f"Reference image {index} is {character.name} "
                f"(character ID {character.id}): {appearance}"
            )
        blocks.append(
            "Keep every selected character visually consistent with its matching "
            "numbered reference image."
        )
    else:
        blocks.append("This scene intentionally has no recurring story character reference images.")
    blocks.extend(
        (
            "Compose as a wide 16:9 illustration with all main subjects inside "
            "the central safe area.",
            "Keep the scene age-appropriate. Do not include text, captions, logos, watermarks, UI, "
            "or typography. Do not make background extras resemble unselected story cast members.",
        )
    )
    return "\n\n".join(blocks)
