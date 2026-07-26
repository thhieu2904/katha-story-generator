# HANDOFF — Katha Story Generator

> ⚠️ **FILE NÀY LÀ BẮT BUỘC ĐỌC** khi bắt đầu chat mới về dự án Katha.
> Đọc file này TRƯỚC, sau đó đọc các file được reference bên dưới.
> Ngày cập nhật: 2026-07-26

---

## 1. Tổng quan dự án

**Katha** (កថា — "truyện kể") là web platform tạo truyện tranh thiếu nhi bằng AI, phục vụ giáo dục ngôn ngữ Khmer. Đây là dự án NCKH (nghiên cứu khoa học).

- **Repo**: `katha-story-generator` (GitHub)
- **Mục đích**: Giáo viên Việt dạy Khmer → tạo truyện tranh song ngữ KM/VN bằng AI
- **Target users**: 2-5 admin (giáo viên) + học sinh đọc truyện
- **Budget**: 500K VND (~$19.6) cho API costs

---

## 2. Mọi quyết định đã chốt

### Model AI (QUAN TRỌNG NHẤT)
- **Image gen**: OpenAI `gpt-image-2` — đã test, thắng Gemini rõ ràng
- **Text gen**: OpenAI `gpt-4o-mini` — rẻ hơn Gemini 2.5 Flash (input 2x, output 4x)
- **Agent điều phối**: OpenAI `gpt-4o-mini`
- **Dịch VN→KM**: OpenAI `gpt-4o-mini`
- **Combo**: ALL OpenAI = 1 provider, 1 billing, đơn giản
- **Lý do chi tiết**: Xem `05-research-notes.md`, Section 9-10

### Chi phí đã tính
- 1 ảnh truyện: ~$0.13 (gpt-image-2)
- 1 truyện (8 trang): ~$1.07 (97% là ảnh)
- Text gen gần như free (~$0.03/truyện)
- Budget $19.6 → tối đa ~18 truyện
- Batch API đã nghiên cứu → KHÔNG dùng (UX kém)

- Phase 4 không hard-code giá ảnh/truyện; các ước tính lịch sử không phải runtime contract.
### Kiến trúc core
- **2-phase pipeline**: Text Phase (rẻ, iterate thoải mái) → Image Phase (đắt, chạy 1 lần)
- Sau confirm, VI/EN/structure/setup/prompt/mapping khóa downstream; D37 chỉ cho controlled `title_km`/`text_km` ở `pending_review`, page edit tăng revision và clear validator/review metadata.
- Regenerate chỉ một page `rejected` có reason tại một thời điểm/story; giữ URL + rejection metadata cũ cho tới khi safe swap/failure.
- Auto-save bản hiện tại, không undo/version history trong MVP

### Content design
- **3 backbone**: Ngụ ngôn, Ba hồi, Lặp lại
- **4 genre**: Cổ tích, Anh hùng, Hài hước, Răn dạy
- **3 art style**: Màu nước, Phẳng, 3D cartoon (admin chọn khi tạo)
- **Số trang nội dung**: `short` 4–6, `medium` 8–10, `long` 12–14
- **Initial generation**: chỉ số chẵn `{4,6}`, `{8,10}`, `{12,14}`; sau edit cho phép số lẻ trong band và confirm không kiểm tra chẵn/lẻ
- **Độ dài/page**: preschool 12–30 từ (max 45), early primary 30–60 (max 80), late primary 50–90 (max 120)
- **Hard limit**: tối đa 16 trang nội dung
- **Sinh text**: AI sinh trực tiếp title + full story pages; không có outline riêng
- **Bìa**: code template React/Tailwind/SVG, không sinh AI và không nằm trong `story_pages`
- **Reader layout**: một cột mọi viewport, ảnh 16:9 trên/text dưới, không ép xoay; cover có cả hai title.
- **Ngôn ngữ reader**: Khmer mặc định; toggle chỉ một body language tại một thời điểm. Admin dùng Việt làm đối chiếu/edit context.

### Edit flow
- Quick actions: [Rút gọn nội dung] [Viết chi tiết hơn] [Kịch tính hơn] [Đơn giản hơn]
- Tất cả quick actions giữ nguyên page count/order
- Custom instruction luôn giữ page IDs/count/order trong P0; add/delete/reorder chỉ qua control riêng
- Add/delete/reorder dùng control riêng; archive `text_draft` deferred P1
- Validator: `POST /api/stories/{id}/validate-km` với expected revision, warning-only, không tăng revision/đổi review status; warning/unvalidated cần explicit acknowledgement khi approve.
- Không inline edit VI/EN/structure downstream; Phase 5 controlled edit `title_km`/`text_km` chỉ ở `pending_review` (D37).

