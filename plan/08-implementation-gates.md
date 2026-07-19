# Katha — Implementation Gates

> Ngày tạo: 2026-07-11
> Mục đích: Các quyết định chưa chốt — dev KHÔNG được ngầm coi là đã quyết.
> Mỗi gate phải được chốt trước khi bắt đầu phase liên quan.

---

## Danh sách gates

| # | Gate | Mô tả | Cần chốt trước phase |
|---|------|-------|---------------------|
| G1 | Reader public hay login + cách phân quyền admin | Reader (học sinh đọc truyện) có cần đăng nhập không? Nếu public, endpoint nào cần auth? | Auth / UI (Phase 1-2) |
| G2 | Character nào xuất hiện trên từng trang | Hiện tại `story_characters` chỉ map story↔character (M:N). Cần quyết có track character theo từng page không, hay chỉ dùng trong prompt. | Image pipeline (Phase 4) |
| G3 | Bìa là asset riêng hay một page | `cover_image_url` trên `stories` gợi ý bìa riêng, nhưng flow gen bìa và mối quan hệ với `story_pages` chưa rõ. | Image pipeline + Reader (Phase 4-5) |
| G4 | Cách chạy/retry/progress sinh ảnh | Background job dùng gì? (Celery, ARQ, asyncio task, hay đơn giản hơn?) Retry policy? Progress tracking (WS/SSE)? | Image pipeline (Phase 4) |
| G5 | Character bank chỉ seed hay có CRUD/gen ref mới | 7 nhân vật hiện tại đã gen sẵn. MVP có cần UI tạo nhân vật mới + gen ảnh ref không, hay chỉ seed từ data có sẵn? | Character module (Phase 2) |
| G6 | `target_age` là tuổi cụ thể hay khoảng tuổi | Schema hiện tại: `target_age int`. Có nên đổi thành range (e.g. `5-8`) hay giữ int? Ảnh hưởng UI dropdown. | Story setup UI (Phase 3) |
| G7 | Thu thập số liệu NCKH ngoài hệ thống thế nào | Không có `story_edit_logs` hay `usage_logs` trong DB. Cần chốt: dùng OpenAI dashboard? Export manual? Google Form? | Phase NCKH (Phase 7) |

---

## Quy tắc

1. **Không tự chốt** — dev gặp gate phải hỏi product owner trước khi implement.
2. **Không thêm bảng** — nếu gate yêu cầu schema mới, phải cập nhật `07-database-schema.md` trước.
3. **Không block foundation** — các gate này không chặn Phase 1 (setup, migration, seed). Chỉ chặn phase liên quan.
4. **Ghi lại quyết định** — khi gate được chốt, ghi vào `01-decisions-log.md` và đánh dấu ở đây.

---

## Trạng thái

| Gate | Trạng thái | Ngày chốt | Ghi chú |
|------|-----------|-----------|----------|
| G1 | ✅ CHỐT | 2026-07-17 | Reader đọc truyện public; toàn bộ `/admin/*` và API phục vụ admin yêu cầu tài khoản có role `admin`. Backend là lớp enforcement cuối cùng. |
| G2 | ⬜ OPEN | — | — |
| G3 | ✅ CHỐT | 2026-07-19 | Bìa dùng code template (React/Tailwind/SVG), không sinh bằng AI. Cover không nằm trong story_pages. cover_image_url nullable, reserved cho future export. |
| G4 | ⬜ OPEN | — | — |
| G5 | ✅ CHỐT | 2026-07-17 | Character Bank MVP chỉ đọc 7 nhân vật seed; không CRUD, upload hay sinh reference mới trong Phase 2. |
| G6 | ✅ CHỐT | 2026-07-19 | target_age dùng text enum group: preschool, early_primary, late_primary. Migration 002 chuyển từ integer. |
| G7 | ⬜ OPEN | — | — |
