"""Offline API/auth and scheduling contracts for Phase 4 image routes."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user, get_current_user
from katha.features.auth.schemas import TokenUser
from katha.features.story_images import runner, service
from katha.features.story_images.dependencies import get_story_image_ai, get_story_image_storage
from katha.features.story_images.schemas import GenerateImagesResponse, StoryImagesResponse
from katha.main import app

ADMIN = TokenUser(
    id=UUID("00000000-0000-0000-0000-000000000401"),
    email="admin-phase4@example.com",
    app_role="admin",
)
READER = TokenUser(
    id=UUID("00000000-0000-0000-0000-000000000402"),
    email="reader-phase4@example.com",
    app_role="reader",
)


def image_state() -> StoryImagesResponse:
    now = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    return StoryImagesResponse.model_validate(
        {
            "story_id": 10,
            "title_vi": "Khu rừng nhỏ",
            "status": "text_confirmed",
            "text_revision": 3,
            "image_plan_revision": 4,
            "image_plan_ready": True,
            "mapping_locked": False,
            "job_id": None,
            "job_stale": False,
            "can_start": True,
            "can_retry": False,
            "can_resume": False,
            "progress": {"total": 1, "pending": 1, "generating": 0, "completed": 0, "failed": 0},
            "available_characters": [{"id": 1, "name": "An", "thumbnail_url": None}],
            "pages": [
                {
                    "id": 101,
                    "page_no": 1,
                    "text_vi": "An đi trong rừng.",
                    "text_km": "អាន ដើរ ក្នុង ព្រៃ។",
                    "text_en": "An walks in the forest.",
                    "image_scene_en": "An walks down a sunny forest path.",
                    "image_prompt_en": "A safe prompt.",
                    "character_ids": [1],
                    "image_status": "pending",
                    "image_url": None,
                    "image_attempt_count": 0,
                    "image_error_code": None,
                    "updated_at": now,
                }
            ],
        }
    )


def install_overrides(session: AsyncSession | None = None) -> tuple[AsyncSession, object, object]:
    session = session or AsyncMock(spec=AsyncSession)
    provider = object()
    storage = object()

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    async def override_admin() -> TokenUser:
        return ADMIN

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_admin_user] = override_admin
    app.dependency_overrides[get_story_image_ai] = lambda: provider
    app.dependency_overrides[get_story_image_storage] = lambda: storage
    return session, provider, storage


@pytest.fixture(autouse=True)
def clean_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


AUTH_CASES = [
    ("GET", "/api/stories/10/images", None),
    (
        "POST",
        "/api/stories/10/image-plan",
        {"expected_text_revision": 3, "expected_image_plan_revision": 4},
    ),
    (
        "PUT",
        "/api/stories/10/image-plan",
        {"expected_image_plan_revision": 4, "pages": [{"page_id": 101, "character_ids": [1]}]},
    ),
    ("POST", "/api/stories/10/generate-images", {"expected_image_plan_revision": 4}),
]


@pytest.mark.parametrize(("method", "path", "payload"), AUTH_CASES)
def test_phase4_routes_require_authentication(method: str, path: str, payload: dict | None) -> None:
    with TestClient(app) as client:
        response = client.request(method, path, json=payload)

    assert response.status_code == 401


@pytest.mark.parametrize(("method", "path", "payload"), AUTH_CASES)
def test_phase4_routes_reject_reader_role(method: str, path: str, payload: dict | None) -> None:
    async def override_reader() -> TokenUser:
        return READER

    app.dependency_overrides[get_current_user] = override_reader
    with TestClient(app) as client:
        response = client.request(method, path, json=payload)

    assert response.status_code == 403


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("POST", "/api/stories/10/image-plan", {"expected_text_revision": 3}),
        (
            "PUT",
            "/api/stories/10/image-plan",
            {
                "expected_image_plan_revision": 4,
                "pages": [
                    {"page_id": 101, "character_ids": []},
                    {"page_id": 101, "character_ids": []},
                ],
            },
        ),
        ("POST", "/api/stories/10/generate-images", {"expected_image_plan_revision": -1}),
    ],
)
def test_phase4_routes_reject_invalid_request_contracts(
    method: str, path: str, payload: dict
) -> None:
    install_overrides()

    with TestClient(app) as client:
        response = client.request(method, path, json=payload)

    assert response.status_code == 422


def test_image_get_dispatches_read_only_service(monkeypatch: pytest.MonkeyPatch) -> None:
    session, _, _ = install_overrides()
    mocked = AsyncMock(return_value=image_state())
    monkeypatch.setattr(service, "get_story_images", mocked)

    with TestClient(app) as client:
        response = client.get("/api/stories/10/images")

    assert response.status_code == 200
    assert response.json()["progress"] == {
        "total": 1,
        "pending": 1,
        "generating": 0,
        "completed": 0,
        "failed": 0,
    }
    mocked.assert_awaited_once_with(session, 10)
    session.commit.assert_not_awaited()


def test_generate_schedules_only_committed_claim_with_primitive_runner_arguments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session, provider, storage = install_overrides()
    job_id = uuid4()
    response_model = GenerateImagesResponse(
        job_id=job_id,
        already_running=False,
        status="generating_images",
        progress={"total": 1, "pending": 1, "generating": 0, "completed": 0, "failed": 0},
    )
    start = AsyncMock(return_value=(response_model, True))
    scheduled = AsyncMock()
    monkeypatch.setattr(service, "start_image_generation", start)
    monkeypatch.setattr(runner, "run_image_generation", scheduled)

    with TestClient(app) as client:
        response = client.post(
            "/api/stories/10/generate-images", json={"expected_image_plan_revision": 4}
        )

    assert response.status_code == 202
    assert response.json()["job_id"] == str(job_id)
    start.assert_awaited_once_with(
        session,
        10,
        start.await_args.args[2],
        storage,
    )
    assert start.await_args.args[2].expected_image_plan_revision == 4
    scheduled.assert_awaited_once_with(10, job_id, provider, storage)
    assert session not in scheduled.await_args.args


def test_fresh_duplicate_claim_does_not_schedule_a_second_runner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, _, _ = install_overrides()
    job_id = uuid4()
    response_model = GenerateImagesResponse(
        job_id=job_id,
        already_running=True,
        status="generating_images",
        progress={"total": 1, "pending": 0, "generating": 1, "completed": 0, "failed": 0},
    )
    start = AsyncMock(return_value=(response_model, False))
    scheduled = AsyncMock()
    monkeypatch.setattr(service, "start_image_generation", start)
    monkeypatch.setattr(runner, "run_image_generation", scheduled)

    with TestClient(app) as client:
        response = client.post(
            "/api/stories/10/generate-images", json={"expected_image_plan_revision": 4}
        )

    assert response.status_code == 202
    assert response.json()["already_running"] is True
    scheduled.assert_not_awaited()