### Auth + Data
- 2-5 tài khoản tạo sẵn (Supabase Auth)
- Reader public không login **chỉ** qua opaque `/stories/[shareToken]` (D49); không catalogue/search/numeric public route.
- D51 mobile compact (`width < 768px` hoặc `height < 600px`) giữ quick/create-list/resume, progress, stale-recovery và share; Khmer deep edit/review/regenerate decisions cần canvas `width >= 768px` và `height >= 600px`.
- Character Bank chỉ đọc 7 nhân vật seed trong MVP (D23)
- Archive thay vì delete (giữ data cho NCKH)
- Vocabulary layer: future phase, KHÔNG trong MVP

### DB Schema design — 7 bảng, không thêm bảng mới ✅
- **Source of truth**: `07-database-schema.md`; migration 003/004 là text lifecycle/Khmer validation, 005 image generation và 006 review/publish constraints.
- KHÔNG có `story_outlines`, `story_edit_logs`, `usage_logs`, `vocabulary` trong MVP
- Generation ownership dùng `text_generation_claim_id`; `updated_at` chỉ xác định stale
- G2 đã chốt ở D34 và G4 đã chốt ở D35 cho Phase 4; G1/G3/G5/G6 cũng đã chốt

### Tất cả decisions chi tiết: xem `01-decisions-log.md`

---

## 3. Character Bank — ĐÃ HOÀN THÀNH ✅

7 nhân vật đã gen reference sheets bằng OpenAI GPT Image 2:

| # | File | Tên | Tuổi | Vai trò |
|---|------|-----|------|---------|
| 1 | `01-srey.png` | Srey (ស្រី) | 7 | Protagonist nữ |
| 2 | `02-dara.png` | Dara (ដារ៉ា) | 10 | Protagonist nam, anh Srey |
| 3 | `03-yeay.png` | Yeay (យាយ) | 65 | Bà nội |
| 4 | `04-mae.png` | Mae (ម៉ែ) | 35 | Mẹ |
| 5 | `05-bopha.png` | Bopha (បុប្ផា) | 6 | Bạn thân Srey |
| 6 | `06-lok-kru.png` | Lok Kru (លោកគ្រូ) | 45 | Thầy giáo |
| 7 | `07-meas.png` | Meas (មាស) | 2 | Mèo cưng (mascot) |

**Files**:
- Ảnh reference: `plan/characters/refs/`
- JSON data (appearance_prompt_en, metadata): `plan/characters/characters.json`
- Prompts đã dùng: `plan/characters/prompts.md`
- Tổng quan + quan hệ + combo truyện: `plan/characters/README.md`

**Cách dùng reference khi gen ảnh truyện**:
- Upload ảnh ref (turnaround sheet) + text anchor (`appearance_prompt_en` từ JSON)
- Art style qua prompt modifier (watercolor/flat/3D)
- Ref image = ~8% chi phí thêm, đáng để tăng consistency
- Tối đa 2-3 nhân vật/scene cho consistency tốt nhất

---

## 4. Tech Stack (đã chốt)

| Layer | Công nghệ | Deploy |
|-------|-----------|--------|
| Frontend | Next.js (TypeScript) | Vercel |
| Backend | Python FastAPI | VPS (DigitalOcean) |
| Database | PostgreSQL | Supabase |
| Storage | Cloudflare R2 | Cloudflare |
| AI | OpenAI (gpt-image-2 + gpt-4o-mini) | API |
| Khmer NLP | Baseline Unicode validator + optional adapter sau dependency spike | VPS |

---

## 5. Tiến độ

```
✅ Pre-work:  Model test (OpenAI vs Gemini) → chốt All OpenAI
✅ Pre-work:  Character assets (7 nhân vật + ref sheets)
✅ Pre-work:  DB schema design (7 bảng) → 07-database-schema.md
✅ Phase 0:   Đồng bộ plan / documentation
✅ Phase 1:   Foundation — code-complete offline; Docker/Supabase/R2 live checks pending
✅ Phase 2:   Config APIs + Character Bank read-only — code-complete offline
🔨 Phase 3:   Text generation / edit / confirm
    - 3A: ✅ Baseline commit `3048010`; code-complete offline — Docker/live verification pending
    - 3B: ✅ Corrective offline coverage complete — Docker/live AI smoke pending
    - 3C: ✅ Corrective review blockers fixed; code-complete offline — Docker/live/native Khmer review pending
⚠️ Phase 4:   Image generation MVP — code-complete offline; PostgreSQL/live/browser acceptance còn pending
🔨 Phase 5:   Review, publish, reader — đang corrective review; chưa tuyên bố code-complete
⬜ Phase 6:   QA, deploy
⬜ Phase 7:   NCKH evaluation
```

