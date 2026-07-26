# Phase 3C Implementation Report

> Ngày hoàn thành: 2026-07-20  
> Phạm vi: Story Editor & Text Confirmation — Core P0  
> Trạng thái: **CODE-COMPLETE OFFLINE SAU CORRECTIVE REVIEW**
> Baseline Phase 3B: `b99eb32`  
> Implementation commit: `e6f320bb73226791c6e337e0f30f5887a456414f`
> Corrective review commit: `b158b1f271c2ac2ec09aa792daa321800ee7d49f`

## 1. Kết quả bàn giao

Phase 3C core đã được triển khai end-to-end từ migration, backend domain/API, OpenAI adapter, Khmer technical validator đến full editor frontend. Admin hiện có thể dùng quick action hoặc custom instruction, thêm/xóa/đổi thứ tự trang, dịch lại Khmer, xem warning kỹ thuật và xác nhận khóa text.

Những invariant sản phẩm đã được enforce ở backend, không chỉ khóa nút frontend:

- Quick action giữ nguyên chính xác page IDs, số trang và thứ tự.
- Custom instruction luôn giữ page IDs/count/order; add/delete/reorder chỉ qua control riêng.
- Sau edit cho phép số trang lẻ nhưng phải còn trong band `4–6`, `8–10`, `12–14`.
- Mọi content mutation chỉ chạy ở `text_draft` và dùng `expected_revision`.
- AI request không giữ database lock qua network call; backend lock/check lại revision và canonical pages trước commit.
- Vietnamese edit chỉ persist sau khi translation Khmer cần thiết đã thành công; không có bilingual partial save.
- `validate-km` chỉ cập nhật metadata, không tăng `text_revision` và không tạo side effect trong `GET /text`.
- Confirm chỉ chuyển `text_draft → text_confirmed`, không tăng revision, không gọi/enqueue image pipeline.
- Không thêm inline editor, history, undo hay edit-log table.

## 2. Database và migration

Migration mới: `backend/alembic/versions/004_story_editor_validation.py`.

- `down_revision = "003"`.
- Thêm `story_pages.khmer_validated_at TIMESTAMP WITH TIME ZONE NULL`.
- Giá trị `NULL` biểu thị bản Khmer hiện tại chưa chạy validator pipeline.
- Downgrade xóa đúng cột này.
- Không thêm bảng mới.
- Offline Alembic graph: một head duy nhất là `004`.

Integration migration 001 → 004 và downgrade trên PostgreSQL thật chưa chạy do Docker Desktop không hoạt động; xem Section 10.

## 3. Backend implementation

Feature mới `katha.features.story_editor` tách riêng khỏi Story Setup/Generation:

- `schemas.py`: strict discriminated request unions, giới hạn instruction/output và response diff.
- `ports.py`: boundary cho AI editor và Khmer validator.
- `prompts.py`: prompt builders cho revise/add/retranslate.
- `diff.py`: server tự tính added/edited/deleted/order/title diff; không tin diff do model khai.
- `service.py`: optimistic concurrency, final lock/revision check, atomic persistence và lifecycle guard.
- `router.py`: admin-only endpoints qua dependency auth hiện có.

OpenAI adapter dùng chung được mở rộng với structured outputs cho revise story, add page và retranslate Khmer. Router/component không gọi provider trực tiếp.

### Transaction/concurrency model

AI edit/add/retranslate thực hiện theo ba pha:

1. Đọc snapshot canonical và kiểm tra status/revision.
2. Rollback read transaction trước khi gọi network; validate toàn bộ structured output và translation trong memory.
3. Lock story, kiểm tra lại status/revision/pages, rồi persist một transaction duy nhất.

Nếu một admin khác đã sửa/reorder/delete/confirm trong lúc AI chạy, request cũ trả `409` và không ghi đè canonical state.

Reorder/delete dùng page number tạm âm trước khi gán lại `1..N`, tránh va `UNIQUE(story_id, page_no)` trong cùng transaction.

## 4. API contracts

Tất cả endpoint dưới đây yêu cầu admin JWT và story ID dương.

| Method | Endpoint | Tác dụng | Revision |
|---|---|---|---|
| POST | `/api/stories/{id}/text/edits` | Quick action hoặc custom instruction | +1 nếu canonical content đổi |
| POST | `/api/stories/{id}/pages` | AI sinh một page, mặc định append; hỗ trợ `after_page_id` | +1 |
| PUT | `/api/stories/{id}/pages/order` | Lưu exact page-ID permutation | +1; no-op giữ nguyên |
| DELETE | `/api/stories/{id}/pages/{page_id}` | Xóa page và renumber | +1 |
| POST | `/api/stories/{id}/validate-km` | Validate toàn bộ page snapshot | Giữ nguyên |
| POST | `/api/stories/{id}/retranslate-km` | Dịch lại title hoặc một page | +1 nếu text Khmer đổi |
| POST | `/api/stories/{id}/confirm-text` | Khóa text | Giữ nguyên |

