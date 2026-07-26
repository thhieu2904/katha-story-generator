"""Offline API/auth contract tests for Phase 3B generation and Phase 3C editor routes."""

from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from katha.core.dependencies import get_db
from katha.features.auth.dependencies import get_admin_user, get_current_user
from katha.features.auth.schemas import TokenUser
from katha.features.stories import generation_service
from katha.features.stories.generation_dependencies import get_story_text_ai
from katha.features.stories.models import Story, StoryPage
from katha.features.stories.schemas import StoryTextResponse
from katha.features.story_editor import service as editor_service
from katha.features.story_editor.schemas import ChangeSummary, MutationResponse
from katha.integrations.khmer.baseline import BaselineKhmerValidator
from katha.integrations.khmer.validator import get_khmer_validator
from katha.main import app

ADMIN = TokenUser(
    id=UUID("00000000-0000-0000-0000-000000000201"),
    email="admin-phase3@example.com",
    app_role="admin",
)
READER = TokenUser(
    id=UUID("00000000-0000-0000-0000-000000000202"),
    email="reader-phase3@example.com",
    app_role="reader",
)


def canonical_text(status: str = "text_draft", revision: int = 3) -> StoryTextResponse:
    return StoryTextResponse.model_validate(
        {
            "id": 10,
            "title_vi": "Chuyến đi nhỏ",
            "title_km": "ដំណើរតូច",
            "description_vi": "Hai người bạn cùng tìm đường về nhà.",
            "target_age": "preschool",
            "length_pref": "short",
            "status": status,
            "text_revision": revision,
            "character_ids": [1, 2],
            "updated_at": datetime.now(timezone.utc),
            "pages": [
                {
                    "id": 100 + index,
                    "page_no": index,
                    "text_vi": f"Hai bạn cùng đi qua khu vườn {index}.",
                    "text_km": f"មិត្ត ពីរ នាក់ ដើរ កាត់ សួន {index}។",
                    "spellcheck_flags": [],
                    "khmer_validated_at": datetime.now(timezone.utc),
                }
                for index in range(1, 5)
            ],
        }
    )


def mutation_response() -> MutationResponse:
    return MutationResponse(
        story=canonical_text(revision=4),
        changes=ChangeSummary(
            has_changes=True,
            title_changed=False,
            edited_page_ids=[101],
            added_page_ids=[],
            deleted_page_ids=[],
            order_changed=False,
            before_count=4,
            after_count=4,
        ),
    )


def install_overrides(session: AsyncSession | None = None) -> AsyncSession:
    session = session or AsyncMock(spec=AsyncSession)

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    async def override_admin() -> TokenUser:
        return ADMIN

    async def override_provider():
        return MagicMock()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_admin_user] = override_admin
    app.dependency_overrides[get_story_text_ai] = override_provider
    app.dependency_overrides[get_khmer_validator] = lambda: BaselineKhmerValidator()
    return session


@pytest.fixture(autouse=True)
def clean_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


AUTH_CASES = [
    ("POST", "/api/stories/10/generate-text", None),
    ("GET", "/api/stories/10/text", None),
    (
        "POST",
        "/api/stories/10/text/edits",
        {"kind": "quick_action", "action": "shorten", "expected_revision": 3},
    ),
    ("POST", "/api/stories/10/pages", {"expected_revision": 3}),
    (
        "PUT",
        "/api/stories/10/pages/order",
        {"page_ids": [101, 102, 103, 104], "expected_revision": 3},
    ),
    ("DELETE", "/api/stories/10/pages/101?expected_revision=3", None),
    ("POST", "/api/stories/10/validate-km", {"expected_revision": 3}),
    (
        "POST",
        "/api/stories/10/retranslate-km",
        {"target": "title", "expected_revision": 3},
    ),
    (
        "POST",
        "/api/stories/10/confirm-text",
        {"expected_revision": 3, "acknowledge_khmer_warnings": False},
    ),
]


@pytest.mark.parametrize(("method", "path", "payload"), AUTH_CASES)
def test_phase3_routes_require_authentication(method: str, path: str, payload: dict | None) -> None:
    with TestClient(app) as client:
        response = client.request(method, path, json=payload)

    assert response.status_code == 401


@pytest.mark.parametrize(("method", "path", "payload"), AUTH_CASES)
def test_phase3_routes_reject_reader_role(method: str, path: str, payload: dict | None) -> None:
    async def override_reader() -> TokenUser:
        return READER

    app.dependency_overrides[get_current_user] = override_reader
    with TestClient(app) as client:
        response = client.request(method, path, json=payload)

    assert response.status_code == 403


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        (
            "POST",
            "/api/stories/10/text/edits",
            {
                "kind": "quick_action",
                "action": "shorten",
                "expected_revision": 3,
                "instruction_vi": "field conflict",
            },
        ),
        ("POST", "/api/stories/10/pages", {"expected_revision": 3, "instruction_vi": "abc"}),
        (
            "PUT",
            "/api/stories/10/pages/order",
            {"page_ids": [101, 101], "expected_revision": 3},
        ),
        ("POST", "/api/stories/10/validate-km", {"expected_revision": 3, "extra": True}),
        (
            "POST",
            "/api/stories/10/retranslate-km",
            {"target": "page", "expected_revision": 3},
        ),
        (
            "POST",
            "/api/stories/10/retranslate-km",
            {"target": "title", "page_id": 101, "expected_revision": 3},
        ),
        (
            "POST",
            "/api/stories/10/confirm-text",
            {"expected_revision": None, "acknowledge_khmer_warnings": False},
        ),
    ],
)
def test_phase3_routes_reject_invalid_contracts(method: str, path: str, payload: dict) -> None:
    install_overrides()

    with TestClient(app) as client:
        response = client.request(method, path, json=payload)

    assert response.status_code == 422