### Bước tiếp theo

1. Bật Docker Desktop và chạy toàn bộ integration suite qua Testcontainers; repo không có Docker Compose service `postgres`.
2. Chạy live smoke có kiểm soát cho Phase 3–5 với `OPENAI_API_KEY`/R2 ngoài test suite.
3. Nhờ người đọc Khmer review sample; archive `text_draft` tiếp tục deferred P1.
4. Với Phase 4, kiểm tra legacy image URL + downstream-status migration guards, custom-size/multi-reference edit, R2 WebP upload và stale-job resume.

---

### Phase 3B implementation evidence (2026-07-20)

- Alembic graph: single head `003`; migration thêm `generating_text`, `text_revision`, UUID claim và `story_pages.story_id NOT NULL`.
- Backend: Responses API structured outputs, deterministic Vietnamese/Khmer validation, atomic claim/finalize/reset và canonical `GET /text`.
- Frontend: save-before-generate, timeout 285 giây + reconcile status, list CTA/status và bilingual read-only preview.
- Offline gates: Ruff pass, mypy pass, `151 passed, 26 deselected`; frontend ESLint pass với 1 warning `<img>` có sẵn, TypeScript pass, production build pass.
- Migration integration chưa chạy vì Docker Desktop không hoạt động (`dockerDesktopLinuxEngine` unavailable).
- Live OpenAI smoke chưa chạy vì cần `OPENAI_API_KEY`; không dùng key thật trong automated suite.
### Phase 3C implementation evidence (2026-07-20)

- Alembic graph: single head `004`; thêm nullable `story_pages.khmer_validated_at` và downgrade đối xứng.
- Backend: 7 editor/validation/confirm routes; optimistic `text_revision`; final lock/check sau AI; atomic selective translation; server-side diff; baseline Khmer warning-only.
- Frontend: full bilingual editor, quick actions, one-shot instruction, add/delete, dnd-kit pointer/touch/keyboard + up/down, retranslate, explicit validate bootstrap, conflict/timeout reconciliation và confirm read-only.
- Offline gates: Ruff pass, mypy pass, `151 passed, 26 deselected`; OpenAPI đủ 7 route; frontend ESLint pass với 1 warning `<img>` có sẵn, TypeScript pass, production build pass.
- 26 integration tests được collect, gồm full Phase 3 generation/editor/concurrency/rollback/migration lifecycle; chưa chạy vì Docker Desktop pipe không tồn tại.
- `text_draft` archive và advanced dictionary/segmentation adapter là P1, chưa triển khai.
- Báo cáo chi tiết: `old/PHASE_3C_IMPLEMENTATION_REPORT.md` (đã archive).

## 6. File map — Đọc gì ở đâu

| File | Nội dung |
|------|----------|
| `HANDOFF.md` (file này) | Tổng hợp mọi thứ, đọc TRƯỚC |
| `00-project-overview.md` | Tổng quan dự án |
| `01-decisions-log.md` | Mọi quyết định + lý do |
| `02-technical-design.md` | Thiết kế kỹ thuật chi tiết |
| `03-user-flows.md` | Flow người dùng |
| `04-implementation-plan.md` | Kế hoạch triển khai (phase map) |
| `05-research-notes.md` | Research: cast size, AI consistency, giá API, model comparison |
| `06-project-structure.md` | Cấu trúc thư mục frontend/ + backend/ |
| `07-database-schema.md` | **DB schema duy nhất** — source of truth cho migration |
| `08-implementation-gates.md` | Quyết định chưa chốt — dev KHÔNG được tự ý quyết |
| `10-deploy-vps.md` | Runbook deploy: FE Vercel + BE Docker/Caddy trên VPS |
| `11-deploy-homeserver.md` | Biến thể homeserver: Cloudflare Tunnel, scp vs CI/CD, giải thích multi-stage Docker |
| `12-giai-thich-kien-truc-deploy.md` | Giải thích TẠI SAO của toàn bộ kiến trúc deploy — đọc để hiểu, kèm sự cố đã gặp |
| `old/PHASE_3B_TEXT_GENERATION_PLAN.md` | Source of truth triển khai generation + bilingual preview |
| `old/PHASE_3C_STORY_EDITOR_CONFIRMATION_PLAN.md` | Source of truth editor + validation + confirm sau khi 3B accept |
| `old/PHASE_5_HUMAN_REVIEW_PUBLISH_READER_PLAN.md` | Source of truth D36–D42, D49–D51 và API/public-reader contract Phase 5 |
| `characters/README.md` | Tổng quan character bank |
| `characters/characters.json` | Data nhân vật (JSON) |
| `characters/prompts.md` | Prompt đã dùng gen ảnh |
| `characters/refs/*.png` | 7 ảnh reference sheets |

