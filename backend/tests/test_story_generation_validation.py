"""Pure contract tests for Phase 3B structured story text."""

import pytest

from katha.features.stories.generation_models import (
    DomainOutputError,
    GeneratedPageVi,
    GeneratedStoryVi,
    TranslatedPageKm,
    TranslatedStoryKm,
    count_words,
    validate_khmer,
    validate_vietnamese,
)


def vietnamese_story(
    page_count: int = 4, text: str = "Bé An gặp một chú thỏ vui."
) -> GeneratedStoryVi:
    return GeneratedStoryVi(
        title_vi="Khu vườn nhỏ",
        pages=[GeneratedPageVi(page_no=index, text_vi=text) for index in range(1, page_count + 1)],
    )


def test_valid_vietnamese_story_is_trimmed_and_counted() -> None:
    payload = vietnamese_story(text="  Bé An gặp một chú thỏ vui.  ")

    result = validate_vietnamese(payload, "preschool", "short")

    assert result.pages[0].text_vi == "Bé An gặp một chú thỏ vui."
    assert count_words(result.pages[0].text_vi) == 7


@pytest.mark.parametrize("page_count", [3, 5, 8])
def test_initial_generation_rejects_page_count_outside_selected_even_set(page_count: int) -> None:
    with pytest.raises(DomainOutputError, match="page count"):
        validate_vietnamese(vietnamese_story(page_count), "preschool", "short")


def test_vietnamese_rejects_out_of_order_pages() -> None:
    payload = vietnamese_story()
    payload.pages[1].page_no = 3

    with pytest.raises(DomainOutputError, match="ordered and contiguous"):
        validate_vietnamese(payload, "preschool", "short")


def test_vietnamese_rejects_age_hard_word_max() -> None:
    text = " ".join(f"từ{i}" for i in range(46))

    with pytest.raises(DomainOutputError, match="45-word"):
        validate_vietnamese(vietnamese_story(text=text), "preschool", "short")


def test_khmer_payload_is_nfc_normalized_and_page_aligned() -> None:
    vietnamese = vietnamese_story()
    payload = TranslatedStoryKm(
        title_km=" សួនតូច ",
        pages=[TranslatedPageKm(page_no=index, text_km="កុមារលេងនៅសួន។") for index in range(1, 5)],
    )

    result = validate_khmer(payload, vietnamese)

    assert result.title_km == "សួនតូច"
    assert [page.page_no for page in result.pages] == [1, 2, 3, 4]


@pytest.mark.parametrize("text", ["Only Latin text", "ខ្មែរ\ufffd", "ខ្មែរ\u0001"])
def test_khmer_rejects_invalid_text(text: str) -> None:
    vietnamese = vietnamese_story()
    payload = TranslatedStoryKm(
        title_km="សួនតូច",
        pages=[TranslatedPageKm(page_no=index, text_km=text) for index in range(1, 5)],
    )

    with pytest.raises(DomainOutputError):
        validate_khmer(payload, vietnamese)


def test_khmer_rejects_page_set_mismatch() -> None:
    vietnamese = vietnamese_story()
    payload = TranslatedStoryKm(
        title_km="សួនតូច",
        pages=[TranslatedPageKm(page_no=index, text_km="កុមារលេងនៅសួន។") for index in [1, 2, 4, 5]],
    )

    with pytest.raises(DomainOutputError, match="do not match"):
        validate_khmer(payload, vietnamese)
