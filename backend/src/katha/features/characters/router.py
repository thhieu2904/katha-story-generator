"""Admin-only Character Bank endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user
from katha.features.auth.schemas import TokenUser
from katha.features.characters import service
from katha.features.characters.models import Character
from katha.features.characters.schemas import CharacterDetailOut, CharacterOut

router = APIRouter()


@router.get("/characters", response_model=list[CharacterOut])
async def read_characters(
    session: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> list[Character]:
    return await service.list_characters(session)


@router.get("/characters/{character_id}", response_model=CharacterDetailOut)
async def read_character(
    character_id: Annotated[int, Path(gt=0)],
    session: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenUser, Depends(get_admin_user)],
) -> Character:
    character = await service.get_character(session, character_id)
    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )
    return character
