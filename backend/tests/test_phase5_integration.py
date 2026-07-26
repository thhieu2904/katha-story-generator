"""PostgreSQL integration coverage for Phase 5 review and publishing invariants."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from fastapi import BackgroundTasks, HTTPException
from PIL import Image
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from katha.core.config import get_settings
from katha.features.public_stories import service as public_service
from katha.features.story_editor import service as editor_service
from katha.features.story_editor.schemas import ValidateKhmerRequest
from katha.features.story_review import router as review_router
from katha.features.story_review import runner, service
from katha.features.story_review.schemas import (
    ApprovePageRequest,
    ArchiveStoryRequest,
    CompleteReviewRequest,
    CreateShareLinkRequest,
    EditKhmerPageRequest,
    PublishStoryRequest,
    RegenerateImageRequest,
    RejectPageRequest,
    RevokeShareRequest,
)
from katha.integrations.khmer.baseline import BaselineKhmerValidator

pytestmark = pytest.mark.integration
ADMIN_ID = UUID("00000000-0000-0000-0000-000000000501")
DESCRIPTION_PREFIX = "phase5-integration-"
OLD_URL = "https://assets.example.test/stories/phase5-old.webp"
NEW_URL = "https://assets.example.test/stories/phase5-new.webp"


class EmptyMappingStorage:
    def key_from_public_url(self, url: str) -> str | None:
        return (
            url.removeprefix("https://assets.example.test/")
            if url.startswith("https://assets.example.test/")
            else None
        )


def _valid_webp() -> bytes:
    width, height = (int(part) for part in get_settings().OPENAI_IMAGE_SIZE.split("x"))
    buffer = BytesIO()
    Image.new("RGB", (width, height), color=(39, 94, 173)).save(buffer, format="WEBP")
    return buffer.getvalue()


class RecordingStorage(EmptyMappingStorage):
    def __init__(self) -> None:
        self.uploads: list[tuple[str, bytes]] = []
        self.deleted_keys: list[str] = []

    def download_public_reference(self, url: str, max_bytes: int) -> bytes:
        raise AssertionError(f"Unexpected reference download: {url}")

    def upload_image(self, key: str, data: bytes) -> str:
        self.uploads.append((key, data))
        return f"https://assets.example.test/{key}"

    def delete_object(self, key: str) -> None:
        self.deleted_keys.append(key)


class ValidWebpProvider:
    def __init__(self) -> None:
        self.calls = 0

    async def generate_image(self, prompt: str, reference_images: tuple[bytes, ...]) -> bytes:
        self.calls += 1
        return _valid_webp()


@pytest_asyncio.fixture
async def phase5_session(
    postgres_url: str, run_migrations: None
) -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(postgres_url)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        await session.execute(
            text("INSERT INTO auth.users (id) VALUES (:id) ON CONFLICT (id) DO NOTHING"),
            {"id": ADMIN_ID},
        )
        await session.execute(
            text("DELETE FROM stories WHERE description_vi LIKE :prefix"),
            {"prefix": f"{DESCRIPTION_PREFIX}%"},
        )
        await session.commit()
        yield session
        await session.rollback()
        await session.execute(
            text("DELETE FROM stories WHERE description_vi LIKE :prefix"),
            {"prefix": f"{DESCRIPTION_PREFIX}%"},
        )
        await session.commit()
    await engine.dispose()


async def _seed_story(
    session: AsyncSession,
    *,
    status: str,
    page_review_statuses: tuple[str, ...] = ("pending", "pending"),
    share_revision: int = 0,
    share_token: str | None = None,
    active_claim: UUID | None = None,
    active_page_index: int | None = None,
) -> tuple[int, list[int]]:
    now = datetime.now(timezone.utc)
    story_id = (
        await session.execute(
            text(
                """
                INSERT INTO stories (
                    title_vi, title_km, description_vi, target_age, length_pref,
                    status, text_revision, image_plan_revision, image_plan_locked_at,
                    image_generation_claim_id, image_generation_heartbeat_at,
                    published_at,
                    public_share_token, public_share_revision,
                    public_share_activated_at, public_share_revoked_at, created_by
                ) VALUES (
                    'Truyện Phase 5', 'រឿងដំណាក់កាលប្រាំ', :description,
                    'preschool', 'short', :status, 3, 1, :locked_at,
                    :claim_id, :heartbeat_at, :published_at, :share_token, :share_revision,
                    :share_activated_at, NULL, :created_by
                ) RETURNING id
                """
            ),
            {
                "description": f"{DESCRIPTION_PREFIX}{uuid4()}",
                "status": status,
                "locked_at": now,
                "claim_id": active_claim,
                "heartbeat_at": now if active_claim else None,
                "published_at": now if status == "published" else None,
                "share_token": share_token,
                "share_revision": share_revision,
                "share_activated_at": now if share_token else None,
                "created_by": ADMIN_ID,
            },
        )
    ).scalar_one()
    page_ids: list[int] = []
    for page_no, review_status in enumerate(page_review_statuses, start=1):
        page_id = (
            await session.execute(
                text(
                    """
                    INSERT INTO story_pages (
                        story_id, page_no, text_vi, text_km, text_en,
                        spellcheck_flags, khmer_validated_at,
                        image_scene_en, image_prompt_en, image_character_ids,
                        image_status, image_url, image_attempt_count,
                        review_status, review_notes, reviewed_by, reviewed_at
                    ) VALUES (
                        :story_id, :page_no, :text_vi, :text_km, :text_en,
                        '[]'::jsonb, clock_timestamp(),
                        'A safe storybook scene', 'A safe storybook scene', '{}'::integer[],
                        :image_status, :image_url, 1,
                        :review_status, :review_notes, :reviewed_by, :reviewed_at
                    ) RETURNING id
                    """
                ),
                {
                    "story_id": story_id,
                    "page_no": page_no,
                    "text_vi": f"Nội dung trang {page_no}.",
                    "text_km": f"ទំព័រ {page_no}។",
                    "text_en": f"Page {page_no}.",
                    "image_status": "generating"
                    if active_claim and active_page_index == page_no - 1
                    else "completed",
                    "image_url": OLD_URL,
                    "review_status": review_status,
                    "review_notes": "Đổi bố cục ảnh" if review_status == "rejected" else None,
                    "reviewed_by": ADMIN_ID if review_status != "pending" else None,
                    "reviewed_at": now if review_status != "pending" else None,
                },
            )
        ).scalar_one()
        page_ids.append(page_id)
    if active_page_index is not None:
        await session.execute(
            text(
                "UPDATE stories SET active_image_regeneration_page_id=:page_id WHERE id=:story_id"
            ),
            {"page_id": page_ids[active_page_index], "story_id": story_id},
        )
    await session.commit()
    return story_id, page_ids


def _factory(session: AsyncSession) -> async_sessionmaker[AsyncSession]:
    assert session.bind is not None
    return async_sessionmaker(session.bind, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_review_mutations_persist_real_page_decisions(phase5_session: AsyncSession) -> None:
    story_id, page_ids = await _seed_story(phase5_session, status="pending_review")
    approved = await service.review_page(
        phase5_session,
        story_id,
        page_ids[0],
        ApprovePageRequest(
            decision="approve",
            expected_text_revision=3,
            expected_review_status="pending",
            expected_image_attempt_count=1,
            expected_image_url=OLD_URL,
        ),
        ADMIN_ID,
    )
    rejected = await service.review_page(
        phase5_session,
        story_id,
        page_ids[1],
        RejectPageRequest(
            decision="reject",
            reason="Cần đổi góc nhìn của nhân vật",
            expected_text_revision=3,
            expected_review_status="pending",
            expected_image_attempt_count=1,
            expected_image_url=OLD_URL,
        ),
        ADMIN_ID,
    )
    assert approved.pages[0].review_status == "approved"
    assert rejected.progress.approved == 1
    assert rejected.progress.rejected == 1


@pytest.mark.asyncio
async def test_publish_race_converges_on_one_share_token(phase5_session: AsyncSession) -> None:
    story_id, _ = await _seed_story(
        phase5_session, status="approved", page_review_statuses=("approved", "approved")
    )
    factory = _factory(phase5_session)
    request = PublishStoryRequest(expected_text_revision=3, expected_share_revision=0)
    async with factory() as first, factory() as second:
        first_state, second_state = await asyncio.gather(
            service.publish_story(first, story_id, request, ADMIN_ID),
            service.publish_story(second, story_id, request, ADMIN_ID),
        )
    assert first_state.story.status == second_state.story.status == "published"
    assert first_state.share.token == second_state.share.token
    assert first_state.share.revision == second_state.share.revision == 1


@pytest.mark.asyncio
async def test_share_revoke_and_rotation_are_revision_fenced(
    phase5_session: AsyncSession,
) -> None:
    story_id, _ = await _seed_story(
        phase5_session, status="approved", page_review_statuses=("approved", "approved")
    )
    published = await service.publish_story(
        phase5_session,
        story_id,
        PublishStoryRequest(expected_text_revision=3, expected_share_revision=0),
        ADMIN_ID,
    )
    first_token = published.share.token
    revoked = await service.revoke_share(
        phase5_session, story_id, RevokeShareRequest(expected_share_revision=1), ADMIN_ID
    )
    rotated = await service.create_share_link(
        phase5_session, story_id, CreateShareLinkRequest(expected_share_revision=2), ADMIN_ID
    )
    assert revoked.share.active is False
    assert rotated.share.active is True
    assert rotated.share.revision == 3
    assert rotated.share.token != first_token


@pytest.mark.asyncio
async def test_share_lifecycle_ack_loss_retries_from_fresh_sessions(
    phase5_session: AsyncSession,
) -> None:
    story_id, _ = await _seed_story(
        phase5_session, status="approved", page_review_statuses=("approved", "approved")
    )
    factory = _factory(phase5_session)
    publish_request = PublishStoryRequest(expected_text_revision=3, expected_share_revision=0)
    async with factory() as first_request:
        published = await service.publish_story(first_request, story_id, publish_request, ADMIN_ID)
    # Model a committed request whose response ACK never reached the client:
    # retry must resolve from a separate request/session, not its identity map.
    async with factory() as retry_request:
        publish_retry = await service.publish_story(
            retry_request, story_id, publish_request, ADMIN_ID
        )
    assert publish_retry.share.token == published.share.token
    assert publish_retry.share.revision == 1

    revoke_request = RevokeShareRequest(expected_share_revision=1)
    async with factory() as first_request:
        revoked = await service.revoke_share(first_request, story_id, revoke_request, ADMIN_ID)
    async with factory() as retry_request:
        revoke_retry = await service.revoke_share(retry_request, story_id, revoke_request, ADMIN_ID)
    assert revoked.share.active is revoke_retry.share.active is False
    assert revoke_retry.share.revision == 2

    share_request = CreateShareLinkRequest(expected_share_revision=2)
    async with factory() as first_request:
        reshared = await service.create_share_link(first_request, story_id, share_request, ADMIN_ID)
    async with factory() as retry_request:
        reshare_retry = await service.create_share_link(
            retry_request, story_id, share_request, ADMIN_ID
        )
    assert reshare_retry.share.token == reshared.share.token
    assert reshare_retry.share.revision == 3

    archive_request = ArchiveStoryRequest(expected_status="published", expected_share_revision=3)
    async with factory() as first_request:
        archived = await service.archive_story_extended(
            first_request, story_id, archive_request, ADMIN_ID
        )
    async with factory() as retry_request:
        archive_retry = await service.archive_story_extended(
            retry_request, story_id, archive_request, ADMIN_ID
        )
    assert archived.status == archive_retry.status == "archived"


@pytest.mark.asyncio
async def test_publish_token_collision_retries_and_exhaustion_is_atomic(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    collision_token = "C" * 43
    unique_token = "U" * 43
    await _seed_story(
        phase5_session,
        status="published",
        page_review_statuses=("approved",),
        share_revision=1,
        share_token=collision_token,
    )
    retry_story_id, _ = await _seed_story(
        phase5_session, status="approved", page_review_statuses=("approved",)
    )
    tokens = iter((collision_token, unique_token))
    monkeypatch.setattr(service.secrets, "token_urlsafe", lambda _size: next(tokens))
    published = await service.publish_story(
        phase5_session,
        retry_story_id,
        PublishStoryRequest(expected_text_revision=3, expected_share_revision=0),
        ADMIN_ID,
    )
    assert published.share.token == unique_token
    assert published.share.revision == 1

    exhausted_story_id, _ = await _seed_story(
        phase5_session, status="approved", page_review_statuses=("approved",)
    )
    monkeypatch.setattr(
        service.secrets,
        "token_urlsafe",
        lambda _size: collision_token,
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.publish_story(
            phase5_session,
            exhausted_story_id,
            PublishStoryRequest(expected_text_revision=3, expected_share_revision=0),
            ADMIN_ID,
        )
    assert exc_info.value.status_code == 500
    await phase5_session.rollback()
    row = (
        await phase5_session.execute(
            text(
                "SELECT status, public_share_token, public_share_revision, published_at "
                "FROM stories WHERE id=:story_id"
            ),
            {"story_id": exhausted_story_id},
        )
    ).one()
    assert tuple(row) == ("approved", None, 0, None)


@pytest.mark.asyncio
async def test_reshare_token_collision_retries_and_exhaustion_is_atomic_in_fresh_session(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    collision_token = "R" * 43
    unique_token = "S" * 43
    await _seed_story(
        phase5_session,
        status="published",
        page_review_statuses=("approved",),
        share_revision=1,
        share_token=collision_token,
    )
    retry_story_id, _ = await _seed_story(
        phase5_session,
        status="published",
        page_review_statuses=("approved",),
        share_revision=2,
    )
    # Use a stable iterator rather than an ORM attribute after the first nested
    # rollback; PostgreSQL must exercise the real unique-token collision here.
    tokens = iter((collision_token, unique_token))
    monkeypatch.setattr(service.secrets, "token_urlsafe", lambda _size: next(tokens))
    reshared = await service.create_share_link(
        phase5_session,
        retry_story_id,
        CreateShareLinkRequest(expected_share_revision=2),
        ADMIN_ID,
    )
    assert reshared.share.token == unique_token
    assert reshared.share.revision == 3

    factory = _factory(phase5_session)
    async with factory() as fresh_session:
        row = (
            await fresh_session.execute(
                text(
                    "SELECT public_share_token, public_share_revision FROM stories "
                    "WHERE id=:story_id"
                ),
                {"story_id": retry_story_id},
            )
        ).one()
    assert tuple(row) == (unique_token, 3)

    exhausted_story_id, _ = await _seed_story(
        phase5_session,
        status="published",
        page_review_statuses=("approved",),
        share_revision=4,
    )
    monkeypatch.setattr(service.secrets, "token_urlsafe", lambda _size: collision_token)
    with pytest.raises(HTTPException) as exc_info:
        await service.create_share_link(
            phase5_session,
            exhausted_story_id,
            CreateShareLinkRequest(expected_share_revision=4),
            ADMIN_ID,
        )
    assert exc_info.value.status_code == 500
    await phase5_session.rollback()
    async with factory() as fresh_session:
        row = (
            await fresh_session.execute(
                text(
                    "SELECT status, public_share_token, public_share_revision FROM stories "
                    "WHERE id=:story_id"
                ),
                {"story_id": exhausted_story_id},
            )
        ).one()
    assert tuple(row) == ("published", None, 4)


@pytest.mark.asyncio
async def test_regeneration_claim_returns_canonical_state_and_can_be_reset(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(service, "async_session_factory", _factory(phase5_session))
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("rejected",)
    )
    await phase5_session.execute(
        text(
            "UPDATE story_pages SET image_status='failed', "
            "image_error_code='PROVIDER_UNAVAILABLE' WHERE id=:page_id"
        ),
        {"page_id": page_ids[0]},
    )
    await phase5_session.commit()
    result = await service.start_regeneration(
        phase5_session,
        story_id,
        page_ids[0],
        RegenerateImageRequest(
            expected_text_revision=3,
            expected_review_status="rejected",
            expected_image_attempt_count=1,
            expected_image_url=OLD_URL,
        ),
        ADMIN_ID,
        EmptyMappingStorage(),
    )
    assert result.response.review.story.status == "generating_images"
    assert result.response.review.job.active_page_id == page_ids[0]
    claimed_page = result.response.review.pages[0]
    assert claimed_page.image_status == "pending"
    assert claimed_page.image_error_code is None
    assert claimed_page.image_url == OLD_URL
    assert claimed_page.review_status == "rejected"
    assert claimed_page.review_notes == "Đổi bố cục ảnh"
    assert await service.reset_regeneration_after_schedule_failure(
        story_id, result.claim_id, page_ids[0]
    )
    state = await service.get_review_state(phase5_session, story_id)
    assert state.story.status == "pending_review"
    assert state.job.active_page_id is None
    reset_page = state.pages[0]
    assert reset_page.image_status == "failed"
    assert reset_page.image_error_code == "SCHEDULE_FAILED"
    assert reset_page.image_url == OLD_URL
    assert reset_page.review_status == "rejected"
    assert reset_page.review_notes == "Đổi bố cục ảnh"
    assert reset_page.can_regenerate is True

    retry = await service.start_regeneration(
        phase5_session,
        story_id,
        page_ids[0],
        RegenerateImageRequest(
            expected_text_revision=3,
            expected_review_status="rejected",
            expected_image_attempt_count=1,
            expected_image_url=OLD_URL,
        ),
        ADMIN_ID,
        EmptyMappingStorage(),
    )
    assert retry.claim_id != result.claim_id
    assert retry.response.review.pages[0].image_status == "pending"
    assert retry.response.review.pages[0].image_error_code is None


@pytest.mark.asyncio
async def test_durable_regeneration_claim_after_lost_commit_ack_is_scheduled_once(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("rejected",)
    )
    factory = _factory(phase5_session)
    monkeypatch.setattr(service, "async_session_factory", factory)

    class AckLossSession(AsyncSession):
        async def commit(self) -> None:
            await super().commit()
            raise ConnectionError("commit acknowledgement lost")

    assert phase5_session.bind is not None
    ack_loss_factory = async_sessionmaker(
        phase5_session.bind,
        class_=AckLossSession,
        expire_on_commit=False,
    )
    tasks = BackgroundTasks()
    async with ack_loss_factory() as request_session:
        response = await review_router.regenerate_page_image(
            story_id,
            page_ids[0],
            RegenerateImageRequest(
                expected_text_revision=3,
                expected_review_status="rejected",
                expected_image_attempt_count=1,
                expected_image_url=OLD_URL,
            ),
            tasks,
            request_session,
            type("Admin", (), {"id": ADMIN_ID})(),
            ValidWebpProvider(),
            EmptyMappingStorage(),
        )

    assert response.already_running is False
    assert response.review.story.status == "generating_images"
    assert response.review.pages[0].image_status == "pending"
    assert len(tasks.tasks) == 1
    scheduled_claim = tasks.tasks[0].args[1]
    assert isinstance(scheduled_claim, UUID)
    async with factory() as fresh_session:
        row = (
            await fresh_session.execute(
                text(
                    "SELECT status, image_generation_claim_id, "
                    "active_image_regeneration_page_id FROM stories WHERE id=:story_id"
                ),
                {"story_id": story_id},
            )
        ).one()
        page_row = (
            await fresh_session.execute(
                text("SELECT image_status FROM story_pages WHERE id=:page_id"),
                {"page_id": page_ids[0]},
            )
        ).one()
    assert tuple(row) == ("generating_images", scheduled_claim, page_ids[0])
    assert tuple(page_row) == ("pending",)


@pytest.mark.asyncio
async def test_durable_claim_reconcile_read_failure_fenced_resets_and_schedules_nothing(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("rejected",)
    )
    factory = _factory(phase5_session)
    monkeypatch.setattr(service, "async_session_factory", factory)

    class AckLossSession(AsyncSession):
        async def commit(self) -> None:
            await super().commit()
            raise ConnectionError("commit acknowledgement lost")

    async def fail_reconcile(*_args: object) -> None:
        raise RuntimeError("fresh canonical read unavailable")

    monkeypatch.setattr(service, "_reconcile_durable_regeneration_claim", fail_reconcile)
    assert phase5_session.bind is not None
    ack_loss_factory = async_sessionmaker(
        phase5_session.bind,
        class_=AckLossSession,
        expire_on_commit=False,
    )
    tasks = BackgroundTasks()
    async with ack_loss_factory() as request_session:
        with pytest.raises(RuntimeError, match="fresh canonical read unavailable"):
            await review_router.regenerate_page_image(
                story_id,
                page_ids[0],
                RegenerateImageRequest(
                    expected_text_revision=3,
                    expected_review_status="rejected",
                    expected_image_attempt_count=1,
                    expected_image_url=OLD_URL,
                ),
                tasks,
                request_session,
                type("Admin", (), {"id": ADMIN_ID})(),
                ValidWebpProvider(),
                EmptyMappingStorage(),
            )

    assert tasks.tasks == []
    async with factory() as fresh_session:
        row = (
            await fresh_session.execute(
                text(
                    "SELECT stories.status, story_pages.image_status, "
                    "story_pages.image_error_code, story_pages.image_url, "
                    "story_pages.review_status, story_pages.review_notes "
                    "FROM stories JOIN story_pages ON story_pages.story_id=stories.id "
                    "WHERE stories.id=:story_id"
                ),
                {"story_id": story_id},
            )
        ).one()
    assert tuple(row) == (
        "pending_review",
        "failed",
        "SCHEDULE_FAILED",
        OLD_URL,
        "rejected",
        "Đổi bố cục ảnh",
    )


@pytest.mark.asyncio
async def test_router_schedule_failure_fresh_reset_is_retryable_and_reclaims_capability(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("rejected",)
    )
    factory = _factory(phase5_session)
    monkeypatch.setattr(service, "async_session_factory", factory)

    class FailingBackgroundTasks:
        def add_task(self, *_args: object, **_kwargs: object) -> None:
            raise RuntimeError("scheduler unavailable")

    async with factory() as request_session:
        with pytest.raises(HTTPException) as exc_info:
            await review_router.regenerate_page_image(
                story_id,
                page_ids[0],
                RegenerateImageRequest(
                    expected_text_revision=3,
                    expected_review_status="rejected",
                    expected_image_attempt_count=1,
                    expected_image_url=OLD_URL,
                ),
                FailingBackgroundTasks(),  # type: ignore[arg-type]
                request_session,
                type("Admin", (), {"id": ADMIN_ID})(),
                ValidWebpProvider(),
                EmptyMappingStorage(),
            )
    assert exc_info.value.status_code == 503

    async with factory() as check_session:
        state = await service.get_review_state(check_session, story_id)
        assert state.story.status == "pending_review"
        assert state.job.active_page_id is None
        assert state.pages[0].image_status == "failed"
        assert state.pages[0].image_error_code == "SCHEDULE_FAILED"
        assert state.pages[0].can_regenerate is True
        await check_session.rollback()

    async with factory() as retry_session:
        retry = await service.start_regeneration(
            retry_session,
            story_id,
            page_ids[0],
            RegenerateImageRequest(
                expected_text_revision=3,
                expected_review_status="rejected",
                expected_image_attempt_count=1,
                expected_image_url=OLD_URL,
            ),
            ADMIN_ID,
            EmptyMappingStorage(),
        )
    assert retry.response.already_running is False
    assert retry.response.review.pages[0].image_status == "pending"


@pytest.mark.asyncio
async def test_old_runner_is_fenced_and_current_runner_swaps_url_atomically(
    phase5_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    old_claim, current_claim = uuid4(), uuid4()
    story_id, page_ids = await _seed_story(
        phase5_session,
        status="generating_images",
        page_review_statuses=("rejected",),
        active_claim=old_claim,
        active_page_index=0,
    )
    factory = _factory(phase5_session)
    monkeypatch.setattr(runner, "async_session_factory", factory)
    await phase5_session.execute(
        text(
            "UPDATE stories SET image_generation_claim_id=:claim, "
            "image_generation_heartbeat_at=clock_timestamp() WHERE id=:story_id"
        ),
        {"claim": current_claim, "story_id": story_id},
    )
    await phase5_session.commit()
    with pytest.raises(runner.ClaimLost):
        await runner._commit_success(story_id, old_claim, page_ids[0], NEW_URL)
    await runner._commit_success(story_id, current_claim, page_ids[0], NEW_URL)
    row = (
        await phase5_session.execute(
            text(
                "SELECT stories.status, story_pages.image_url, story_pages.review_status, "
                "stories.image_generation_claim_id FROM stories "
                "JOIN story_pages ON story_pages.story_id=stories.id "
                "WHERE stories.id=:story_id"
            ),
            {"story_id": story_id},
        )
    ).one()
    assert tuple(row) == ("pending_review", NEW_URL, "pending", None)


@pytest.mark.asyncio
async def test_schedule_reset_cannot_clear_a_reclaimed_claim(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(service, "async_session_factory", _factory(phase5_session))
    old_claim, current_claim = uuid4(), uuid4()
    story_id, page_ids = await _seed_story(
        phase5_session,
        status="generating_images",
        page_review_statuses=("rejected",),
        active_claim=current_claim,
        active_page_index=0,
    )
    assert not await service.reset_regeneration_after_schedule_failure(
        story_id, old_claim, page_ids[0]
    )
    row = (
        await phase5_session.execute(
            text("SELECT status, image_generation_claim_id FROM stories WHERE id=:story_id"),
            {"story_id": story_id},
        )
    ).one()
    assert tuple(row) == ("generating_images", current_claim)


@pytest.mark.asyncio
@pytest.mark.parametrize("stale_page_status", ["pending", "generating"])
async def test_stale_pending_or_generating_target_reclaims_before_image_usability_check(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    stale_page_status: str,
) -> None:
    old_claim = uuid4()
    story_id, page_ids = await _seed_story(
        phase5_session,
        status="generating_images",
        page_review_statuses=("rejected",),
        active_claim=old_claim,
        active_page_index=0,
    )
    await phase5_session.execute(
        text(
            "UPDATE stories SET image_generation_heartbeat_at='2000-01-01T00:00:00Z' "
            "WHERE id=:story_id"
        ),
        {"story_id": story_id},
    )
    await phase5_session.execute(
        text("UPDATE story_pages SET image_status=:status WHERE id=:page_id"),
        {"status": stale_page_status, "page_id": page_ids[0]},
    )
    await phase5_session.commit()

    reclaimed = await service.start_regeneration(
        phase5_session,
        story_id,
        page_ids[0],
        RegenerateImageRequest(
            expected_text_revision=3,
            expected_review_status="rejected",
            expected_image_attempt_count=1,
            expected_image_url=OLD_URL,
        ),
        ADMIN_ID,
        EmptyMappingStorage(),
    )
    assert reclaimed.claim_id != old_claim
    assert reclaimed.response.review.pages[0].image_status == "pending"
    assert reclaimed.response.review.pages[0].image_error_code is None

    factory = _factory(phase5_session)
    monkeypatch.setattr(runner, "async_session_factory", factory)
    with pytest.raises(runner.ClaimLost):
        await runner._commit_success(story_id, old_claim, page_ids[0], NEW_URL)
    state = await service.get_review_state(phase5_session, story_id)
    assert state.job.is_running is True
    assert state.job.active_page_id == page_ids[0]


@pytest.mark.asyncio
async def test_two_session_approve_reject_race_has_one_winner(
    phase5_session: AsyncSession,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("pending",)
    )
    factory = _factory(phase5_session)
    approve = ApprovePageRequest(
        decision="approve",
        expected_text_revision=3,
        expected_review_status="pending",
        expected_image_attempt_count=1,
        expected_image_url=OLD_URL,
    )
    reject = RejectPageRequest(
        decision="reject",
        reason="Cần thay đổi bố cục trang",
        expected_text_revision=3,
        expected_review_status="pending",
        expected_image_attempt_count=1,
        expected_image_url=OLD_URL,
    )
    async with factory() as first, factory() as second:
        outcomes = await asyncio.gather(
            service.review_page(first, story_id, page_ids[0], approve, ADMIN_ID),
            service.review_page(second, story_id, page_ids[0], reject, ADMIN_ID),
            return_exceptions=True,
        )
    assert sum(not isinstance(outcome, Exception) for outcome in outcomes) == 1
    conflicts = [outcome for outcome in outcomes if isinstance(outcome, HTTPException)]
    assert len(conflicts) == 1
    assert conflicts[0].status_code == 409


@pytest.mark.asyncio
async def test_khmer_edit_complete_review_race_preserves_a_consistent_story(
    phase5_session: AsyncSession,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("approved",)
    )
    factory = _factory(phase5_session)
    async with factory() as first, factory() as second:
        outcomes = await asyncio.gather(
            service.edit_khmer_page(
                first,
                story_id,
                page_ids[0],
                EditKhmerPageRequest(
                    text_km="មិត្តភក្តិដើរកាត់សួនដោយរីករាយ។",
                    expected_text_revision=3,
                ),
                ADMIN_ID,
            ),
            service.complete_review(
                second,
                story_id,
                CompleteReviewRequest(expected_text_revision=3),
                ADMIN_ID,
            ),
            return_exceptions=True,
        )
    assert sum(not isinstance(outcome, Exception) for outcome in outcomes) == 1
    row = (
        await phase5_session.execute(
            text(
                "SELECT stories.status, stories.text_revision, story_pages.review_status "
                "FROM stories JOIN story_pages ON story_pages.story_id=stories.id "
                "WHERE stories.id=:story_id"
            ),
            {"story_id": story_id},
        )
    ).one()
    assert tuple(row) in {("approved", 3, "approved"), ("pending_review", 4, "pending")}


@pytest.mark.asyncio
async def test_reject_regenerate_complete_review_race_is_fenced(
    phase5_session: AsyncSession,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("approved",)
    )
    factory = _factory(phase5_session)

    async def reject_then_regenerate(session: AsyncSession):
        await service.review_page(
            session,
            story_id,
            page_ids[0],
            RejectPageRequest(
                decision="reject",
                reason="Cần đổi góc nhìn của nhân vật",
                expected_text_revision=3,
                expected_review_status="approved",
                expected_image_attempt_count=1,
                expected_image_url=OLD_URL,
            ),
            ADMIN_ID,
        )
        return await service.start_regeneration(
            session,
            story_id,
            page_ids[0],
            RegenerateImageRequest(
                expected_text_revision=3,
                expected_review_status="rejected",
                expected_image_attempt_count=1,
                expected_image_url=OLD_URL,
            ),
            ADMIN_ID,
            EmptyMappingStorage(),
        )

    async with factory() as first, factory() as second:
        outcomes = await asyncio.gather(
            reject_then_regenerate(first),
            service.complete_review(
                second,
                story_id,
                CompleteReviewRequest(expected_text_revision=3),
                ADMIN_ID,
            ),
            return_exceptions=True,
        )
    assert sum(not isinstance(outcome, Exception) for outcome in outcomes) == 1
    row = (
        await phase5_session.execute(
            text(
                "SELECT stories.status, stories.active_image_regeneration_page_id, "
                "story_pages.review_status FROM stories "
                "JOIN story_pages ON story_pages.story_id=stories.id "
                "WHERE stories.id=:story_id"
            ),
            {"story_id": story_id},
        )
    ).one()
    assert tuple(row) in {
        ("approved", None, "approved"),
        ("generating_images", page_ids[0], "rejected"),
    }


@pytest.mark.asyncio
async def test_concurrent_regeneration_same_page_has_one_fresh_claim(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("rejected",)
    )
    request = RegenerateImageRequest(
        expected_text_revision=3,
        expected_review_status="rejected",
        expected_image_attempt_count=1,
        expected_image_url=OLD_URL,
    )
    factory = _factory(phase5_session)
    first_tasks = BackgroundTasks()
    second_tasks = BackgroundTasks()

    provider = ValidWebpProvider()
    storage = RecordingStorage()
    monkeypatch.setattr(runner, "async_session_factory", factory)
    async with factory() as first, factory() as second:
        responses = await asyncio.gather(
            review_router.regenerate_page_image(
                story_id,
                page_ids[0],
                request,
                first_tasks,
                first,
                type("Admin", (), {"id": ADMIN_ID})(),
                provider,
                storage,
            ),
            review_router.regenerate_page_image(
                story_id,
                page_ids[0],
                request,
                second_tasks,
                second,
                type("Admin", (), {"id": ADMIN_ID})(),
                provider,
                storage,
            ),
        )
    assert sorted(response.already_running for response in responses) == [False, True]
    assert len(first_tasks.tasks) + len(second_tasks.tasks) == 1
    await first_tasks()
    await second_tasks()
    assert provider.calls == 1
    assert len(storage.uploads) == 1
    row = (
        await phase5_session.execute(
            text("SELECT status FROM stories WHERE id=:story_id"),
            {"story_id": story_id},
        )
    ).one()
    assert row.status == "pending_review"


@pytest.mark.asyncio
async def test_runner_db_guard_blocks_cross_process_duplicate_provider_call(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("rejected",)
    )
    claim = await service.start_regeneration(
        phase5_session,
        story_id,
        page_ids[0],
        RegenerateImageRequest(
            expected_text_revision=3,
            expected_review_status="rejected",
            expected_image_attempt_count=1,
            expected_image_url=OLD_URL,
        ),
        ADMIN_ID,
        EmptyMappingStorage(),
    )
    factory = _factory(phase5_session)
    monkeypatch.setattr(runner, "async_session_factory", factory)
    semaphore = asyncio.Semaphore(2)
    monkeypatch.setattr(runner, "_semaphore_for_current_settings", lambda: semaphore)

    class BlockingProvider(ValidWebpProvider):
        def __init__(self) -> None:
            super().__init__()
            self.entered = asyncio.Event()
            self.release = asyncio.Event()

        async def generate_image(self, prompt: str, reference_images: tuple[bytes, ...]) -> bytes:
            self.calls += 1
            self.entered.set()
            await self.release.wait()
            return _valid_webp()

    provider = BlockingProvider()
    storage = RecordingStorage()
    runner_key = (story_id, claim.claim_id)
    runner._active_regen_keys.discard(runner_key)
    first = asyncio.create_task(
        runner.run_single_page_regeneration(
            story_id, claim.claim_id, page_ids[0], provider, storage
        )
    )
    await asyncio.wait_for(provider.entered.wait(), timeout=5)

    # Simulate a second process: it does not share the process-local key set,
    # but it must still lose the DB pending-to-generating ownership transition.
    runner._active_regen_keys.discard(runner_key)
    second = asyncio.create_task(
        runner.run_single_page_regeneration(
            story_id, claim.claim_id, page_ids[0], provider, storage
        )
    )
    await asyncio.wait_for(second, timeout=5)
    assert provider.calls == 1
    assert storage.uploads == []

    provider.release.set()
    await asyncio.wait_for(first, timeout=10)
    assert provider.calls == 1
    assert len(storage.uploads) == 1
    row = (
        await phase5_session.execute(
            text("SELECT image_attempt_count, image_status FROM story_pages WHERE id=:page_id"),
            {"page_id": page_ids[0]},
        )
    ).one()
    assert tuple(row) == (2, "completed")


@pytest.mark.asyncio
async def test_concurrent_regeneration_of_different_pages_conflicts(
    phase5_session: AsyncSession,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session,
        status="pending_review",
        page_review_statuses=("rejected", "rejected"),
    )
    request = RegenerateImageRequest(
        expected_text_revision=3,
        expected_review_status="rejected",
        expected_image_attempt_count=1,
        expected_image_url=OLD_URL,
    )
    factory = _factory(phase5_session)
    async with factory() as first, factory() as second:
        outcomes = await asyncio.gather(
            service.start_regeneration(
                first, story_id, page_ids[0], request, ADMIN_ID, EmptyMappingStorage()
            ),
            service.start_regeneration(
                second, story_id, page_ids[1], request, ADMIN_ID, EmptyMappingStorage()
            ),
            return_exceptions=True,
        )
    assert sum(not isinstance(outcome, Exception) for outcome in outcomes) == 1
    conflicts = [outcome for outcome in outcomes if isinstance(outcome, HTTPException)]
    assert len(conflicts) == 1
    assert conflicts[0].status_code == 409


@pytest.mark.asyncio
async def test_regeneration_rejects_page_owned_by_another_story(
    phase5_session: AsyncSession,
) -> None:
    story_id, _ = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("rejected",)
    )
    _, foreign_page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("rejected",)
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.start_regeneration(
            phase5_session,
            story_id,
            foreign_page_ids[0],
            RegenerateImageRequest(
                expected_text_revision=3,
                expected_review_status="rejected",
                expected_image_attempt_count=1,
                expected_image_url=OLD_URL,
            ),
            ADMIN_ID,
            EmptyMappingStorage(),
        )
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_publish_archive_race_never_leaves_archived_story_with_active_token(
    phase5_session: AsyncSession,
) -> None:
    story_id, _ = await _seed_story(
        phase5_session, status="approved", page_review_statuses=("approved", "approved")
    )
    factory = _factory(phase5_session)
    async with factory() as first, factory() as second:
        outcomes = await asyncio.gather(
            service.publish_story(
                first,
                story_id,
                PublishStoryRequest(expected_text_revision=3, expected_share_revision=0),
                ADMIN_ID,
            ),
            service.archive_story_extended(
                second,
                story_id,
                ArchiveStoryRequest(expected_status="approved"),
                ADMIN_ID,
            ),
            return_exceptions=True,
        )
    assert sum(not isinstance(outcome, Exception) for outcome in outcomes) == 1
    row = (
        await phase5_session.execute(
            text("SELECT status, public_share_token FROM stories WHERE id=:story_id"),
            {"story_id": story_id},
        )
    ).one()
    assert not (row.status == "archived" and row.public_share_token is not None)


@pytest.mark.asyncio
async def test_archive_reshare_race_never_leaves_archived_story_with_active_token(
    phase5_session: AsyncSession,
) -> None:
    story_id, _ = await _seed_story(
        phase5_session,
        status="published",
        page_review_statuses=("approved",),
        share_revision=2,
    )
    await phase5_session.execute(
        text("UPDATE stories SET public_share_revoked_at=clock_timestamp() WHERE id=:story_id"),
        {"story_id": story_id},
    )
    await phase5_session.commit()
    factory = _factory(phase5_session)
    async with factory() as first, factory() as second:
        outcomes = await asyncio.gather(
            service.create_share_link(
                first,
                story_id,
                CreateShareLinkRequest(expected_share_revision=2),
                ADMIN_ID,
            ),
            service.archive_story_extended(
                second,
                story_id,
                ArchiveStoryRequest(expected_status="published", expected_share_revision=2),
                ADMIN_ID,
            ),
            return_exceptions=True,
        )
    assert sum(not isinstance(outcome, Exception) for outcome in outcomes) == 1
    row = (
        await phase5_session.execute(
            text("SELECT status, public_share_token FROM stories WHERE id=:story_id"),
            {"story_id": story_id},
        )
    ).one()
    assert not (row.status == "archived" and row.public_share_token is not None)


@pytest.mark.asyncio
async def test_revoke_reshare_race_finishes_in_canonical_inactive_state(
    phase5_session: AsyncSession,
) -> None:
    story_id, _ = await _seed_story(
        phase5_session,
        status="published",
        page_review_statuses=("approved",),
        share_revision=1,
        share_token="R" * 43,
    )
    factory = _factory(phase5_session)
    async with factory() as first, factory() as second:
        await asyncio.gather(
            service.revoke_share(
                first,
                story_id,
                RevokeShareRequest(expected_share_revision=1),
                ADMIN_ID,
            ),
            service.create_share_link(
                second,
                story_id,
                CreateShareLinkRequest(expected_share_revision=1),
                ADMIN_ID,
            ),
            return_exceptions=True,
        )
    row = (
        await phase5_session.execute(
            text(
                "SELECT status, public_share_token, public_share_revision, "
                "public_share_revoked_at IS NOT NULL FROM stories WHERE id=:story_id"
            ),
            {"story_id": story_id},
        )
    ).one()
    assert tuple(row) == ("published", None, 2, True)


@pytest.mark.asyncio
async def test_full_phase5_flow_on_real_postgresql(
    phase5_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    story_id, page_ids = await _seed_story(
        phase5_session, status="pending_review", page_review_statuses=("pending", "pending")
    )

    edited = await service.edit_khmer_page(
        phase5_session,
        story_id,
        page_ids[0],
        EditKhmerPageRequest(
            text_km="មិត្តភក្តិដើរកាត់សួនដោយរីករាយ។",
            expected_text_revision=3,
        ),
        ADMIN_ID,
    )
    assert edited.story.text_revision == 4
    await editor_service.validate_khmer_snapshot(
        phase5_session,
        story_id,
        ValidateKhmerRequest(expected_revision=4),
        BaselineKhmerValidator(),
    )
    await service.review_page(
        phase5_session,
        story_id,
        page_ids[0],
        ApprovePageRequest(
            decision="approve",
            acknowledge_khmer_warnings=True,
            expected_text_revision=4,
            expected_review_status="pending",
            expected_image_attempt_count=1,
            expected_image_url=OLD_URL,
        ),
        ADMIN_ID,
    )
    await service.review_page(
        phase5_session,
        story_id,
        page_ids[1],
        RejectPageRequest(
            decision="reject",
            reason="Cần đổi góc nhìn của nhân vật",
            expected_text_revision=4,
            expected_review_status="pending",
            expected_image_attempt_count=1,
            expected_image_url=OLD_URL,
        ),
        ADMIN_ID,
    )

    claim = await service.start_regeneration(
        phase5_session,
        story_id,
        page_ids[1],
        RegenerateImageRequest(
            expected_text_revision=4,
            expected_review_status="rejected",
            expected_image_attempt_count=1,
            expected_image_url=OLD_URL,
        ),
        ADMIN_ID,
        EmptyMappingStorage(),
    )
    factory = _factory(phase5_session)
    monkeypatch.setattr(runner, "async_session_factory", factory)
    await runner._snapshot_regen_page(story_id, claim.claim_id, page_ids[1], EmptyMappingStorage())
    await runner._commit_success(story_id, claim.claim_id, page_ids[1], NEW_URL)
    phase5_session.expire_all()
    await service.review_page(
        phase5_session,
        story_id,
        page_ids[1],
        ApprovePageRequest(
            decision="approve",
            acknowledge_khmer_warnings=True,
            expected_text_revision=4,
            expected_review_status="pending",
            expected_image_attempt_count=2,
            expected_image_url=NEW_URL,
        ),
        ADMIN_ID,
    )
    approved = await service.complete_review(
        phase5_session,
        story_id,
        CompleteReviewRequest(expected_text_revision=4),
        ADMIN_ID,
    )
    assert approved.story.status == "approved"

    published = await service.publish_story(
        phase5_session,
        story_id,
        PublishStoryRequest(expected_text_revision=4, expected_share_revision=0),
        ADMIN_ID,
    )
    first_token = published.share.token
    assert first_token is not None
    assert (await public_service.get_shared_story(phase5_session, first_token)).page_count == 2
    with pytest.raises(HTTPException) as malformed:
        await public_service.get_shared_story(phase5_session, "10")
    assert malformed.value.status_code == 404

    await service.revoke_share(
        phase5_session,
        story_id,
        RevokeShareRequest(expected_share_revision=1),
        ADMIN_ID,
    )
    with pytest.raises(HTTPException):
        await public_service.get_shared_story(phase5_session, first_token)
    reshared = await service.create_share_link(
        phase5_session,
        story_id,
        CreateShareLinkRequest(expected_share_revision=2),
        ADMIN_ID,
    )
    second_token = reshared.share.token
    assert second_token is not None and second_token != first_token
    assert (await public_service.get_shared_story(phase5_session, second_token)).page_count == 2
    with pytest.raises(HTTPException):
        await public_service.get_shared_story(phase5_session, first_token)

    await service.archive_story_extended(
        phase5_session,
        story_id,
        ArchiveStoryRequest(expected_status="published", expected_share_revision=3),
        ADMIN_ID,
    )
    with pytest.raises(HTTPException):
        await public_service.get_shared_story(phase5_session, second_token)
