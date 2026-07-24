"""Router for story management endpoints (Phase 3A)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user
from katha.features.auth.schemas import TokenUser
from katha.features.stories import generation_service, service
from katha.features.stories.generation_dependencies import get_story_text_ai
from katha.features.stories.models import Story
from katha.features.stories.route_keys import decode_story_route_key
from katha.features.stories.schemas import (
    StoryCreate,
    StoryListItem,
    StoryResponse,
    StoryTextResponse,
    StoryUpdate,
)
from katha.integrations.openai_story_text import StoryTextAI

router = APIRouter()


@router.post("/stories", response_model=StoryResponse, status_code=status.HTTP_201_CREATED)
async def create_story(
    data: StoryCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> Story:
    """Create a new story draft."""
    return await service.create_story(session, data, admin.id)


@router.get("/stories", response_model=list[StoryListItem])
async def list_stories(
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
    include_archived: bool = False,
) -> list[Story]:
    """List all stories. Archived stories excluded by default."""
    return await service.list_stories(session, include_archived)


@router.get("/stories/by-route-key/{route_key}", response_model=StoryResponse)
async def get_story_by_route_key(
    route_key: str,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> Story:
    """Resolve an opaque route key into internal story_id and return story detail."""
    story_id = decode_story_route_key(route_key)
    if story_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    story = await service.get_story(session, story_id)
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    return story


@router.get("/stories/{story_id}", response_model=StoryResponse)
async def get_story(
    story_id: Annotated[int, Path(gt=0)],
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> Story:
    """Get story detail with character_ids."""
    story = await service.get_story(session, story_id)
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    return story


@router.patch("/stories/{story_id}", response_model=StoryResponse)
async def update_story(
    story_id: Annotated[int, Path(gt=0)],
    data: StoryUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> Story:
    """Update a draft story's setup fields."""
    return await service.update_story(session, story_id, data)


@router.post("/stories/{story_id}/archive", response_model=StoryResponse)
async def archive_story(
    story_id: Annotated[int, Path(gt=0)],
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> Story:
    """Archive a draft story."""
    return await service.archive_story(session, story_id)


@router.post("/stories/{story_id}/generate-text", response_model=StoryTextResponse)
async def generate_story_text(
    story_id: Annotated[int, Path(gt=0)],
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
    provider: Annotated[StoryTextAI, Depends(get_story_text_ai)],
) -> StoryTextResponse:
    """Generate, translate, validate, and atomically persist bilingual story text."""
    return await generation_service.generate_story_text(session, story_id, provider)


@router.get("/stories/{story_id}/text", response_model=StoryTextResponse)
async def get_story_text(
    story_id: Annotated[int, Path(gt=0)],
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> StoryTextResponse:
    """Return canonical bilingual story text without side effects."""
    return await generation_service.get_story_text(session, story_id)
