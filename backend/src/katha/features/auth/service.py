"""Verification of Supabase access tokens against the project's JWKS."""

from functools import lru_cache
from typing import Any, Literal
from uuid import UUID

import jwt
from jwt import PyJWKClient

from katha.core.config import Settings
from katha.features.auth.schemas import TokenUser

ALLOWED_JWT_ALGORITHMS = ("RS256", "ES256")


class TokenVerificationError(Exception):
    """Raised when an access token cannot be trusted."""


@lru_cache(maxsize=4)
def get_jwks_client(jwks_url: str) -> PyJWKClient:
    """Return PyJWT's cached JWKS client for a Supabase project."""

    return PyJWKClient(jwks_url, cache_keys=True)


def verify_access_token(
    token: str,
    settings: Settings,
    jwks_client: PyJWKClient | None = None,
) -> TokenUser:
    """Verify a Supabase JWT and normalize its application role."""

    base_url = settings.SUPABASE_URL.rstrip("/")
    if not base_url:
        raise TokenVerificationError("Supabase Auth is not configured")

    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        key_id = header.get("kid")
        if algorithm not in ALLOWED_JWT_ALGORITHMS or not isinstance(key_id, str):
            raise TokenVerificationError("Unsupported token header")

        client = jwks_client or get_jwks_client(f"{base_url}/auth/v1/.well-known/jwks.json")
        signing_key = client.get_signing_key_from_jwt(token)
        payload: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=list(ALLOWED_JWT_ALGORITHMS),
            audience=settings.SUPABASE_JWT_AUDIENCE,
            issuer=f"{base_url}/auth/v1",
            options={"require": ["exp", "iss", "aud", "sub"]},
        )

        user_id = UUID(str(payload["sub"]))
        email_claim = payload.get("email")
        email = email_claim if isinstance(email_claim, str) else None
        metadata = payload.get("app_metadata")
        raw_role = metadata.get("app_role") if isinstance(metadata, dict) else None
        app_role: Literal["admin", "reader"] = "admin" if raw_role == "admin" else "reader"
        return TokenUser(id=user_id, email=email, app_role=app_role)
    except TokenVerificationError:
        raise
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise TokenVerificationError("Invalid access token") from exc
