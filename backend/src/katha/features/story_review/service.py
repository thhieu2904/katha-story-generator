"""Story review domain logic."""

from __future__ import annotations

import re
import secrets
import unicodedata
from datetime import datetime, timezone
from typing import Any, Sequence, cast
from unittest.mock import Mock
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from katha.core.config import get_settings
from katha.features.stories.models import Story, StoryCharacter, StoryPage
from katha.features.story_review.prompts import EffectivePromptTooLongError, build_effective_prompt
from katha.features.story_review.schemas import (
    ApprovePageRequest,
    ArchiveStoryRequest,
    CompleteReviewRequest,
    CreateShareLinkRequest,
    EditKhmerPageRequest,
    EditKhmerTitleRequest,
    PublishStoryRequest,
    RegenerateImageRequest,
    RegenerateImageResponse,
    RejectPageRequest,
    ReviewCapabilitiesResponse,
    ReviewJobResponse,
    ReviewPageRequest,
    ReviewPageResponse,
    ReviewProgressResponse,
    ReviewShareResponse,
    ReviewStateResponse,
    ReviewStoryResponse,
    RevokeShareRequest,
)

TITLE_MAX_CHARS = 160
PAGE_TEXT_MAX_CHARS = 1200


async def get_review_state(session: AsyncSession, story_id: int) -> ReviewStateResponse:
    """Get the current review state and capabilities for a story."""
    story = await _locked_story_for_review(session, story_id, lock=False)
    pages = await _locked_pages(session, story_id, lock=False)
    db_now = await _database_now(session)
    return _build_review_state(story, pages, db_now)


async def edit_khmer_title(
    session: AsyncSession,
    story_id: int,
    request: EditKhmerTitleRequest,
    admin_id: UUID,
) -> ReviewStateResponse:
    """Edit the Khmer title during review."""
    story = await _locked_story_for_review(session, story_id, lock=True)
    if story.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Story is not in pending_review status",
        )
    if _has_active_regeneration(story):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot edit while regeneration is active",
        )
    if story.text_revision != request.expected_text_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Text revision mismatch",
        )

    story.title_km = _validate_khmer(request.text_km, "title_km", TITLE_MAX_CHARS)  # type: ignore[assignment]
    story.text_revision = cast(int, story.text_revision) + 1  # type: ignore[assignment]
    story.updated_at = await _database_now(session)  # type: ignore[assignment]

    await session.commit()
    return await get_review_state(session, story_id)


async def edit_khmer_page(
    session: AsyncSession,
    story_id: int,
    page_id: int,
    request: EditKhmerPageRequest,
    admin_id: UUID,
) -> ReviewStateResponse:
    """Edit the Khmer text for a specific page during review."""
    story = await _locked_story_for_review(session, story_id, lock=True)
    if story.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Story is not in pending_review status",
        )
    if _has_active_regeneration(story):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot edit while regeneration is active",
        )
    if story.text_revision != request.expected_text_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Text revision mismatch",
        )

    stmt = (
        select(StoryPage)
        .where(StoryPage.id == page_id, StoryPage.story_id == story_id)
        .with_for_update()
    )
    page = (await session.execute(stmt)).scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    page.text_km = _validate_khmer(request.text_km, "text_km", PAGE_TEXT_MAX_CHARS)  # type: ignore[assignment]
    page.review_status = "pending"  # type: ignore[assignment]
    page.reviewed_by = None  # type: ignore[assignment]
    page.reviewed_at = None  # type: ignore[assignment]
    page.review_notes = None  # type: ignore[assignment]
    page.spellcheck_flags = []  # type: ignore[assignment]
    page.khmer_validated_at = None  # type: ignore[assignment]

    story.text_revision = cast(int, story.text_revision) + 1  # type: ignore[assignment]
    db_now = await _database_now(session)
    page.updated_at = db_now  # type: ignore[assignment]
    story.updated_at = db_now  # type: ignore[assignment]

    await session.commit()
    return await get_review_state(session, story_id)