OpenAPI static smoke xác nhận đủ `7/7` route.

### Request examples

Quick action:

```json
{
  "kind": "quick_action",
  "action": "shorten",
  "expected_revision": 3
}
```

Custom instruction:

```json
{
  "kind": "instruction",
  "instruction_vi": "Làm cao trào rõ hơn nhưng giữ nguyên các trang",
  "expected_revision": 3
}
```

Validate Khmer metadata:

```json
{
  "expected_revision": 3
}
```

Retranslate title:

```json
{
  "target": "title",
  "expected_revision": 3
}
```

Retranslate page:

```json
{
  "target": "page",
  "page_id": 101,
  "expected_revision": 3
}
```

Confirm:

```json
{
  "expected_revision": 3,
  "acknowledge_khmer_warnings": true
}
```

### Error/status behavior

- `401/403`: auth dependency hiện có.
- `404`: story/page/insertion point không tồn tại.
- `409`: stale revision hoặc story text đã khóa.
- `422`: request/policy/content state không hợp lệ, vượt band/min/max hoặc thiếu acknowledgment.
- `502`: provider trả structured content sai contract.
- `503`: provider unavailable hoặc text-operation timeout.

## 5. Khmer validation decision

P0 sử dụng baseline-only validator, warning-only:

- NFC normalization mismatch.
- Replacement character `U+FFFD`.
- Disallowed control characters.
- Missing Khmer script.
- Absolute length anomaly.
- Offset deterministic theo Unicode code points; ZWSP/newline/tab và mixed Latin names được phép.

Validator không sửa text, không tuyên bố kiểm tra đúng spelling/grammar/semantics và warning không hard-block confirm sau khi admin acknowledge.

Dependency spike:

- `khmercut==0.1.0`: segmenter, không phải spellchecker; Windows/Python 3.11 smoke build gặp metadata encoding error, không pin.
- KOOMPI Khmer spellchecker: dictionary/Hunspell assets, chưa có runtime/license/corpus acceptance đủ cho P0.
- `khmerthings`: Python candidate nhưng Alpha/0.x; chưa có corpus/native review đủ để production-pin.

Advanced segmentation/dictionary adapter được giữ ở P1. Port/factory đã tách để bổ sung sau mà không đổi editor service.

## 6. Frontend implementation

Route `/admin/stories/[id]/edit` nay render editor thật với:

- Invalid ID local guard; draft redirect về setup; generating state poll; archived message; confirmed read-only.
- Vietnamese primary, Khmer subtitle, status/page-count/length/revision header.
- Quick actions đúng label: **Rút gọn nội dung**, **Viết chi tiết hơn**, **Kịch tính hơn**, **Đơn giản hơn**.
- One-shot instruction; input chỉ clear sau success và được giữ lại khi error/conflict.
- Add page; delete có confirm/no-undo và bị disable ở đáy band.
- Dnd-kit pointer/touch/keyboard sensors; nút lên/xuống accessibility fallback; chỉ save ở drag-end/click.
- Dịch lại Khmer cho title/page.
- Explicit `validate-km` bootstrap một lần/revision khi page cũ có timestamp `NULL`.
- Một pending operation tại một thời điểm; disable toàn bộ mutation controls để tránh double-submit.
- AI request timeout 285 giây. Timeout/mất kết nối hoặc `409` đều refetch canonical status/revision trước khi cho thao tác tiếp.
- Confirm dialog hiển thị page count, warning/unvalidated count và checkbox acknowledgment khi cần.
- Sau confirm editor chuyển read-only; không có nút “Sinh ảnh”.
- Story list CTA đúng lifecycle: `Xem trạng thái`, `Tiếp tục biên tập`, `Xem nội dung`.

Dependency thêm: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Không thêm state-management library.

## 7. Automated evidence

### Backend

```text
uv run ruff format --check src tests
67 files already formatted

uv run ruff check src tests
All checks passed!

uv run mypy src
Success: no issues found in 50 source files

uv run alembic heads
004 (head)

PYTHONPATH=src uv run pytest -q -m "not integration"
151 passed, 26 deselected, 2 warnings in 3.62s
```

Hai warning backend không phải lỗi Phase 3C:

- Starlette báo deprecation cho `httpx`/`TestClient`.
- Alembic báo `path_separator` legacy config.

Corrective suite nâng tổng backend offline lên **151 passed**. Coverage mới gồm 35 API/auth contracts, 12 OpenAI adapter contracts, generation DB-clock/timeout/reset/rollback, editor add/reorder/delete/retranslate/idempotency/race và structural negation guards.

