# Phase 3A — Story Setup & Story List Implementation Plan

> Trạng thái: ✅ Code-complete offline — ⏳ Docker/live verification pending
> Phạm vi: Tạo và quản lý story draft, chưa gọi AI
> Thời lượng dự kiến: 2–3 ngày
> Ngày cập nhật: 2026-07-20

---

## 1. Mục tiêu

Xây dựng lát cắt đầu tiên của Phase 3 để admin có thể:

- Xem danh sách tất cả story của hệ thống.
- Tạo một story draft từ chủ đề, cấu hình và 2–3 nhân vật.
- Mở lại và chỉnh sửa phần thiết lập khi story còn `draft`.
- Archive story draft không còn sử dụng.
- Chuẩn bị dữ liệu sạch cho Phase 3B sinh nội dung Việt/Khmer.

Phase 3A chỉ xử lý **story setup và persistence**. Không gọi OpenAI, không dịch Khmer và không tạo `story_pages`.

---

## 2. Quyết định nghiệp vụ đã chốt

### 2.1 Quyền truy cập

- Mọi endpoint Phase 3A yêu cầu Supabase user có `app_role = admin`.
- Mọi admin được xem và sửa tất cả story.
- `created_by` vẫn được lưu để biết ai tạo, nhưng không dùng để lọc hoặc giới hạn quyền.
- Reader không được truy cập story setup hoặc admin story list.

### 2.2 Story setup lifecycle

- Story mới có `status = draft`.
- Toàn bộ setup được sửa khi `status = draft`.
- Setup bị khóa từ `text_draft` trở đi.
- Request sửa setup của story không còn `draft` trả `409 Conflict`.
- Story không sử dụng được chuyển sang `archived`; không hard-delete.
- Phase 3A chỉ archive story đang ở `draft`. Việc archive các trạng thái sau sẽ được xem xét ở phase tương ứng.

### 2.3 Nhóm tuổi

`target_age` lưu một trong ba giá trị:

| Giá trị | Label UI | Prompt Phase 3B |
|---|---|---|
| `preschool` | Mầm non (3–5 tuổi) | `for preschool children aged 3-5` |
| `early_primary` | Tiểu học đầu (6–8 tuổi) | `for early primary children aged 6-8` |
| `late_primary` | Tiểu học cuối (9–12 tuổi) | `for late primary children aged 9-12` |

- Dùng cột text có CHECK constraint, không tạo PostgreSQL enum type.
- Form và API bắt buộc chọn một nhóm tuổi.
- Không đổi tên cột thành `target_age_group` để tránh rename không cần thiết.

### 2.4 Độ dài

| Giá trị DB | Label UI | Số trang nội dung Phase 3B |
|---|---|---|
| `short` | Ngắn (4–6 trang) | 4–6 |
| `medium` | Vừa (8–10 trang) | 8–10 |
| `long` | Dài (12–14 trang) | 12–14 |

- Số trang không bắt buộc chẵn.
- AI sẽ tự chọn số trang trong khoảng ở Phase 3B.
- Sau chỉnh sửa, hard limit là 16 trang nội dung.
- Bìa không được tính vào số trang nội dung.

### 2.5 Outline và bìa

- Không có bước outline riêng.
- Phase 3B sẽ sinh trực tiếp tiêu đề và nội dung hoàn chỉnh theo từng trang.
- Bìa là React/Tailwind/SVG template, không sinh bằng AI.
- Bìa không nằm trong `story_pages`.
- `stories.cover_image_url` tiếp tục nullable và chưa được sử dụng trong Phase 3A.
- Component bìa thật sẽ được triển khai khi Reader/Story Card cần; Phase 3A không tạo bitmap hoặc upload bìa lên R2.

### 2.6 Nhân vật

- Mỗi story bắt buộc chọn 2–3 nhân vật khác nhau.
- Chỉ được chọn nhân vật tồn tại trong Character Bank.
- Phase 3A chỉ tạo liên kết `story_characters`; không chỉnh sửa character.

---

## 3. Ngoài phạm vi

- OpenAI SDK và prompt execution.
- Sinh tiêu đề hoặc nội dung truyện.
- Dịch Việt → Khmer/Anh.
- Tạo, sửa hoặc reorder `story_pages`.
- Quick actions và chat editing.
- Confirm/lock text.
- Image generation và R2 story images.
- Background jobs, retry, progress, SSE hoặc WebSocket.
- Reader/public story routes.
- Story search, pagination, dashboard hoặc analytics.
- Restore/unarchive UI.
- Docker bắt buộc trong vòng code-complete offline.