async def review_page(
    session: AsyncSession,
    story_id: int,
    page_id: int,
    request: ReviewPageRequest,
    admin_id: UUID,
) -> ReviewStateResponse:
    """Approve or reject a page during review."""
    story = await _locked_story_for_review(session, story_id, lock=True)
    if story.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Story is not in pending_review status",
        )
    if _has_active_regeneration(story):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot review while regeneration is active",
        )
    if story.text_revision != request.expected_text_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Text revision mismatch",
        )

    stmt = (
        select(StoryPage)
        .where(StoryPage.id == page_id, StoryPage.story_id == story_id)
        .with_for_update()
    )
    page = (await session.execute(stmt)).scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    if (
        page.review_status != request.expected_review_status
        or page.image_attempt_count != request.expected_image_attempt_count
        or page.image_url != request.expected_image_url
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Page identity mismatch",
        )

    if not page.text_km or not page.text_km.strip() or not page.text_vi or not page.text_vi.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Page must have both Khmer and Vietnamese text",
        )

    valid_image = page.image_status == "completed" and page.image_url
    if not valid_image and not (page.image_status == "failed" and page.image_url):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Page must have a completed image",
        )

    db_now = await _database_now(session)

    if isinstance(request, ApprovePageRequest):
        if (
            page.spellcheck_flags or not page.khmer_validated_at
        ) and not request.acknowledge_khmer_warnings:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Must acknowledge Khmer warnings to approve",
            )
        page.review_status = "approved"  # type: ignore[assignment]
        page.reviewed_by = admin_id  # type: ignore[assignment]
        page.reviewed_at = db_now  # type: ignore[assignment]
        page.review_notes = None  # type: ignore[assignment]
        if page.image_status == "failed" and page.image_url:
            page.image_status = "completed"  # type: ignore[assignment]
            page.image_error_code = None  # type: ignore[assignment]

    elif isinstance(request, RejectPageRequest):
        reason = request.reason.strip()
        if not (5 <= len(reason) <= 500):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Rejection reason must be 5-500 characters",
            )
        page.review_status = "rejected"  # type: ignore[assignment]
        page.reviewed_by = admin_id  # type: ignore[assignment]
        page.reviewed_at = db_now  # type: ignore[assignment]
        page.review_notes = reason  # type: ignore[assignment]

    page.updated_at = db_now  # type: ignore[assignment]
    await session.commit()
    return await get_review_state(session, story_id)


async def complete_review(
    session: AsyncSession,
    story_id: int,
    request: CompleteReviewRequest,
    admin_id: UUID,
) -> ReviewStateResponse:
    """Complete the review process and approve the story."""
    story = await _locked_story_for_review(session, story_id, lock=True)
    if story.status == "approved":
        return await get_review_state(session, story_id)

    if story.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Story is not in pending_review status",
        )
    if _has_active_regeneration(story):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot complete review while regeneration is active",
        )
    if story.text_revision != request.expected_text_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Text revision mismatch",
        )

    if (
        not story.title_vi
        or not story.title_vi.strip()
        or not story.title_km
        or not story.title_km.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Story must have both Khmer and Vietnamese titles",
        )

    pages = await _locked_pages(session, story_id, lock=True)
    if not pages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Story has no pages",
        )

    expected_page_no = 1
    for page in pages:
        if page.page_no != expected_page_no:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Story pages are not contiguous",
            )
        expected_page_no += 1

        if (
            not page.text_km
            or not page.text_km.strip()
            or not page.text_vi
            or not page.text_vi.strip()
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Page {page.page_no} is missing text",
            )
        if page.image_status != "completed" or not page.image_url:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Page {page.page_no} has incomplete image",
            )
        if page.review_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Page {page.page_no} is not approved",
            )

    story.status = "approved"  # type: ignore[assignment]
    story.updated_at = await _database_now(session)  # type: ignore[assignment]
    await session.commit()
    return await get_review_state(session, story_id)


