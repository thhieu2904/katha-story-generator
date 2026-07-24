# Phase 4.5 — Workflow UX Refinement — Implementation Guide

> **Trạng thái**: READY FOR DEV
> **Ngày lập**: 2026-07-24
> **Phạm vi**: tối ưu luồng admin story creation, frontend-only
> **Mức độ hoàn thiện**: P0 (bắt buộc) + P1 (polish)
> **Backend**: KHÔNG THAY ĐỔI — không migration, không endpoint mới
> **Thời gian ước lượng**: 2.5–3.5 ngày dev frontend quen repo

---

## Mục lục

1. [Bối cảnh và mục tiêu](#1-bối-cảnh-và-mục-tiêu)
2. [Baseline codebase hiện tại](#2-baseline-codebase-hiện-tại)
3. [Ràng buộc phải giữ](#3-ràng-buộc-phải-giữ)
4. [Kiến trúc tổng quan](#4-kiến-trúc-tổng-quan)
5. [Slice 1 — Presentation Foundation](#5-slice-1--presentation-foundation)
6. [Slice 2 — Setup & Text Journey](#6-slice-2--setup--text-journey)
7. [Slice 3 — Image Workspace](#7-slice-3--image-workspace)
8. [Slice 4 — Hardening & Acceptance](#8-slice-4--hardening--acceptance)
9. [Terminology Cleanup](#9-terminology-cleanup)
10. [Mobile & Responsive Policy](#10-mobile--responsive-policy)
11. [Accessibility Requirements](#11-accessibility-requirements)
12. [Test Matrix](#12-test-matrix)
13. [Manual Acceptance Scenarios](#13-manual-acceptance-scenarios)
14. [Quality Gates](#14-quality-gates)
15. [Definition of Done](#15-definition-of-done)
16. [Review Blockers](#16-review-blockers)
17. [Handoff sang Phase 5](#17-handoff-sang-phase-5)

---

## 1. Bối cảnh và mục tiêu

### 1.1 Vấn đề

Luồng admin hiện tại đúng về nghiệp vụ nhưng UI phơi quá nhiều checkpoint kỹ thuật. Happy path cần khoảng 9 lượt bấm trước khi ảnh bắt đầu được tạo:

```
Tạo truyện → Lưu bản nháp → Sinh nội dung → Xác nhận nội dung
→ Xác nhận trong modal → Tiếp tục chuẩn bị minh họa → Tạo kế hoạch minh họa
→ Bắt đầu sinh ảnh → Xác nhận trong modal
```

Các vấn đề cụ thể:
- Sau tạo draft, màn hình lặp lại toàn bộ form vừa nhập
- Primary CTA lúc cuối form, lúc đầu trang, lúc trước nội dung cần kiểm tra
- Editor có thể dài 4–14 trang nhưng CTA xác nhận chỉ nằm cuối
- Mapping nằm theo từng trang ở dưới, nút lưu/start nằm phía trên
- Khi sinh ảnh, `0/N` giữ nguyên vài phút, trông giống job bị treo
- Main UI dùng nhiều từ kỹ thuật: `mapping`, `image plan revision`, `job stale`, `reclaim`

### 1.2 Mục tiêu

Triển khai workflow shell 4 bước và action bar nhất quán:

```
1. Thiết lập → 2. Nội dung → 3. Minh họa → 4. Duyệt & xuất bản
```

Sau khi điền form, happy path còn **5 lượt bấm**, giữ 2 confirmation có ý nghĩa (khóa text + start image):

```
Tạo và sinh nội dung
→ Xác nhận và chuẩn bị minh họa (+ modal khóa text)
→ Bắt đầu sinh N ảnh (+ modal image operation)
→ Theo dõi gallery/progress
→ Sẵn sàng human review
```

### 1.3 Không làm

- Không đặt mục tiêu ETA chính xác cho OpenAI
- Không giả lập phần trăm tiến độ bên trong một image operation
- Không thêm queue/Celery/Redis
- Không thêm analytics, onboarding tour
- Không tạo route/API review/publish giả (thuộc Phase 5)

---

## 2. Baseline codebase hiện tại

### 2.1 Tech stack

| Thành phần | Version/Chi tiết |
|---|---|
| Framework | Next.js 16.2.10 (App Router, Turbopack dev) |
| React | 19.1.0 |
| TypeScript | 5.x |
| Styling | Tailwind CSS v4 (utility-first, `@tailwindcss/postcss`) |
| Fonts | Inter (Latin), Noto Sans Khmer |
| Test | Vitest 4.1.10 + @testing-library/react 16.3.2 + jsdom 28.1.0 |
| Auth | Supabase Auth |
| API client | Custom `apiFetch<T>` wrapper với auto-auth, timeout, AbortController |
| Path alias | `@/*` → `./src/*` |

### 2.2 Design tokens (globals.css)

```css
--color-katha-primary:       oklch(0.65 0.15 250)
--color-katha-primary-light: oklch(0.75 0.12 250)
--color-katha-surface:       oklch(0.17 0.01 250)
--color-katha-surface-light: oklch(0.22 0.015 250)
--color-katha-accent:        oklch(0.75 0.15 150)
--color-katha-success:       oklch(0.72 0.17 150)
--color-katha-warning:       oklch(0.80 0.15 85)
--color-katha-error:         oklch(0.65 0.2 25)
```

### 2.3 Cấu trúc frontend hiện tại

```
frontend/src/
├── app/
│   ├── layout.tsx                          # Root layout (Inter + NotoSansKhmer fonts, AuthProvider)
│   ├── globals.css                         # Tailwind v4 + Katha tokens
│   ├── admin/
│   │   ├── layout.tsx                      # RequireAdmin guard + AdminHeader
│   │   └── stories/
│   │       ├── page.tsx                    # Story list
│   │       ├── new/page.tsx                # Create story (60 lines)
│   │       └── [id]/
│   │           ├── setup/page.tsx          # Setup/edit draft (224 lines)
│   │           ├── edit/page.tsx           # Text editor (21 lines, delegates to StoryTextEditor)
│   │           └── images/page.tsx         # Image workspace (26 lines, delegates to StoryImageWorkspace)
├── components/
│   └── layout/
│       └── AdminHeader.tsx                 # Sticky top nav: brand + nav links + user/logout
├── features/
│   ├── auth/                               # Supabase auth, RequireAdmin
│   ├── characters/                         # Character catalog CRUD
│   ├── stories/
│   │   ├── api.ts                          # fetchStories, fetchStory, createStory, updateStory, archiveStory, generateStoryText
│   │   ├── types.ts                        # Story, StoryStatus, StoryCreateInput, etc.
│   │   ├── routes.ts                       # getStoryWorkflowHref, getStoryWorkflowLabel, isImageWorkflowStatus
│   │   ├── routes.test.ts                  # Parameterized table tests
│   │   └── components/
│   │       ├── StorySetupForm.tsx           # Full setup form (461 lines)
│   │       ├── StoryListItem.tsx            # Story card with status CTA
│   │       └── ArchiveStoryDialog.tsx       # Archive confirmation modal
│   ├── story-editor/
│   │   ├── useStoryEditor.ts               # Hook: story+text fetch, polling, mutations, confirm
│   │   └── components/
│   │       ├── StoryTextEditor.tsx          # Editor UI (228 lines)
│   │       ├── ConfirmTextDialog.tsx        # Text lock confirmation modal
│   │       ├── StoryPageCard.tsx            # Individual page display
│   │       ├── SortablePageList.tsx         # Drag-and-drop page reorder
│   │       ├── QuickActions.tsx             # AI quick action buttons
│   │       ├── InstructionBox.tsx           # Custom AI instruction input
│   │       ├── AddPageButton.tsx            # Add new page
│   │       ├── DeletePageDialog.tsx         # Page deletion confirmation
│   │       └── SpellcheckFlags.tsx          # Khmer validation indicators
│   └── story-images/
│       ├── api.ts                           # fetchStoryImages, createImagePlan, saveImagePlanMapping, startImageGeneration
│       ├── types.ts                         # StoryImagesState, StoryImagePage, progress types
│       ├── useStoryImages.ts                # Hook: image state, polling, mapping draft, capabilities
│       └── components/
│           ├── StoryImageWorkspace.tsx       # Main workspace (298 lines)
│           ├── ImageGenerationProgress.tsx   # Progress bar + stats grid
│           ├── ImagePlanCard.tsx             # Per-page plan display (65 lines)
│           ├── CharacterMapping.tsx          # Character checkbox selector per page
│           ├── GeneratedImageCard.tsx        # Image display with fallback
│           └── StartImageGenerationDialog.tsx# Start/retry/resume confirmation modal
├── lib/
│   ├── api.ts                               # apiFetch<T>, ApiError, safeErrorMessage
│   └── supabase.ts                          # Supabase client
└── test/
    └── setup.ts                             # Vitest setup + cleanup
```

### 2.4 Hiện trạng routing/navigation

Mỗi admin story page hiện tự render:
- Header/breadcrumb riêng (`← Quay lại danh sách`)
- Title + status badge riêng
- CTA buttons riêng ở các vị trí khác nhau
- Redirect logic riêng dựa trên `story.status`

**Không có shared layout** giữa các story pages (ngoài `AdminLayout` chung cho toàn bộ `/admin/*`).

### 2.5 Workflow routing hiện tại (`routes.ts`)

```ts
// getStoryWorkflowHref mapping:
'draft'             → /admin/stories/${id}/setup
'generating_text'   → /admin/stories/${id}/edit
'text_draft'        → /admin/stories/${id}/edit
'text_confirmed'    → /admin/stories/${id}/images
'generating_images' → /admin/stories/${id}/images
'pending_review'    → /admin/stories/${id}/images  // Phase 5 sẽ đổi → /review
'approved'          → /admin/stories/${id}/images  // Phase 5 sẽ đổi → /review
'published'         → /admin/stories/${id}/images  // Phase 5 sẽ đổi → /review
'archived'          → /admin/stories
```

### 2.6 CTA placement hiện tại (cần thay đổi)

| Page | CTA vị trí | Vấn đề |
|---|---|---|
| `/new` | Bottom-right trong form | OK nhưng chỉ có `Lưu bản nháp`, không có 1-click create+generate |
| `/setup` | Header right (`Lưu trữ`) + form footer (`Cập nhật`, `Sinh nội dung`) | CTA phân tán 2 vị trí |
| `/edit` | Header right (`Dịch lại Khmer`) + bottom-right (`Xác nhận nội dung`) + confirmed banner (`Tiếp tục chuẩn bị minh họa`) | 3 vị trí CTA khác nhau, confirm button ẩn nếu 14 trang |
| `/images` | Top area (`Tạo kế hoạch`, `Lưu mapping`) + middle card (`Bắt đầu sinh ảnh`) | CTA ở giữa trang, mapping controls ở dưới |

---

## 3. Ràng buộc phải giữ

### 3.1 Backend invariants — KHÔNG ĐƯỢC VI PHẠM

- Backend là authority cho story status, revision, capability
- Text generation: `draft → generating_text → text_draft`
- Confirm text: `text_draft → text_confirmed`, khóa nội dung
- Image plan dùng `expected_text_revision` và `expected_image_plan_revision`
- Lưu mapping tăng `image_plan_revision`
- Start/retry/resume/finalization dùng endpoint và capability hiện tại
- Ảnh completed không bị sinh lại khi retry/resume
- Timeout, mất ACK hoặc `409` phải canonical reread/reconcile
- Poll text và image giữ chu kỳ 3 giây
- Modal khóa text và modal xác nhận image operation **phải tồn tại**

### 3.2 Kiến trúc — KHÔNG ĐƯỢC VI PHẠM

- Giữ route độc lập để refresh, deep-link và resume được
- **Không tạo** `useStoryWizard()` quản lý mọi mutation/polling
- Shared workflow layer chỉ làm **presentation, navigation, orchestration**
- Không sao chép business state machine backend sang nhiều component
- Không thêm UI framework mới
- Không thêm DB migration hoặc endpoint backend
- Không render nested `<main>` — mỗi route chỉ có đúng một landmark `<main>`

### 3.3 Ranh giới Phase 5

- `pending_review`, `approved`, `published` tạm dùng `/images` vì `/review` chưa tồn tại
- Stepper hiển thị bước 4 nhưng **không được tạo nút approve/reject/publish giả**
- Khi Phase 5 triển khai, chỉ đổi route mapping + gắn workspace mới vào shell

---

## 4. Kiến trúc tổng quan

### 4.1 Module mới: `story-workflow`

```
frontend/src/features/story-workflow/
├── types.ts                    # WorkflowPresentation, WorkflowStepKey, WorkflowRouteMode, WorkflowTransitionResult
├── workflow.ts                 # Pure functions: mapping status → step/route/label/mode
├── workflow.test.ts            # Table-driven tests cho mọi status
├── orchestration.ts            # Shared multi-step chains (create→generate, confirm→plan, save→start)
├── orchestration.test.ts       # Failure case tests cho mọi chain
└── components/
    ├── StoryWorkflowShell.tsx   # Layout wrapper cho tất cả admin story pages
    ├── StoryWorkflowStepper.tsx # 4-step progress indicator
    ├── WorkflowHeader.tsx       # Breadcrumb + story title + status
    ├── WorkflowActionBar.tsx    # Sticky bottom action bar
    ├── WorkflowStateMessage.tsx # Contextual banner messages
    └── StorySetupSummary.tsx    # Compact read-only setup display
```

### 4.2 Files chỉnh sửa

```
# Route pages — bọc vào Shell, bỏ header/breadcrumb trùng
frontend/src/app/admin/stories/new/page.tsx
frontend/src/app/admin/stories/[id]/setup/page.tsx
frontend/src/app/admin/stories/[id]/edit/page.tsx
frontend/src/app/admin/stories/[id]/images/page.tsx

# Feature components — CTA chuyển vào action bar, bỏ navigation riêng
frontend/src/features/stories/routes.ts
frontend/src/features/stories/routes.test.ts
frontend/src/features/stories/components/StorySetupForm.tsx
frontend/src/features/stories/components/StoryListItem.tsx
frontend/src/features/story-editor/components/StoryTextEditor.tsx
frontend/src/features/story-images/useStoryImages.ts
frontend/src/features/story-images/components/StoryImageWorkspace.tsx
frontend/src/features/story-images/components/ImageGenerationProgress.tsx
frontend/src/features/story-images/components/ImagePlanCard.tsx

# New image components
frontend/src/features/story-images/components/ImagePageProgressGrid.tsx
frontend/src/features/story-images/components/ImagePlanCompactRow.tsx
```

### 4.3 Visual layout mục tiêu

```
┌──────────────────────────────────────────────────────────────┐
│  AdminHeader (sticky top, z-20)                              │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐  │
│  │  WorkflowHeader                                        │  │
│  │  ← Quay lại danh sách              [Story Title]       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  StoryWorkflowStepper                                  │  │
│  │  [✓ Thiết lập] ── [● Nội dung] ── [○ Minh họa] ── [○] │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  {children} — page-specific content                    │  │
│  │  (form / editor / image workspace)                     │  │
│  │                                                        │  │
│  │  ← bottom padding cho action bar →                     │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  WorkflowActionBar (fixed bottom, z-40)                      │
│  [Status/dirty info]              [Secondary]  [Primary CTA] │
│  padding-bottom: env(safe-area-inset-bottom)                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Slice 1 — Presentation Foundation

> **Commit gợi ý**: `Phase 4.5: Thêm workflow shell và điều hướng thống nhất`
> **Không làm API orchestration** trong slice này — chỉ presentation/navigation.

### 5.1 `types.ts`

```ts
// frontend/src/features/story-workflow/types.ts

export type WorkflowStepKey = 'setup' | 'text' | 'images' | 'review';

export interface WorkflowStep {
  key: WorkflowStepKey;
  number: 1 | 2 | 3 | 4;
  label: string;            // "Thiết lập", "Nội dung", "Minh họa", "Duyệt & xuất bản"
}

export const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  { key: 'setup',  number: 1, label: 'Thiết lập' },
  { key: 'text',   number: 2, label: 'Nội dung' },
  { key: 'images', number: 3, label: 'Minh họa' },
  { key: 'review', number: 4, label: 'Duyệt & xuất bản' },
] as const;

export type WorkflowStepState = 'completed' | 'current' | 'locked' | 'future';

export interface WorkflowPresentation {
  currentStep: 1 | 2 | 3 | 4;
  currentKey: WorkflowStepKey;
  stepStates: Record<WorkflowStepKey, WorkflowStepState>;
  canonicalHref: string;
  allowedReadOnlyHrefs: string[];   // routes cho completed steps mà user được phép xem
  resumeLabel: string;
  showStepper: boolean;             // false cho archived
}

export type WorkflowRouteMode = 'current' | 'historical_readonly' | 'redirect';

/**
 * Discriminated result cho multi-step orchestration.
 * Bắt buộc phân biệt:
 * - Bước đầu chưa commit
 * - Bước đầu đã commit nhưng bước sau lỗi
 * - Mutation outcome không chắc chắn + canonical reread thành công
 * - Mutation outcome không chắc chắn + canonical reread cũng lỗi
 */
export type WorkflowTransitionResult<T> =
  | { kind: 'success'; canonical: T; nextHref: string }
  | { kind: 'partial'; canonical: T; message: string; nextHref: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'failed'; message: string };
```

### 5.2 `workflow.ts`

Pure function module. **Quy tắc**: không fetch, không mutation, không đọc router, không tự suy capability phức tạp.

```ts
// frontend/src/features/story-workflow/workflow.ts

import type { WorkflowPresentation, WorkflowRouteMode, WorkflowStepKey, WorkflowStepState } from './types';

/**
 * Map story status → WorkflowPresentation.
 * Đây là source of truth duy nhất cho route, step, label.
 *
 * Future-compatible: nhận thêm signals từ Phase 5 nhưng KHÔNG tự suy logic Phase 5.
 */
export function getWorkflowPresentation(
  storyId: number,
  status: string,
  options?: {
    imageWorkflowKind?: 'initial' | 'review_regeneration' | null;
    activeImageRegenerationPageId?: number | null;
  }
): WorkflowPresentation {
  // Implementation: switch on status, return correct step/route/label
  // Archived → showStepper: false
  // Unknown → fail-safe redirect /admin/stories
}

/**
 * Phân loại requested route so với canonical presentation.
 */
export function getWorkflowRouteMode(
  presentation: WorkflowPresentation,
  requestedPath: string,
): WorkflowRouteMode {
  // requestedPath === canonicalHref → 'current'
  // requestedPath in allowedReadOnlyHrefs → 'historical_readonly'
  // else → 'redirect'
}

/**
 * Thay thế getStoryWorkflowHref hiện tại.
 */
export function getCanonicalHref(storyId: number, status: string): string { ... }

/**
 * Thay thế getStoryWorkflowLabel hiện tại.
 */
export function getResumeLabel(status: string): string { ... }

/**
 * Thay thế isImageWorkflowStatus hiện tại.
 */
export function isImageWorkflowStatus(status: string): boolean { ... }
```

**Mapping table bắt buộc**:

| Status | Step | Key | Canonical Route | Resume Label | Completed Steps |
|---|---|---|---|---|---|
| (no story) | 1 | setup | `/admin/stories/new` | — | [] |
| `draft` | 1 | setup | `/admin/stories/{id}/setup` | Tiếp tục thiết lập | [] |
| `generating_text` | 2 | text | `/admin/stories/{id}/edit` | Xem tiến độ nội dung | [setup] |
| `text_draft` | 2 | text | `/admin/stories/{id}/edit` | Tiếp tục biên tập | [setup] |
| `text_confirmed` | 3 | images | `/admin/stories/{id}/images` | Chuẩn bị minh họa | [setup, text] |
| `generating_images` | 3 | images | `/admin/stories/{id}/images` | Xem tiến độ ảnh | [setup, text] |
| `pending_review` | 4 | review | tạm `/admin/stories/{id}/images` | Sẵn sàng duyệt | [setup, text, images] |
| `approved` | 4 | review | tạm `/admin/stories/{id}/images` | Đã duyệt | [setup, text, images] |
| `published` | 4✅ | review | tạm `/admin/stories/{id}/images` | Quản lý chia sẻ | [setup, text, images, review] |
| `archived` | — | — | `/admin/stories` | — | showStepper: false |
| Unknown | — | — | `/admin/stories` | — | fail-safe |

### 5.3 `workflow.test.ts`

Table-driven tests bắt buộc:

```ts
it.each([
  ['draft',            1, 'setup',  '/admin/stories/42/setup',  'Tiếp tục thiết lập'],
  ['generating_text',  2, 'text',   '/admin/stories/42/edit',   'Xem tiến độ nội dung'],
  ['text_draft',       2, 'text',   '/admin/stories/42/edit',   'Tiếp tục biên tập'],
  ['text_confirmed',   3, 'images', '/admin/stories/42/images', 'Chuẩn bị minh họa'],
  ['generating_images',3, 'images', '/admin/stories/42/images', 'Xem tiến độ ảnh'],
  ['pending_review',   4, 'review', '/admin/stories/42/images', 'Sẵn sàng duyệt'],
  ['approved',         4, 'review', '/admin/stories/42/images', 'Đã duyệt'],
  ['published',        4, 'review', '/admin/stories/42/images', 'Quản lý chia sẻ'],
])('status=%s → step=%i, key=%s, href=%s, label=%s', ...)

it('archived → showStepper false, no workflow CTA')
it('unknown status → fail-safe redirect /admin/stories')
it('published → all 4 steps completed')

// Route mode tests
it('step 3 requesting /setup → historical_readonly')
it('step 3 requesting /edit → historical_readonly')
it('step 2 requesting /images → redirect')
it('step 2 requesting /edit → current')
```

### 5.4 `StoryWorkflowShell.tsx`

```tsx
// frontend/src/features/story-workflow/components/StoryWorkflowShell.tsx

interface StoryWorkflowShellProps {
  storyId?: number;           // undefined cho /new
  storyTitle?: string;
  status?: string;            // undefined cho /new
  children: React.ReactNode;
  actionBar?: React.ReactNode; // content cho sticky bar
  readOnly?: boolean;
}

export function StoryWorkflowShell({ ... }: StoryWorkflowShellProps) {
  const presentation = status && storyId
    ? getWorkflowPresentation(storyId, status)
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-28 pt-8 sm:px-8 sm:pt-12">
      {/* WorkflowHeader — back link + title */}
      <WorkflowHeader storyTitle={storyTitle} />

      {/* StoryWorkflowStepper — 4 steps */}
      {presentation?.showStepper !== false && (
        <StoryWorkflowStepper
          presentation={presentation}
          storyId={storyId}
        />
      )}

      {/* Page content */}
      <main>
        {children}
      </main>

      {/* Sticky action bar */}
      {actionBar && (
        <WorkflowActionBar>
          {actionBar}
        </WorkflowActionBar>
      )}
    </div>
  );
}
```

**Shell sở hữu**: breadcrumb, title, stepper, layout width/padding, bottom padding cho action bar.

**Shell KHÔNG sở hữu**: story fetch/poll, form state, text mutation, image mapping, modal state, backend capability rules.

### 5.5 `StoryWorkflowStepper.tsx`

Desktop rendering:

```
┌──────────────────────────────────────────────────────────┐
│ [✓] Thiết lập ──── [●] Nội dung ──── [○] Minh họa ──── [○] Duyệt & xuất bản │
└──────────────────────────────────────────────────────────┘
```

Mobile rendering:

```
┌──────────────────────┐
│ Bước 2/4 · Nội dung  │
└──────────────────────┘
```

Yêu cầu chi tiết:

- Container: `<nav aria-label="Tiến trình tạo truyện">`
- Steps: `<ol>` → `<li>` cho mỗi step
- Current step: `aria-current="step"` — **đúng một** step có attribute này
- State indicators — **phân biệt không chỉ bằng màu**:
  - ✅ Completed: check icon + emerald color + text label
  - ● Current: filled circle + primary color + bold text
  - ○ Future: empty circle + muted color + normal text
  - 🔒 Locked: lock icon (dùng khi step đã hoàn tất nhưng bị khóa không quay lại edit)
- Completed step: render `<Link>` tới route read-only hợp lệ (e.g. `/setup`, `/edit`)
- Future step: **không interactive** — không link, không button, không tab
- Published: đủ 4 steps hiển thị completed
- Archived: **không render** stepper
- Connector lines giữa steps: `border-katha-primary` cho completed, `border-white/20` cho future
- Responsive: dùng `hidden md:flex` cho desktop, `md:hidden` cho mobile compact

### 5.6 `WorkflowHeader.tsx`

```tsx
interface WorkflowHeaderProps {
  storyTitle?: string;
}

export function WorkflowHeader({ storyTitle }: WorkflowHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <Link
        href="/admin/stories"
        className="text-sm text-white/60 hover:text-white transition-colors"
      >
        ← Quay lại danh sách
      </Link>
      {storyTitle && (
        <h1 className="text-lg font-semibold text-white truncate max-w-md">
          {storyTitle}
        </h1>
      )}
    </div>
  );
}
```

### 5.7 `WorkflowActionBar.tsx`

```tsx
interface WorkflowActionBarProps {
  children: React.ReactNode;
}

export function WorkflowActionBar({ children }: WorkflowActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-katha-surface/95 backdrop-blur-xl"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        {children}
      </div>
    </div>
  );
}
```

Yêu cầu:
- `z-index: 40` — dưới modal (`z-50`), trên nội dung
- Background: blur/contrast đủ đọc trên nền tối
- Desktop: left side info, right side buttons
- Mobile: primary button full-width
- `padding-bottom: env(safe-area-inset-bottom)` cho iOS notch
- Parent content phải có `pb-28` (hoặc tương đương) để action bar không che content cuối

### 5.8 `WorkflowStateMessage.tsx`

Contextual banner component:

```tsx
interface WorkflowStateMessageProps {
  variant: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}
```

### 5.9 `StorySetupSummary.tsx`

Compact read-only summary cho bước setup đã hoàn tất:

```tsx
interface StorySetupSummaryProps {
  story: Story;
}
```

Hiển thị:
- Description (truncated nếu dài)
- Characters: chips với thumbnail + name
- Backbone, Genre, Art Style: label badges
- Target Age, Length: info pills
- **Không render form controls** — chỉ display

### 5.10 Chỉnh sửa `routes.ts`

```ts
// frontend/src/features/stories/routes.ts
// Re-export từ workflow module để giữ backward compatibility

export {
  getCanonicalHref as getStoryWorkflowHref,
  getResumeLabel as getStoryWorkflowLabel,
  isImageWorkflowStatus,
} from '@/features/story-workflow/workflow';
```

### 5.11 Chỉnh sửa `StoryListItem.tsx`

- Import `getResumeLabel` và `getCanonicalHref` từ workflow module
- Resume label dùng mapping mới (e.g. `Sẵn sàng duyệt` thay vì `Xem minh họa`)
- Giữ layout card hiện tại, chỉ đổi label text

### 5.12 Bọc 4 pages vào Shell

**Mỗi page** cần:
1. Import `StoryWorkflowShell`
2. Bỏ header/breadcrumb riêng lẻ
3. Bỏ `<main>` wrapper riêng (shell có rồi)
4. Truyền `actionBar` slot với CTA buttons phù hợp
5. Giữ logic fetch/mutation/redirect hiện tại

Ví dụ cho `edit/page.tsx`:

```tsx
export default function StoryTextEditorPage() {
  // ... existing storyId validation ...
  return <StoryTextEditorWithShell storyId={storyId} />;
}

function StoryTextEditorWithShell({ storyId }: { storyId: number }) {
  const editor = useStoryEditor(storyId);

  // ... existing redirect logic ...

  return (
    <StoryWorkflowShell
      storyId={storyId}
      storyTitle={editor.story?.title_vi}
      status={editor.story?.status}
      actionBar={/* action buttons based on state */}
    >
      {/* StoryTextEditor content without header/breadcrumb */}
    </StoryWorkflowShell>
  );
}
```

### 5.13 Acceptance — Slice 1

- [ ] Có đúng một `aria-current="step"` khi workflow chưa completed
- [ ] Current/completed/locked không chỉ phân biệt bằng màu
- [ ] Future step không interactive
- [ ] Completed step chỉ link khi route read-only hợp lệ
- [ ] Published hiển thị đủ 4 bước completed
- [ ] Archived không render stepper
- [ ] Direct navigation `/setup` ở downstream status → read-only hoặc redirect đúng
- [ ] Story list dùng cùng mapping với shell
- [ ] Action bar luôn nhìn thấy, không che content cuối
- [ ] Không nested `<main>` landmark
- [ ] Desktop + mobile stepper render đúng
- [ ] `npm run test -- --run` pass
- [ ] `npx tsc --noEmit` pass

---

## 6. Slice 2 — Setup & Text Journey

> **Commit gợi ý**: `Phase 4.5: Rút gọn luồng thiết lập và xác nhận nội dung`

### 6.1 `orchestration.ts`

```ts
// frontend/src/features/story-workflow/orchestration.ts

import type { WorkflowTransitionResult } from './types';
import type { Story } from '@/features/stories/types';
import type { StoryImagesState } from '@/features/story-images/types';

/**
 * Gộp create + generate thành 1 intent.
 * Mỗi API vẫn commit/reconcile độc lập.
 */
export async function orchestrateCreateAndGenerate(
  formData: StoryCreateInput,
): Promise<WorkflowTransitionResult<Story>> { ... }

/**
 * Gộp confirm text + create image plan.
 */
export async function orchestrateConfirmAndPrepare(
  storyId: number,
  textRevision: number,
  acknowledge: boolean,
): Promise<WorkflowTransitionResult<StoryImagesState>> { ... }

/**
 * Gộp save mapping (nếu dirty) + start generation.
 */
export async function orchestrateSaveAndStart(
  storyId: number,
  mappingDirty: boolean,
  mappingPayload: StoryImageMappingInput[],
  currentRevision: number,
): Promise<WorkflowTransitionResult<StartImageGenerationResponse>> { ... }
```

### 6.2 `orchestrateCreateAndGenerate` — chi tiết

```
validate local form
  → POST createStory
  → nếu fail rõ ràng: return { kind: 'failed', message }
  → nếu network ambiguity TRƯỚC KHI có story ID:
      return { kind: 'blocked', message: 'Bản nháp có thể đã được tạo. Vui lòng kiểm tra danh sách truyện.' }
      ⚠️ Không auto retry create — POST chưa có idempotency key
  → lưu storyId từ response
  → POST generateStoryText(storyId)
  → nếu success/running:
      return { kind: 'success', canonical: story, nextHref: `/admin/stories/${storyId}/edit` }
  → nếu fail rõ ràng, canonical vẫn draft:
      return { kind: 'partial', canonical: story, message: '...', nextHref: `/admin/stories/${storyId}/setup` }
  → nếu timeout, reconcile canonical:
      if status === 'generating_text' | 'text_draft':
        return { kind: 'success', ... nextHref: `/edit` }
      if status === 'draft':
        return { kind: 'partial', ... nextHref: `/setup` }
  → nếu reconcile cũng fail:
      return { kind: 'blocked', message: 'Không thể kiểm tra trạng thái. Vui lòng thử lại.' }
```

**Quy tắc bắt buộc**:
- Create fail → **không gọi generate**
- Create response đã trả ID → mọi retry chỉ retry generation, **không create lại**
- Không navigate rồi fire-and-forget generation
- Refresh/back không auto gửi create/generate lần hai — page load chỉ fetch canonical state
- Double click/Enter lặp không tạo hai request
- `useEffect` hoặc query flag **không được tự kích hoạt mutation**

### 6.3 `orchestrateConfirmAndPrepare` — chi tiết

```
confirmStoryText(storyId, { expected_text_revision, acknowledge })
  → nếu fail: return { kind: 'failed', message }. Không gọi image plan.
  → nếu success:
      editor chuyển read-only
      fetchStoryImages(storyId) để lấy canonical text_revision + image_plan_revision
      → createImagePlan(storyId, { expected_text_revision, expected_image_plan_revision })
      → nếu plan success:
          return { kind: 'success', canonical: imagesState, nextHref: `/images` }
      → nếu plan fail:
          return { kind: 'partial', canonical: imagesState,
                   message: 'Nội dung đã được xác nhận; kế hoạch minh họa chưa tạo được.',
                   nextHref: `/images` }
      → nếu plan timeout, reconcile:
          if plan ready: return success
          else: return partial
      → nếu reconcile fail:
          return { kind: 'blocked', message: '...' }
```

**Quy tắc bắt buộc**:
- Confirm fail → **không gọi image plan**
- Confirm success + plan fail → text vẫn `text_confirmed`. **Không báo "xác nhận thất bại"**
- CTA tiếp theo: `Thử lại chuẩn bị minh họa` — **không yêu cầu confirm text lần nữa**
- Không hard-code image-plan revision `0`
- Refresh/back sau confirm chỉ fetch canonical — không auto-call plan từ `useEffect`

### 6.4 Chỉnh sửa `new/page.tsx`

Action bar content:
- Left: (empty hoặc step info)
- Right:
  - Secondary: `Chỉ lưu nháp` — gọi `createStory` only, route `/setup`
  - Primary: `Tạo và sinh nội dung` — gọi `orchestrateCreateAndGenerate`

Transitional presentation:
- Ngay khi create response thành công, shell chuyển local step sang 2 với copy `Đã lưu bản nháp · đang tạo nội dung`
- Không navigate/unmount request generation đang chạy chỉ để đổi stepper
- Khi settle → route `/edit` hoặc `/setup`

### 6.5 Chỉnh sửa `setup/page.tsx`

Khi `status === 'draft'`:
- Action bar: Secondary `Lưu thay đổi` + Primary `Lưu và sinh nội dung`
- Helper copy dưới primary: `Thiết lập hiện tại sẽ được lưu trước khi tạo nội dung.`

Khi `status !== 'draft'`:
- Render `StorySetupSummary` read-only thay vì `StorySetupForm` disabled
- Không render form controls, không render submit buttons
- Action bar: context-dependent (có thể là link `Quay lại bước hiện tại`)

### 6.6 Chỉnh sửa `StorySetupForm.tsx`

- **Bỏ footer action buttons** (L434-461) — CTA chuyển lên action bar
- Form expose validation + submit qua callback/ref cho parent page
- Invalid submit: focus/scroll tới field lỗi đầu tiên
- Field error liên kết bằng `aria-describedby`
- Character và art-style card: dùng native input/label hoặc button/radio semantics — **không dùng clickable `div` không keyboard-accessible**
- Config loading/error không xóa input người dùng đã nhập
- Mobile compact: hiển thị đúng backbone, genre, art style, target age, length đang chọn — **không lấy phần tử config đầu tiên làm hidden default**

### 6.7 Chỉnh sửa `StoryTextEditor.tsx`

Bỏ:
- Header breadcrumb (`← Quay lại danh sách` + `Xem thiết lập`) — shell lo
- `Tiếp tục chuẩn bị minh họa` link trong confirmed banner — action bar lo
- `Xác nhận nội dung` button ở footer — chuyển lên action bar

Action bar content theo state:

| State | Left info | Primary action |
|---|---|---|
| `generating_text` | `Đang sinh nội dung song ngữ…` | Không CTA mutation |
| `text_draft` | Page count + revision | `Xác nhận và chuẩn bị minh họa` |
| Confirm pending | — | `Đang xác nhận nội dung…` (disabled) |
| Plan pending | — | `Đang chuẩn bị minh họa…` (disabled) |
| `text_confirmed` (read-only) | `Nội dung đã xác nhận` | Không edit action |

Primary CTA `Xác nhận và chuẩn bị minh họa` → mở `ConfirmTextDialog` → sau confirm thành công gọi `orchestrateConfirmAndPrepare`.

P1: Page navigator/anchor compact cho editor nhiều trang — `<nav>` nhỏ liệt kê `Trang 1, 2, ... N` với anchor links.

### 6.8 `orchestration.test.ts`

Bắt buộc test mọi failure case:

**Create → Generate chain:**
- Create fail → không generate → return `failed`
- Create success + generate success → return `success` với `nextHref=/edit`
- Create success + generate fail + canonical `draft` → return `partial` với `nextHref=/setup`
- Generate timeout + canonical `generating_text` → return `success` với `nextHref=/edit`
- Generate uncertain + reconcile fail → return `blocked`
- Create network ambiguity trước story ID → return `blocked` với message kiểm tra danh sách

**Confirm → Plan chain:**
- Confirm fail → không prepare plan → return `failed`
- Confirm success + plan success → return `success` với `nextHref=/images`
- Confirm success + plan fail → return `partial` (text vẫn confirmed) với `nextHref=/images`
- Plan timeout + canonical plan ready → return `success`
- Plan uncertain + reconcile fail → return `blocked`

### 6.9 Acceptance — Slice 2

- [ ] New story: bấm `Tạo và sinh nội dung` → chỉ 1 story được tạo
- [ ] Bấm `Chỉ lưu nháp` → tạo draft, không gọi AI
- [ ] Create success + generate fail → draft tồn tại, CTA retry generation
- [ ] Existing draft: `Lưu và sinh nội dung` → save rồi generate
- [ ] Text editor: `Xác nhận và chuẩn bị minh họa` → modal → confirm → plan
- [ ] Confirm success + plan fail → route `/images` với thông báo plan chưa tạo được
- [ ] Retry plan không yêu cầu confirm text lần nữa
- [ ] Refresh/back không auto-fire mutation
- [ ] Double click không tạo duplicate
- [ ] Confirmed text: editor read-only, action bar không có edit CTA
- [ ] Setup read-only: `StorySetupSummary` compact, không form disabled
- [ ] Action bar luôn nhìn thấy dù 14 trang text

---

## 7. Slice 3 — Image Workspace

> **Commit gợi ý**: `Phase 4.5: Tối ưu mapping và tiến độ sinh ảnh`

### 7.1 `StoryImageWorkspace.tsx` — mode-based rendering

Image workspace phải render theo **mode** thay vì một layout cho mọi state:

| Mode | Khi nào | Hiển thị chính |
|---|---|---|
| `plan_missing` | `text_confirmed` + plan chưa có | CTA `Chuẩn bị minh họa` hoặc `Thử lại chuẩn bị minh họa` |
| `mapping_review` | Plan ready + chưa locked | Heading `Kiểm tra nhân vật từng trang`, page cards/rows, action bar |
| `generating` | `generating_images` | **Progress/gallery là primary**, text/prompt/mapping collapsed |
| `recovery` | Stale/error/can_resume/can_retry | Recovery copy/action theo canonical capability |
| `complete_readonly` | All images done / pending_review+ | Gallery read-only |

Bỏ:
- Header breadcrumb (`← Quay lại danh sách` + `Xem nội dung đã xác nhận`) — shell lo
- `<main>` wrapper — shell có
- Generation CTA card ở giữa trang — chuyển vào action bar
- `Lưu mapping` button ở header — chuyển vào action bar

### 7.2 Action bar content theo mode

| Mode | Left info | Secondary | Primary |
|---|---|---|---|
| `plan_missing` | `Nội dung đã xác nhận` | — | `Chuẩn bị minh họa` |
| `mapping_review` (clean) | — | — | `Bắt đầu sinh N ảnh` |
| `mapping_review` (dirty) | `Thay đổi nhân vật sẽ được lưu trước khi bắt đầu` | `Lưu thay đổi` | `Bắt đầu sinh N ảnh` |
| `generating` | `Đang tạo trang X · M/N ảnh hoàn tất` | — | Status only |
| `recovery` can_resume | `Quá trình tạo ảnh bị gián đoạn` | — | `Tiếp tục K ảnh còn lại` |
| `recovery` can_retry | `Có K ảnh cần thử lại` | — | `Thử lại K ảnh` |
| `recovery` finalize | `Ảnh đã được lưu, cần đồng bộ trạng thái` | — | `Đồng bộ kết quả` |
| `complete_readonly` | `Tất cả ảnh đã hoàn tất` | — | `Sẵn sàng duyệt` (placeholder Phase 5) |

### 7.3 `orchestrateSaveAndStart` — chi tiết

```
Khi user xác nhận modal:
  if mapping dirty:
    saveImagePlanMapping(storyId, currentRevision, completePagePayload)
    → nếu save fail: return { kind: 'failed' }. Không gọi start.
    → lấy canonical image_plan_revision từ save response
  else:
    dùng currentRevision đang có

  startImageGeneration(storyId, canonicalRevision)
  → nếu success: return { kind: 'success' }
  → nếu fail: return { kind: 'partial', message: 'Lựa chọn nhân vật đã lưu, quá trình tạo ảnh chưa bắt đầu.' }
  → nếu timeout/409, canonical generating: chuyển progress mode
  → nếu reconcile fail: return { kind: 'blocked' }
```

**Quy tắc bắt buộc**:
- Save fail → **không gọi start**
- Save success + start fail → **không rollback mapping**
- **Không start bằng revision cũ** trong closure sau save
- Blocked state **không gửi mutation**
- Double click/Enter lặp không tạo hai request

### 7.4 Chỉnh sửa `useStoryImages.ts`

- `saveMapping()`: trả canonical `StoryImagesState` (hoặc `{ success: boolean; state?: StoryImagesState }`) thay vì chỉ `boolean`
- `startGeneration()`: nhận `revision` parameter, dùng revision vừa persist
- Export thêm: active page info (page có `image_status === 'generating'`)

### 7.5 Chỉnh sửa `ImageGenerationProgress.tsx`

Thêm active page indicator:

```tsx
// Suy active page từ pages data
const activePage = pages.find(p => p.image_status === 'generating');

// Header status text
<p role="status" aria-live="polite">
  {activePage
    ? `Đang tạo trang ${activePage.page_no} · ${completed}/${total} ảnh hoàn tất`
    : status === 'generating_images'
      ? `Chuẩn bị trang tiếp theo · ${completed}/${total} ảnh hoàn tất`
      : `${completed}/${total} ảnh hoàn tất`}
</p>
```

Copy an toàn bên dưới progress:

```
Mỗi ảnh có thể mất vài phút.
Bạn có thể quay lại xem sau; các ảnh đã hoàn tất sẽ được giữ lại.
```

**Không hiển thị ETA giả.**

### 7.6 `ImagePageProgressGrid.tsx` (NEW)

Grid/list trạng thái N pages khi `generating`:

```tsx
interface ImagePageProgressGridProps {
  pages: StoryImagePage[];
}
```

Mỗi tile/card hiển thị 1 trong 4 trạng thái:

| Page status | Visual | Label |
|---|---|---|
| `pending` | Empty placeholder, muted border | `Đang chờ` |
| `generating` | Pulsing ring + primary accent, **nổi bật** | `Đang tạo` |
| `completed` | Thumbnail image, success border | `Hoàn tất` |
| `failed` | Error icon, error border | `Cần thử lại` |

- Active page (generating) nổi bật nhất + label `Trang X - Đang tạo`
- Completed image xuất hiện dần theo canonical poll
- P1: anchor `Đi tới trang đang xử lý` nếu danh sách dài
- Poll error giữ last-known progress/thumbnail — không quay về skeleton rỗng
- `aria-live="polite"` chỉ announce khi active page/count/status thay đổi

### 7.7 `ImagePlanCompactRow.tsx` (NEW — P1)

Compact page row thay thế full `ImagePlanCard` trong mapping_review mode:

```tsx
interface ImagePlanCompactRowProps {
  page: StoryImagePage;
  characters: StoryImageCharacter[];
  selectedCharacterIds: number[];
  mappingEditable: boolean;
  disabled: boolean;
  onMappingChange: (characterIds: number[]) => void;
}
```

Layout:
```
┌──────────────────────────────────────────────────────────┐
│ Trang 1 │ Mô tả cảnh ngắn...   │ [Char A] [Char B] [+] │
│          │ ▶ Xem nội dung và chi tiết kỹ thuật            │
└──────────────────────────────────────────────────────────┘
```

- Số trang + mô tả cảnh ngắn (Vietnamese text, truncated)
- Chip/thumbnail nhân vật đang chọn
- Mapping controls (expand)
- Expandable `Xem nội dung và chi tiết kỹ thuật` — Vietnamese, Khmer, English, prompt
- **Không mở sẵn** toàn bộ content cho mọi trang

### 7.8 Chỉnh sửa `ImagePlanCard.tsx`

- Collapse English plan/prompt mặc định (`<details>` bắt đầu đóng — đang đúng)
- **Ẩn** `image plan revision` khỏi UI chính — chỉ giữ trong expandable technical details
- Ẩn `Lần xử lý {count}` khỏi headline — chuyển vào technical details

### 7.9 Acceptance — Slice 3

- [ ] `plan_missing` mode: CTA `Chuẩn bị minh họa` trong action bar
- [ ] `mapping_review` dirty: helper text + secondary `Lưu thay đổi` + primary `Bắt đầu sinh N ảnh`
- [ ] Save mapping trước start, start dùng revision mới
- [ ] Save fail → không start
- [ ] Save success + start fail → mapping giữ, hiển thị lỗi
- [ ] Generating mode: progress grid là primary, text/mapping collapsed
- [ ] Active page hiển thị rõ kể cả khi `0/N` completed
- [ ] Completed thumbnail xuất hiện dần
- [ ] Recovery: đúng CTA theo canonical capability
- [ ] Poll error: giữ last-known state
- [ ] Complete: gallery read-only
- [ ] Compact row (P1): expandable, không mở sẵn mọi trang
- [ ] Action bar luôn thấy, không cuộn ngược

---

## 8. Slice 4 — Hardening & Acceptance

> **Commit gợi ý**: `Phase 4.5: Hoàn thiện kiểm thử và tài liệu UX`

- Sửa mọi terminology (xem §9)
- Responsive viewport matrix (xem §10)
- Accessibility fixes (xem §11)
- Full Vitest regression suite (xem §12)
- Manual browser scenarios (xem §13)
- Update documentation + handoff

---

## 9. Terminology Cleanup

Áp dụng cho **tất cả main UI** — internal status/revision có thể nằm trong expandable technical details.

| Không dùng trong main UI | Thay bằng |
|---|---|
| `Đã duyệt text` | `Đã xác nhận nội dung` |
| `Review mapping nhân vật` | `Kiểm tra nhân vật từng trang` |
| `Mapping nhân vật đã khóa` | `Lựa chọn nhân vật đã khóa` |
| `image plan revision` | Ẩn khỏi main UI |
| `Lần xử lý {count}` | Ẩn khỏi headline (giữ trong technical details) |
| `Job sinh ảnh bị gián đoạn` | `Quá trình tạo ảnh bị gián đoạn` |
| `reclaim job` | `Tiếp tục các ảnh còn lại` |
| `Band` | `Độ dài đã chọn` |
| `Lưu mapping` | `Lưu thay đổi` |
| `Tạo kế hoạch minh họa` | `Chuẩn bị minh họa` |
| `Hoàn tất trạng thái job ảnh` | `Đồng bộ kết quả` |
| `Sinh nội dung truyện` | `Sinh nội dung` |
| `Bắt đầu sinh minh họa` (dialog title) | `Bắt đầu sinh ảnh` |
| `Tiến độ minh họa` | `Tiến độ tạo ảnh` |

---

## 10. Mobile & Responsive Policy

### 10.1 Breakpoint definition

Mobile compact: `width < 768px` **HOẶC** `height < 600px`.

Phone xoay ngang `844x390`: **vẫn mobile compact** dù width > 768px vì height < 600px.

```css
/* Deep controls chỉ bật khi đồng thời đủ cả hai: */
@media (min-width: 768px) and (min-height: 600px) { ... }
```

**Không dùng user-agent** để phân biệt.

### 10.2 Mobile compact hỗ trợ (P0)

- Quick-create: description, characters, backbone, genre, art style, target age, length
- `Tùy chỉnh` mở accordion/bottom sheet
- Story list/resume
- Start text generation
- Xem text/ảnh/status, active page, tiến độ
- Foreground refresh, poll-error recovery, retry/resume/finalization
- Confirmation an toàn, touch target tối thiểu 44px
- Sticky action bar có safe-area padding
- Stepper mobile: `Bước 2/4 · Nội dung`

### 10.3 Deep controls — chỉ tablet/desktop

- Structural text edit/add/delete/reorder
- Image mapping chi tiết
- Khmer deep edit

Mobile mở direct deep route: nhận **read-only summary + progress + recovery** và hướng dẫn `Mở trên tablet hoặc máy tính để chỉnh sửa chi tiết`.

**Không 403**, không redirect loop, không gửi mutation chỉ vì resize/rotate/foreground.

### 10.4 Viewport test matrix

| Viewport | Scenario |
|---|---|
| 320 × 568 | Smallest phone portrait |
| 360 × 800 | Common Android |
| 390 × 844 | iPhone 14/15 |
| 667 × 375 | Phone landscape (mobile compact) |
| 844 × 390 | Large phone landscape (mobile compact vì height < 600) |
| 768 × 1024 | iPad portrait (deep controls OK) |
| 1280 × 720 | Small desktop |
| 1440 × 900 | Standard desktop |
| Browser zoom 200% | Accessibility check |

Kiểm tra:
- Không horizontal overflow
- Sticky action bar không che field cuối
- Modal dài scroll bên trong viewport
- Khmer text không bị cắt dòng
- Resize/rotate không reset state hoặc phát duplicate mutation

---

## 11. Accessibility Requirements

### Component-level

| Component | Requirement |
|---|---|
| Stepper | `<nav aria-label="Tiến trình tạo truyện">` + `<ol>`. Đúng một `aria-current="step"`. Status không phụ thuộc riêng màu |
| Action bar | Keyboard-accessible. `z-index` dưới modal. Không che content khi focus |
| Dialog/Modal | Accessible title (`aria-labelledby`), focus trap, Escape close (khi chưa pending), focus restore |
| Progress | `aria-live="polite"` chỉ announce meaningful change, `<progress>` có `aria-label` |
| Form errors | `aria-describedby` liên kết field ↔ error message |
| Character cards | Native `<input type="checkbox">` + `<label>` — **không dùng** clickable `<div>` |
| Art style cards | Native radio semantics |
| Focus | `focus-visible` không bị tắt |

### Screen reader flow

- Keyboard-only phải hoàn thành được happy path
- Reduced motion (`prefers-reduced-motion`) không làm mất thông tin trạng thái

---

## 12. Test Matrix

### 12.1 Workflow mapping (`workflow.test.ts`)

- Mọi known status → đúng step, completed/locked, canonical href, resume label
- Unknown status → fail-safe
- Archived → không workflow CTA, showStepper false
- `pending_review/approved/published` không trỏ `/review` trước khi route tồn tại
- Historical `/setup` và `/edit` downstream → `historical_readonly`
- Future/invalid route → `redirect`

### 12.2 Stepper/action bar

- Accessible nav name + đúng một `aria-current="step"`
- Future step không interactive
- Completed step không mở edit controls
- Tại mỗi state chỉ có **một workflow primary action**
- Modal mở thì background action không click/focus được
- Action pending disable ngay; double click/Enter không gọi mutation hai lần

### 12.3 Setup orchestration (`orchestration.test.ts`)

- `createStory` chạy trước `generateStoryText`
- Create fail → không generate
- Create success + generate fail → chỉ một draft tồn tại
- Timeout generation + canonical generating → route `/edit`
- Reconcile fail → blocked
- Existing draft: update chạy trước generate
- Secondary save không gọi AI
- Sau create commit, transitional presentation chuyển step 2
- Unmount/refresh/back không gửi create/generate lần hai

### 12.4 Text orchestration

- Confirm fail → không gọi create image plan
- Confirm success → fetch canonical image state trước plan
- Plan dùng đúng text/image-plan revision canonical
- Confirm success + plan fail → không hiện "xác nhận thất bại"
- Confirm success → route `/images`, không còn extra continue CTA
- Warning/unvalidated acknowledgment không regress
- Poll và editor mutation hiện tại không regress
- Sau confirm, transitional presentation chuyển step 3
- Refresh/back không auto-call image plan từ mount effect

### 12.5 Mapping/start

- Mapping clean → start trực tiếp sau modal confirm
- Mapping dirty → save rồi start đúng thứ tự
- Start dùng revision trả về từ save
- Save fail → không start
- Save success + start fail → mapping giữ
- Timeout/409 canonical generating → chuyển progress mode
- Blocked → không gửi mutation
- Retry/resume/finalization mode và modal hiện tại không regress

### 12.6 Progress/gallery

- Page `generating` hiển thị `Đang tạo trang X` kể cả completed = 0
- N tile khớp N pages
- Completed URL render thumbnail; failed/pending/generating có label riêng
- Poll error giữ last-known canonical state
- Null `updated_at` không crash
- Broken image fallback không regress
- `aria-live` không announce lại khi poll không đổi meaningful state

### 12.7 Route/list regressions

- Story list và workflow shell dùng cùng mapping
- Wrong deep-link → redirect canonical
- Back/forward không trigger orchestration lại
- Auth/admin guard không đổi
- Existing loading/error/retry paths vẫn pass

---

## 13. Manual Acceptance Scenarios

### Scenario A — Create và generate thành công

1. Mở `/admin/stories/new`
2. Điền setup hợp lệ
3. Xác nhận stepper ở bước 1, action bar luôn nhìn thấy
4. Bấm `Tạo và sinh nội dung` **một lần**
5. Xác nhận **chỉ một story** được tạo
6. UI chuyển bước 2 và phản ánh generating/text_draft đúng canonical state

### Scenario B — Create thành công, generation lỗi

1. Làm generation fail/timeout có kiểm soát
2. Xác nhận draft vẫn tồn tại, không duplicate
3. CTA chỉ retry generation, không create lại

### Scenario C — Text confirm và plan partial failure

1. Confirm text draft
2. Làm image plan fail
3. Xác nhận text vẫn `text_confirmed` và read-only
4. `/images` nói rõ plan chưa tạo được
5. Retry plan không yêu cầu confirm text lần hai

### Scenario D — Dirty mapping và start

1. Sửa mapping ở trang cuối (scroll xuống dưới)
2. **Không cuộn ngược lên** — action bar vẫn nhìn thấy
3. Bấm `Bắt đầu sinh N ảnh`, xác nhận modal
4. Xác nhận mapping save trước và start dùng revision mới
5. Completed page không bị reset

### Scenario E — Long-running first image

1. Bắt đầu story 6+ trang
2. Khi completed vẫn `0/N`, UI phải hiện rõ `Đang tạo trang X`
3. Scroll toàn trang: compact progress/action vẫn nhìn thấy
4. Completed thumbnail xuất hiện dần

### Scenario F — Poll error và stale recovery

1. Tạm làm poll lỗi nhưng job chưa stale
2. Last-known progress vẫn hiển thị, không có nút start/retry sai
3. Khi canonical `can_resume`, CTA đổi thành `Tiếp tục K ảnh còn lại`
4. Sau reconcile, modal/action tự đổi theo canonical state mới

### Scenario G — Read-only previous steps

1. Từ step 3 mở step 1 hoặc step 2 đã hoàn tất
2. Chỉ xem summary/content read-only
3. Không có save/generate/edit controls
4. Có action rõ để quay lại current canonical step

---

## 14. Quality Gates

### 14.1 Frontend automated — bắt buộc

```powershell
cd frontend
npm run test -- --run     # 0 test failure
npm run lint              # 0 lint error (warning cũ phải báo rõ, không tạo mới)
npx tsc --noEmit          # TypeScript clean
npm run build             # Production build pass
```

### 14.2 Repository — bắt buộc

```powershell
git diff --check          # Không trailing whitespace
git status --short        # Chỉ file trong scope
```

- **Không stage/commit** file backend hoặc plan Phase 5
- **Không commit** secret, `.env`, log, ảnh test tạm

### 14.3 Browser/manual — bắt buộc để gọi UX accepted

Automated pass chỉ là **code-complete offline**.
Chỉ gọi **UX accepted** sau khi:
- Scenario A–G chạy trên app thật
- Viewport matrix kiểm tra
- Ít nhất 1 text generation và 1 image generation live được quan sát

---

## 15. Definition of Done

Phase 4.5 **code-complete offline** khi:

- [ ] Workflow shell 4 bước trên mọi admin story workspace
- [ ] Story list, stepper và canonical redirect dùng chung một presentation mapping
- [ ] Route guard phân biệt current / historical read-only / future-invalid
- [ ] Mỗi state chỉ có **một workflow primary CTA**
- [ ] Setup, editor và image action luôn ở vị trí nhất quán (sticky action bar)
- [ ] New story có `Chỉ lưu nháp` + `Tạo và sinh nội dung` với partial-failure handling
- [ ] Text confirm không còn extra continue click, phân biệt đúng confirm success / plan failure
- [ ] Dirty mapping được save-before-start bằng revision canonical mới
- [ ] Generating mode hiển thị active page và page-status gallery
- [ ] Main UI không còn copy kỹ thuật đã liệt kê (§9)
- [ ] Previous completed steps render compact read-only
- [ ] Automated frontend/repository gates pass
- [ ] Mobile quick-create/progress/recovery dùng được; deep controls chỉ khi canvas đủ cả width + height
- [ ] P1 compact rows, page navigator implemented
- [ ] Không thay DB/backend state machine

Phase 4.5 **UX accepted** khi manual/browser scenarios + viewport matrix pass.

---

## 16. Review Blockers

### REQUEST CHANGES nếu vi phạm (P0 blocker):

- ❌ Xây mega wizard/global store thay vì giữ route/canonical feature state
- ❌ Thêm backend endpoint/migration mà không được PM chấp thuận
- ❌ Auto retry create khi chưa biết story ID (có thể tạo draft trùng)
- ❌ Confirm thành công nhưng plan lỗi lại báo "xác nhận thất bại"
- ❌ Save mapping xong start bằng revision cũ
- ❌ Bypass `blocked`/canonical reconcile để cho mutation tiếp
- ❌ Auto-resume stale job hoặc auto-retry image operation có chi phí
- ❌ Bỏ modal text lock hoặc modal image cost
- ❌ Hiển thị fake ETA/percent
- ❌ Render future review/publish buttons/API giả
- ❌ Một màn hình có nhiều workflow primary CTA cạnh tranh
- ❌ Sticky bar che nội dung hoặc không keyboard-accessible
- ❌ Mobile mất quick-create/progress/recovery, dùng hidden config default, horizontal overflow, hoặc landscape phone bật deep mutation
- ❌ Previous completed step mở lại quyền sửa
- ❌ Regression làm completed image bị sinh lại
- ❌ Stage/commit thay đổi backend
- ❌ Ghi UX decisions đè D36–D42 (reserved cho Phase 5)

### Có thể deferred nếu ghi rõ (P1):

- ⚠️ Last-update time giàu thông tin (cần backend heartbeat contract)
- ⚠️ Story-list progress `x/N` (cần list API projection mới)
- ⚠️ Backend idempotency key cho create
- ⚠️ Durable queue/external worker

---

## 17. Handoff sang Phase 5

Sau Phase 4.5, Phase 5 chỉ cần:

1. Thêm route `/admin/stories/{id}/review`
2. Map `pending_review/approved/published` sang route thật trong `workflow.ts`
3. Dùng backend capability cho approve/reject/regenerate/complete-review/publish
4. Giữ manual regeneration ở step 4
5. Đổi complete-state CTA từ placeholder sang `Đi tới duyệt truyện`
6. Gắn cover preview và public-reader CTA ở bước 4

**Không được viết lại** stepper/action bar trong `story-review` — Phase 5 chỉ cung cấp workspace content và action capability cho shell đã có.

---

## Tóm tắt file changes

### Files mới (12)

| # | File | Slice |
|---|---|---|
| 1 | `features/story-workflow/types.ts` | 1 |
| 2 | `features/story-workflow/workflow.ts` | 1 |
| 3 | `features/story-workflow/workflow.test.ts` | 1 |
| 4 | `features/story-workflow/components/StoryWorkflowShell.tsx` | 1 |
| 5 | `features/story-workflow/components/StoryWorkflowStepper.tsx` | 1 |
| 6 | `features/story-workflow/components/WorkflowHeader.tsx` | 1 |
| 7 | `features/story-workflow/components/WorkflowActionBar.tsx` | 1 |
| 8 | `features/story-workflow/components/WorkflowStateMessage.tsx` | 1 |
| 9 | `features/story-workflow/components/StorySetupSummary.tsx` | 1 |
| 10 | `features/story-workflow/orchestration.ts` | 2 |
| 11 | `features/story-workflow/orchestration.test.ts` | 2 |
| 12 | `features/story-images/components/ImagePageProgressGrid.tsx` | 3 |

### Files chỉnh sửa (13)

| # | File | Slice | Thay đổi chính |
|---|---|---|---|
| 1 | `app/admin/stories/new/page.tsx` | 2 | Bọc Shell, one-click create+generate |
| 2 | `app/admin/stories/[id]/setup/page.tsx` | 2 | Bọc Shell, read-only summary |
| 3 | `app/admin/stories/[id]/edit/page.tsx` | 2 | Bọc Shell |
| 4 | `app/admin/stories/[id]/images/page.tsx` | 3 | Bọc Shell |
| 5 | `features/stories/routes.ts` | 1 | Re-export từ workflow |
| 6 | `features/stories/routes.test.ts` | 1 | Giữ + extend |
| 7 | `features/stories/components/StorySetupForm.tsx` | 2 | Bỏ footer CTAs, a11y fixes |
| 8 | `features/stories/components/StoryListItem.tsx` | 1 | Dùng workflow mapping mới |
| 9 | `features/story-editor/components/StoryTextEditor.tsx` | 2 | Bỏ header/CTAs, action bar |
| 10 | `features/story-images/useStoryImages.ts` | 3 | saveMapping return type, active page |
| 11 | `features/story-images/components/StoryImageWorkspace.tsx` | 3 | Mode-based, bỏ header/CTAs |
| 12 | `features/story-images/components/ImageGenerationProgress.tsx` | 3 | Active page indicator |
| 13 | `features/story-images/components/ImagePlanCard.tsx` | 3+4 | Collapse technical, ẩn revision |

### P1 files (thêm nếu thời gian cho phép)

| # | File | Thay đổi |
|---|---|---|
| P1-1 | `features/story-images/components/ImagePlanCompactRow.tsx` | Compact row thay ImagePlanCard |
| P1-2 | Text editor page navigator component | Anchor links cho trang |