---

## 4. Deliverables

### Backend

- Migration đổi `stories.target_age` từ integer sang text group.
- SQLAlchemy model và schema cập nhật tương ứng.
- Story service theo cấu trúc feature-based.
- Năm endpoint admin:
  - `POST /api/stories`
  - `GET /api/stories`
  - `GET /api/stories/{story_id}`
  - `PATCH /api/stories/{story_id}`
  - `POST /api/stories/{story_id}/archive`
- Unit/contract tests chạy được khi Docker tắt.
- Integration tests được viết sẵn, có thể chạy sau bằng Testcontainers.

### Frontend

- Link “Truyện” trong admin navigation.
- `/admin/stories` — danh sách story.
- `/admin/stories/new` — tạo story.
- `/admin/stories/[id]/setup` — xem/sửa story draft.
- Feature folder `stories` chứa types, API và hooks.
- Loading, empty, error, retry và form validation states.
- Confirmation trước khi archive.

### Documentation

- G3 và G6 được đánh dấu đã chốt.
- Decision log ghi lại các quyết định Phase 3A.
- Database schema mô tả `target_age` mới.
- Xóa/đổi các mô tả còn nói có outline riêng.
- Roadmap phản ánh Phase 2 đã code-complete offline và Phase 3A đang triển khai.

---

## 5. Database migration

### 5.1 Migration strategy

Tạo migration mới, ví dụ:

```text
backend/alembic/versions/002_target_age_groups.py
```

Không sửa `001_initial_schema.py` vì migration Phase 1 đã được commit và là lịch sử đã công bố trong repo.

Upgrade phải:

1. Chuyển `stories.target_age` từ integer sang text.
2. Map dữ liệu cũ nếu có:
   - `3–5` → `preschool`
   - `6–8` → `early_primary`
   - `9–12` → `late_primary`
3. Giá trị ngoài khoảng hoặc null tiếp tục là null để migration không tự gán sai nhóm.
4. Thêm CHECK constraint:

```sql
target_age IS NULL OR target_age IN (
    'preschool',
    'early_primary',
    'late_primary'
)
```

API Phase 3A vẫn bắt buộc `target_age`; nullable ở DB chỉ để migration an toàn với dữ liệu legacy.

Downgrade phải có mapping đại diện và ghi rõ là lossy:

- `preschool` → `4`
- `early_primary` → `7`
- `late_primary` → `10`

### 5.2 ORM model

`Story.target_age` đổi từ `Integer` sang `Text`.

Không thay đổi:

- Danh sách 7 bảng.
- `length_pref` values.
- Status lifecycle.
- `story_characters` relationship.
- `cover_image_url` nullable.

### 5.3 Migration verification

Integration test cần xác minh:

- Upgrade từ empty DB thành công.
- Column type là text/varchar.
- Ba giá trị hợp lệ insert được.
- Giá trị bất kỳ khác bị CHECK constraint từ chối.
- Downgrade/upgrade path không làm migration graph có nhiều heads.

Các test này có thể hoãn chạy đến khi Docker Desktop bật, nhưng file test và migration phải có trong Phase 3A.

---

## 6. Backend architecture

Giữ feature-based structure:

```text
backend/src/katha/features/stories/
├── __init__.py
├── models.py
├── schemas.py
├── service.py
└── router.py
```

Dependency flow:

```text
router -> get_admin_user + get_db -> story service -> models/database
```

- Router không chứa SQL hoặc transaction logic.
- Service không đọc HTTP request trực tiếp.
- Schema là allowlist dữ liệu request/response.
- Không đặt story logic trong `main.py`; `main.py` chỉ mount router.

---

## 7. API contract

### 7.1 Common enums

Backend schema dùng enum/Literal cho:

```text
TargetAge = preschool | early_primary | late_primary
LengthPreference = short | medium | long
```

Không cho frontend gửi label tiếng Việt vào DB.

### 7.2 StoryCreate

Request:

```json
{
  "description_vi": "Câu chuyện về Srey học cách chia sẻ đồ chơi với Dara.",
  "backbone_id": 1,
  "genre_id": 1,
  "art_style_id": 1,
  "target_age": "early_primary",
  "length_pref": "medium",
  "character_ids": [1, 2]
}
```

Validation:

