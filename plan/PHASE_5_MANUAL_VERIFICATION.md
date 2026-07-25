# Katha — Phase 5 Manual Verification & Deployment Acceptance

> Document hướng dẫn và nhật ký kiểm thử thủ công với PostgreSQL thực tế, live OpenAI/R2 API, và Browser Acceptance cho Phase 5.

---

## 1. Môi trường & Điều kiện tiên quyết

### PostgreSQL Thực tế (Real Instance)
- Khởi chạy PostgreSQL qua Docker: `docker-compose up -d postgres`
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
4. **Kỳ vọng:** Tiêu đề tiếng Khmer được cập nhật tức thì trên UI và DB, `text_revision` tăng 1.

### Kịch bản 2: Duyệt Trang kèm Cảnh báo Spellcheck (`acknowledge_khmer_warnings`)
1. Tìm trang có cảnh báo chính tả hoặc chưa validate Khmer.
2. Bấm nút **"Duyệt trang"**.
3. Modal `ApproveWarningDialog` xuất hiện yêu cầu xác nhận.
4. Đánh dấu checkbox **"Tôi xác nhận đã kiểm tra..."** và bấm **"Xác nhận duyệt"**.
5. **Kỳ vọng:** API `POST /review/pages/{id}/approve` được gọi với `acknowledge_khmer_warnings=true`, trang chuyển sang trạng thái `approved`.

### Kịch bản 3: Từ chối & Sinh lại Ảnh đơn Trang (Single-Page Regeneration)
1. Bấm nút **"Từ chối trang"** trên một trang, nhập lý do từ chối (5-500 ký tự).
2. Trang chuyển sang `rejected`.
3. Nhập prompt tiếng Anh mới và bấm **"Sinh lại ảnh"**.
4. API trả về `202 ACCEPTED` kèm `job_id`. Background task tiến hành gọi OpenAI / DALL-E & upload R2.
5. **Kỳ vọng:** Khi hoàn tất, ảnh mới hiển thị trên UI, trang quay lại `completed` và story về `pending_review`.

### Kịch bản 4: Xuất bản & Quản lý Link Chia sẻ Public
1. Khi tất cả các trang đều `approved`, bấm **"Hoàn tất duyệt"** -> story sang `approved`.
2. Bấm **"Xuất bản truyện"** -> story chuyển sang `published` và sinh `public_share_token` (43 ký tự URL-safe).
3. Bấm **"Sao chép link chia sẻ"** và mở tab ẩn danh truy cập `/stories/{share_token}`.
4. **Kỳ vọng:** Trình đọc Public Reader hiển thị bìa đơn giản (ảnh trang 1 + gradient + tiêu đề DOM), cho phép lật trang và chuyển đổi ngôn ngữ Khmer / Việt.
5. Bấm **"Hủy link chia sẻ"** từ Admin workspace -> truy cập lại link cũ -> nhận `404 Not Found` kèm security headers.

---

## 3. Trạng thái Đạt được (Quality Gate Verification)

| Hạng mục Verification | Trạng thái | Ghi chú |
| :--- | :--- | :--- |
| **Backend Unit & API Tests** | ✅ **PASSED** | 262 offline pytest passed (0 failed). |
| **Backend Type & Lint Checks** | ✅ **PASSED** | `mypy` 0 errors (72 files), `ruff check/format` 0 errors. |
| **Backend Migration Graph** | ✅ **PASSED** | Single head `006 (head)` verified. |
| **Frontend Unit & Hook Tests** | ✅ **PASSED** | 117 vitest passed across 12 test files (0 failed). |
| **Frontend Type & Build Checks** | ✅ **PASSED** | `tsc --noEmit` 0 errors, `next build` 0 errors (static & dynamic routes compiled). |
| **PostgreSQL Executed Verification** | ⏳ **PENDING DEPLOYMENT** | Sẵn sàng chạy trên staging/production DB thực tế theo kịch bản trên. |
| **Live OpenAI/R2 Acceptance** | ⏳ **PENDING DEPLOYMENT** | Sẵn sàng verify với API key live. |
| **Browser Acceptance** | ⏳ **PENDING DEPLOYMENT** | Sẵn sàng verify giao diện trên browser thực tế. |
