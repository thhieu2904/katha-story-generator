import re
from typing import cast

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from katha.features.stories.models import Story

from .schemas import PublicCoverResponse, PublicPageResponse, PublicStoryResponse

_TOKEN_REGEX = re.compile(r"^[A-Za-z0-9_-]{43}$")


async def get_shared_story(session: AsyncSession, share_token: str) -> PublicStoryResponse:
    # Validate token format before DB query
    if not _TOKEN_REGEX.match(share_token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")

    # Lookup: exact token + published status
    stmt = (
        select(Story)
        .where(
            Story.public_share_token == share_token,
            Story.status == "published",
            Story.public_share_activated_at.is_not(None),
            Story.public_share_revoked_at.is_(None),
        )
        .options(selectinload(Story.pages))
    )
    story = (await session.execute(stmt)).scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")

    # Sort pages by page_no ASC
    sorted_pages = sorted(story.pages, key=lambda p: p.page_no)

    # Cover: page 1 image_url
    cover_url = sorted_pages[0].image_url if sorted_pages else None

    return PublicStoryResponse(
        title_km=cast(str | None, story.title_km),
        title_vi=cast(str | None, story.title_vi),
        target_age=cast(str | None, story.target_age),
        page_count=len(sorted_pages),
        cover=PublicCoverResponse(background_url=cast(str | None, cover_url)),
        pages=[
            PublicPageResponse(
                page_no=cast(int, p.page_no),
                text_km=cast(str, p.text_km or ""),
                text_vi=cast(str, p.text_vi or ""),
                image_url=cast(str | None, p.image_url),
            )
            for p in sorted_pages
        ],
    )