---

## 7. Về người dùng (context quan trọng)

- **Ngôn ngữ**: Tiếng Việt (giao tiếp), code/docs bằng tiếng Anh
- **Level**: Senior-capable developer, đang học thạc sĩ, làm cho trường
- **Kinh nghiệm**: RAG, AI agents (LangGraph), Docker, Caddy/Nginx, DigitalOcean
- **Phong cách**: Thích phân tích, cần lý do rõ ràng trước khi quyết định, hay hỏi "tại sao"
- **Constraint**: Budget sát (500K VND), cần tối ưu chi phí API
- **Lưu ý**: Không over-engineer, bắt đầu đơn giản, scale sau

---

## 8. Quy tắc cho agent mới

1. **Đọc file này trước** → hiểu context
2. **Không hỏi lại** những quyết định đã chốt (D01-D33)
3. **Giữ tiếng Việt** khi giao tiếp, code comments bằng tiếng Anh
4. **Budget-aware**: mọi quyết định API phải tính chi phí
5. **Đừng over-engineer**: MVP first, cần chạy được trước
6. **Reference character bank** tại `plan/characters/` — đã hoàn thành, không cần gen lại
7. **All OpenAI**: gpt-image-2 cho ảnh, gpt-4o-mini cho text/agent/dịch
8. Khi bàn về D11 (model) hoặc giá → đã chốt, xem Section 9-10 trong `05-research-notes.md`
9. **DB schema**: dùng `07-database-schema.md` làm source of truth duy nhất. KHÔNG tự thêm bảng.
10. **Quyết định chưa chốt**: xem `08-implementation-gates.md`. Không tự ý quyết thay.

---

## Phase 4 implementation evidence (cập nhật 2026-07-22)

Phần này thay thế các ghi chú cũ nói G2/G4 còn mở, Phase 4 có manual regeneration, hoặc có giá ảnh cố định.

- **Status**: implementation/code-complete offline; full acceptance còn pending PostgreSQL integration, live provider/storage và browser matrix. Alembic head `005`.
- **D34/G2**: mapping 0–3 character theo từng page được persist/revision/lock; prompt deterministic và manual per-page regenerate thuộc Phase 5.
- **D35/G4**: one-app-instance `BackgroundTasks` runner chạy sequential với UUID claim + heartbeat, `GET /images` polling và retry/resume `pending`/`failed`; task không bền qua restart/deploy nên dùng explicit stale-resume.
- **API**: admin tạo/sửa plan, rồi `POST /generate-images` nhận `202` sau durable claim; retry/resume chỉ áp dụng page pending/failed.
- **Data/R2**: scene/prompt/mapping + page status/attempt/error được persist; output WebP validate và upload R2, reference chỉ đọc qua configured public URL.
- **Cost**: không có giá cố định trong UI/API/docs vận hành; tính theo cấu hình image và provider pricing tại thời điểm chạy.
- **Phase boundary**: manual per-page regenerate là Phase 5 review, không thuộc Phase 4.
- **Migration safety**: `005_story_image_generation` hard-fail trước mọi DDL nếu có legacy `story_pages.image_url` không rỗng hoặc story downstream `pending_review`/`approved`/`published`; legacy `generating_images` không owner được normalize về `text_confirmed`.
- **Offline evidence**: backend `245 passed, 37 deselected`; riêng Phase 4 offline `94 passed`; Ruff/mypy pass; frontend Vitest `21 passed`, TypeScript và production build pass.
- **Timeout budget**: defaults dành `300s` cho tối đa hai OpenAI attempts (`150s × 2`), giữ `5s` finalization margin và tối đa `25s` botocore transport cho hai R2 upload attempts; custom config yêu cầu tối thiểu `1s` transport budget; botocore không có hidden retry.
- **Deferred**: `37` integration tests collect (`11` Phase 4) nhưng chưa execute; controlled live OpenAI/R2 custom-size/multi-reference và browser/manual matrix cũng chưa chạy.

