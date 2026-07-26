# Katha — Phase 5 Manual Verification & Deployment Acceptance

> Document hướng dẫn và nhật ký kiểm thử thủ công với PostgreSQL thực tế, live OpenAI/R2 API, và Browser Acceptance cho Phase 5.

---

## 1. Môi trường & Điều kiện tiên quyết

### PostgreSQL Thực tế (Real Instance)
- Repo không có Docker Compose service `postgres`. Bật Docker Desktop/Linux engine và kiểm tra bằng `docker info`; suite integration dùng Testcontainers tự khởi chạy `postgres:16-alpine`.
- Chạy PostgreSQL suite từ `backend/`: `uv run pytest tests/ -m integration -v`.
- Chạy Alembic migration nâng cấp DB: `uv run alembic upgrade head`
- Kiểm tra migration version: `uv run alembic heads` (xác nhận `006 (head)`).

### Live Cloud Services (OpenAI & Cloudflare R2)
- Khấu hình `.env` backend với `OPENAI_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`.
- Kiểm tra kết nối R2 bucket và OpenAI API endpoint.

---

## 2. Kịch bản Kiểm thử Thủ công (Manual Test Scenarios)

### Kịch bản 1: Sửa Tiêu đề Tiếng Khmer (`can_edit_khmer`)
1. Truy cập workspace review tại `/admin/stories/[storyKey]/review` với truyện ở trạng thái `pending_review`.
2. Bấm nút **"Sửa tiêu đề Khmer"** trên header workspace.
3. Nhập tiêu đề tiếng Khmer mới và bấm **"Lưu tiêu đề"**.
4. Bấm **"Chạy lại kiểm tra Khmer"** nếu workspace còn trang chưa validate/còn warning.
5. **Kỳ vọng:** Tiêu đề được cập nhật, `text_revision` tăng 1; validator cập nhật warning/timestamp nhưng không tăng revision.

### Kịch bản 2: Duyệt Trang kèm Cảnh báo Spellcheck (`acknowledge_khmer_warnings`)
1. Tìm trang có cảnh báo chính tả hoặc chưa validate Khmer.
2. Bấm nút **"Duyệt trang"**.
3. Modal `ApproveWarningDialog` xuất hiện yêu cầu xác nhận.
4. Đánh dấu checkbox **"Tôi xác nhận đã kiểm tra..."** và bấm **"Xác nhận duyệt"**.
5. **Kỳ vọng:** API `PUT /api/stories/{story_id}/pages/{page_id}/review` nhận `decision=approve` và `acknowledge_khmer_warnings=true`; trang chuyển sang `approved`.

### Kịch bản 3: Từ chối & Sinh lại Ảnh đơn Trang (Single-Page Regeneration)
1. Bấm nút **"Từ chối trang"** trên một trang, nhập lý do từ chối (5-500 ký tự).
2. Trang chuyển sang `rejected`.
3. Kiểm tra lý do từ chối rồi bấm **"Tạo lại ảnh"**; UI không yêu cầu nhập prompt tiếng Anh mới.
4. API trả `202 ACCEPTED` với `already_running` và canonical `review`; không expose UUID claim. Background task dùng prompt đã khóa + lý do từ chối, gọi `gpt-image-2` và upload R2.
5. **Kỳ vọng:** Khi hoàn tất, URL ảnh được safe-swap, page image về `completed`, review decision về `pending`, story về `pending_review`; runner UUID cũ không thể ghi đè.

### Kịch bản 4: Xuất bản & Quản lý Link Chia sẻ Public
1. Khi tất cả các trang đều `approved`, bấm **"Hoàn tất duyệt"** -> story sang `approved`.
2. Bấm **"Xuất bản truyện"** -> story chuyển sang `published` và sinh `public_share_token` (43 ký tự URL-safe).
3. Bấm **"Sao chép link chia sẻ"** và mở tab ẩn danh truy cập `/stories/{share_token}`.
4. **Kỳ vọng:** Trình đọc Public Reader hiển thị bìa đơn giản (ảnh trang 1 + gradient + tiêu đề DOM); Khmer mặc định, toggle đúng một body language tại một thời điểm, và dùng pager Previous/Next, keyboard hoặc swipe (không page-flip).
5. Bấm **"Hủy link chia sẻ"** từ Admin workspace -> truy cập lại link cũ -> nhận `404 Not Found` kèm security headers.

