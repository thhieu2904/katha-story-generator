"""Authentication endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends

from katha.features.auth.dependencies import get_current_user
from katha.features.auth.schemas import TokenUser

router = APIRouter()


@router.get("/me", response_model=TokenUser)
async def read_current_user(
    user: Annotated[TokenUser, Depends(get_current_user)],
) -> TokenUser:
    """Confirm that the backend accepts the current Supabase session."""

    return user
