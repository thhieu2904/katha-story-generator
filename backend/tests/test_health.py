"""Tests for the /health endpoint."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def healthy_client():
    """Create a test client with mocked healthy dependencies."""
    mock_r2 = MagicMock()
    mock_r2.check_connection.return_value = True

    with (
        patch("katha.main.get_db") as mock_get_db,
        patch("katha.main._get_r2_client", return_value=mock_r2),
    ):
        # Mock DB session that succeeds
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()

        async def _mock_get_db():
            yield mock_session

        mock_get_db.side_effect = _mock_get_db

        from katha.main import app

        with TestClient(app) as client:
            yield client


@pytest.fixture
def degraded_client():
    """Create a test client with a failing DB dependency."""
    mock_r2 = MagicMock()
    mock_r2.check_connection.return_value = True

    with (
        patch("katha.main.get_db") as mock_get_db,
        patch("katha.main._get_r2_client", return_value=mock_r2),
    ):
        # Mock DB session that fails
        async def _mock_get_db():
            raise ConnectionError("DB unavailable")
            yield  # noqa: E501 — unreachable, required to make it an async generator

        mock_get_db.side_effect = _mock_get_db

        from katha.main import app

        with TestClient(app) as client:
            yield client


def test_health_healthy(healthy_client):
    """Health endpoint returns 200 with correct structure when all checks pass."""
    response = healthy_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.1.0"
    assert "checks" in data
    assert data["checks"]["database"] == "ok"
    assert data["checks"]["r2"] == "ok"


def test_health_degraded(degraded_client):
    """Health endpoint returns 503 when database is unavailable."""
    response = degraded_client.get("/health")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"
    assert data["version"] == "0.1.0"
    assert data["checks"]["database"] == "unavailable"
    # Should never expose raw error messages
    assert "ConnectionError" not in str(data)
    assert "DB unavailable" not in str(data)