## Phase 5 corrective implementation evidence (cập nhật 2026-07-26)

- **Status**: đang xử lý corrective review; Alembic head `006`. Chưa tuyên bố Phase 5 code-complete hoặc PostgreSQL verified.
- **Review**: canonical `/review` projection, optimistic page identity, edit title/page Khmer, chạy lại validator, explicit warning acknowledgement, complete-review.
- **Regeneration**: một page rejected, locked mapping/reference preflight trước UUID claim; response public chỉ có `already_running` + `review`. Claim đưa page về `pending` và clear lỗi cũ; fenced schedule reset đưa page về `failed/SCHEDULE_FAILED`, giữ URL/rejection metadata và bật retry. Stale target `pending|generating` được reclaim bằng fresh UUID trước usable-image guard.
- **Publish/share/reader**: publish revalidate dưới lock, share revision rotation, token cũ 404 với security headers, public projection không lộ ID nội bộ.
- **Archive/navigation**: draft giữ bodyless archive; review/published bắt buộc expected fields. `/images` redirect `/review` cho review regeneration và downstream statuses.
- **Offline evidence**: backend `268 passed, 65 deselected`; Ruff/format/mypy pass. Frontend `130 passed`/16 files, TypeScript và production build pass; lint 0 error/4 warning.
- **Integration evidence**: 65 test collect, gồm 28 Phase 5 test cho migration 006, durable ACK-loss fresh-session reconcile/reset, real provider/upload runner fencing, stale reclaim, §14 races, token collision và full flow. Docker Desktop Linux engine đang tắt, nên đây chỉ là collect/static review, không phải integration pass.

## Phase 5 UI corrective fixes + live smoke (2026-07-26, cùng ngày)

- **UI/flow fixes**: (1) review workspace truyền `status`/`storyTitle`/`imageWorkflowKind` vào `StoryWorkflowShell` ở mọi nhánh (kể cả loading/error, fallback meta từ stories API) — stepper hiện đúng bước 4 thay vì mặc định bước 1; (2) `CompleteReviewDialog` bỏ `&quot;` entity để né bug SWC/Turbopack Next 16.2 nuốt space sau `{expr}` khi text node chứa entity ("6trang"); (3) Duyệt/Từ chối gate theo `page.can_approve`/`page.can_reject` từ backend, Duyệt disable thêm khi trang đã approved, kèm hint text hiển thị (không chỉ tooltip); (4) action bar review theo đúng convention chung (hint trái + CTA phải, luôn hiện cho mọi status); (5) `useStoryReview`: reconcile nhận predicate `wasApplied` — banner lỗi được xóa khi canonical reread chứng minh mutation đã ăn; `handleRegenerateImage` thêm nhánh reconcile `status === 0` (nhận biết cả trường hợp job đã chạy xong qua attempt count/URL đổi); (6) thống nhất fallback title "Truyện chưa đặt tên", quotes typographic, counter trim-consistent cho 3 input, thêm counter cho `EditKhmerTitleDialog`.
- **Design pass**: Be Vietnam Pro (UI, hỗ trợ tiếng Việt đầy đủ) + Noto Serif Khmer (thân truyện reader + tiêu đề bìa — cảm giác sách); palette dịch sang indigo đêm ấm + accent vàng saffron; badge trạng thái kiểu chấm màu + chữ thường thay vì pill uppercase; stepper bỏ emoji khóa, dùng SVG.
- **Tests sau fix**: Vitest `137 passed/16 files` (5 test mới cho gating + reconcile predicate, có negative case); `tsc` 0 lỗi; lint 0 error/4 warning cũ.
- **Migration live**: `alembic upgrade head` chạy trên Supabase live 2026-07-26 → head `006`; verify đủ cột/constraint/partial unique index.
- **Live smoke**: approve 6/6 → complete → publish → token 43 ký tự → public API `200` (projection sạch) → reader render thật → revoke → `404` + security headers + UI not-found. Story 1 đã restore về `pending_review` nguyên trạng. Chi tiết: `PHASE_5_MANUAL_VERIFICATION.md` Section 4.
- **Còn pending**: 65 integration test (Testcontainers) chờ Docker Desktop Linux engine — app không tự khởi động trong phiên headless, cần mở thủ công; live OpenAI/R2 regeneration smoke; admin UI browser matrix sau đăng nhập.
