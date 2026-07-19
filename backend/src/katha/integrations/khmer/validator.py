"""Khmer validator dependency with safe baseline fallback."""

from functools import lru_cache

from katha.features.story_editor.ports import KhmerValidator
from katha.integrations.khmer.baseline import BaselineKhmerValidator


@lru_cache
def get_khmer_validator() -> KhmerValidator:
    # Dependency spike result: no advanced package met the P0 acceptance bar.
    # Keep this boundary so an optional adapter can be added without changing services.
    return BaselineKhmerValidator()
