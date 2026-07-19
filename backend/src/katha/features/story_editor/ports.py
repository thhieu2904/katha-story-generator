"""Ports used by the story editor domain."""

from typing import Protocol

from katha.features.stories.generation_models import TranslatedStoryKm
from katha.features.story_editor.schemas import AddedPageVi, RetranslatedTextKm, RevisedStoryVi


class StoryEditorAI(Protocol):
    async def revise_story(self, instructions: str, prompt: str) -> RevisedStoryVi: ...

    async def add_page(self, instructions: str, prompt: str) -> AddedPageVi: ...

    async def translate_khmer(self, instructions: str, prompt: str) -> TranslatedStoryKm: ...

    async def retranslate_khmer(self, instructions: str, prompt: str) -> RetranslatedTextKm: ...


class KhmerValidator(Protocol):
    def validate(self, text: str) -> list[dict]: ...