- `description_vi`: trim, bắt buộc, không rỗng; giới hạn hợp lý 10–2000 ký tự.
- Các config ID là integer dương.
- `target_age` và `length_pref` thuộc allowlist.
- `character_ids` có 2–3 ID duy nhất.
- Không chấp nhận field ngoài schema nếu project đang dùng strict request models.

Response `201 Created`:

```json
{
  "id": 12,
  "title_vi": null,
  "title_km": null,
  "description_vi": "Câu chuyện về Srey học cách chia sẻ đồ chơi với Dara.",
  "backbone_id": 1,
  "genre_id": 1,
  "art_style_id": 1,
  "target_age": "early_primary",
  "length_pref": "medium",
  "status": "draft",
  "cover_image_url": null,
  "created_by": "<admin-uuid>",
  "character_ids": [1, 2],
  "created_at": "<timestamp>",
  "updated_at": "<timestamp>"
}
```

Rules:

- `created_by` luôn lấy từ verified token, không nhận từ request.
- Status luôn là `draft`, không nhận từ request.
- Story và `story_characters` được ghi trong cùng transaction.
- Nếu một config/character ID không tồn tại, không tạo record dở dang.

### 7.3 Story list

```text
GET /api/stories
```

Behavior:

- Admin only.
- Trả story của tất cả admin.
- Mặc định loại `archived`.
- Sort `created_at DESC`, sau đó `id DESC` để ổn định.
- Chưa cần pagination.
- Không join/nạp `story_pages`.
- Có thể hỗ trợ `include_archived=true` ở API nếu triển khai không làm tăng đáng kể scope; Phase 3A UI chưa cần màn hình archived.

List item tối thiểu:

```text
id, title_vi, title_km, description_vi,
target_age, length_pref, status,
created_by, created_at, updated_at
```

Frontend hiển thị fallback `Truyện chưa đặt tên` khi `title_vi` chưa có.

### 7.4 Story detail

```text
GET /api/stories/{story_id}
```

- Admin only.
- Mọi admin được xem mọi story.
- Không tồn tại: `404 Story not found`.
- Response gồm setup fields và `character_ids`.
- Chưa trả `story_pages` trong Phase 3A.

### 7.5 Story update

```text
PATCH /api/stories/{story_id}
```

Request cho phép cập nhật một hoặc nhiều field setup:

```text
description_vi, backbone_id, genre_id, art_style_id,
target_age, length_pref, character_ids
```

Rules:

- Chỉ cho phép khi status hiện tại là `draft`.
- Không cho sửa `created_by`, `status`, title hoặc timestamps.
- Nếu có `character_ids`, thay thế toàn bộ association trong cùng transaction.
- Validate đầy đủ như create.
- Chỉ commit sau khi tất cả referenced IDs hợp lệ.
- Cập nhật `updated_at` rõ ràng.
- Story không còn draft: `409 Story setup is locked`.

### 7.6 Archive draft

```text
POST /api/stories/{story_id}/archive
```

- Admin only.
- Chỉ áp dụng cho story `draft` trong Phase 3A.
- Chuyển status thành `archived` và cập nhật `updated_at`.
- Không xóa `story_characters` hoặc dữ liệu story.
- Gọi lại với story archived có thể trả current representation hoặc `409`; chọn một contract và test nhất quán. Khuyến nghị idempotent: trả `200` với story đã archived.
- Story ở trạng thái khác: `409` cho đến khi archive lifecycle của phase sau được thiết kế.

### 7.7 Error contract

| Trường hợp | Status |
|---|---:|
| Không có/invalid token | 401 |
| Reader gọi admin API | 403 |
| Request schema không hợp lệ | 422 |
| Config/character selection không hợp lệ | 422 |
| Story không tồn tại | 404 |
| Story setup đã khóa | 409 |

Không trả raw SQL error, stack trace hoặc nội dung token.

---

## 8. Backend service rules

### Create transaction

1. Validate backbone, genre và art style tồn tại.
2. Validate 2–3 character IDs duy nhất và tồn tại.
3. Insert story với `created_by = current_user.id`.
4. Flush để lấy story ID.
5. Insert `story_characters`.
6. Commit một lần.
7. Refresh/serialize response.

### Update transaction

1. Load story.
2. Kiểm tra `status == draft`.
3. Validate referenced IDs mới.
4. Update scalar fields.
5. Nếu thay characters, thay association atomically.
6. Update timestamp và commit một lần.

### Query rules

