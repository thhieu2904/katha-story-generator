# Katha Backend

FastAPI backend for Katha. Run all commands from this directory.

## Local run

```bash
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run python -m katha.features.config_data.seed
uv run uvicorn katha.main:app --reload
```

## Phase 4 image-generation MVP

Admin-only routes under `/api/stories/{story_id}` provide:

- `GET /images` for canonical plan, page state, and polling progress;
- `POST`/`PUT /image-plan` to create or edit the full page-to-character mapping;
- `POST /generate-images` to claim and start one in-process sequential job.

The worker uses a UUID claim plus heartbeat, page states (`pending`, `generating`,
`completed`, `failed`), and configured local concurrency. It writes validated WebP
images to R2. A retry resumes only retryable pages under the locked plan; manual
per-page regeneration belongs to Phase 5.

## Phase 5 review, publish, and public reader

Admin review APIs expose canonical page decisions, Khmer edits/validation, single-page image regeneration, complete-review, publish, share rotation, and archive concurrency. Regeneration preflights the locked mapping/references before committing a DB-clock UUID claim; finalizers and schedule-failure reset are fenced by claim plus active page. A scheduling failure restores `pending_review` and marks the target `failed/SCHEDULE_FAILED` while retaining its old URL and rejection metadata, so the same page remains usable and retryable.

The regeneration endpoint returns only `already_running` and canonical `review`; the internal UUID claim and active-target metadata are not exposed as mutation response fields.

`GET /api/public/shared-stories/{share_token}` returns a minimal reader projection. Invalid, revoked, unpublished, or malformed tokens return the same 404 response with no-store/no-referrer/noindex headers. Migration `006_story_review_publish` is the current Alembic head.

Set the Phase 4 variables in `.env` from `.env.example`: `OPENAI_IMAGE_*`,
`IMAGE_PLAN_OPERATION_TIMEOUT_SECONDS`, `IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS`,
`IMAGE_GENERATION_STALE_SECONDS`, `IMAGE_MAX_CONCURRENT_JOBS`, and
`IMAGE_MAX_OUTPUT_BYTES`. Image cost is intentionally not hard-coded: it depends
on the configured model, size, quality, and current provider pricing.

### Migration safety

Migration `005_story_image_generation` deliberately stops before schema mutation
if any legacy `story_pages.image_url` is non-empty, or if a story is already in
`pending_review`, `approved`, or `published` without Phase 4 state. Decide how to
preserve/import, clear, normalize, or archive those rows before applying it to a
populated database; the migration never silently overwrites or strands them.

## Verification

```bash
uv run ruff check src/ tests/ alembic/versions/
uv run ruff format --check src/ tests/ alembic/versions/
uv run mypy src/
uv run pytest -m "not integration" tests/ -q
uv run pytest -m integration tests/ -q
docker build -t katha-backend .
```

Docker/Testcontainers migration coverage and a controlled live OpenAI/R2 smoke are
separate gates. For the live smoke, use a non-production story with valid R2
character references, then verify polling, WebP upload, and a stale-job resume.
