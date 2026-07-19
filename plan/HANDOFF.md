# HANDOFF — Katha Story Generator

> ⚠️ **FILE NÀY LÀ BẮT BUỘC ĐỌC** khi bắt đầu chat mới về dự án Katha.
> Đọc file này TRƯỚC, sau đó đọc các file được reference bên dưới.
> Ngày cập nhật: 2026-07-20

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

### Kiến trúc core
- **2-phase pipeline**: Text Phase (rẻ, iterate thoải mái) → Image Phase (đắt, chạy 1 lần)
- Text KHÓA sau khi admin confirm → không sửa text ở image phase
- Sửa ảnh từng trang riêng lẻ (không gen lại hàng loạt)
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
- **Layout**: Landscape (tất cả)
- **Song ngữ**: KM primary (reader) / VN primary (admin edit)

### Edit flow
- Quick actions: [Rút gọn nội dung] [Viết chi tiết hơn] [Kịch tính hơn] [Đơn giản hơn]
- Tất cả quick actions giữ nguyên page count/order
- Custom instruction mặc định giữ cấu trúc; chỉ add/delete/reorder khi admin yêu cầu rõ
- Add/delete/reorder dùng control riêng; archive `text_draft` deferred P1
- Validate page Khmer cũ qua explicit `POST /validate-km`; retranslate title/page qua endpoint chung
- KHÔNG có inline text edit trong MVP

### Auth + Data
- 2-5 tài khoản tạo sẵn (Supabase Auth)
- Reader public, không yêu cầu đăng nhập (D22)
- Character Bank chỉ đọc 7 nhân vật seed trong MVP (D23)
- Archive thay vì delete (giữ data cho NCKH)
- Vocabulary layer: future phase, KHÔNG trong MVP

### DB Schema design — 7 bảng, không thêm bảng mới ✅
- **Source of truth**: `07-database-schema.md`; migration 003 dự kiến thêm status/revision/generation claim UUID, migration 004 thêm Khmer validation timestamp
- KHÔNG có `story_outlines`, `story_edit_logs`, `usage_logs`, `vocabulary` trong MVP
- Generation ownership dùng `text_generation_claim_id`; `updated_at` chỉ xác định stale
- Chỉ G2 và G4 còn mở; G1/G3/G5/G6 đã chốt

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
    - 3B: 📋 Plan READY; chưa triển khai
    - 3C: 📋 Core contract READY; chỉ bắt đầu sau khi 3B được review accept
⬜ Phase 4:   Image generation
⬜ Phase 5:   Review, publish, reader
⬜ Phase 6:   QA, deploy
⬜ Phase 7:   NCKH evaluation
```

### Bước tiếp theo

1. Dùng baseline Phase 3A `3048010` làm điểm bắt đầu ổn định.
2. Triển khai Phase 3B theo `PHASE_3B_TEXT_GENERATION_PLAN.md` và review accept contract 3B.
3. Chỉ sau đó mới bắt đầu Phase 3C core; archive `text_draft` giữ ở P1 deferred.

---

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
| `PHASE_3B_TEXT_GENERATION_PLAN.md` | Source of truth triển khai generation + bilingual preview |
| `PHASE_3C_STORY_EDITOR_CONFIRMATION_PLAN.md` | Source of truth editor + validation + confirm sau khi 3B accept |
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
