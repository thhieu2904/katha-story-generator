"""OpenAI Responses API adapter for story text generation."""

from __future__ import annotations

from typing import Protocol, TypeVar, cast

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel

from katha.core.config import Settings
from katha.features.stories.generation_models import (
    GENERATION_MAX_OUTPUT_TOKENS,
    TRANSLATION_MAX_OUTPUT_TOKENS,
    GeneratedStoryVi,
    TranslatedStoryKm,
)
from katha.features.story_editor.schemas import (
    ADD_PAGE_MAX_OUTPUT_TOKENS,
    EDIT_MAX_OUTPUT_TOKENS,
    RETRANSLATE_MAX_OUTPUT_TOKENS,
    AddedPageVi,
    RetranslatedTextKm,
    RevisedStoryVi,
)

ParsedT = TypeVar("ParsedT", bound=BaseModel)


class ProviderOutputError(RuntimeError):
    """The provider returned incomplete, refused, or unparseable content."""


class ProviderUnavailableError(RuntimeError):
    """The provider could not complete the request temporarily."""


class StoryTextAI(Protocol):
    async def generate_vietnamese(self, instructions: str, prompt: str) -> GeneratedStoryVi: ...

    async def translate_khmer(self, instructions: str, prompt: str) -> TranslatedStoryKm: ...


class OpenAIStoryTextAI:
    """Thin SDK adapter; retry and per-attempt timeout are owned by the SDK."""

    def __init__(self, settings: Settings) -> None:
        self._model = settings.OPENAI_TEXT_MODEL
        self._client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.OPENAI_TIMEOUT_SECONDS,
            max_retries=settings.OPENAI_MAX_RETRIES,
        )

    async def generate_vietnamese(self, instructions: str, prompt: str) -> GeneratedStoryVi:
        return await self._parse(
            instructions=instructions,
            prompt=prompt,
            output_type=GeneratedStoryVi,
            max_output_tokens=GENERATION_MAX_OUTPUT_TOKENS,
        )

    async def translate_khmer(self, instructions: str, prompt: str) -> TranslatedStoryKm:
        return await self._parse(
            instructions=instructions,
            prompt=prompt,
            output_type=TranslatedStoryKm,
            max_output_tokens=TRANSLATION_MAX_OUTPUT_TOKENS,
        )

    async def revise_story(self, instructions: str, prompt: str) -> RevisedStoryVi:
        return await self._parse(
            instructions=instructions,
            prompt=prompt,
            output_type=RevisedStoryVi,
            max_output_tokens=EDIT_MAX_OUTPUT_TOKENS,
        )

    async def add_page(self, instructions: str, prompt: str) -> AddedPageVi:
        return await self._parse(
            instructions=instructions,
            prompt=prompt,
            output_type=AddedPageVi,
            max_output_tokens=ADD_PAGE_MAX_OUTPUT_TOKENS,
        )

    async def retranslate_khmer(self, instructions: str, prompt: str) -> RetranslatedTextKm:
        return await self._parse(
            instructions=instructions,
            prompt=prompt,
            output_type=RetranslatedTextKm,
            max_output_tokens=RETRANSLATE_MAX_OUTPUT_TOKENS,
        )

    async def _parse(
        self,
        *,
        instructions: str,
        prompt: str,
        output_type: type[ParsedT],
        max_output_tokens: int,
    ) -> ParsedT:
        try:
            response = await self._client.responses.parse(
                model=self._model,
                instructions=instructions,
                input=prompt,
                text_format=output_type,
                max_output_tokens=max_output_tokens,
                store=False,
            )
        except (APITimeoutError, APIConnectionError, RateLimitError) as exc:
            raise ProviderUnavailableError("AI provider temporarily unavailable") from exc
        except APIStatusError as exc:
            if exc.status_code >= 500:
                raise ProviderUnavailableError("AI provider temporarily unavailable") from exc
            raise ProviderOutputError("AI provider rejected the request") from exc
        except Exception as exc:
            raise ProviderOutputError("AI provider response could not be parsed") from exc

        parsed = response.output_parsed
        if response.status != "completed" or parsed is None:
            raise ProviderOutputError("AI provider returned incomplete content")
        return cast(ParsedT, parsed)
