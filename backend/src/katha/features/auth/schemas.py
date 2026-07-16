"""Schemas exposed by the authentication feature."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class TokenUser(BaseModel):
    """The small, trusted user view extracted from a verified access token."""

    id: UUID
    email: str | None = None
    app_role: Literal["admin", "reader"] = "reader"
