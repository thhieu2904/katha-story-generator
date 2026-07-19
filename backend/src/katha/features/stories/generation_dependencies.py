"""FastAPI dependency for the story text AI adapter."""

from functools import lru_cache

from fastapi import HTTPException, status

from katha.core.config import get_settings
from katha.integrations.openai_story_text import OpenAIStoryTextAI, StoryTextAI


@lru_cache
def get_story_text_ai() -> StoryTextAI:
    settings = get_settings()
    if not settings.OPENAI_API_KEY.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Story text generation is not configured",
        )
    return OpenAIStoryTextAI(settings)
