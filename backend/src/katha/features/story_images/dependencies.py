"""FastAPI dependency factories for the Phase 4 adapters."""

from __future__ import annotations

from functools import lru_cache

from fastapi import HTTPException, status

from katha.core.config import get_settings
from katha.features.story_images.ports import StoryImageAI, StoryImageStorage
from katha.integrations.openai_story_images import OpenAIStoryImagesAI
from katha.integrations.r2_storage import R2Client


@lru_cache
def get_story_image_ai() -> StoryImageAI:
    """Return the configured OpenAI adapter without ever exposing credentials."""

    settings = get_settings()
    if not settings.OPENAI_API_KEY.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image generation is not configured",
        )
    return OpenAIStoryImagesAI(settings)


@lru_cache
def get_story_image_storage() -> StoryImageStorage:
    """Return the configured R2 adapter required before a paid image job can start."""

    settings = get_settings()
    required = (
        settings.R2_ENDPOINT_URL,
        settings.R2_ACCESS_KEY_ID,
        settings.R2_SECRET_ACCESS_KEY,
        settings.R2_PUBLIC_URL,
    )
    if not all(value.strip() for value in required):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image storage is not configured",
        )
    return R2Client(settings)
