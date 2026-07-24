"""OpenAI adapters for structured image planning and GPT Image generation."""

from __future__ import annotations

import base64
from typing import Any, cast

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError

from katha.core.config import Settings
from katha.features.story_images.models import StoryImagePlanOutput
from katha.features.story_images.ports import (
    ImageProviderConfigurationError,
    ImageProviderRejectedError,
    ImageProviderUnavailableError,
    ImageReferenceInvalidError,
)

IMAGE_PLAN_MAX_OUTPUT_TOKENS = 12_000


class OpenAIStoryImagesAI:
    """Thin adapter whose SDK owns the single transient provider retry."""

    def __init__(self, settings: Settings) -> None:
        self._text_model = settings.OPENAI_TEXT_MODEL
        self._image_model = settings.OPENAI_IMAGE_MODEL
        self._image_size = settings.OPENAI_IMAGE_SIZE
        self._image_quality = settings.OPENAI_IMAGE_QUALITY
        self._output_format = settings.OPENAI_IMAGE_OUTPUT_FORMAT
        self._output_compression = settings.OPENAI_IMAGE_OUTPUT_COMPRESSION
        self._max_output_bytes = settings.IMAGE_MAX_OUTPUT_BYTES
        self._client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.OPENAI_IMAGE_TIMEOUT_SECONDS,
            max_retries=settings.OPENAI_IMAGE_MAX_RETRIES,
        )

    async def plan_images(self, instructions: str, prompt: str) -> StoryImagePlanOutput:
        """Ask the text model for a strict page-aligned image plan."""

        try:
            response = await self._client.responses.parse(
                model=self._text_model,
                instructions=instructions,
                input=prompt,
                text_format=StoryImagePlanOutput,
                max_output_tokens=IMAGE_PLAN_MAX_OUTPUT_TOKENS,
                store=False,
            )
        except (APITimeoutError, APIConnectionError, RateLimitError) as exc:
            raise ImageProviderUnavailableError(
                "Image plan provider is temporarily unavailable"
            ) from exc
        except APIStatusError as exc:
            if exc.status_code >= 500:
                raise ImageProviderUnavailableError(
                    "Image plan provider is temporarily unavailable"
                ) from exc
            if _is_provider_configuration_error(exc):
                raise ImageProviderConfigurationError(
                    "Image plan provider configuration is unavailable"
                ) from exc
            raise ImageProviderRejectedError("Image plan provider rejected the request") from exc
        except Exception as exc:
            raise ImageProviderRejectedError(
                "Image plan provider response could not be parsed"
            ) from exc

        parsed = response.output_parsed
        if response.status != "completed" or parsed is None:
            raise ImageProviderRejectedError("Image plan provider returned incomplete content")
        return cast(StoryImagePlanOutput, parsed)

    async def generate_image(self, prompt: str, reference_images: tuple[bytes, ...]) -> bytes:
        """Use generate without references and edit with the selected ordered references."""

        reference_inputs = [
            _reference_input(index, image) for index, image in enumerate(reference_images, start=1)
        ]
        images_api = cast(Any, self._client.images)
        try:
            if reference_inputs:
                response = await images_api.edit(
                    model=self._image_model,
                    image=reference_inputs,
                    prompt=prompt,
                    size=self._image_size,
                    quality=self._image_quality,
                    output_format=self._output_format,
                    output_compression=self._output_compression,
                    background="opaque",
                    n=1,
                )
            else:
                response = await images_api.generate(
                    model=self._image_model,
                    prompt=prompt,
                    size=self._image_size,
                    quality=self._image_quality,
                    output_format=self._output_format,
                    output_compression=self._output_compression,
                    background="opaque",
                    n=1,
                    moderation="auto",
                )
        except (APITimeoutError, APIConnectionError, RateLimitError) as exc:
            raise ImageProviderUnavailableError(
                "Image provider is temporarily unavailable"
            ) from exc
        except APIStatusError as exc:
            if exc.status_code >= 500:
                raise ImageProviderUnavailableError(
                    "Image provider is temporarily unavailable"
                ) from exc
            if _is_provider_configuration_error(exc):
                raise ImageProviderConfigurationError(
                    "Image provider configuration is unavailable"
                ) from exc
            raise ImageProviderRejectedError("Image provider rejected the request") from exc
        return _decode_image_response(response, max_bytes=self._max_output_bytes)


def _is_provider_configuration_error(error: APIStatusError) -> bool:
    """Classify systemic credential/model failures without exposing provider diagnostics."""

    if error.status_code in {401, 403, 404}:
        return True
    if error.status_code != 400:
        return False
    return not _is_known_content_rejection(error.body)


def _is_known_content_rejection(body: object) -> bool:
    """Keep refusal, moderation, and content-policy failures isolated to their page."""

    fragments: list[str] = []
    if isinstance(body, dict):
        values: list[object] = list(body.values())
    elif isinstance(body, (list, tuple)):
        values = list(body)
    else:
        values = [body]
    while values:
        value = values.pop()
        if isinstance(value, dict):
            values.extend(value.values())
        elif isinstance(value, (list, tuple)):
            values.extend(value)
        elif isinstance(value, str):
            fragments.append(value.casefold())
    text = " ".join(fragments)
    return any(
        marker in text
        for marker in (
            "content policy",
            "content_policy",
            "moderation",
            "refusal",
            "refused",
            "safety",
        )
    )


def _decode_image_response(response: Any, *, max_bytes: int) -> bytes:
    """Decode only the first returned base64 image without exposing its payload."""
    try:
        data = response.data
        encoded = data[0].b64_json
        if not isinstance(encoded, str) or not encoded:
            raise ValueError("missing image data")
        max_encoded_length = 4 * ((max_bytes + 2) // 3)
        if len(encoded) > max_encoded_length:
            raise ValueError("encoded image data exceeds the byte limit")
        if len(encoded) % 4 == 0:
            padding = 2 if encoded.endswith("==") else 1 if encoded.endswith("=") else 0
            decoded_length = (len(encoded) // 4) * 3 - padding
            if decoded_length > max_bytes:
                raise ValueError("decoded image data exceeds the byte limit")
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > max_bytes:
            raise ValueError("decoded image data exceeds the byte limit")
        return decoded
    except Exception as exc:
        raise ImageProviderRejectedError("Image provider returned invalid image data") from exc


def _reference_input(index: int, data: bytes) -> tuple[str, bytes, str]:
    """Preserve the actual media type of an R2-loaded character reference."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        extension, media_type = "png", "image/png"
    elif data.startswith(b"\xff\xd8\xff"):
        extension, media_type = "jpg", "image/jpeg"
    elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        extension, media_type = "webp", "image/webp"
    else:
        raise ImageReferenceInvalidError("Character reference image has an unsupported format")
    return f"character-reference-{index}.{extension}", data, media_type
