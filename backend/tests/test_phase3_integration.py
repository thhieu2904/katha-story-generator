"""PostgreSQL integration flows for Phase 3B generation and Phase 3C editing.

These tests are collected in the repository but require Docker/Testcontainers to execute.
"""

import asyncio
from collections.abc import AsyncGenerator
from uuid import UUID

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from katha.features.stories import generation_service
from katha.features.stories.generation_models import (
    GeneratedPageVi,
    GeneratedStoryVi,
    TranslatedPageKm,
    TranslatedStoryKm,
)
from katha.features.story_editor import service
from katha.features.story_editor.schemas import (
    AddedPageVi,
    ConfirmTextRequest,
    QuickActionEdit,
    ReorderPagesRequest,
    RetranslatedTextKm,
    RetranslatePageRequest,
    RevisedPageVi,
    RevisedStoryVi,
    ValidateKhmerRequest,
)
from katha.integrations.khmer.baseline import BaselineKhmerValidator
from katha.integrations.openai_story_text import ProviderOutputError

pytestmark = pytest.mark.integration
ADMIN_ID = UUID("00000000-0000-0000-0000-000000000301")
STORY_IDS = (301, 302, 303, 304, 305)


@pytest_asyncio.fixture
async def phase3_session(
    postgres_url: str, run_migrations: None
) -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(postgres_url)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        await session.execute(
            text("DELETE FROM stories WHERE id = ANY(:ids)"), {"ids": list(STORY_IDS)}
        )
        await session.execute(
            text("INSERT INTO auth.users (id) VALUES (:id) ON CONFLICT (id) DO NOTHING"),
            {"id": ADMIN_ID},
        )
        await session.execute(
            text(
                """
                INSERT INTO story_backbones (id, name_vi, name_en, prompt_template_en)
                VALUES (301, 'Ba hồi P3', 'Three act P3', 'Three acts')
                ON CONFLICT (id) DO UPDATE SET prompt_template_en = EXCLUDED.prompt_template_en
                """
            )
        )
        await session.execute(
            text(
                """
                INSERT INTO story_genres (id, name_vi, name_en, prompt_modifier_en)
                VALUES (301, 'Ấm áp P3', 'Warm P3', 'Warm tone')
                ON CONFLICT (id) DO UPDATE SET prompt_modifier_en = EXCLUDED.prompt_modifier_en
                """
            )
        )
        await session.execute(
            text(
                """
                INSERT INTO art_styles (id, name_vi, name_en, prompt_modifier_en)
                VALUES (301, 'Màu nước P3', 'Watercolor P3', 'Soft watercolor')
                ON CONFLICT (id) DO UPDATE SET prompt_modifier_en = EXCLUDED.prompt_modifier_en
                """
            )
        )
        await session.execute(
            text(
                """
                INSERT INTO characters (id, name, age, personality_vi, appearance_prompt_en)
                VALUES
                    (301, 'An P3', 6, 'Dũng cảm', 'A brave child'),
                    (302, 'Thỏ P3', 4, 'Vui vẻ', 'A white rabbit')
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
                """
            )
        )
        await session.commit()
        yield session
        await session.rollback()
        await session.execute(
            text("DELETE FROM stories WHERE id = ANY(:ids)"), {"ids": list(STORY_IDS)}
        )
        await session.commit()
    await engine.dispose()


