"""Always-available technical Khmer validator.

This validator reports Unicode/script warnings only. It does not prove spelling,
grammar, or semantic correctness and never modifies persisted text.
"""

from __future__ import annotations

import unicodedata

from katha.features.stories.generation_models import PAGE_TEXT_MAX_CHARS

SOURCE = "baseline"
SOURCE_VERSION = "1"
_ALLOWED_CONTROLS = {"\n", "\t", "\u200b"}


class BaselineKhmerValidator:
    def validate(self, text: str) -> list[dict]:
        flags: list[dict] = []
        if unicodedata.normalize("NFC", text) != text:
            flags.append(_flag("not_nfc", 0, len(text), token=""))
        for index, character in enumerate(text):
            if character == "\ufffd":
                flags.append(_flag("replacement_character", index, index + 1, character))
            elif (
                unicodedata.category(character).startswith("C")
                and character not in _ALLOWED_CONTROLS
            ):
                flags.append(_flag("disallowed_control", index, index + 1, character))
        if not any("\u1780" <= character <= "\u17b3" for character in text):
            flags.append(_flag("missing_khmer_script", 0, len(text), token=""))
        if len(text) > PAGE_TEXT_MAX_CHARS:
            flags.append(_flag("text_too_long", PAGE_TEXT_MAX_CHARS, len(text), token=""))
        return flags


def _flag(kind: str, start: int, end: int, token: str) -> dict:
    return {
        "kind": kind,
        "token": token,
        "start": start,
        "end": end,
        "suggestions": [],
        "source": SOURCE,
        "source_version": SOURCE_VERSION,
        "severity": "warning",
    }