### Kịch bản 5: Archive và canonical navigation
1. Mở trực tiếp `/admin/stories/[storyKey]/images` khi story đang `pending_review`, `approved` hoặc `published`.
2. **Kỳ vọng:** route redirect sang `/review`, không hiển thị historical image workspace.
3. Archive từ review/published và kiểm tra request có `expected_status`; published có thêm `expected_share_revision`.
4. **Kỳ vọng:** UI nhận `StoryResponse`, chuyển về danh sách; link public cũ của published story trả 404.

---

## 3. Kết quả gate hiện tại (không phải Phase 5 completion claim)

| Hạng mục Verification | Trạng thái | Ghi chú |
| :--- | :--- | :--- |
| **Backend Unit & API Tests** | ✅ **PASSED** | 268 offline pytest passed (0 failed); 65 PostgreSQL-marked tests được deselect khi chạy non-integration gate. |
| **Backend Type & Lint Checks** | ✅ **PASSED** | `mypy` 0 errors (72 files), `ruff check/format` 0 errors. |
| **Backend Migration Graph** | ✅ **PASSED** | Single head `006 (head)` verified. |
| **Frontend Unit, Hook & Dialog Tests** | ✅ **PASSED** | 135 Vitest tests across 16 files (0 failed), gồm cả hai completion order của reader visibility race, terminal silent-404, ACK-loss reread và mobile stale-recovery CTA. |
| **Frontend Type & Build** | ✅ **PASSED** | `tsc --noEmit` và `next build` pass ngày 2026-07-26; lint 0 error, còn 4 warning đã ghi nhận. |
| **PostgreSQL Integration** | ⏳ **COLLECTED, NOT EXECUTED** | 65 tests collect, gồm 28 test Phase 5 cho migration 006 lifecycle/constraints, durable ACK-loss fresh-session reconcile/reset, real runner provider/upload fencing, stale reclaim, race, token collision và full flow. Docker daemon hiện tắt; chỉ được đổi thành pass sau khi Testcontainers chạy thật. |
| **Live Supabase Migration** | ✅ **APPLIED 2026-07-26** | `alembic upgrade head` chạy trên Supabase live (pooler ap-northeast-2): `005 → 006`. Đã verify đủ 6 cột mới, 5 constraint mới, partial unique index token và `review_status NOT NULL`. |
| **Live Publish/Share/Reader Smoke** | ✅ **PASSED 2026-07-26** | Xem Section 4. Kịch bản 4 chạy trên localhost + Supabase live: publish story 1 → token 43 ký tự, public API 200 với projection sạch, reader render bìa/trang thật; revoke → token cũ 404 + UI "Không tìm thấy truyện". Data đã restore về `pending_review` sau smoke. |
| **Live OpenAI/R2 Acceptance** | ⏳ **PENDING DEPLOYMENT** | Sẵn sàng verify với API key live (smoke trên chỉ đọc ảnh R2 có sẵn, chưa test upload/regeneration live). |
| **Browser Acceptance** | ⏳ **PENDING DEPLOYMENT** | Headless-browser E2E localhost đã pass cho public reader (Section 4); browser matrix thật và admin UI sau đăng nhập vẫn chờ verify thủ công. |

---

## 4. Nhật ký Live Smoke 2026-07-26 (localhost + Supabase thật)

Thực hiện qua service layer của backend (cùng code path với HTTP API, bỏ qua tầng auth transport vì môi trường headless không đăng nhập admin được) + HTTP checks với backend `uvicorn` thật:

1. **Migration**: `alembic upgrade head` → `006`; preconditions checked trước khi chạy (0 dirty rows, review metadata NULL).
2. **Approve 6/6 trang** (acknowledge Khmer warnings) → `complete_review` → story `approved`.
3. **Publish** → story `published`, sinh token 43 ký tự URL-safe; `GET /api/public/shared-stories/{token}` → `200`, body chỉ gồm `title_km/title_vi/target_age/page_count/cover/pages` (không lộ ID nội bộ); reader `/stories/{token}` render bìa + 6 trang với ảnh R2 thật.
4. **Revoke** → `public_share_revoked_at` set; token cũ → `404` kèm `cache-control: private, no-store`, `x-robots-tag: noindex`; reader hiển thị đúng trạng thái "Không tìm thấy truyện".
5. **Restore**: story 1 và 6 trang được đưa về đúng trạng thái trước smoke (`pending_review`, 6 pending, share revision 0, không token) — đã verify lại qua `get_review_state`.
