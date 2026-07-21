"""Offline foundation tests for Phase 4 image generation."""

from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from katha.core.config import Settings
from katha.integrations.r2_storage import R2Client, R2ReferenceError


def _settings(**overrides: object) -> Settings:
    """Build Settings independent of a developer's local environment file."""
    values: dict[str, object] = {
        "OPENAI_TIMEOUT_SECONDS": 60,
        "TEXT_OPERATION_TIMEOUT_SECONDS": 270,
        "TEXT_GENERATION_STALE_SECONDS": 600,
        "OPENAI_IMAGE_MODEL": "gpt-image-2",
        "OPENAI_IMAGE_SIZE": "1536x864",
        "OPENAI_IMAGE_QUALITY": "high",
        "OPENAI_IMAGE_OUTPUT_FORMAT": "webp",
        "OPENAI_IMAGE_OUTPUT_COMPRESSION": 90,
        "OPENAI_IMAGE_TIMEOUT_SECONDS": 150,
        "OPENAI_IMAGE_MAX_RETRIES": 1,
        "IMAGE_PLAN_OPERATION_TIMEOUT_SECONDS": 180,
        "IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS": 330,
        "IMAGE_GENERATION_STALE_SECONDS": 900,
        "IMAGE_MAX_CONCURRENT_JOBS": 1,
        "IMAGE_MAX_OUTPUT_BYTES": 20 * 1024 * 1024,
        "R2_ENDPOINT_URL": "https://account.example.test",
        "R2_ACCESS_KEY_ID": "test-key",
        "R2_SECRET_ACCESS_KEY": "test-secret",
        "R2_PUBLIC_URL": "https://assets.example.test/katha",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"OPENAI_IMAGE_SIZE": "1535x864"}, "multiples of 16"),
        ({"OPENAI_IMAGE_SIZE": "512x512"}, "pixel count"),
        ({"OPENAI_IMAGE_OUTPUT_FORMAT": "png"}, "must be webp"),
        ({"OPENAI_IMAGE_MAX_RETRIES": 2}, "must be 0 or 1"),
        (
            {"IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS": 300},
            "complete OpenAI image retry budget",
        ),
        (
            {"IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS": 305.1},
            "minimum R2 transport budget",
        ),
        ({"IMAGE_GENERATION_STALE_SECONDS": 360}, "safety margin"),
        ({"IMAGE_MAX_CONCURRENT_JOBS": 0}, "at least 1"),
    ],
)
def test_image_settings_reject_unsafe_values(overrides: dict[str, object], message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        _settings(**overrides)


def test_model_registry_exposes_phase4_columns_and_constraints() -> None:
    """Phase 4 ORM fields remain visible to Alembic metadata imports."""
    import katha.db.model_registry  # noqa: F401
    from katha.db.base import Base

    stories = Base.metadata.tables["stories"]
    pages = Base.metadata.tables["story_pages"]

    assert {
        "image_plan_revision",
        "image_plan_locked_at",
        "image_generation_claim_id",
        "image_generation_heartbeat_at",
    } <= set(stories.columns.keys())
    assert {
        "image_scene_en",
        "image_character_ids",
        "image_status",
        "image_attempt_count",
        "image_error_code",
    } <= set(pages.columns.keys())

    story_checks = {constraint.name for constraint in stories.constraints}
    page_checks = {constraint.name for constraint in pages.constraints}
    assert {
        "stories_image_plan_revision_check",
        "stories_image_generation_claim_heartbeat_check",
        "stories_image_generation_claim_status_check",
    } <= story_checks
    assert {
        "story_pages_image_status_check",
        "story_pages_image_attempt_count_check",
        "story_pages_image_character_ids_check",
        "story_pages_completed_image_url_check",
    } <= page_checks


@pytest.mark.integration
@pytest.mark.asyncio
async def test_migration_005_exposes_phase4_schema(session) -> None:
    """The real PostgreSQL schema has every durable Phase 4 column."""
    result = await session.execute(
        text(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' "
            "AND table_name IN ('stories', 'story_pages') "
            "AND column_name LIKE 'image_%'"
        )
    )
    columns = {(row.table_name, row.column_name) for row in result}

    assert {
        ("stories", "image_plan_revision"),
        ("stories", "image_plan_locked_at"),
        ("stories", "image_generation_claim_id"),
        ("stories", "image_generation_heartbeat_at"),
        ("story_pages", "image_scene_en"),
        ("story_pages", "image_character_ids"),
        ("story_pages", "image_status"),
        ("story_pages", "image_attempt_count"),
        ("story_pages", "image_error_code"),
    } <= columns


@pytest.mark.integration
@pytest.mark.asyncio
async def test_migration_005_enforces_completed_page_url_check(session) -> None:
    """A real PostgreSQL row cannot be completed without a durable image URL."""

    marker = "phase4 completed url constraint"
    story_id = (
        await session.execute(
            text(
                "INSERT INTO stories (description_vi, target_age, length_pref, status) "
                "VALUES (:description, 'preschool', 'short', 'text_confirmed') RETURNING id"
            ),
            {"description": marker},
        )
    ).scalar_one()
    page_id = (
        await session.execute(
            text(
                "INSERT INTO story_pages (story_id, page_no, text_vi) "
                "VALUES (:story_id, 1, 'Trang kiem tra.') RETURNING id"
            ),
            {"story_id": story_id},
        )
    ).scalar_one()
    await session.commit()

    try:
        with pytest.raises(IntegrityError) as exc_info:
            await session.execute(
                text(
                    "UPDATE story_pages SET image_status = 'completed', image_url = NULL "
                    "WHERE id = :page_id"
                ),
                {"page_id": page_id},
            )
        assert "story_pages_completed_image_url_check" in str(exc_info.value.orig)
    finally:
        await session.rollback()
        await session.execute(
            text("DELETE FROM stories WHERE id = :story_id"), {"story_id": story_id}
        )
        await session.commit()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_migration_005_rejects_claim_when_story_status_is_null(session) -> None:
    """COALESCE in the real claim/status CHECK must reject SQL NULL status."""

    try:
        with pytest.raises(IntegrityError) as exc_info:
            await session.execute(
                text(
                    "INSERT INTO stories "
                    "(description_vi, target_age, length_pref, status, "
                    "image_generation_claim_id, image_generation_heartbeat_at) "
                    "VALUES ('phase4 null status claim', 'preschool', 'short', NULL, "
                    ":claim_id, clock_timestamp())"
                ),
                {"claim_id": "00000000-0000-0000-0000-000000000401"},
            )
        assert "stories_image_generation_claim_status_check" in str(exc_info.value.orig)
    finally:
        await session.rollback()


class _Body:
    def __init__(self, data: bytes) -> None:
        self._data = data
        self.read_size: int | None = None
        self.closed = False

    def read(self, size: int = -1) -> bytes:
        self.read_size = size
        return self._data

    def close(self) -> None:
        self.closed = True


@pytest.fixture
def r2_client() -> tuple[R2Client, Mock]:
    with patch("katha.integrations.r2_storage.boto3.client") as create_client:
        low_level_client = Mock()
        create_client.return_value = low_level_client
        yield R2Client(_settings()), low_level_client


@pytest.mark.parametrize(
    ("page_timeout", "openai_timeout", "max_retries"),
    [(330, 150, 1), (156, 150, 0)],
)
def test_r2_transport_timeouts_and_retry_budget_fit_the_page_policy(
    monkeypatch: pytest.MonkeyPatch,
    page_timeout: float,
    openai_timeout: float,
    max_retries: int,
) -> None:
    create_client = Mock(return_value=Mock())
    monkeypatch.setattr("katha.integrations.r2_storage.boto3.client", create_client)
    settings = _settings(
        IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS=page_timeout,
        OPENAI_IMAGE_TIMEOUT_SECONDS=openai_timeout,
        OPENAI_IMAGE_MAX_RETRIES=max_retries,
    )

    R2Client(settings)

    config = create_client.call_args.kwargs["config"]
    provider_retry_budget = openai_timeout * (max_retries + 1)
    remaining_page_budget = page_timeout - provider_retry_budget
    transport_budget = settings.image_r2_transport_budget_seconds
    assert config.retries == {"mode": "standard", "total_max_attempts": 1}
    assert config.connect_timeout > 0
    assert config.read_timeout > 0
    # The runner owns two immutable-key upload attempts; botocore has no hidden retry.
    total_upload_transport = 2 * (config.connect_timeout + config.read_timeout)
    assert total_upload_transport <= transport_budget
    assert total_upload_transport <= remaining_page_budget
    assert provider_retry_budget + total_upload_transport < page_timeout


def test_upload_image_sets_immutable_webp_headers(r2_client: tuple[R2Client, Mock]) -> None:
    client, low_level_client = r2_client
    key = "stories/12/pages/71/claim-1-1.webp"

    url = client.upload_image(key, b"webp-bytes")

    assert url == "https://assets.example.test/katha/stories/12/pages/71/claim-1-1.webp"
    kwargs = low_level_client.put_object.call_args.kwargs
    assert kwargs == {
        "Bucket": "katha-assets",
        "Key": key,
        "Body": b"webp-bytes",
        "ContentType": "image/webp",
        "CacheControl": "public, max-age=31536000, immutable",
    }


def test_public_reference_download_stays_in_r2_namespace(r2_client: tuple[R2Client, Mock]) -> None:
    client, low_level_client = r2_client
    body = _Body(b"png")
    low_level_client.get_object.return_value = {
        "ContentType": "image/png; charset=binary",
        "ContentLength": 3,
        "Body": body,
    }

    assert client.key_from_public_url("https://assets.example.test/katha/characters/1.png") == (
        "characters/1.png"
    )
    assert client.key_from_public_url("https://other.example.test/katha/characters/1.png") is None
    assert (
        client.key_from_public_url("https://assets.example.test/katha/%2E%2E/private.png") is None
    )
    assert (
        client.download_public_reference(
            "https://assets.example.test/katha/characters/1.png", max_bytes=10
        )
        == b"png"
    )
    low_level_client.get_object.assert_called_once_with(
        Bucket="katha-assets", Key="characters/1.png"
    )
    assert body.read_size == 11
    assert body.closed is True


def test_public_reference_rejects_invalid_type_and_oversize(
    r2_client: tuple[R2Client, Mock],
) -> None:
    client, low_level_client = r2_client
    invalid_type_body = _Body(b"svg")
    low_level_client.get_object.return_value = {
        "ContentType": "image/svg+xml",
        "ContentLength": 3,
        "Body": invalid_type_body,
    }

    with pytest.raises(R2ReferenceError, match="unsupported content type"):
        client.download_public_reference("https://assets.example.test/katha/characters/1.svg", 10)
    assert invalid_type_body.closed is True

    oversized_body = _Body(b"01234567890")
    low_level_client.get_object.return_value = {
        "ContentType": "image/webp",
        "ContentLength": 11,
        "Body": oversized_body,
    }
    with pytest.raises(R2ReferenceError, match="exceeds the byte limit"):
        client.download_public_reference("https://assets.example.test/katha/characters/1.webp", 10)
    assert oversized_body.closed is True