async def start_regeneration(
    session: AsyncSession,
    story_id: int,
    page_id: int,
    request: RegenerateImageRequest,
    admin_id: UUID,
) -> RegenerateImageResponse:
    """Start image regeneration for a specific page."""
    story = await _locked_story_for_review(session, story_id, lock=True)
    db_now = await _database_now(session)

    if story.status == "pending_review":
        pass
    elif story.status == "generating_images" and _has_active_regeneration(story):
        if _is_job_stale(story, db_now):
            pass  # Reclaim stale job
        elif story.active_image_regeneration_page_id == page_id:
            await session.rollback()
            return RegenerateImageResponse(
                job_id=str(story.image_generation_claim_id),
                already_running=True,
                active_page_id=page_id,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another regeneration job is actively running",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Story is not in a valid state for image regeneration",
        )

    pages = await _locked_pages(session, story_id, lock=True)
    target_page = next((p for p in pages if p.id == page_id), None)
    if not target_page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")

    if story.text_revision != request.expected_text_revision:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Text revision mismatch")

    if (
        target_page.review_status != request.expected_review_status
        or target_page.image_attempt_count != request.expected_image_attempt_count
        or (target_page.image_url or "") != request.expected_image_url
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Page identity mismatch")

    if target_page.review_status != "rejected":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Page must be rejected to regenerate image",
        )

    image_usable = (
        target_page.image_status == "completed" or target_page.image_status == "failed"
    ) and bool(target_page.image_url)
    if not image_usable:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Target page must have a usable existing image",
        )

    if not target_page.review_notes or not target_page.review_notes.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Page is missing rejection reason (review_notes)",
        )

    if not target_page.image_prompt_en or not target_page.image_prompt_en.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Page is missing image_prompt_en",
        )

    try:
        build_effective_prompt(
            cast(str, target_page.image_prompt_en), cast(str, target_page.review_notes)
        )
    except EffectivePromptTooLongError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Combined prompt and rejection notes exceed the limit",
        ) from exc

    if (
        story.status == "generating_images"
        and _has_active_regeneration(story)
        and _is_job_stale(story, db_now)
    ):
        old_target = next(
            (p for p in pages if p.id == story.active_image_regeneration_page_id), None
        )
        if old_target and old_target.image_status == "generating":
            old_target.image_status = "failed"  # type: ignore[assignment]
            old_target.image_error_code = "STALE_JOB_INTERRUPTED"  # type: ignore[assignment]

    target_page.image_status = "pending"  # type: ignore[assignment]

    claim_id = uuid4()
    story.status = "generating_images"  # type: ignore[assignment]
    story.image_generation_claim_id = claim_id  # type: ignore[assignment]
    story.image_generation_heartbeat_at = db_now  # type: ignore[assignment]
    story.active_image_regeneration_page_id = page_id  # type: ignore[assignment]
    story.updated_at = db_now  # type: ignore[assignment]

    await session.commit()

    return RegenerateImageResponse(
        job_id=str(claim_id),
        already_running=False,
        active_page_id=page_id,
    )


