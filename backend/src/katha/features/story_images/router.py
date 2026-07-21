"""Admin-only API routes for image planning and sequential image generation."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user
from katha.features.auth.schemas import TokenUser
from katha.features.story_images import runner, service
from katha.features.story_images.dependencies import get_story_image_ai, get_story_image_storage
from katha.features.story_images.ports import StoryImageAI, StoryImageStorage
from katha.features.story_images.schemas import (
    CreateImagePlanRequest,
    GenerateImagesRequest,
    GenerateImagesResponse,
    StoryImagesResponse,
    UpdateImagePlanRequest,
)

router = APIRouter()


@router.get("/stories/{story_id}/images", response_model=StoryImagesResponse)
async def get_story_images(
    story_id: Annotated[int, Path(gt=0)],
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> StoryImagesResponse:
    """Read canonical progress only; this endpoint never schedules or reclaims a job."""

    return await service.get_story_images(session, story_id)


@router.post("/stories/{story_id}/image-plan", response_model=StoryImagesResponse)
async def create_image_plan(
    story_id: Annotated[int, Path(gt=0)],
    request: CreateImagePlanRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
    provider: Annotated[StoryImageAI, Depends(get_story_image_ai)],
) -> StoryImagesResponse:
    """Synchronously create a structured plan; no image generation starts here."""

    return await service.create_image_plan(session, story_id, request, provider)


@router.put("/stories/{story_id}/image-plan", response_model=StoryImagesResponse)
async def update_image_plan(
    story_id: Annotated[int, Path(gt=0)],
    request: UpdateImagePlanRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> StoryImagesResponse:
    """Save a full page-to-character mapping and rebuild deterministic prompts."""

    return await service.update_image_plan(session, story_id, request)


@router.post(
    "/stories/{story_id}/generate-images",
    response_model=GenerateImagesResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_images(
    story_id: Annotated[int, Path(gt=0)],
    request: GenerateImagesRequest,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
    provider: Annotated[StoryImageAI, Depends(get_story_image_ai)],
    storage: Annotated[StoryImageStorage, Depends(get_story_image_storage)],
) -> GenerateImagesResponse:
    """Commit an ownership claim first, then schedule exactly one in-process runner."""

    response, should_schedule = await service.start_image_generation(
        session, story_id, request, storage
    )
    if should_schedule:
        background_tasks.add_task(
            runner.run_image_generation, story_id, response.job_id, provider, storage
        )
    return response