async def seed_story(
    session: AsyncSession,
    story_id: int,
    *,
    status: str,
    page_count: int,
    revision: int,
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO stories (
                id, title_vi, title_km, description_vi, backbone_id, genre_id,
                art_style_id, target_age, length_pref, status, text_revision, created_by
            ) VALUES (
                :id, :title_vi, :title_km, :description_vi, 301, 301,
                301, 'preschool', 'short', :status, :revision, :created_by
            )
            """
        ),
        {
            "id": story_id,
            "title_vi": None if status == "draft" else "Chuyến đi nhỏ",
            "title_km": None if status == "draft" else "ដំណើរតូច",
            "description_vi": "An và Thỏ cùng tìm đường qua khu vườn xanh.",
            "status": status,
            "revision": revision,
            "created_by": ADMIN_ID,
        },
    )
    for character_id in (301, 302):
        await session.execute(
            text("INSERT INTO story_characters (story_id, character_id) VALUES (:story, :char)"),
            {"story": story_id, "char": character_id},
        )
    for page_no in range(1, page_count + 1):
        await session.execute(
            text(
                """
                INSERT INTO story_pages (
                    story_id, page_no, text_vi, text_km, spellcheck_flags, khmer_validated_at
                ) VALUES (:story, :page_no, :vi, :km, '[]', clock_timestamp())
                """
            ),
            {
                "story": story_id,
                "page_no": page_no,
                "vi": f"An và Thỏ vui chơi ở vườn trang {page_no}.",
                "km": f"អាន និង ទន្សាយ លេង នៅ សួន {page_no}។",
            },
        )
    await session.commit()


class GenerationProvider:
    async def generate_vietnamese(self, instructions: str, prompt: str) -> GeneratedStoryVi:
        return GeneratedStoryVi(
            title_vi="Đường về nhà",
            pages=[
                GeneratedPageVi(page_no=index, text_vi="An và Thỏ cùng tìm đường về nhà.")
                for index in range(1, 5)
            ],
        )

    async def translate_khmer(self, instructions: str, prompt: str) -> TranslatedStoryKm:
        return TranslatedStoryKm(
            title_km="ផ្លូវទៅផ្ទះ",
            pages=[
                TranslatedPageKm(page_no=index, text_km="អាន និង ទន្សាយ រក ផ្លូវ ទៅ ផ្ទះ។")
                for index in range(1, 5)
            ],
        )


class PageProvider:
    async def add_page(self, instructions: str, prompt: str) -> AddedPageVi:
        return AddedPageVi(text_vi="An và Thỏ gặp một chú chim nhỏ.")

    async def retranslate_khmer(self, instructions: str, prompt: str) -> RetranslatedTextKm:
        return RetranslatedTextKm(text_km="អាន និង ទន្សាយ ជួប បក្សី តូច។")


class EditTranslationFailureProvider:
    def __init__(self, page_ids: list[int], texts: list[str]) -> None:
        self.page_ids = page_ids
        self.texts = texts

    async def revise_story(self, instructions: str, prompt: str) -> RevisedStoryVi:
        return RevisedStoryVi(
            title_vi="Chuyến đi nhỏ",
            pages=[
                RevisedPageVi(
                    source_page_id=page_id,
                    text_vi=("An và Thỏ vội vàng trở về nhà." if index == 0 else self.texts[index]),
                )
                for index, page_id in enumerate(self.page_ids)
            ],
        )

    async def translate_khmer(self, instructions: str, prompt: str) -> TranslatedStoryKm:
        raise ProviderOutputError("translation failed")


@pytest.mark.asyncio
async def test_generation_claim_and_finalize_on_real_postgresql(
    phase3_session: AsyncSession,
) -> None:
    await seed_story(phase3_session, STORY_IDS[0], status="draft", page_count=0, revision=0)

    result = await generation_service.generate_story_text(
        phase3_session, STORY_IDS[0], GenerationProvider()
    )

    assert result.status == "text_draft"
    assert result.text_revision == 1
    assert len(result.pages) == 4
    row = (
        await phase3_session.execute(
            text(
                "SELECT status, text_revision, text_generation_claim_id FROM stories WHERE id=:id"
            ),
            {"id": STORY_IDS[0]},
        )
    ).one()
    assert tuple(row) == ("text_draft", 1, None)


@pytest.mark.asyncio
async def test_full_editor_page_flow_and_confirm_on_real_postgresql(
    phase3_session: AsyncSession,
) -> None:
    story_id = STORY_IDS[1]
    await seed_story(phase3_session, story_id, status="text_draft", page_count=5, revision=3)
    initial = await generation_service.get_story_text(phase3_session, story_id)
    reversed_ids = [page.id for page in reversed(initial.pages)]

    reordered = await service.reorder_pages(
        phase3_session,
        story_id,
        ReorderPagesRequest(page_ids=reversed_ids, expected_revision=3),
    )
    deleted = await service.delete_page(
        phase3_session, story_id, reordered.story.pages[0].id, expected_revision=4
    )
    added = await service.add_page(
        phase3_session,
        story_id,
        service.AddPageRequest(expected_revision=5),
        PageProvider(),
        BaselineKhmerValidator(),
    )
    await phase3_session.execute(
        text("UPDATE story_pages SET khmer_validated_at=NULL WHERE id=:id"),
        {"id": added.story.pages[0].id},
    )
    await phase3_session.commit()
    validated = await service.validate_khmer_snapshot(
        phase3_session,
        story_id,
        ValidateKhmerRequest(expected_revision=6),
        BaselineKhmerValidator(),
    )
    retranslated = await service.retranslate_khmer(
        phase3_session,
        story_id,
        RetranslatePageRequest(target="page", page_id=validated.pages[0].id, expected_revision=6),
        PageProvider(),
        BaselineKhmerValidator(),
    )
    confirmed = await service.confirm_text(
        phase3_session,
        story_id,
        ConfirmTextRequest(expected_revision=7, acknowledge_khmer_warnings=False),
    )

    assert deleted.story.text_revision == 5
    assert len(added.story.pages) == 5
    assert validated.text_revision == 6
    assert retranslated.story.text_revision == 7
    assert confirmed.status == "text_confirmed"
    assert confirmed.text_revision == 7
    assert len(confirmed.pages) == 5
    assert [page.page_no for page in confirmed.pages] == [1, 2, 3, 4, 5]


@pytest.mark.asyncio
async def test_stale_revision_cannot_mutate_after_real_commit(
    phase3_session: AsyncSession,
) -> None:
    story_id = STORY_IDS[2]
    await seed_story(phase3_session, story_id, status="text_draft", page_count=5, revision=3)
    canonical = await generation_service.get_story_text(phase3_session, story_id)
    await service.reorder_pages(
        phase3_session,
        story_id,
        ReorderPagesRequest(
            page_ids=[page.id for page in reversed(canonical.pages)], expected_revision=3
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.delete_page(
            phase3_session, story_id, canonical.pages[0].id, expected_revision=3
        )

    assert exc_info.value.status_code == 409
    latest = await generation_service.get_story_text(phase3_session, story_id)
    assert latest.text_revision == 4
    assert len(latest.pages) == 5


@pytest.mark.asyncio
async def test_translation_failure_leaves_real_canonical_rows_unchanged(
    phase3_session: AsyncSession,
) -> None:
    story_id = STORY_IDS[3]
    await seed_story(phase3_session, story_id, status="text_draft", page_count=4, revision=3)
    before = await generation_service.get_story_text(phase3_session, story_id)
    provider = EditTranslationFailureProvider(
        [page.id for page in before.pages], [page.text_vi for page in before.pages]
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.edit_story(
            phase3_session,
            story_id,
            QuickActionEdit(kind="quick_action", action="shorten", expected_revision=3),
            provider,
            BaselineKhmerValidator(),
        )

    assert exc_info.value.status_code == 502
    after = await generation_service.get_story_text(phase3_session, story_id)
    assert after.text_revision == 3
    assert [page.text_vi for page in after.pages] == [page.text_vi for page in before.pages]
    assert [page.text_km for page in after.pages] == [page.text_km for page in before.pages]


@pytest.mark.asyncio
async def test_concurrent_generation_allows_only_one_real_postgresql_claim(
    phase3_session: AsyncSession,
    postgres_url: str,
) -> None:
    story_id = STORY_IDS[4]
    await seed_story(phase3_session, story_id, status="draft", page_count=0, revision=0)
    engine = create_async_engine(postgres_url)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as first_session, factory() as second_session:
        results = await asyncio.gather(
            generation_service.generate_story_text(first_session, story_id, GenerationProvider()),
            generation_service.generate_story_text(second_session, story_id, GenerationProvider()),
            return_exceptions=True,
        )

    await engine.dispose()
    successes = [result for result in results if not isinstance(result, Exception)]
    conflicts = [
        result
        for result in results
        if isinstance(result, HTTPException) and result.status_code == 409
    ]
    assert len(successes) == 1
    assert len(conflicts) == 1
    canonical = await generation_service.get_story_text(phase3_session, story_id)
    assert canonical.status == "text_draft"
    assert canonical.text_revision == 1
    assert len(canonical.pages) == 4