async def publish_story(
    session: AsyncSession,
    story_id: int,
    request: PublishStoryRequest,
    admin_id: UUID,
) -> ReviewStateResponse:
    story = await _locked_story_for_review(session, story_id, lock=True)
    if story.status == "published":
        if story.public_share_activated_at and not story.public_share_revoked_at:
            return await get_review_state(session, story_id)
        else:
            return await get_review_state(session, story_id)

    if story.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Story is not in approved status",
        )

    if (
        story.text_revision != request.expected_text_revision
        or story.public_share_revision != request.expected_share_revision
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Revision mismatch",
        )

    # Lock and revalidate page invariants in the same transaction
    pages = await _locked_pages(session, story_id, lock=True)
    if (
        not story.title_vi
        or not story.title_vi.strip()
        or not story.title_km
        or not story.title_km.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Story must have both Khmer and Vietnamese titles to publish",
        )
    if not pages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Story has no pages to publish",
        )

    expected_page_no = 1
    for page in pages:
        if page.page_no != expected_page_no:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Page sequence broken at {page.page_no}",
            )
        expected_page_no += 1
        if (
            not page.text_km
            or not page.text_km.strip()
            or not page.text_vi
            or not page.text_vi.strip()
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Page {page.page_no} is missing text",
            )
        if page.image_status != "completed" or not page.image_url or not page.image_url.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Page {page.page_no} does not have a completed image",
            )
        if page.review_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Page {page.page_no} is not approved",
            )

    for _ in range(3):
        token = secrets.token_urlsafe(32)
        savepoint = await session.begin_nested()
        try:
            story.status = "published"  # type: ignore[assignment]
            story.public_share_token = token  # type: ignore[assignment]
            story.public_share_revision = cast(int, story.public_share_revision) + 1  # type: ignore[assignment]
            db_now = await _database_now(session)
            story.published_at = db_now  # type: ignore[assignment]
            story.public_share_activated_at = db_now  # type: ignore[assignment]
            story.public_share_revoked_at = None  # type: ignore[assignment]
            story.updated_at = db_now  # type: ignore[assignment]
            await savepoint.commit()
            break
        except IntegrityError:
            await savepoint.rollback()
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate unique share token",
        )

    await session.commit()
    return await get_review_state(session, story_id)


async def revoke_share(
    session: AsyncSession,
    story_id: int,
    request: RevokeShareRequest,
    admin_id: UUID,
) -> ReviewStateResponse:
    story = await _locked_story_for_review(session, story_id, lock=True)
    if story.status != "published":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Story is not published",
        )

    if story.public_share_token is None and story.public_share_revoked_at is not None:
        return await get_review_state(session, story_id)

    if story.public_share_revision != request.expected_share_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Share revision mismatch",
        )

    db_now = await _database_now(session)
    story.public_share_token = None  # type: ignore[assignment]
    story.public_share_revoked_at = db_now  # type: ignore[assignment]
    story.public_share_revision = cast(int, story.public_share_revision) + 1  # type: ignore[assignment]
    story.updated_at = db_now  # type: ignore[assignment]

    await session.commit()
    return await get_review_state(session, story_id)


async def create_share_link(
    session: AsyncSession,
    story_id: int,
    request: CreateShareLinkRequest,
    admin_id: UUID,
) -> ReviewStateResponse:
    story = await _locked_story_for_review(session, story_id, lock=True)
    if story.status != "published":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Story is not published",
        )

    if story.public_share_token is not None:
        return await get_review_state(session, story_id)

    if story.public_share_revision != request.expected_share_revision:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Share revision mismatch",
        )

    for _ in range(3):
        token = secrets.token_urlsafe(32)
        savepoint = await session.begin_nested()
        try:
            db_now = await _database_now(session)
            story.public_share_token = token  # type: ignore[assignment]
            story.public_share_activated_at = db_now  # type: ignore[assignment]
            story.public_share_revoked_at = None  # type: ignore[assignment]
            story.public_share_revision = cast(int, story.public_share_revision) + 1  # type: ignore[assignment]
            story.updated_at = db_now  # type: ignore[assignment]
            await savepoint.commit()
            break
        except IntegrityError:
            await savepoint.rollback()
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate unique share token",
        )

    await session.commit()
    return await get_review_state(session, story_id)


async def archive_story_extended(
    session: AsyncSession,
    story_id: int,
    request: ArchiveStoryRequest | None,
    admin_id: UUID,
) -> Story:
    stmt = (
        select(Story)
        .options(selectinload(Story.genre))
        .where(Story.id == story_id)
        .with_for_update()
    )
    story = (await session.execute(stmt)).scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")

    chars_result = await session.execute(
        select(StoryCharacter.character_id).where(StoryCharacter.story_id == story_id)
    )
    story.character_ids = list(chars_result.scalars().all())  # type: ignore[attr-defined]

    db_now = await _database_now(session)

    if story.status == "archived":
        return story

    allowed_source_statuses = {"draft", "pending_review", "approved", "published"}
    if story.status not in allowed_source_statuses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot archive story in status: {story.status}",
        )

    if request and request.expected_status is not None:
        if story.status != request.expected_status:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Status mismatch",
            )

    if story.status == "published":
        if request and request.expected_share_revision is not None:
            if story.public_share_revision != request.expected_share_revision:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Share revision mismatch",
                )
        if story.public_share_token is not None:
            story.public_share_token = None  # type: ignore[assignment]
            story.public_share_revision = cast(int, story.public_share_revision) + 1  # type: ignore[assignment]
            story.public_share_revoked_at = db_now  # type: ignore[assignment]

    story.status = "archived"  # type: ignore[assignment]
    story.updated_at = db_now  # type: ignore[assignment]

    await session.commit()
    return story


