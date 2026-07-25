from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db

from . import service

router = APIRouter()


@router.get("/shared-stories/{share_token}")
async def get_shared_story(
    share_token: str,
    session: AsyncSession = Depends(get_db),
) -> Response:
    headers = {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
    }
    try:
        result = await service.get_shared_story(session, share_token)
        return JSONResponse(
            content=result.model_dump(mode="json"),
            headers=headers,
        )
    except HTTPException as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=headers,
        )
