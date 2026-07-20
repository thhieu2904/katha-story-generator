"""Offline contract tests for the shared OpenAI Responses API adapter."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from openai import APIConnectionError, APIStatusError

from katha.core.config import Settings
from katha.features.stories.generation_models import (
    GENERATION_MAX_OUTPUT_TOKENS,
    TRANSLATION_MAX_OUTPUT_TOKENS,
    GeneratedPageVi,
    GeneratedStoryVi,
    TranslatedPageKm,
    TranslatedStoryKm,
)
from katha.features.story_editor.schemas import (
    ADD_PAGE_MAX_OUTPUT_TOKENS,
    EDIT_MAX_OUTPUT_TOKENS,
    RETRANSLATE_MAX_OUTPUT_TOKENS,
    AddedPageVi,
    RetranslatedTextKm,
    RevisedPageVi,
    RevisedStoryVi,
)
from katha.integrations.openai_story_text import (
    OpenAIStoryTextAI,
    ProviderOutputError,
    ProviderUnavailableError,
)


def adapter_with(result=None, side_effect=None):
    parse = AsyncMock(return_value=SimpleNamespace(status="completed", output_parsed=result))
    if side_effect is not None:
        parse.side_effect = side_effect
    adapter = object.__new__(OpenAIStoryTextAI)
    adapter._model = "test-model"
    adapter._client = SimpleNamespace(responses=SimpleNamespace(parse=parse))
    return adapter, parse


@pytest.mark.parametrize(
    ("method", "parsed", "expected_tokens"),
    [
        (
            "generate_vietnamese",
            GeneratedStoryVi(
                title_vi="Truyện",
                pages=[GeneratedPageVi(page_no=1, text_vi="Một câu chuyện nhỏ.")],
            ),
            GENERATION_MAX_OUTPUT_TOKENS,
        ),
        (
            "translate_khmer",
            TranslatedStoryKm(
                title_km="រឿង",
                pages=[TranslatedPageKm(page_no=1, text_km="រឿង តូច។")],
            ),
            TRANSLATION_MAX_OUTPUT_TOKENS,
        ),
        (
            "revise_story",
            RevisedStoryVi(
                title_vi="Truyện",
                pages=[RevisedPageVi(source_page_id=1, text_vi="Một câu chuyện rõ hơn.")],
            ),
            EDIT_MAX_OUTPUT_TOKENS,
        ),
        ("add_page", AddedPageVi(text_vi="Một trang mới."), ADD_PAGE_MAX_OUTPUT_TOKENS),
        (
            "retranslate_khmer",
            RetranslatedTextKm(text_km="ទំព័រ ថ្មី។"),
            RETRANSLATE_MAX_OUTPUT_TOKENS,
        ),
    ],
)
@pytest.mark.asyncio
async def test_adapter_uses_structured_parse_and_operation_token_cap(
    method: str, parsed, expected_tokens: int
) -> None:
    adapter, parse = adapter_with(parsed)

    result = await getattr(adapter, method)("instructions", "prompt")

    assert result is parsed
    kwargs = parse.await_args.kwargs
    assert kwargs["model"] == "test-model"
    assert kwargs["instructions"] == "instructions"
    assert kwargs["input"] == "prompt"
    assert kwargs["max_output_tokens"] == expected_tokens
    assert kwargs["store"] is False


@pytest.mark.parametrize("status", ["incomplete", "failed"])
@pytest.mark.asyncio
async def test_adapter_rejects_non_completed_or_missing_parsed_output(status: str) -> None:
    adapter, parse = adapter_with(AddedPageVi(text_vi="Một trang mới."))
    parse.return_value = SimpleNamespace(status=status, output_parsed=None)

    with pytest.raises(ProviderOutputError, match="incomplete"):
        await adapter.add_page("instructions", "prompt")


@pytest.mark.asyncio
async def test_adapter_maps_connection_failure_to_temporary_unavailable() -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    adapter, _ = adapter_with(side_effect=APIConnectionError(request=request))

    with pytest.raises(ProviderUnavailableError):
        await adapter.generate_vietnamese("instructions", "prompt")


@pytest.mark.parametrize(
    ("status_code", "expected_error"),
    [(400, ProviderOutputError), (500, ProviderUnavailableError)],
)
@pytest.mark.asyncio
async def test_adapter_maps_provider_http_status(
    status_code: int, expected_error: type[Exception]
) -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(status_code, request=request)
    error = APIStatusError("provider status", response=response, body=None)
    adapter, _ = adapter_with(side_effect=error)

    with pytest.raises(expected_error):
        await adapter.translate_khmer("instructions", "prompt")


@pytest.mark.asyncio
async def test_adapter_hides_unexpected_parse_details() -> None:
    adapter, _ = adapter_with(side_effect=ValueError("raw provider payload"))

    with pytest.raises(ProviderOutputError, match="could not be parsed") as exc_info:
        await adapter.retranslate_khmer("instructions", "prompt")

    assert "raw provider payload" not in str(exc_info.value)


def test_adapter_wires_sdk_timeout_and_retry_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    constructor = MagicMock(return_value=SimpleNamespace())
    monkeypatch.setattr("katha.integrations.openai_story_text.AsyncOpenAI", constructor)
    settings = Settings(
        OPENAI_API_KEY="test-only-key",
        OPENAI_TEXT_MODEL="test-model",
        OPENAI_TIMEOUT_SECONDS=60,
        OPENAI_MAX_RETRIES=1,
    )

    OpenAIStoryTextAI(settings)

    constructor.assert_called_once_with(
        api_key="test-only-key",
        timeout=60,
        max_retries=1,
    )