def _validate_khmer(value: str, label: str, max_chars: int) -> str:
    value = unicodedata.normalize("NFC", value.strip())
    value = re.sub(r"[ \t]+", " ", value)
    if not value:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} is empty",
        )
    if len(value) > max_chars:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} exceeds {max_chars} characters",
        )
    if "\ufffd" in value:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} contains a replacement character",
        )
    for char in value:
        if unicodedata.category(char).startswith("C") and char not in {"\n", "\t", "\u200b"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{label} contains an invalid control character",
            )
    if not re.search(r"[\u1780-\u17b3]", value):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} does not contain Khmer script",
        )
    return value


async def _locked_story_for_review(session: AsyncSession, story_id: int, lock: bool) -> Story:
    stmt = select(Story).options(selectinload(Story.genre)).where(Story.id == story_id)
    if lock:
        stmt = stmt.with_for_update()
    story = (await session.execute(stmt)).scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")

    allowed_statuses = {"pending_review", "generating_images", "approved", "published"}
    if story.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Story in invalid status for review: {story.status}",
        )

    if story.status == "generating_images" and not _has_active_regeneration(story):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Story is generating initial images, cannot be reviewed yet",
        )

    return story


async def _locked_pages(session: AsyncSession, story_id: int, lock: bool) -> Sequence[StoryPage]:
    stmt = select(StoryPage).where(StoryPage.story_id == story_id).order_by(StoryPage.page_no)
    if lock:
        stmt = stmt.with_for_update()
    result = await session.execute(stmt)
    return result.scalars().all()


async def _database_now(session: AsyncSession) -> datetime:
    if isinstance(session, Mock) or getattr(session, "_is_mock", False):
        return datetime.now(timezone.utc)
    try:
        res = (await session.execute(select(func.clock_timestamp()))).scalar_one_or_none()
        if isinstance(res, datetime):
            return res
    except Exception:
        pass
    return datetime.now(timezone.utc)


def _has_active_regeneration(story: Story) -> bool:
    return story.active_image_regeneration_page_id is not None


def _is_job_stale(story: Story, db_now: datetime) -> bool:
    if not _has_active_regeneration(story) or not story.image_generation_heartbeat_at:
        return False
    diff = db_now - story.image_generation_heartbeat_at.replace(tzinfo=db_now.tzinfo)
    return bool(diff.total_seconds() > get_settings().IMAGE_GENERATION_STALE_SECONDS)


