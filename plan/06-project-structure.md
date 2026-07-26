# Katha — Cấu trúc dự án

> Ngày cập nhật: 2026-07-20
> Trạng thái: ĐÃ CHỐT ✅

---

## Tổng quan

```
katha-story-generator/
├── frontend/                    ← Next.js (App Router, TypeScript)
├── backend/                     ← FastAPI (Python, feature-based)
├── plan/                        ← Tài liệu thiết kế (đã có)
├── .gitignore
└── README.md
```

- **frontend/** và **backend/** hoàn toàn độc lập — dependencies riêng, deploy riêng
- Frontend deploy → Vercel (free tier)
- Backend deploy → VPS DigitalOcean (đã có)

---

## 1. Backend — FastAPI

### Cấu trúc thư mục

```
backend/
├── pyproject.toml               # Dependencies (uv / pip)
├── Dockerfile
├── .env.example
├── alembic.ini                  # DB migration config
├── alembic/                     # Migration files
│   └── versions/
│
└── src/
    ├── main.py                  # FastAPI app, mount routers
    ├── config.py                # Pydantic Settings (.env → config object)
    ├── database.py              # Async SQLAlchemy engine + session
    ├── dependencies.py          # Shared dependencies (get_db, get_current_user)
    │
    ├── auth/                    ── Xác thực ──────────────────────
    │   ├── router.py            # POST /auth/login, POST /auth/logout
    │   ├── service.py           # Verify Supabase JWT, lấy user info
    │   ├── schemas.py           # LoginRequest, TokenResponse
    │   └── dependencies.py      # get_current_user, require_admin
    │
    ├── characters/              ── Ngân hàng nhân vật ─────────────
    │   ├── router.py            # CRUD /characters
    │   ├── service.py           # Business logic (expand description, etc.)
    │   ├── models.py            # SQLAlchemy model: Character
    │   └── schemas.py           # Pydantic: CharacterCreate, CharacterResponse
    │
    ├── stories/                 ── Quản lý truyện + pages ────────
    │   ├── router.py            # CRUD /stories, /stories/:id/pages
    │   ├── service.py           # Story lifecycle, state machine
    │   ├── models.py            # Story, StoryPage, StoryCharacter
    │   └── schemas.py           # StoryCreate, PageResponse, EditRequest
    │
    ├── config_data/             ── Dữ liệu cấu hình (seed) ──────
    │   ├── router.py            # GET /backbones, /genres, /art-styles
    │   ├── models.py            # StoryBackbone, StoryGenre, ArtStyle
    │   ├── schemas.py           # BackboneResponse, GenreResponse
    │   └── seed.py              # Script seed data (3 backbone, 4 genre, 3 art style)
    │
    ├── ai/                      ── AI Services ───────────────────
    │   ├── __init__.py
    │   ├── base.py              # ABC: ImageGenerator, TextGenerator, Translator
    │   ├── openai_client.py     # OpenAI SDK wrapper (shared client)
    │   ├── image_generator.py   # OpenAIImageGenerator (gpt-image-2)
    │   ├── text_generator.py    # OpenAITextGenerator (gpt-4o-mini)
    │   ├── translator.py        # VN→KM, VN→EN translation
    │   └── prompts/             # Prompt templates
    │       ├── story_system.py  # System prompt cho sinh truyện
    │       ├── edit_actions.py  # Quick action prompts
    │       └── image_scene.py   # Image prompt builder
    │
    ├── storage/                 ── Cloudflare R2 ─────────────────
    │   ├── r2_client.py         # Upload, download, generate URL
    │   └── schemas.py           # UploadResult
    │
    └── khmer/                   ── Khmer NLP ─────────────────────
        └── validator.py         # Baseline Unicode/code-point warnings; advanced adapter deferred P1

```

### Giải thích cấu trúc

Mỗi feature folder chứa 4 file chuẩn:

| File | Vai trò |
|------|---------|
| `router.py` | Định nghĩa API endpoints (routes), nhận request, trả response |
| `service.py` | Business logic, gọi models + AI services, xử lý nghiệp vụ |
| `models.py` | SQLAlchemy ORM models (mapping table → Python class) |
| `schemas.py` | Pydantic schemas (validate input/output, serialize JSON) |

**Shared services** (`ai/`, `storage/`, `khmer/`) không có router — được inject vào service của các feature.

### Dependencies chính

```
fastapi
uvicorn
sqlalchemy[asyncio]     # Async ORM
asyncpg                 # PostgreSQL async driver
alembic                 # DB migrations
pydantic-settings       # Config from .env
openai                  # OpenAI SDK
boto3                   # S3-compatible (R2)
(không pin Khmer NLP package ở P0; baseline không có runtime dependency)
python-jose[cryptography]  # JWT decode (Supabase tokens)
httpx                   # Async HTTP client
```

---

## 2. Frontend — Next.js (App Router)

### Cấu trúc thư mục

```
frontend/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts           # Tailwind config (custom colors, fonts)
├── .env.local.example
├── public/
│   └── fonts/                   # Noto Sans Khmer (self-hosted)
│
└── src/
    ├── app/                     ── Routes (App Router) ───────────
    │   ├── layout.tsx           # Root layout: fonts, providers, metadata
    │   ├── globals.css          # Tailwind directives + custom Khmer typography
    │   ├── page.tsx             # Landing/admin entry; không fetch hoặc redirect tới public catalogue
    │   │
    │   ├── login/
    │   │   └── page.tsx         # Form đăng nhập
    │   │
    │   ├── admin/               ── Admin routes (cần auth) ──────
    │   │   ├── layout.tsx       # Admin layout: sidebar, topbar, navigation
    │   │   │
    │   │   ├── dashboard/
    │   │   │   └── page.tsx     # Tổng quan: số truyện, usage, etc.
    │   │   │
    │   │   ├── characters/
    │   │   │   ├── page.tsx     # Danh sách nhân vật (card grid)
    │   │   │   ├── new/
    │   │   │   │   └── page.tsx # Form tạo nhân vật + gen ảnh ref
    │   │   │   └── [id]/
    │   │   │       └── page.tsx # Sửa nhân vật
    │   │   │
    │   │   └── stories/
    │   │       ├── page.tsx     # Danh sách truyện (tất cả trạng thái)
    │   │       ├── new/
    │   │       │   └── page.tsx # Bước 1: Form thiết lập truyện
    │   │       └── [id]/
    │   │           ├── page.tsx     # Chi tiết truyện (redirect theo status)
    │   │           ├── edit/
    │   │           │   └── page.tsx # Bước 2: Text Phase — edit song ngữ
    │   │           ├── generate/
    │   │           │   └── page.tsx # Bước 3: Image Phase — progress
    │   │           └── review/
    │   │               └── page.tsx # Bước 4: Review từng trang
    │   │
    │   └── stories/             ── Reader exact-link (public) ───
    │       └── [shareToken]/
    │           └── page.tsx     # Opaque unlisted reader; pager + one-language toggle
    │
    ├── components/              ── Components theo feature ───────
    │   ├── ui/                  # Shared UI primitives
    │   │   ├── Button.tsx
    │   │   ├── Modal.tsx
    │   │   ├── Input.tsx
    │   │   ├── Select.tsx
    │   │   ├── Toast.tsx
    │   │   ├── Card.tsx
    │   │   ├── Badge.tsx
    │   │   ├── ProgressBar.tsx
    │   │   └── Spinner.tsx
    │   │
    │   ├── characters/          # Character-specific components
    │   │   ├── CharacterCard.tsx
    │   │   ├── CharacterForm.tsx
    │   │   ├── CharacterPicker.tsx   # Multi-select cho tạo truyện
    │   │   └── RefImageGallery.tsx   # Chọn ảnh reference
    │   │
    │   ├── stories/             # Story-specific components
    │   │   ├── StoryCard.tsx
    │   │   ├── StorySetupForm.tsx    # Chọn backbone, genre, art style
    │   │   ├── PageEditor.tsx       # 1 trang trong text editor
    │   │   ├── PageList.tsx          # Sortable list (drag-drop)
    │   │   ├── QuickActions.tsx      # [Rút gọn nội dung] [Viết chi tiết hơn] ...
    │   │   ├── ChatInput.tsx         # Chat edit input
    │   │   ├── ImageProgress.tsx     # Progress bar sinh ảnh
    │   │   └── ReviewPage.tsx        # Review 1 trang (ảnh + text)
    │   │
    │   ├── reader/              # Reader-specific components
    │   │   ├── StoryCover.tsx        # Code-template cover, hai title
    │   │   ├── ReaderLanguageToggle.tsx # Khmer default, một body language
    │   │   └── ReaderPager.tsx       # Previous/Next, keyboard, swipe
    │   │
    │   └── layout/              # Layout components
    │       ├── AdminSidebar.tsx
    │       ├── AdminTopbar.tsx
    │       └── ReaderHeader.tsx
    │
    ├── lib/                     ── Utilities ─────────────────────
    │   ├── api.ts               # Fetch wrapper (base URL, auth header, error handling)
    │   ├── supabase.ts          # Supabase client (auth only)
    │   ├── utils.ts             # Format date, truncate text, etc.
    │   └── constants.ts         # Status labels, routes, etc.
    │
    ├── hooks/                   ── Custom hooks ──────────────────
    │   ├── useAuth.ts           # Auth state + login/logout
    │   ├── useCharacters.ts     # Fetch + cache characters (SWR)
    │   ├── useStory.ts          # Fetch + mutate story
    │   ├── useStoryPages.ts     # Fetch + mutate pages
    │   └── useProgress.ts       # Image gen progress (Gate G4 — cách tracking chưa chốt)
    │
    ├── contexts/                ── React Contexts ────────────────
    │   └── AuthContext.tsx      # Auth provider (wrap toàn app)
    │
    └── types/                   ── TypeScript types ──────────────
        ├── character.ts         # Character, CharacterCreate
        ├── story.ts             # Story, StoryPage, StoryStatus
        ├── config.ts            # Backbone, Genre, ArtStyle
        └── api.ts               # ApiResponse<T>, PaginatedResponse<T>
```

### Giải thích cấu trúc

**Routing (App Router):**

| Route | Trang | Auth |
|-------|-------|------|
| `/login` | Đăng nhập | Public |
| `/admin/dashboard` | Tổng quan admin | Admin |
| `/admin/characters` | Danh sách nhân vật | Admin |
| `/admin/characters/new` | Tạo nhân vật | Admin |
| `/admin/characters/[id]` | Sửa nhân vật | Admin |
| `/admin/stories` | Danh sách truyện (admin) | Admin |
| `/admin/stories/new` | Thiết lập truyện mới | Admin |
| `/admin/stories/[storyKey]/edit` | Text Phase — edit song ngữ | Admin |
| `/admin/stories/[storyKey]/images` | Image Phase — plan/progress | Admin |
| `/admin/stories/[storyKey]/review` | Review từng trang | Admin |
| `/stories/[shareToken]` | Unlisted reader — Khmer default, one-language toggle | Public |

Không có route catalogue `/stories` hoặc reader theo numeric story ID trong Phase 5.

**Components:**
- Mỗi component = 1 file `.tsx` — style viết bằng Tailwind classes trong JSX
- Không cần file CSS riêng cho từng component
- `ui/` = primitives dùng chung (Button, Modal, Input...)
- Feature folders = components chỉ dùng trong feature đó

**Data fetching:**
- SWR cho server state (characters, stories)
- Custom hooks wrap SWR calls → components chỉ gọi `useCharacters()`
- Auth state qua React Context

### Dependencies chính

```json
{
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "swr": "^2.x",
    "@supabase/supabase-js": "^2.x",
    "@dnd-kit/core": "^6.x",
    "@dnd-kit/sortable": "^8.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/react": "latest",
    "@types/node": "latest",
    "tailwindcss": "^4.x",
    "@tailwindcss/postcss": "^4.x"
  }
}
```

---

## 3. CSS Strategy — Tailwind CSS

### Cách hoạt động

Style viết trực tiếp trong JSX bằng Tailwind utility classes:

```tsx
// Button.tsx
export function Button({ variant = 'primary', children }) {
  return (
    <button className="px-4 py-2 rounded-lg font-medium
      bg-blue-600 hover:bg-blue-700 text-white
      transition-colors duration-200">
      {children}
    </button>
  );
}
```

- Không cần file CSS riêng cho từng component
- Tailwind tự purge unused classes → bundle nhỏ
- Custom config cho Khmer typography trong `tailwind.config.ts`

### Tailwind Config (custom cho Katha)

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        khmer: ['Noto Sans Khmer', 'sans-serif'],
      },
      fontSize: {
        'khmer-body': ['22px', { lineHeight: '1.8', fontWeight: '600' }],
        'khmer-title': ['28px', { lineHeight: '1.8', fontWeight: '700' }],
        'vi-body': ['16px', { lineHeight: '1.5' }],
        'vi-subtitle': ['14px', { lineHeight: '1.5' }],
      },
    },
  },
};

export default config;
```

### globals.css

```css
/* globals.css */
@import 'tailwindcss';

