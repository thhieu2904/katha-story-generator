"""Single-page image regeneration runner for Phase 5C."""

import asyncio
import logging
from dataclasses import dataclass
from typing import cast
from uuid import UUID

from sqlalchemy import select

from katha.core.config import get_settings
from katha.core.database import async_session_factory
from katha.features.stories.models import Story, StoryPage
from katha.features.story_images.ports import (
    ImageProviderConfigurationError,
    ImageProviderRejectedError,
    ImageProviderUnavailableError,
    ImageReferenceInvalidError,
    StoryImageAI,
    StoryImageStorage,
)
from katha.features.story_images.runner import (
    ClaimLost,
    InvalidGeneratedImage,
    ReferenceUnavailable,
    StorageUploadFailed,
    _acquire_with_heartbeat,
    _cleanup_orphan_if_safe,
    _database_now,
    _heartbeat,
    _image_object_key,
    _reference_urls,
    _selected_characters,
    _semaphore_for_current_settings,
    _upload_once_with_retry,
    _validate_generated_image,
)
from katha.features.story_review.prompts import build_effective_prompt

logger = logging.getLogger(__name__)

_active_regen_keys: set[tuple[int, UUID]] = set()


@dataclass(frozen=True, slots=True)
class RegenPageSnapshot:
    story_id: int
    page_id: int
    claim_id: UUID
    effective_prompt: str
    character_reference_urls: tuple[str, ...]
    previous_image_url: str | None
    attempt_count: int


async def run_single_page_regeneration(
    story_id: int,
    claim_id: UUID,
    page_id: int,
    provider: StoryImageAI,
    storage: StoryImageStorage,
) -> None:
    runner_key = (story_id, claim_id)
    if runner_key in _active_regen_keys:
        logger.info(
            "Ignoring duplicate manual image runner",
            extra={"story_id": story_id, "job_id": str(claim_id)},
        )
        return

    _active_regen_keys.add(runner_key)
    semaphore = _semaphore_for_current_settings()
    acquired = False
    candidate_url: str | None = None
    candidate_key: str | None = None
    previous_url: str | None = None

    try:
        acquired = await _acquire_with_heartbeat(semaphore, story_id, claim_id)
        if not acquired:
            return

        logger.info(
            "Starting manual page regeneration", extra={"story_id": story_id, "page_id": page_id}
        )

        # 1. Snapshot target page
        snapshot = await _snapshot_regen_page(story_id, claim_id, page_id, storage)
        previous_url = snapshot.previous_image_url

        page_deadline = (
            asyncio.get_running_loop().time() + get_settings().IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS
        )

        # 2. Download character references + generate image
        image_bytes = await _generate_regen_image(snapshot, provider, storage)

        candidate_key = _image_object_key(
            story_id,
            snapshot.page_id,
            claim_id,
            snapshot.attempt_count,
        )

        # 3. Heartbeat before upload
        if not await _heartbeat(story_id, claim_id):
            raise ClaimLost()

        remaining_operation_seconds = page_deadline - asyncio.get_running_loop().time()
        if remaining_operation_seconds <= 0:
            raise ImageProviderUnavailableError("Image operation timed out")

        # 4. Upload to R2
        candidate_url = await _upload_once_with_retry(
            storage,
            candidate_key,
            image_bytes,
            timeout_seconds=remaining_operation_seconds,
        )

        # 5. Atomic success write
        await _commit_success(story_id, claim_id, page_id, candidate_url)

        # 6. Best-effort old object cleanup
        if previous_url and previous_url != candidate_url:
            previous_key = storage.key_from_public_url(previous_url)
            if previous_key:
                await _cleanup_orphan_if_safe(
                    storage, story_id, page_id, previous_key, candidate_url
                )

        logger.info(
            "Completed manual page regeneration", extra={"story_id": story_id, "page_id": page_id}
        )

    except ImageProviderRejectedError:
        await _commit_failure(story_id, claim_id, page_id, "PROVIDER_REJECTED")
    except ImageProviderUnavailableError:
        await _commit_failure(story_id, claim_id, page_id, "PROVIDER_UNAVAILABLE")
    except ImageProviderConfigurationError:
        await _commit_failure(story_id, claim_id, page_id, "PROVIDER_CONFIG_ERROR")
    except InvalidGeneratedImage:
        await _commit_failure(story_id, claim_id, page_id, "INVALID_IMAGE_OUTPUT")
    except StorageUploadFailed:
        if candidate_key is not None:
            await _cleanup_orphan_if_safe(storage, story_id, page_id, candidate_key, candidate_url)
        await _commit_failure(story_id, claim_id, page_id, "STORAGE_UPLOAD_FAILED")
    except ClaimLost:
        if candidate_key is not None:
            await _cleanup_orphan_if_safe(storage, story_id, page_id, candidate_key, candidate_url)
        logger.info(
            "Stopping stale manual image runner",
            extra={"story_id": story_id, "job_id": str(claim_id)},
        )
    except Exception:
        logger.exception(
            "Unexpected manual regeneration failure",
            extra={"story_id": story_id, "job_id": str(claim_id)},
        )
        if candidate_key is not None:
            await _cleanup_orphan_if_safe(storage, story_id, page_id, candidate_key, candidate_url)
        await _commit_failure(story_id, claim_id, page_id, "INTERNAL_ERROR")
    finally:
        if acquired:
            semaphore.release()
        _active_regen_keys.discard(runner_key)


