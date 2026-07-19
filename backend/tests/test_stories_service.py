"""Focused unit tests for story service transaction failure behavior."""

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from katha.features.stories.models import Story
from katha.features.stories.schemas import StoryCreate, StoryUpdate
from katha.features.stories.service import archive_story, create_story, update_story

ADMIN_ID = UUID("00000000-0000-0000-0000-000000000001")


def result_for(*, detail: object | None = None, items: list[object] | None = None) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = detail
    if items is not None:
        result.scalars.return_value.all.return_value = items
    return result


def valid_create_data() -> StoryCreate:
    return StoryCreate(
        description_vi="Câu chuyện hợp lệ dùng cho kiểm tra transaction",
        backbone_id=1,
        genre_id=1,
        art_style_id=1,
        target_age="preschool",
        length_pref="short",
        character_ids=[1, 2],
    )


@pytest.mark.asyncio
async def test_invalid_fk_update_keeps_state_and_does_not_commit() -> None:
    session = AsyncMock(spec=AsyncSession)
    story = Story(
        id=1,
        description_vi="Mô tả ban đầu của câu chuyện",
        backbone_id=1,
        status="draft",
    )
    session.execute.side_effect = [
        result_for(detail=story),
        result_for(items=[1, 2]),
        result_for(detail=None),
    ]

    with pytest.raises(HTTPException) as exc_info:
        await update_story(session, story.id, StoryUpdate(backbone_id=999))

    assert exc_info.value.status_code == 422
    assert story.backbone_id == 1
    session.flush.assert_not_awaited()
    session.commit.assert_not_awaited()
    session.rollback.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_flush_failure_rolls_back_and_does_not_commit() -> None:
    session = AsyncMock(spec=AsyncSession)
    session.execute.side_effect = [
        result_for(detail=MagicMock(id=1)),
        result_for(detail=MagicMock(id=1)),
        result_for(detail=MagicMock(id=1)),
        result_for(items=[MagicMock(id=1), MagicMock(id=2)]),
    ]
    session.flush.side_effect = SQLAlchemyError("flush failed")

    with pytest.raises(SQLAlchemyError, match="flush failed"):
        await create_story(session, valid_create_data(), ADMIN_ID)

    session.rollback.assert_awaited_once()
    session.commit.assert_not_awaited()
    assert session.add.call_count == 1


@pytest.mark.asyncio
async def test_update_commit_failure_rolls_back_and_does_not_return_success() -> None:
    session = AsyncMock(spec=AsyncSession)
    story = Story(id=1, description_vi="Mô tả ban đầu của câu chuyện", status="draft")
    session.execute.side_effect = [
        result_for(detail=story),
        result_for(items=[1, 2]),
    ]
    session.commit.side_effect = SQLAlchemyError("commit failed")

    with pytest.raises(SQLAlchemyError, match="commit failed"):
        await update_story(
            session,
            story.id,
            StoryUpdate(description_vi="Mô tả mới đủ dài nhưng commit thất bại"),
        )

    session.flush.assert_awaited_once()
    session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_archive_commit_failure_rolls_back_and_does_not_return_success() -> None:
    session = AsyncMock(spec=AsyncSession)
    story = Story(id=1, description_vi="Mô tả câu chuyện", status="draft")
    session.execute.side_effect = [
        result_for(detail=story),
        result_for(items=[1, 2]),
    ]
    session.commit.side_effect = SQLAlchemyError("archive failed")

    with pytest.raises(SQLAlchemyError, match="archive failed"):
        await archive_story(session, story.id)

    session.flush.assert_awaited_once()
    session.rollback.assert_awaited_once()
