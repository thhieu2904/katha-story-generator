"""FastAPI dependencies for authenticated and admin-only endpoints."""

import asyncio
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from katha.core.config import Settings, get_settings
from katha.features.auth.schemas import TokenUser
from katha.features.auth.service import TokenVerificationError, verify_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing access token",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TokenUser:
    """Return a trusted user derived from a verified Bearer token."""

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    try:
        return await asyncio.to_thread(verify_access_token, credentials.credentials, settings)
    except TokenVerificationError as exc:
        raise _unauthorized() from exc


async def get_admin_user(
    user: Annotated[TokenUser, Depends(get_current_user)],
) -> TokenUser:
    """Require the verified user to hold the server-controlled admin role."""

    if user.app_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