- Tránh N+1 khi detail cần characters.
- Không eager-load pages ở list/detail Phase 3A.
- Không filter theo `created_by`.
- Không hardcode seed IDs hoặc tên config.

---

## 9. Frontend structure

```text
frontend/src/
├── app/admin/stories/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/setup/page.tsx
├── features/stories/
│   ├── api.ts
│   ├── constants.ts
│   ├── types.ts
│   ├── useStories.ts
│   ├── useStory.ts
│   └── components/
│       ├── StorySetupForm.tsx
│       ├── StoryListItem.tsx
│       └── ArchiveStoryDialog.tsx
└── components/layout/AdminHeader.tsx
```

- Page components chỉ compose feature components.
- API calls đi qua `apiFetch` để tự gắn Supabase token.
- Không gọi trực tiếp Supabase Database.
- Không tạo global state mới nếu hooks cục bộ đáp ứng đủ.

---

## 10. Story list UI

Route:

```text
/admin/stories
```

### Required states

- Loading skeleton.
- Empty state với CTA “Tạo truyện đầu tiên”.
- Error state và nút thử lại.
- Success list/grid.
- Archive confirmation và pending state.

### Mỗi item hiển thị

- `title_vi` hoặc fallback `Truyện chưa đặt tên`.
- Mô tả rút gọn.
- Nhóm tuổi label tiếng Việt.
- Độ dài label tiếng Việt.
- Status badge.
- Ngày tạo.
- CTA:
  - `draft` → “Tiếp tục thiết lập”.
  - `text_draft` trở đi → hiển thị trạng thái; route editor sẽ được nối ở Phase 3B/3C.
  - `draft` → Archive.

### Sorting và archived behavior

- Mới nhất trước.
- Archived không xuất hiện mặc định.
- Không cần search/filter/pagination trong Phase 3A.

---

## 11. Story setup form

Routes:

```text
/admin/stories/new
/admin/stories/{id}/setup
```

### Fields

1. Chủ đề/mô tả tiếng Việt — textarea.
2. Nhân vật — multi-select từ Character Bank, min 2/max 3.
3. Backbone — single select/card.
4. Genre — single select/card.
5. Art style — single select/card; ảnh sample có fallback.
6. Nhóm tuổi — ba lựa chọn đã chốt.
7. Độ dài — short/medium/long với range hiển thị.

### Data loading

- Dùng các protected config/character APIs của Phase 2.
- Có loading, error và retry khi tải options.
- Không render form với options rỗng mà không giải thích.
- Tránh gọi trùng cùng một config endpoint không cần thiết.

### Validation UX

- Trim mô tả trước submit.
- Hiển thị lỗi ngay cạnh field.
- Chặn chọn nhân vật thứ tư.
- Không cho submit khi chưa đủ 2 nhân vật hoặc thiếu config.
- Disable submit trong request để tránh double-create.
- Backend vẫn validate lại toàn bộ.

### Create behavior

- Nút chính: `Lưu bản nháp`.
- Thành công: redirect `/admin/stories/{id}/setup` và hiển thị thông báo đã lưu.
- Không hiển thị nút gọi AI trong Phase 3A.
- Request lỗi giữ lại dữ liệu form.

### Edit behavior

- Load story detail và prefill form.
- Nếu `status = draft`, form editable.
- Nếu story không còn draft, form read-only hoặc redirect về route phase phù hợp; tuyệt đối không cho update ngầm.
- Lưu thành công cập nhật data trên UI.
- Archive có confirmation; thành công quay về story list.

---

## 12. Navigation

Cập nhật admin header tối thiểu:

- “Nhân vật” → `/admin/characters`.
- “Truyện” → `/admin/stories`.
- Nút “Tạo truyện” có thể nằm trên story list thay vì header toàn cục.
- Giữ email và logout behavior Phase 2.
- Không xây sidebar/dashboard mới.

Root/admin redirect hiện tại không cần đổi nếu không cản flow; không mở rộng scope chỉ để đổi landing.

---

## 13. Automated tests

### 13.1 Offline API/contract tests

Phải chạy được khi Docker tắt bằng dependency override/mock service hoặc mock DB phù hợp với pattern Phase 2.

Create cases:

- Admin tạo story hợp lệ → 201.
- `created_by` lấy từ token, bỏ qua/không nhận client field.
- Status luôn là draft.
- Reader → 403; không token → 401.
- 1 nhân vật → 422.
- 4 nhân vật → 422.
- Character IDs trùng → 422.
- Invalid target age/length → 422.
- Missing config/character reference → 422.
- Service failure không trả partial success.

