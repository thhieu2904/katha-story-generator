# Katha — កថា

> AI-powered bilingual story generator for Cambodian children — Khmer & Vietnamese.

Katha giúp giáo viên và phụ huynh tạo truyện tranh song ngữ Khmer-Việt cho trẻ em, sử dụng AI để tạo nội dung và minh họa nhất quán.

## Tech Stack

- **Frontend**: Next.js (TypeScript), Tailwind CSS v4
- **Backend**: FastAPI (Python 3.11), SQLAlchemy (async)
- **Database**: PostgreSQL (Supabase)
- **Storage**: Cloudflare R2
- **AI**: OpenAI (gpt-4o-mini, gpt-image-2)

## Architecture

```
Modular monolith, feature-based

backend/src/katha/
├── core/           # Config, database, dependencies
├── db/             # Base model, registry
├── features/       # Feature modules (config_data, characters, stories)
└── integrations/   # External service adapters (R2, Supabase, OpenAI)

frontend/src/
├── app/            # Routes + layouts (Next.js App Router)
├── features/       # Feature modules
├── shared/         # Shared UI components
└── lib/            # Utilities (API client, Supabase client)
```

### Dependency Rules

```
router → service → model/database
                 → integration adapter
```

- Router: nhận request, validate input, trả response
- Service: business logic, gọi model + integration
- Integration: external services, không import router/feature
- main.py: chỉ khởi tạo app, middleware, mount routers

## Prerequisites

- Python 3.11+
- Node.js 20+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Docker (for tests)

## Setup

### Backend

```bash
cd backend
uv sync                     # Install dependencies (including dev group)
cp .env.example .env        # Configure environment variables
uv run alembic upgrade head # Run migrations
uv run python -m katha.features.config_data.seed  # Seed data
uv run python -m katha.integrations.upload_refs    # Upload 7 ref images to R2
uv run uvicorn katha.main:app --reload            # Start dev server
```

### Frontend

```bash
cd frontend
npm install                 # Install dependencies
cp .env.local.example .env.local  # Configure environment variables
npm run dev                 # Start dev server
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL async connection string |
| `SUPABASE_URL` | Phase 2 | Supabase project URL |
| `R2_ENDPOINT_URL` | ✅ | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | ✅ | R2 access key |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 secret key |
| `R2_BUCKET_NAME` | ✅ | R2 bucket name |
| `R2_PUBLIC_URL` | ✅ | R2 public URL |
| `CORS_ORIGINS` | ❌ | Allowed origins (default: localhost:3000) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Phase 2 | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Phase 2 | Supabase publishable key |

## Testing

### Backend

```bash
cd backend
uv run ruff check src/ tests/ alembic/versions/002_target_age_groups.py
uv run ruff format --check src/ tests/ alembic/versions/002_target_age_groups.py
uv run mypy src/
uv run pytest -m "not integration" tests/ -q  # Offline suite
uv run pytest -m integration tests/ -q        # Requires Docker/Testcontainers
docker build -t katha-backend .               # Docker build smoke test
```

### Frontend

```bash
cd frontend
npx eslint .        # Lint
npx tsc --noEmit    # Type check
npm run build       # Build
```

## Health Check

```bash
curl http://localhost:8000/health
# {"status": "healthy", "checks": {"database": "ok", "r2": "ok"}, "version": "0.1.0"}
```

## Database

7 tables across 2 groups:

**Config** (seed data): `story_backbones`, `story_genres`, `art_styles`  
**Core** (user data): `characters`, `stories`, `story_characters`, `story_pages`

Schema: [`plan/07-database-schema.md`](plan/07-database-schema.md)

## Seed Data

Run idempotent (safe to run multiple times):

```bash
cd backend
uv run python -m katha.features.config_data.seed
# Seed complete: 3 backbones, 4 genres, 3 art_styles, 7 characters inserted
```

## Project Status

- [x] Phase 1: Foundation — code-complete offline; Docker/Supabase/R2 live checks pending
- [x] Phase 2: Auth + config APIs + Character Bank read-only — code-complete offline
- [x] Phase 3A: Story setup/list — code-complete offline; Docker/live checks pending
- [ ] Phase 3B–3C: Text generation, editor, confirmation
- [ ] Phase 4: Polish + deploy
