"""Admin-only Story Editor API routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user
from katha.features.auth.schemas import TokenUser
from katha.features.stories.generation_dependencies import get_story_text_ai
from katha.features.stories.schemas import StoryTextResponse
from katha.features.story_editor import service
from katha.features.story_editor.ports import KhmerValidator, StoryEditorAI
from katha.features.story_editor.schemas import (
    AddPageRequest,
    ConfirmTextRequest,
    EditRequest,
    MutationResponse,
    ReorderPagesRequest,
    RetranslateRequest,
    ValidateKhmerRequest,
)
from katha.integrations.khmer.validator import get_khmer_validator

router = APIRouter()


@router.post("/stories/{story_id}/text/edits", response_model=MutationResponse)
async def edit_story(
    story_id: Annotated[int, Path(gt=0)],
    request: EditRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
    provider: Annotated[StoryEditorAI, Depends(get_story_text_ai)],
    validator: Annotated[KhmerValidator, Depends(get_khmer_validator)],
) -> MutationResponse:
    return await service.edit_story(session, story_id, request, provider, validator)


@router.post(
    "/stories/{story_id}/pages",
    response_model=MutationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_page(
    story_id: Annotated[int, Path(gt=0)],
    request: AddPageRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
    provider: Annotated[StoryEditorAI, Depends(get_story_text_ai)],
    validator: Annotated[KhmerValidator, Depends(get_khmer_validator)],
) -> MutationResponse:
    return await service.add_page(session, story_id, request, provider, validator)


@router.put("/stories/{story_id}/pages/order", response_model=MutationResponse)
async def reorder_pages(
    story_id: Annotated[int, Path(gt=0)],
    request: ReorderPagesRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> MutationResponse:
    return await service.reorder_pages(session, story_id, request)


@router.delete("/stories/{story_id}/pages/{page_id}", response_model=MutationResponse)
async def delete_page(
    story_id: Annotated[int, Path(gt=0)],
    page_id: Annotated[int, Path(gt=0)],
    expected_revision: Annotated[int, Query(ge=1)],
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> MutationResponse:
    return await service.delete_page(session, story_id, page_id, expected_revision)


@router.post("/stories/{story_id}/validate-km", response_model=StoryTextResponse)
async def validate_khmer(
    story_id: Annotated[int, Path(gt=0)],
    request: ValidateKhmerRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
    validator: Annotated[KhmerValidator, Depends(get_khmer_validator)],
) -> StoryTextResponse:
    return await service.validate_khmer_snapshot(session, story_id, request, validator)


@router.post("/stories/{story_id}/retranslate-km", response_model=MutationResponse)
async def retranslate_khmer(
    story_id: Annotated[int, Path(gt=0)],
    request: RetranslateRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
    provider: Annotated[StoryEditorAI, Depends(get_story_text_ai)],
    validator: Annotated[KhmerValidator, Depends(get_khmer_validator)],
) -> MutationResponse:
    return await service.retranslate_khmer(session, story_id, request, provider, validator)


@router.post("/stories/{story_id}/confirm-text", response_model=StoryTextResponse)
async def confirm_text(
    story_id: Annotated[int, Path(gt=0)],
    request: ConfirmTextRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> StoryTextResponse:
    return await service.confirm_text(session, story_id, request)