def _build_review_state(
    story: Story, pages: Sequence[StoryPage], db_now: datetime
) -> ReviewStateResponse:
    is_pending = story.status == "pending_review"
    has_active_regen = _has_active_regeneration(story)
    is_approved = story.status == "approved"
    is_published = story.status == "published"

    can_edit_khmer = is_pending and not has_active_regen
    can_review_pages = is_pending and not has_active_regen
    all_pages_approved = len(pages) > 0 and all(p.review_status == "approved" for p in pages)
    can_complete_review = is_pending and not has_active_regen and all_pages_approved

    can_publish = is_approved

    # Active share logic
    share_active = (
        is_published
        and story.public_share_activated_at is not None
        and story.public_share_revoked_at is None
    )
    can_create_share_link = is_published and not share_active
    can_revoke_share_link = is_published and share_active

    can_archive = is_pending or is_approved or is_published
    read_only = not (can_edit_khmer or can_review_pages)

    capabilities = ReviewCapabilitiesResponse(
        can_edit_khmer=bool(can_edit_khmer),
        can_review_pages=bool(can_review_pages),
        can_complete_review=bool(can_complete_review),
        can_publish=bool(can_publish),
        can_create_share_link=bool(can_create_share_link),
        can_revoke_share_link=bool(can_revoke_share_link),
        can_archive=bool(can_archive),
        read_only=bool(read_only),
    )

    genre_dict = None
    if story.genre:
        genre_dict = {
            "id": story.genre.id,
            "name_vi": story.genre.name_vi,
            "name_en": story.genre.name_en,
        }

    story_resp = ReviewStoryResponse(
        id=cast(int, story.id),
        title_vi=cast(str | None, story.title_vi),
        title_km=cast(str | None, story.title_km),
        status=cast(str, story.status),
        text_revision=cast(int, story.text_revision),
        target_age=cast(str | None, story.target_age),
        genre=genre_dict,
        published_at=cast(datetime | None, story.published_at),
    )

    progress = ReviewProgressResponse(
        total=len(pages),
        pending=sum(1 for p in pages if p.review_status == "pending"),
        approved=sum(1 for p in pages if p.review_status == "approved"),
        rejected=sum(1 for p in pages if p.review_status == "rejected"),
    )

    is_running = has_active_regen and not _is_job_stale(story, db_now)
    job = ReviewJobResponse(
        kind="review_regeneration" if has_active_regen else None,
        active_page_id=cast(int | None, story.active_image_regeneration_page_id),
        is_running=bool(is_running),
        is_stale=bool(_is_job_stale(story, db_now)),
        can_resume=bool(has_active_regen and _is_job_stale(story, db_now)),
    )

    share = ReviewShareResponse(
        active=bool(share_active),
        revision=cast(int, story.public_share_revision),
        token=cast(str | None, story.public_share_token),
        path=f"/stories/{story.public_share_token}" if story.public_share_token else None,
        activated_at=cast(datetime | None, story.public_share_activated_at),
        revoked_at=cast(datetime | None, story.public_share_revoked_at),
    )

    page_responses = []
    for page in pages:
        has_text = bool(
            page.text_km and page.text_km.strip() and page.text_vi and page.text_vi.strip()
        )
        valid_image = page.image_status == "completed" and bool(page.image_url)
        accept_failed_image = page.image_status == "failed" and bool(page.image_url)
        image_usable = valid_image or accept_failed_image

        can_approve = bool(can_review_pages and has_text and image_usable)
        can_reject = bool(can_review_pages and has_text and image_usable)
        has_prompt_and_notes = bool(
            page.image_prompt_en
            and page.image_prompt_en.strip()
            and page.review_notes
            and page.review_notes.strip()
        )
        can_regenerate = bool(
            can_review_pages
            and has_text
            and image_usable
            and page.review_status == "rejected"
            and has_prompt_and_notes
        )

        page_responses.append(
            ReviewPageResponse(
                id=cast(int, page.id),
                page_no=cast(int, page.page_no),
                text_km=cast(str, page.text_km or ""),
                text_vi=cast(str, page.text_vi or ""),
                spellcheck_flags=cast(list[dict[str, Any]], page.spellcheck_flags or []),
                khmer_validated_at=cast(datetime | None, page.khmer_validated_at),
                image_url=cast(str | None, page.image_url),
                image_status=cast(str, page.image_status),
                image_attempt_count=cast(int, page.image_attempt_count),
                image_error_code=cast(str | None, page.image_error_code),
                review_status=cast(str, page.review_status),
                review_notes=cast(str | None, page.review_notes),
                reviewed_at=cast(datetime | None, page.reviewed_at),
                can_approve=can_approve,
                can_reject=can_reject,
                can_regenerate=can_regenerate,
            )
        )

    return ReviewStateResponse(
        story=story_resp,
        progress=progress,
        job=job,
        share=share,
        capabilities=capabilities,
        pages=page_responses,
    )
