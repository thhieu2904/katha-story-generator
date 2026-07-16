"""Offline tests for Supabase JWT verification and auth dependencies."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.testclient import TestClient

from katha.core.config import Settings
from katha.features.auth.dependencies import get_admin_user
from katha.features.auth.schemas import TokenUser
from katha.features.auth.service import TokenVerificationError, verify_access_token
from katha.main import app

ISSUER = "https://example.supabase.co/auth/v1"
AUDIENCE = "authenticated"
PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PUBLIC_KEY = PRIVATE_KEY.public_key()
USER_ID = uuid4()


class StaticJwksClient:
    def __init__(self, key=PUBLIC_KEY):
        self.key = key

    def get_signing_key_from_jwt(self, _token: str):
        return SimpleNamespace(key=self.key)


def make_token(**overrides: object) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, object] = {
        "sub": str(USER_ID),
        "email": "admin@example.com",
        "app_metadata": {"app_role": "admin"},
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=10),
    }
    payload.update(overrides)
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256", headers={"kid": "test-key"})


def auth_settings() -> Settings:
    return Settings(
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_JWT_AUDIENCE=AUDIENCE,
    )


def test_valid_admin_token():
    user = verify_access_token(make_token(), auth_settings(), StaticJwksClient())

    assert user.id == USER_ID
    assert user.email == "admin@example.com"
    assert user.app_role == "admin"


@pytest.mark.parametrize(
    ("metadata", "expected_role"),
    [
        ({"app_role": "reader"}, "reader"),
        ({}, "reader"),
        ({"app_role": "owner"}, "reader"),
    ],
)
def test_role_is_normalized_from_app_metadata(metadata, expected_role):
    token = make_token(app_metadata=metadata)

    user = verify_access_token(token, auth_settings(), StaticJwksClient())

    assert user.app_role == expected_role


@pytest.mark.parametrize(
    "claims",
    [
        {"exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        {"iss": "https://attacker.example/auth/v1"},
        {"aud": "other-audience"},
        {"sub": "not-a-uuid"},
    ],
)
def test_invalid_claims_are_rejected(claims):
    with pytest.raises(TokenVerificationError):
        verify_access_token(
            make_token(**claims),
            auth_settings(),
            StaticJwksClient(),
        )


def test_invalid_signature_is_rejected():
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    with pytest.raises(TokenVerificationError):
        verify_access_token(
            make_token(),
            auth_settings(),
            StaticJwksClient(other_key.public_key()),
        )


def test_unsupported_algorithm_is_rejected():
    token = jwt.encode(
        {"sub": str(USER_ID)},
        "not-a-production-secret-32-bytes-long",
        algorithm="HS256",
        headers={"kid": "test-key"},
    )

    with pytest.raises(TokenVerificationError):
        verify_access_token(token, auth_settings(), StaticJwksClient())


@pytest.mark.asyncio
async def test_reader_cannot_pass_admin_dependency():
    reader = TokenUser(id=UUID("00000000-0000-0000-0000-000000000001"))

    with pytest.raises(HTTPException) as exc_info:
        await get_admin_user(reader)

    assert exc_info.value.status_code == 403


def test_missing_bearer_token_returns_sanitized_401():
    with TestClient(app) as client:
        response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json() == {"detail": "Invalid or missing access token"}


def test_malformed_token_does_not_leak_token_or_exception():
    raw_token = "this-is-not-a-jwt"
    with TestClient(app) as client:
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {raw_token}"},
        )

    assert response.status_code == 401
    assert raw_token not in response.text
    assert "TokenVerificationError" not in response.text