### Frontend

```text
npm run lint
0 errors, 1 warning

npx tsc --noEmit
pass

npm run build
Compiled successfully
/admin/stories/[id]/edit -> dynamic route
```

ESLint warning duy nhất là `<img>` trong `StorySetupForm.tsx`, tồn tại từ trước Phase 3C.

Production build hiện tại pass trong workspace; không dùng browser/live backend để suy diễn thành E2E pass.

### Repository safety

```text
git diff --check
pass

credential-shaped diff scan
no credential-shaped values
```

`uv lock --check` pass; frontend lockfile không đổi trong corrective commit và production build đọc thành công.

## 8. Verification mapping

| Contract quan trọng | Evidence |
|---|---|
| Quick action giữ count/order | Unit test structural output bị reject + source-ID exact sequence guard |
| Custom instruction luôn non-structural | Unit test reject cả keyword, explicit request và câu phủ định |
| Selective translation | Unit test chỉ changed page được dịch, unchanged Khmer giữ nguyên |
| Không partial bilingual save | Provider translation failure test: no commit, Vietnamese unchanged |
| Stale AI không overwrite | Final revision race test trả 409, no commit |
| Validate không tăng revision | Validate metadata test giữ revision 3 |
| Odd count được confirm trong band | 5-page short story confirm thành công |
| Warning cần acknowledgment | Confirm 422 khi page unvalidated và chưa acknowledge |
| Confirm không gọi image | Confirm service không nhận AI/image dependency; route chỉ gọi lifecycle service |
| 7 API routes mounted | OpenAPI smoke `editor_routes True 7` |

## 9. Manual/static UX checklist

Đã kiểm tra tĩnh qua source + lint/type/build:

- Invalid ID không gọi API.
- Loading/error/retry/generating/archived/read-only branches có mặt.
- Quick action/instruction pending state và one-operation lock có mặt.
- Add max và delete min boundary có cả frontend guard + backend enforcement.
- Delete confirmation có cảnh báo không undo.
- Dnd pointer/touch/keyboard và up/down fallback có mặt.
- Reorder chỉ submit ở drag-end hoặc fallback click.
- Conflict/timeout refetch canonical state.
- Explicit Khmer bootstrap không nằm trong GET.
- Confirm acknowledgment/read-only transition và exact CTA.
- Không có CTA sinh ảnh trong editor.

Chưa thực hiện browser walkthrough bằng chuột/touch thật vì không có backend PostgreSQL/OpenAI live stack trong lượt này. Việc đó nằm trong live verification, không được ghi là đã pass.

## 10. Deferred / chưa được tuyên bố hoàn thành

### Docker/PostgreSQL

Full Docker suite chưa chạy được; 26 integration tests đã được collect và sẽ dừng ở Testcontainers setup vì Windows pipe `//./pipe/dockerDesktopLinuxEngine` không tồn tại. Kết quả phần không cần Docker là 151 pass; không có assertion failure của Phase 3C.

Cần chạy khi Docker Desktop hoạt động:

- Migration upgrade 001 → 004 và downgrade.
- PostgreSQL exact-permutation/temporary-renumber behavior.
- Revision race/concurrent transaction tests trên DB thật.
- Full API flow edit/add/delete/reorder/validate/retranslate/confirm.

### Live OpenAI

Chưa dùng key thật trong automated suite. Cần limited smoke cho quick action, custom edit, add page và retranslate, đồng thời kiểm tra refusal/malformed/timeout logging không lộ data.

### Linguistic review

Chưa có native Khmer reviewer và chưa đo false-positive trên corpus 30–50 samples. Baseline hiện chỉ là technical warning validator.

### P1

- Archive `text_draft`: deferred; hiện archive lifecycle không được mở rộng ngoài scope P0.
- Advanced dictionary/segmentation adapter: deferred.

### Toolchain notes

- `npm install` báo 2 moderate audit findings; không chạy `npm audit fix --force` vì có thể tạo breaking dependency changes ngoài scope.
- npm cũng cảnh báo Node 22.12 thấp hơn engine mong muốn của một eslint transitive package (>=22.13); lint/type/build vẫn pass. Nên nâng Node patch trước CI/deploy nếu môi trường CI gặp engine enforcement.

## 11. Exact changed-file list của implementation commit

Ký hiệu: `M` = modified, `A` = added.

