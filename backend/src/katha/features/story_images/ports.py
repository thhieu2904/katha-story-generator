"""Provider and storage boundaries for the image-generation feature."""

from __future__ import annotations

from typing import Protocol

from katha.features.story_images.models import StoryImagePlanOutput


class ImageProviderUnavailableError(RuntimeError):
    """The provider failed transiently after its SDK-owned retry budget."""


class ImageProviderConfigurationError(ImageProviderUnavailableError):
    """The configured model, credentials, or provider access cannot serve this job."""


class ImageProviderRejectedError(RuntimeError):
    """The provider rejected input or returned unusable image output."""


class ImageReferenceInvalidError(RuntimeError):
    """A selected reference image cannot safely be used by the provider."""


class ImageStorageError(RuntimeError):
    """A configured storage operation could not safely complete."""


class StoryImageAI(Protocol):
    """Text planning plus image generation/editing capability."""

    async def plan_images(self, instructions: str, prompt: str) -> StoryImagePlanOutput: ...

    async def generate_image(self, prompt: str, reference_images: tuple[bytes, ...]) -> bytes: ...


class StoryImageStorage(Protocol):
    """Synchronous R2 adapter methods, called off the event loop by the runner."""

    def key_from_public_url(self, url: str) -> str | None: ...

    def download_public_reference(self, url: str, max_bytes: int) -> bytes: ...

    def upload_image(self, key: str, data: bytes) -> str: ...

    def delete_object(self, key: str) -> None: ...