def test_delete_requires_expected_revision_query() -> None:
    install_overrides()

    with TestClient(app) as client:
        response = client.delete("/api/stories/10/pages/101")

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("method", "path", "payload", "module", "function_name", "response_body", "status_code"),
    [
        (
            "POST",
            "/api/stories/10/generate-text",
            None,
            generation_service,
            "generate_story_text",
            canonical_text(revision=1),
            200,
        ),
        (
            "GET",
            "/api/stories/10/text",
            None,
            generation_service,
            "get_story_text",
            canonical_text(),
            200,
        ),
        (
            "POST",
            "/api/stories/10/text/edits",
            {"kind": "quick_action", "action": "shorten", "expected_revision": 3},
            editor_service,
            "edit_story",
            mutation_response(),
            200,
        ),
        (
            "POST",
            "/api/stories/10/pages",
            {"expected_revision": 3},
            editor_service,
            "add_page",
            mutation_response(),
            201,
        ),
        (
            "PUT",
            "/api/stories/10/pages/order",
            {"page_ids": [104, 103, 102, 101], "expected_revision": 3},
            editor_service,
            "reorder_pages",
            mutation_response(),
            200,
        ),
        (
            "DELETE",
            "/api/stories/10/pages/101?expected_revision=3",
            None,
            editor_service,
            "delete_page",
            mutation_response(),
            200,
        ),
        (
            "POST",
            "/api/stories/10/validate-km",
            {"expected_revision": 3},
            editor_service,
            "validate_khmer_snapshot",
            canonical_text(),
            200,
        ),
        (
            "POST",
            "/api/stories/10/retranslate-km",
            {"target": "page", "page_id": 101, "expected_revision": 3},
            editor_service,
            "retranslate_khmer",
            mutation_response(),
            200,
        ),
        (
            "POST",
            "/api/stories/10/confirm-text",
            {"expected_revision": 3, "acknowledge_khmer_warnings": False},
            editor_service,
            "confirm_text",
            canonical_text(status="text_confirmed"),
            200,
        ),
    ],
)
def test_phase3_routes_dispatch_valid_contracts(
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    payload: dict | None,
    module,
    function_name: str,
    response_body,
    status_code: int,
) -> None:
    install_overrides()
    mocked = AsyncMock(return_value=response_body)
    monkeypatch.setattr(module, function_name, mocked)

    with TestClient(app) as client:
        response = client.request(method, path, json=payload)

    assert response.status_code == status_code
    mocked.assert_awaited_once()


def test_validate_km_api_reruns_timestamped_pages_that_still_have_warnings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = install_overrides()
    now = datetime.now(timezone.utc)
    story = Story(
        id=10,
        title_vi="Chuyến đi nhỏ",
        title_km="ដំណើរតូច",
        description_vi="Hai người bạn cùng tìm đường về nhà.",
        target_age="preschool",
        length_pref="short",
        status="pending_review",
        text_revision=3,
    )
    page = StoryPage(
        id=101,
        story_id=10,
        page_no=1,
        text_vi="Hai bạn cùng đi qua khu vườn.",
        text_km="មិត្ត ពីរ នាក់ ដើរ កាត់ សួន។",
        spellcheck_flags=[{"code": "old-warning"}],
        khmer_validated_at=now,
    )

    def scalar(value):
        result = MagicMock()
        result.scalar_one_or_none.return_value = value
        return result

    def scalars(values):
        result = MagicMock()
        result.scalars.return_value.all.return_value = values
        return result

    session.execute.side_effect = [
        scalar(story),
        scalars([page]),
        scalars([]),
        scalar(story),
        scalars([page]),
    ]

    class RecordingValidator(BaselineKhmerValidator):
        def __init__(self) -> None:
            self.calls: list[str] = []

        def validate(self, text: str) -> list[dict]:
            self.calls.append(text)
            return []

    validator = RecordingValidator()
    app.dependency_overrides[get_khmer_validator] = lambda: validator
    monkeypatch.setattr(
        generation_service,
        "get_story_text",
        AsyncMock(return_value=canonical_text(status="pending_review")),
    )

    with TestClient(app) as client:
        response = client.post("/api/stories/10/validate-km", json={"expected_revision": 3})

    assert response.status_code == 200
    assert validator.calls == [page.text_km]
    session.commit.assert_awaited_once()