- `M  PHASE_3C_STORY_EDITOR_CONFIRMATION_PLAN.md`
- `A  backend/alembic/versions/004_story_editor_validation.py`
- `M  backend/src/katha/features/stories/models.py`
- `M  backend/src/katha/features/stories/schemas.py`
- `A  backend/src/katha/features/story_editor/__init__.py`
- `A  backend/src/katha/features/story_editor/diff.py`
- `A  backend/src/katha/features/story_editor/ports.py`
- `A  backend/src/katha/features/story_editor/prompts.py`
- `A  backend/src/katha/features/story_editor/router.py`
- `A  backend/src/katha/features/story_editor/schemas.py`
- `A  backend/src/katha/features/story_editor/service.py`
- `A  backend/src/katha/integrations/khmer/__init__.py`
- `A  backend/src/katha/integrations/khmer/baseline.py`
- `A  backend/src/katha/integrations/khmer/validator.py`
- `M  backend/src/katha/integrations/openai_story_text.py`
- `M  backend/src/katha/main.py`
- `M  backend/tests/test_migration.py`
- `M  backend/tests/test_migration_graph.py`
- `A  backend/tests/test_story_editor.py`
- `M  frontend/package-lock.json`
- `M  frontend/package.json`
- `M  frontend/src/app/admin/stories/[id]/edit/page.tsx`
- `M  frontend/src/features/stories/components/StoryListItem.tsx`
- `M  frontend/src/features/stories/types.ts`
- `A  frontend/src/features/story-editor/api.ts`
- `A  frontend/src/features/story-editor/components/AddPageButton.tsx`
- `A  frontend/src/features/story-editor/components/ConfirmTextDialog.tsx`
- `A  frontend/src/features/story-editor/components/DeletePageDialog.tsx`
- `A  frontend/src/features/story-editor/components/InstructionBox.tsx`
- `A  frontend/src/features/story-editor/components/QuickActions.tsx`
- `A  frontend/src/features/story-editor/components/SortablePageList.tsx`
- `A  frontend/src/features/story-editor/components/SpellcheckFlags.tsx`
- `A  frontend/src/features/story-editor/components/StoryPageCard.tsx`
- `A  frontend/src/features/story-editor/components/StoryTextEditor.tsx`
- `A  frontend/src/features/story-editor/constants.ts`
- `A  frontend/src/features/story-editor/types.ts`
- `A  frontend/src/features/story-editor/useStoryEditor.ts`
- `M  plan/00-project-overview.md`
- `M  plan/01-decisions-log.md`
- `M  plan/02-technical-design.md`
- `M  plan/03-user-flows.md`
- `M  plan/04-implementation-plan.md`
- `M  plan/05-research-notes.md`
- `M  plan/06-project-structure.md`
- `M  plan/HANDOFF.md`

## 12. Handoff sang Phase 4

Phase 4 chỉ nên bắt đầu sau khi:

1. Chạy và accept Docker/PostgreSQL integration cho migration/concurrency.
2. Chạy limited OpenAI live smoke.
3. Chốt Gate G2 (character-per-page strategy).
4. Chốt Gate G4 (image job/retry/progress strategy).

Canonical input cho Phase 4 là story `text_confirmed` với title/pages Việt–Khmer đã khóa. Phase 4 chịu trách nhiệm tạo English/image prompts và image pipeline; không đưa logic đó ngược vào Phase 3C.

## 13. Corrective review closure

Phản hồi REQUEST CHANGES sau commit ban đầu đã được xử lý:

- Custom instruction luôn non-structural; regex keyword authorization đã bị xóa, gồm regression cho câu phủ định.
- `generating_text` dùng recursive polling 3 giây cho đến khi status đổi hoặc component unmount.
- Story metadata/text được load atomically; lỗi `GET /text` hiện error + retry thay vì skeleton vô hạn.
- Khmer validation failure có nút retry cùng revision; network loss refetch canonical state trước retry.
- Stale generation dùng PostgreSQL `clock_timestamp()` và Settings reject `stale <= operation timeout`.
- Retranslate page trả cùng Khmer vẫn refresh flags/timestamp mà không tăng revision.
- Thêm API/auth, provider, timeout/reset, add/reorder/delete/retranslate, idempotency/race/rollback tests.
- Thêm 5 full Phase 3 PostgreSQL integration flows và migration 003/004 lifecycle test; execution còn Docker-deferred.

Corrective commit: `b158b1f271c2ac2ec09aa792daa321800ee7d49f`.

22 file trong corrective commit:

- Runtime/config: `backend/src/katha/core/config.py`, generation service, editor prompt/service và 2 file frontend editor.
- Tests: migration lifecycle, generation/editor service suites và 3 suite mới cho OpenAI adapter, API/auth contracts, PostgreSQL Phase 3 flows.
- Docs: plan 3B/3C, README, overview, decisions, technical design, implementation plan, research notes, project structure và `plan/HANDOFF.md`.

File báo cáo này được cập nhật sau commit corrective để lưu đúng hash và kết quả gate cuối.