/* Custom Khmer typography utilities */
@layer components {
  .text-khmer {
    font-family: 'Noto Sans Khmer', sans-serif;
    font-size: 22px;
    line-height: 1.8;
    font-weight: 600;
  }

  .text-khmer-subtitle {
    font-family: 'Noto Sans Khmer', sans-serif;
    font-size: 14px;
    line-height: 1.8;
    font-weight: 400;
    opacity: 0.6;
  }
}
```

---

## 4. Giao tiếp Frontend ↔ Backend

```
Frontend (Next.js / Vercel)
    │
    │  REST API (fetch / SWR)
    │  Auth: Supabase JWT trong header
    │  Base URL: NEXT_PUBLIC_API_URL
    │
    ▼
Backend (FastAPI / VPS)
    │
    ├── Supabase PostgreSQL (query data)
    ├── Cloudflare R2 (upload/serve ảnh)
    └── OpenAI API (AI calls)
```

- Frontend GỌI backend qua REST API
- Frontend KHÔNG gọi trực tiếp Supabase DB (chỉ dùng Supabase Auth client)
- Backend trả ảnh URLs (R2 public URL), frontend render `<img src={url}>`
- Image gen progress: cách tracking chưa chốt — xem Gate G4 (`08-implementation-gates.md`)

---

## 5. Quyết định đã chốt (tóm tắt)

| Quyết định | Chọn |
|-----------|------|
| Repo structure | Monorepo: `frontend/` + `backend/` |
| Backend framework | FastAPI (Python) |
| Backend structure | Feature-based (auth, characters, stories, ai, storage, khmer) |
| Database | Supabase PostgreSQL (free tier) |
| Auth | Supabase Auth (JWT) |
| Storage | Cloudflare R2 |
| Frontend framework | Next.js (App Router, TypeScript) |
| Frontend structure | Feature-based components |
| Styling | Tailwind CSS |
| State management | SWR (server state) + React Context (auth) |
| Routing | App Router — Admin: `/admin/xx`, Reader: `/stories/xx` |
| AI | All OpenAI: gpt-image-2 + gpt-4o-mini |
| Deploy | Frontend → Vercel, Backend → VPS DigitalOcean |

---

## 6. Ghi chú khi setup

1. **Khmer font**: Self-host Noto Sans Khmer (đặt trong `public/fonts/`)

2. **Environment variables cần thiết**:
   - Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Backend: `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `OPENAI_API_KEY`, `R2_*` credentials

