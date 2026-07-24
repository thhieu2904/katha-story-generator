"""Offline contract tests for the Phase 4 OpenAI image adapter."""

from __future__ import annotations

import base64
import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from openai import APIConnectionError, APIStatusError
from openai.resources.images import AsyncImages

from katha.core.config import Settings
from katha.features.story_images.models import PlannedImagePage, StoryImagePlanOutput
from katha.features.story_images.ports import (
    ImageProviderConfigurationError,
    ImageProviderRejectedError,
    ImageProviderUnavailableError,
)
from katha.integrations.openai_story_images import (
    IMAGE_PLAN_MAX_OUTPUT_TOKENS,
    OpenAIStoryImagesAI,
)


def image_plan() -> StoryImagePlanOutput:
    return StoryImagePlanOutput(
        pages=[
            PlannedImagePage(
                page_id=10,
                page_no=1,
                text_en="A faithful translation.",
                image_scene_en="A child walks through a sunny garden.",
                character_ids=[1],
            )
        ]
    )


def _assert_valid_sdk_kwargs(method, kwargs: dict) -> None:
    """Bind kwargs against the real SDK method signature; raises TypeError on mismatch."""
    sig = inspect.signature(method)
    # Skip 'self' — we're validating only the keyword arguments.
    params = {k: v for k, v in sig.parameters.items() if k != "self"}
    bound_sig = sig.replace(parameters=list(params.values()))
    bound_sig.bind(**kwargs)


def adapter_with(*, parse_result=None, image_result=None, side_effect=None):
    parse = AsyncMock(return_value=parse_result)
    generate = AsyncMock(return_value=image_result)
    edit = AsyncMock(return_value=image_result)
    if side_effect is not None:
        parse.side_effect = side_effect
        generate.side_effect = side_effect
        edit.side_effect = side_effect
    adapter = object.__new__(OpenAIStoryImagesAI)
    adapter._text_model = "test-text-model"
    adapter._image_model = "gpt-image-2"
    adapter._image_size = "1536x864"
    adapter._image_quality = "high"
    adapter._output_format = "webp"
    adapter._output_compression = 90
    adapter._max_output_bytes = 20 * 1024 * 1024
    adapter._client = SimpleNamespace(
        responses=SimpleNamespace(parse=parse), images=SimpleNamespace(generate=generate, edit=edit)
    )
    return adapter, parse, generate, edit


def image_response(data: bytes = b"webp-bytes") -> SimpleNamespace:
    return SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(data).decode("ascii"))])


@pytest.mark.asyncio
async def test_image_planner_uses_structured_text_parse_without_state_storage() -> None:
    output = image_plan()
    adapter, parse, _, _ = adapter_with(
        parse_result=SimpleNamespace(status="completed", output_parsed=output)
    )

    result = await adapter.plan_images("planner instructions", "immutable plan input")

    assert result is output
    assert parse.await_args.kwargs == {
        "model": "test-text-model",
        "instructions": "planner instructions",
        "input": "immutable plan input",
        "text_format": StoryImagePlanOutput,
        "max_output_tokens": IMAGE_PLAN_MAX_OUTPUT_TOKENS,
        "store": False,
    }


@pytest.mark.asyncio
async def test_generate_without_references_uses_native_wide_webp_contract() -> None:
    adapter, _, generate, edit = adapter_with(image_result=image_response())

    result = await adapter.generate_image("draw an empty path", ())

    assert result == b"webp-bytes"
    generate.assert_awaited_once()
    edit.assert_not_awaited()
    kwargs = generate.await_args.kwargs
    assert kwargs == {
        "model": "gpt-image-2",
        "prompt": "draw an empty path",
        "size": "1536x864",
        "quality": "high",
        "output_format": "webp",
        "output_compression": 90,
        "background": "opaque",
        "n": 1,
        "moderation": "auto",
    }
    _assert_valid_sdk_kwargs(AsyncImages.generate, kwargs)
    assert "input_fidelity" not in kwargs


@pytest.mark.asyncio
async def test_references_use_images_edit_in_exact_canonical_order() -> None:
    adapter, _, generate, edit = adapter_with(image_result=image_response())
    first_reference = b"RIFF\x00\x00\x00\x00WEBPVP8 "
    second_reference = b"\x89PNG\r\n\x1a\nreference"

    result = await adapter.generate_image("draw An and Thỏ", (first_reference, second_reference))

    assert result == b"webp-bytes"
    generate.assert_not_awaited()
    edit.assert_awaited_once()
    kwargs = edit.await_args.kwargs
    assert kwargs["image"] == [
        ("character-reference-1.webp", first_reference, "image/webp"),
        ("character-reference-2.png", second_reference, "image/png"),
    ]
    assert kwargs["model"] == "gpt-image-2"
    assert kwargs["size"] == "1536x864"
    assert kwargs["quality"] == "high"
    assert kwargs["output_format"] == "webp"
    assert kwargs["output_compression"] == 90
    assert kwargs["background"] == "opaque"
    assert kwargs["n"] == 1
    assert "moderation" not in kwargs
    assert "input_fidelity" not in kwargs
    _assert_valid_sdk_kwargs(AsyncImages.edit, kwargs)