async def _snapshot_regen_page(
    story_id: int, claim_id: UUID, page_id: int, storage: StoryImageStorage
) -> RegenPageSnapshot:
    async with async_session_factory() as session:
        result = await session.execute(select(Story).where(Story.id == story_id).with_for_update())
        story = result.scalar_one_or_none()
        if (
            story is None
            or story.status != "generating_images"
            or story.image_generation_claim_id != claim_id
            or story.active_image_regeneration_page_id != page_id
        ):
            await session.rollback()
            raise ClaimLost()

        page_result = await session.execute(
            select(StoryPage)
            .where(StoryPage.id == page_id, StoryPage.story_id == story_id)
            .with_for_update()
        )
        page = page_result.scalar_one_or_none()
        if page is None:
            await session.rollback()
            raise ClaimLost()

        prompt_en = cast(str, page.image_prompt_en)
        review_notes = cast(str, page.review_notes)
        attempt_count = cast(int, page.image_attempt_count or 0) + 1
        previous_url = cast(str | None, page.image_url)

        effective_prompt = build_effective_prompt(prompt_en, review_notes)

        page.image_status = "generating"  # type: ignore[assignment]
        page.image_attempt_count = attempt_count  # type: ignore[assignment]
        now = await _database_now(session)
        story.image_generation_heartbeat_at = now  # type: ignore[assignment]
        story.updated_at = now  # type: ignore[assignment]

        try:
            characters = await _selected_characters(session, page)
            urls = _reference_urls(
                characters,
                cast(list[int] | None, page.image_character_ids) or [],
                storage,
            )
        except Exception:
            await session.commit()
            raise

        await session.commit()

        return RegenPageSnapshot(
            story_id=story_id,
            page_id=page_id,
            claim_id=claim_id,
            effective_prompt=effective_prompt,
            character_reference_urls=urls,
            previous_image_url=previous_url,
            attempt_count=attempt_count,
        )


async def _generate_regen_image(
    snapshot: RegenPageSnapshot,
    provider: StoryImageAI,
    storage: StoryImageStorage,
) -> bytes:
    settings = get_settings()
    reference_limit = min(settings.IMAGE_MAX_OUTPUT_BYTES, 10 * 1024 * 1024)
    try:
        async with asyncio.timeout(settings.image_provider_retry_budget_seconds):
            try:
                references: tuple[bytes, ...] = tuple(
                    await asyncio.gather(
                        *(
                            asyncio.to_thread(
                                storage.download_public_reference,
                                url,
                                reference_limit,
                            )
                            for url in snapshot.character_reference_urls
                        )
                    )
                )
            except Exception as exc:
                raise ReferenceUnavailable("Reference image could not be loaded") from exc

            try:
                image_bytes = await provider.generate_image(snapshot.effective_prompt, references)
            except ImageReferenceInvalidError as exc:
                raise ReferenceUnavailable("Reference image is invalid") from exc
    except TimeoutError as exc:
        raise ImageProviderUnavailableError("Image operation timed out") from exc

    _validate_generated_image(
        image_bytes, settings.OPENAI_IMAGE_SIZE, settings.IMAGE_MAX_OUTPUT_BYTES
    )
    return image_bytes


async def _commit_success(story_id: int, claim_id: UUID, page_id: int, new_url: str) -> None:
    async with async_session_factory() as session:
        result = await session.execute(select(Story).where(Story.id == story_id).with_for_update())
        story = result.scalar_one_or_none()
        if (
            story is None
            or story.image_generation_claim_id != claim_id
            or story.active_image_regeneration_page_id != page_id
        ):
            await session.rollback()
            raise ClaimLost("Claim lost during commit_success")

        page_result = await session.execute(
            select(StoryPage)
            .where(StoryPage.id == page_id, StoryPage.story_id == story_id)
            .with_for_update()
        )
        page = page_result.scalar_one_or_none()
        if page is None:
            await session.rollback()
            return

        page.image_url = new_url  # type: ignore[assignment]
        page.image_status = "completed"  # type: ignore[assignment]
        page.review_status = "pending"  # type: ignore[assignment]
        page.image_error_code = None  # type: ignore[assignment]
        page.reviewed_by = None  # type: ignore[assignment]
        page.reviewed_at = None  # type: ignore[assignment]
        page.review_notes = None  # type: ignore[assignment]

        story.status = "pending_review"  # type: ignore[assignment]
        story.image_generation_claim_id = None  # type: ignore[assignment]
        story.image_generation_heartbeat_at = None  # type: ignore[assignment]
        story.active_image_regeneration_page_id = None  # type: ignore[assignment]
        story.updated_at = await _database_now(session)  # type: ignore[assignment]

        await session.commit()


async def _commit_failure(story_id: int, claim_id: UUID, page_id: int, error_code: str) -> None:
    async with async_session_factory() as session:
        result = await session.execute(select(Story).where(Story.id == story_id).with_for_update())
        story = result.scalar_one_or_none()
        if (
            story is None
            or story.image_generation_claim_id != claim_id
            or story.active_image_regeneration_page_id != page_id
        ):
            await session.rollback()
            return

        page_result = await session.execute(
            select(StoryPage)
            .where(StoryPage.id == page_id, StoryPage.story_id == story_id)
            .with_for_update()
        )
        page = page_result.scalar_one_or_none()
        if page is None:
            await session.rollback()
            return

        page.image_status = "failed"  # type: ignore[assignment]
        page.image_error_code = error_code  # type: ignore[assignment]

        story.status = "pending_review"  # type: ignore[assignment]
        story.image_generation_claim_id = None  # type: ignore[assignment]
        story.image_generation_heartbeat_at = None  # type: ignore[assignment]
        story.active_image_regeneration_page_id = None  # type: ignore[assignment]
        story.updated_at = await _database_now(session)  # type: ignore[assignment]

        await session.commit()