List/detail cases:

- Mọi admin thấy story của các admin khác.
- Archived bị loại khỏi list mặc định.
- List sort ổn định mới nhất trước.
- Missing story → 404.
- Detail trả đúng `character_ids`.

Update cases:

- Draft update thành công.
- Replace character selection thành công.
- Non-draft update → 409.
- Invalid reference không thay đổi story hiện tại.
- Không cho client sửa status/created_by/timestamps.

Archive cases:

- Draft archive → archived.
- Archive lần hai theo contract idempotent → 200.
- Non-draft archive → 409.
- Không hard-delete row/associations.

### 13.2 Migration integration tests

Khi Docker sẵn sàng:

- Migration 001 → 002 chạy được.
- Full migration từ empty DB chạy được.
- Constraint target age hoạt động.
- Existing test suite vẫn pass.
- Seed vẫn idempotent.
- Không có nhiều Alembic heads.

### 13.3 Frontend gates

- Lint không lỗi.
- TypeScript không lỗi.
- Production build pass.
- Không cần thêm frontend test framework chỉ cho Phase 3A nếu repo chưa có.

Manual smoke sau khi có backend data:

- Tạo draft hợp lệ.
- Validation 2–3 nhân vật.
- Refresh setup page vẫn giữ dữ liệu.
- Admin khác mở và sửa được story.
- Archive làm story biến mất khỏi default list.
- Non-draft setup không sửa được.

---

## 14. Quality gates

### Backend offline

```bash
cd backend
uv lock --check
uv run ruff check src/ tests/ alembic/versions/002_target_age_groups.py
uv run ruff format --check src/ tests/ alembic/versions/002_target_age_groups.py
uv run mypy src/
uv run alembic heads
uv run pytest -m "not integration" tests/ -q
uv run pytest -m integration tests/ --collect-only -q
```

### Frontend offline

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

### Deferred integration

```bash
cd backend
uv run pytest -m integration tests/ -q
uv run pytest tests/ -v
docker build -t katha-backend .
```

Docker/Testcontainers và live Supabase/R2 không chặn trạng thái **Phase 3A code-complete offline**, nhưng phải còn trong acceptance backlog.

Kết quả Round 3 ngày 2026-07-20: backend offline 57 passed, 16 integration tests collect-only; Ruff/format/mypy/Alembic xanh. Frontend lint/typecheck/build xanh; lint còn 1 warning `@next/next/no-img-element` đã được chấp nhận trong phạm vi Round 3. Docker-backed pytest, Docker image build và live smoke chưa chạy.

---

## 15. Documentation updates bắt buộc

### `plan/08-implementation-gates.md`

- G6 → CHỐT: ba nhóm tuổi text.
- G3 → CHỐT: bìa code template, không phải story page và không sinh AI trong MVP.

### `plan/01-decisions-log.md`

Ghi các quyết định mới:

- Target age dùng ba nhóm.
- Không có outline riêng.
- Mapping length và hard limit 16.
- Bìa code template, không gen AI.
- Mọi admin thấy/sửa mọi story.
- Setup editable ở draft, khóa từ text_draft.

### `plan/07-database-schema.md`

- `target_age int` → text với ba values.
- Ghi bìa không nằm trong `story_pages`.
- Ghi `cover_image_url` nullable/reserved cho future export nếu cần.

### Các tài liệu flow/design

Thay hoặc loại bỏ:

- “Tạo outline”.
- “Admin chỉnh outline”.
- Prompt output outline như một bước sản phẩm riêng.
- Wireframe coi bìa là page 1.
- Mô tả range tuổi còn OPEN.

Thay bằng:

- “Tạo nội dung truyện” ở Phase 3B.
- AI trả trực tiếp title + full story pages.
- `page_no=1` là trang nội dung đầu tiên.
- Bìa được render bằng component riêng.

Không cần viết lại toàn bộ tài liệu; chỉ sửa các đoạn mâu thuẫn trực tiếp với quyết định đã chốt.

---

## 16. Implementation order

### Step 1 — Đồng bộ decisions và schema contract

- Cập nhật gates/decision log/schema docs.
- Viết migration 002.
- Cập nhật ORM model và migration tests.

### Step 2 — Backend schemas/service/router

- Request/response schemas.
- Create/list/detail/update/archive service.
- Router admin-protected.
- Mount router trong `main.py`.

### Step 3 — Backend offline tests