@pytest.mark.parametrize("status", ["incomplete", "failed"])
@pytest.mark.asyncio
async def test_image_planner_rejects_incomplete_or_missing_structured_output(status: str) -> None:
    adapter, _, _, _ = adapter_with(parse_result=SimpleNamespace(status=status, output_parsed=None))

    with pytest.raises(ImageProviderRejectedError, match="incomplete"):
        await adapter.plan_images("instructions", "prompt")


@pytest.mark.asyncio
async def test_image_adapter_maps_connection_failure_to_sanitized_transient_error() -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/images/generations")
    adapter, _, _, _ = adapter_with(side_effect=APIConnectionError(request=request))

    with pytest.raises(ImageProviderUnavailableError, match="temporarily unavailable") as exc_info:
        await adapter.generate_image("prompt", ())

    assert "api.openai.com" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_image_adapter_propagates_unexpected_sdk_failure() -> None:
    adapter, _, generate, _ = adapter_with(side_effect=RuntimeError("unexpected SDK failure"))

    with pytest.raises(RuntimeError, match="unexpected SDK failure"):
        await adapter.generate_image("prompt", ())

    generate.assert_awaited_once()


@pytest.mark.parametrize(
    ("status_code", "body", "expected_error"),
    [
        (
            400,
            {"error": {"message": "content policy refusal"}},
            ImageProviderRejectedError,
        ),
        (400, None, ImageProviderConfigurationError),
        (401, None, ImageProviderConfigurationError),
        (403, None, ImageProviderConfigurationError),
        (404, None, ImageProviderConfigurationError),
        (500, None, ImageProviderUnavailableError),
    ],
)
@pytest.mark.asyncio
async def test_image_adapter_classifies_http_provider_errors(
    status_code: int, body: object | None, expected_error: type[Exception]
) -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/images/generations")
    response = httpx.Response(status_code, request=request)
    error = APIStatusError("raw provider diagnostic", response=response, body=body)
    adapter, _, _, _ = adapter_with(side_effect=error)

    with pytest.raises(expected_error) as exc_info:
        await adapter.generate_image("prompt", ())

    assert "raw provider diagnostic" not in str(exc_info.value)


@pytest.mark.parametrize("encoded", [None, "", "not base64@"])
@pytest.mark.asyncio
async def test_image_adapter_rejects_missing_or_invalid_base64_without_leaking_payload(
    encoded,
) -> None:
    raw_payload = "sensitive-image-payload"
    response = SimpleNamespace(data=[SimpleNamespace(b64_json=encoded or raw_payload)])
    if encoded is None:
        response = SimpleNamespace(data=[SimpleNamespace(b64_json=None)])
    elif encoded == "":
        response = SimpleNamespace(data=[SimpleNamespace(b64_json="")])
    adapter, _, _, _ = adapter_with(image_result=response)

    with pytest.raises(ImageProviderRejectedError, match="invalid image data") as exc_info:
        await adapter.generate_image("prompt", ())

    assert raw_payload not in str(exc_info.value)


@pytest.mark.asyncio
async def test_image_adapter_rejects_oversized_base64_before_decode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adapter, _, _, _ = adapter_with(image_result=image_response(b"four"))
    adapter._max_output_bytes = 3
    decode = MagicMock()
    monkeypatch.setattr("katha.integrations.openai_story_images.base64.b64decode", decode)

    with pytest.raises(ImageProviderRejectedError, match="invalid image data"):
        await adapter.generate_image("prompt", ())

    decode.assert_not_called()


@pytest.mark.asyncio
async def test_image_adapter_rechecks_decoded_bytes_when_base64_length_is_ambiguous() -> None:
    response = SimpleNamespace(data=[SimpleNamespace(b64_json="AAAA")])
    adapter, _, _, _ = adapter_with(image_result=response)
    adapter._max_output_bytes = 1

    with pytest.raises(ImageProviderRejectedError, match="invalid image data"):
        await adapter.generate_image("prompt", ())


def test_image_adapter_wires_sdk_timeout_and_single_retry_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    constructor = MagicMock(return_value=SimpleNamespace())
    monkeypatch.setattr("katha.integrations.openai_story_images.AsyncOpenAI", constructor)
    settings = Settings(
        OPENAI_API_KEY="test-only-key",
        OPENAI_TEXT_MODEL="test-text-model",
        OPENAI_IMAGE_TIMEOUT_SECONDS=150,
        OPENAI_IMAGE_MAX_RETRIES=1,
    )

    OpenAIStoryImagesAI(settings)

    constructor.assert_called_once_with(api_key="test-only-key", timeout=150, max_retries=1)


def test_regression_moderation_kwarg_on_edit_raises_type_error() -> None:
    """Guard against re-introducing moderation='auto' on images.edit().

    Binding against the real SDK signature ensures that unsupported kwargs
    raise TypeError — the same failure that surfaced in production.
    """
    edit_kwargs = {
        "model": "gpt-image-2",
        "image": [],
        "prompt": "test",
        "size": "1536x864",
        "quality": "high",
        "output_format": "webp",
        "output_compression": 90,
        "background": "opaque",
        "n": 1,
        "moderation": "auto",  # not accepted by edit()
    }
    with pytest.raises(TypeError):
        _assert_valid_sdk_kwargs(AsyncImages.edit, edit_kwargs)