3. **Tailwind**: Dùng Tailwind v4 — import trực tiếp `@import 'tailwindcss'` trong globals.css, không cần `@tailwind` directives cũ

---

## 7. Phase 3C — cấu trúc thực tế

Backend dùng feature riêng `src/katha/features/story_editor/` gồm `router.py`, `schemas.py`, `service.py`, `ports.py`, `prompts.py`, `diff.py`; adapter Khmer ở `src/katha/integrations/khmer/`. OpenAI adapter dùng chung được mở rộng, không gọi provider trực tiếp từ router.

Frontend dùng `src/features/story-editor/` gồm API/types/constants/hook và các component editor. Route hiện hành `app/admin/stories/[storyKey]/edit/page.tsx` resolve opaque admin key rồi render feature. Dnd-kit là dependency UI mới duy nhất.

Migration 004 chỉ thêm `story_pages.khmer_validated_at`; không thêm bảng, edit log, history hay inline editor.
---

## 8. Phase 4 structure thực tế (2026-07-21)

Phần này thay thế các placeholder `ai/`, `storage/` và ghi chú Gate G4 chưa chốt ở trên.

- Backend: `src/katha/features/story_images/` chứa router, service, schemas, models, prompts, ports, dependencies và runner.
- Integrations: `integrations/openai_story_images.py` và `integrations/r2_storage.py` là adapter cho plan/image và R2 safe reference/WebP output.
- Frontend: `src/features/story-images/` và route `app/admin/stories/[storyKey]/images/` hiển thị plan, mapping và polling progress.
- Execution: `BackgroundTasks` chỉ schedule runner; runner lấy session riêng, chạy sequential và fencing bằng UUID claim/heartbeat.
- Boundary: manual page regeneration là Phase 5; Docker/live provider smoke vẫn deferred.

## 9. Phase 5 structure thực tế (2026-07-26)

- Backend: `features/story_review/{router,schemas,service,runner,prompts}.py` sở hữu review, regeneration, publish/share; `features/public_stories/` sở hữu projection reader; migration `006_story_review_publish.py` là schema head.
- Frontend: `features/story-review/` là admin workspace; `features/reader/` là public reader; routes canonical là `/admin/stories/[storyKey]/review` và `/stories/[shareToken]`.
- Tests: `test_phase5_review_and_publish.py` giữ offline contract nhỏ; `test_phase5_integration.py` chứa PostgreSQL mutation/race/share/fencing. Hook specs nằm cạnh `useStoryReview` và `usePublicStory`.
