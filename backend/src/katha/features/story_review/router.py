"""FastAPI router for story review endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user
from katha.features.auth.schemas import TokenUser
from katha.features.story_images.dependencies import get_story_image_ai, get_story_image_storage
from katha.features.story_images.ports import StoryImageAI, StoryImageStorage
from katha.features.story_review import runner, service
from katha.features.story_review.schemas import (
    CompleteReviewRequest,
    EditKhmerPageRequest,
    EditKhmerTitleRequest,
    RegenerateImageRequest,
    RegenerateImageResponse,
    ReviewPageRequest,
    ReviewStateResponse,
)

router = APIRouter()


@router.get("/stories/{story_id}/review", response_model=ReviewStateResponse)
async def get_review_state(
    story_id: Annotated[int, Path(gt=0)],
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> ReviewStateResponse:
    """Get the current review state and capabilities for a story."""
    return await service.get_review_state(session, story_id)


@router.patch("/stories/{story_id}/review/title-km", response_model=ReviewStateResponse)
async def edit_khmer_title(
    story_id: Annotated[int, Path(gt=0)],
    request: EditKhmerTitleRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> ReviewStateResponse:
    """Edit the Khmer title during review."""
    return await service.edit_khmer_title(session, story_id, request, admin.id)


@router.patch(
    "/stories/{story_id}/pages/{page_id}/review/text-km",
    response_model=ReviewStateResponse,
)
async def edit_khmer_page(
    story_id: Annotated[int, Path(gt=0)],
    page_id: Annotated[int, Path(gt=0)],
    request: EditKhmerPageRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> ReviewStateResponse:
    """Edit the Khmer text for a specific page during review."""
    return await service.edit_khmer_page(session, story_id, page_id, request, admin.id)


@router.put(
    "/stories/{story_id}/pages/{page_id}/review",
    response_model=ReviewStateResponse,
)
async def review_page(
    story_id: Annotated[int, Path(gt=0)],
    page_id: Annotated[int, Path(gt=0)],
    request: ReviewPageRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> ReviewStateResponse:
    """Approve or reject a page during review."""
    return await service.review_page(session, story_id, page_id, request, admin.id)


@router.post("/stories/{story_id}/complete-review", response_model=ReviewStateResponse)
async def complete_review(
    story_id: Annotated[int, Path(gt=0)],
    request: CompleteReviewRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> ReviewStateResponse:
    """Complete the review process and approve the story."""
    return await service.complete_review(session, story_id, request, admin.id)


@router.post(
    "/stories/{story_id}/pages/{page_id}/regenerate-image",
    response_model=RegenerateImageResponse,
)
async def regenerate_page_image(
    story_id: Annotated[int, Path(gt=0)],
    page_id: Annotated[int, Path(gt=0)],
    request: RegenerateImageRequest,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
    provider: Annotated[StoryImageAI, Depends(get_story_image_ai)],
    storage: Annotated[StoryImageStorage, Depends(get_story_image_storage)],
) -> RegenerateImageResponse:
    """Regenerate a rejected page's image."""
    response = await service.start_regeneration(session, story_id, page_id, request, admin.id)
    if not response.already_running:
        background_tasks.add_task(
            runner.run_single_page_regeneration,
            story_id,
            UUID(response.job_id),
            page_id,
            provider,
            storage,
        )
    return response