- Auth contract.
- Validation.
- Transactions/locked status/archive behavior.
- Ruff/format/mypy.

### Step 4 — Frontend story feature

- Types/API/hooks.
- Story list.
- New/setup form.
- Archive confirmation.
- Admin navigation.

### Step 5 — Frontend gates và manual static review

- Lint/typecheck/build.
- Responsive/error/loading states.
- Kiểm tra không lộ secrets và không gọi Supabase DB trực tiếp.

### Step 6 — Deferred integration

- Docker migration/tests.
- Supabase live CRUD smoke.
- Không trộn task này với Phase 3B AI implementation.

---

## 17. Definition of Done

### Code-complete offline

- [x] G3/G6 và các quyết định Phase 3A đã được ghi vào docs.
- [x] Migration 002 và ORM thống nhất `target_age` text.
- [x] Migration graph không bị sửa lịch sử 001.
- [x] Create/list/detail/update/archive APIs đã implement.
- [x] Mọi API dùng `get_admin_user`.
- [x] Mọi admin có thể truy cập story của admin khác.
- [x] Create/update validate đúng 2–3 nhân vật và config IDs.
- [x] Setup chỉ sửa được ở draft.
- [x] Archive không hard-delete.
- [x] Story list/new/setup routes hoạt động ở mức code.
- [x] Frontend có đủ loading/empty/error/retry/validation states.
- [x] Không có OpenAI call, translation hoặc story_pages creation.
- [x] Backend offline gates pass.
- [x] Frontend lint/typecheck/build pass.
- [x] Không có credential/token thật trong source hoặc walkthrough.

### Pending integration/live verification

- [ ] Full Testcontainers suite pass.
- [ ] Migration 001 → 002 pass trên PostgreSQL thật.
- [ ] Docker image build pass.
- [ ] Supabase live create/update/list/archive smoke pass.
- [ ] Hai admin account xác minh cross-admin visibility.

Chỉ dùng trạng thái **Phase 3A code-complete offline** khi nhóm đầu đạt. Không ghi “fully verified” khi nhóm integration/live chưa chạy.

---

## 18. Evidence dev phải bàn giao

- Commit hash và danh sách file thay đổi.
- Nội dung decisions/gates đã cập nhật.
- Alembic revision/down_revision và output `alembic heads` nếu chạy được.
- Danh sách endpoint cùng auth/status contract.
- Output Ruff, format, mypy và offline tests.
- Output frontend lint, TypeScript và build.
- Bằng chứng test 2–3 character validation.
- Bằng chứng test cross-admin access.
- Bằng chứng non-draft update trả 409.
- Bằng chứng archive không xóa row.
- Ghi rõ Docker/live checks nào còn deferred.
- Không gửi access token, database URL hoặc secrets trong walkthrough.

---

## 19. Rủi ro và kiểm soát

| Rủi ro | Ảnh hưởng | Kiểm soát |
|---|---|---|
| Chỉ sửa ORM, quên migration/docs | Schema lệch môi trường | Migration 002 + schema docs + integration test |
| Client gửi `created_by`/status | Giả mạo owner/lifecycle | Không có fields này trong request schema |
| Ghi story trước rồi association lỗi | Partial data | Một transaction cho story + characters |
| Admin bị filter theo owner ngoài ý muốn | Không cộng tác được | Test cross-admin visibility |
| Cho sửa setup sau khi sinh text | Text/config không nhất quán | Lock từ `text_draft`, trả 409 |
| Hard-delete draft | Mâu thuẫn D17 | Archive action, không DELETE endpoint |
| Scope trượt sang AI/editor | Phase quá lớn | Không thêm OpenAI/story_pages trong Phase 3A |
| Docker chưa bật | Chưa có proof migration thật | Offline status riêng, integration backlog rõ ràng |

---

## 20. Handoff sang Phase 3B

Phase 3B chỉ bắt đầu sau khi Phase 3A code-complete offline và API story setup ổn định.

Input Phase 3B có thể tin cậy:

- Story ở `draft`.
- Description/config/target age/length hợp lệ.
- Có 2–3 characters hợp lệ.
- `created_by` đã được xác minh.

Phase 3B sẽ bổ sung:

- `POST /api/stories/{id}/generate-text`.
- Structured output title + full Vietnamese pages.
- Dịch Khmer.
- Atomic creation/replacement của `story_pages`.
- Chuyển `draft → text_draft`.

Không đưa các phần này ngược vào Phase 3A.
