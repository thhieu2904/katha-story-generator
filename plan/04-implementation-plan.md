# Katha — Kế hoạch triển khai

> Ngày cập nhật: 2026-07-20
> DB schema: xem `07-database-schema.md` (source of truth duy nhất)
> Quyết định chưa chốt: xem `08-implementation-gates.md`
> Các gate đã chốt: G1 (D22), G3 (D27), G5 (D23), G6 (D24).

---

## Phase Map

```
✅ Pre-work:  Model test (OpenAI vs Gemini) → chốt All OpenAI
✅ Pre-work:  Character assets (7 nhân vật + ref sheets)
✅ Pre-work:  DB schema design (7 bảng) → 07-database-schema.md
✅ Phase 0:   Đồng bộ plan / documentation
✅ Phase 1:   Foundation — code-complete offline; Docker/Supabase/R2 live checks pending
✅ Phase 2:   Config APIs + Character Bank read-only — code-complete offline
🔨 Phase 3:   Text generation / edit / confirm
    - 3A: ✅ Code-complete offline — Docker/live verification pending
    - 3B: Text Generation — AI sinh title + full story pages trực tiếp (D25)
    - 3C: Story Editor & Confirmation
⬜ Phase 4:   Image generation cho các trang nội dung
⬜ Phase 5:   Review, publish, reader
⬜ Phase 6:   QA, deploy
⬜ Phase 7:   NCKH evaluation
```

---

## Phase 1 — Foundation (3-4 ngày) — Code-complete offline

> Docker image build và live Supabase/R2/health smoke vẫn pending.

### Mục tiêu
Setup repo, scaffold `frontend/` + `backend/`, chạy migration theo `07-database-schema.md`, seed data, kết nối Supabase + R2, health check.

### Việc cần làm

- [ ] **1.1** Init Git repo + monorepo structure
  - `frontend/` (Next.js App Router, TypeScript)
  - `backend/` (FastAPI, Python)
  - `.gitignore`, `README.md`, branch strategy (main / develop / feature/*)

- [ ] **1.2** Scaffold `backend/`
  - Project structure: `src/` với feature folders (auth, characters, stories, config_data, ai, storage, khmer)
  - `pyproject.toml`, Dockerfile, `.env.example`
  - Cài dependencies: FastAPI, SQLAlchemy[asyncio], asyncpg, Alembic, openai, boto3, khmercut

- [ ] **1.3** Scaffold `frontend/`
  - `npx -y create-next-app@latest ./frontend`
  - Cài dependencies: SWR, @supabase/supabase-js, @dnd-kit/core, @dnd-kit/sortable
  - Setup Noto Sans Khmer font (self-hosted)

- [ ] **1.4** Setup Supabase project
  - Tạo project trên Supabase (free tier)
  - Alembic migration tạo 7 bảng theo `07-database-schema.md` — **KHÔNG thêm/sửa bảng**
  - Tạo 2-5 user accounts qua Auth dashboard

- [ ] **1.5** Viết seed spec
  - Viết `prompt_template_en` cho 3 backbones (NOT NULL trong schema)
  - Viết `prompt_modifier_en` cho 4 genres (NOT NULL trong schema)
  - Viết `prompt_modifier_en` cho 3 art styles (NOT NULL trong schema)
  - Mapping `characters/characters.json` → schema `characters` (cột nào map vào đâu)
  - Output: file seed SQL hoặc Python script chạy được

- [ ] **1.6** Chạy seed data
  - 3 records → `story_backbones` (dùng seed spec ở 1.5)
  - 4 records → `story_genres`
  - 3 records → `art_styles`
  - 7 records → `characters`

- [ ] **1.7** Setup Cloudflare R2
  - Tạo bucket, config CORS
  - Upload 7 ảnh reference nhân vật → R2
  - Test upload/download

- [ ] **1.8** Kết nối + health check
  - Backend ↔ Supabase (DATABASE_URL)
  - Backend ↔ R2 (S3 SDK)
  - Frontend ↔ Backend (NEXT_PUBLIC_API_URL)
  - Frontend ↔ Supabase Auth (client)
  - `GET /health` endpoint
  - Vercel preview deploy

### Quy tắc Phase 1
- Dùng `frontend/` và `backend/` — KHÔNG dùng `/web`, `/api`, `/shared`
- Migration PHẢI theo `07-database-schema.md` — không tự thêm bảng
- KHÔNG bắt đầu image pipeline ở phase này
- KHÔNG tạo `story_outlines`, `story_edit_logs`, `usage_logs`

### Deliverable
- Repo có scaffold chạy được (hello world cả FE + BE)
- DB có 7 bảng + seed data
- R2 có 7 ảnh ref
- Health check endpoint hoạt động

---

## Phase 2 — Config APIs + Character Bank read-only (3-4 ngày) — Code-complete offline

### Mục tiêu
API đọc config (backbones, genres, art styles), API đọc 7 nhân vật seed và UI Character Bank read-only theo D23.

### Việc cần làm

- [x] **2.1** API config data (read-only)
  - `GET /backbones` — danh sách cấu trúc truyện
  - `GET /genres` — danh sách thể loại
  - `GET /art-styles` — danh sách phong cách vẽ

- [x] **2.2** API characters read-only
  - `GET /characters` — danh sách nhân vật
  - `GET /characters/:id` — chi tiết

- [x] **2.3** Auth middleware
  - Verify Supabase JWT
  - `get_current_user` dependency
  - Admin API được bảo vệ; Reader public theo D22

- [x] **2.4** UI character list
  - Card grid hiển thị 7 nhân vật với ảnh ref
  - Không có CTA tạo/sửa/xóa trong MVP

### Deliverable
- API hoạt động: đọc config + characters
- Auth middleware chặn đúng
- UI nhân vật hiển thị 7 nhân vật hiện có

---

## Phase 3 — Text Generation / Edit / Confirm (5-6 ngày)

### Mục tiêu
Flow tạo truyện → sinh text VN → dịch KM → edit (quick actions + chat) → confirm text.

> `target_age` đã chốt theo D24: `preschool` (3–5), `early_primary` (6–8), `late_primary` (9–12).

### Việc cần làm

- [ ] **3.1** API tạo truyện
  - `POST /stories` — tạo story record
  - `POST /stories/:id/generate-text` — gọi LLM sinh text VN + auto dịch KM
  - `POST /stories/:id/edit` — gửi chat/quick action, AI trả text VN mới + auto dịch lại KM
  - `POST /stories/:id/confirm` — khóa text, chuyển status → `text_confirmed`
  - `PUT /stories/:id/pages` — cập nhật pages (reorder, add, delete)

- [ ] **3.2** AI text generation service
  - System prompt = base + backbone.prompt_template_en + genre.prompt_modifier_en
  - + character descriptions (appearance_prompt_en)
  - Output: text đầy đủ (không phải tóm tắt) cho từng trang
  - Pipeline text ghi trực tiếp vào `story_pages.text_vi` + `text_km`
  - Auto-save bản hiện tại sau mỗi AI response — KHÔNG lưu version/undo

- [ ] **3.3** Translator service
  - `translate(text, "vi", "km")` — cho hiển thị song ngữ
  - `translate(text, "vi", "en")` — cho image prompt (Phase 4)
  - Auto dịch lại từng trang khi sửa text VN

- [ ] **3.4** Khmer validator
  - Tích hợp khmercut + khmer-spellchecker
  - Output: `spellcheck_flags` JSON → lưu vào `story_pages`
  - Auto chạy sau mỗi lần dịch

- [ ] **3.5** Prompt engineering
  - Viết prompt_template_en cho 3 backbones
  - Viết prompt_modifier_en cho 4 genres
  - Test & tune

- [ ] **3.6** UI story setup form
  - Chọn nhân vật (multi-select), backbone, genre, art style
  - Nhập mô tả/chủ đề (VN)
  - Chọn độ dài (Ngắn/Vừa/Dài)
  - Chọn một trong ba nhóm tuổi D24 đã chốt

- [ ] **3.7** UI text editor song ngữ
  - Hiển thị text đầy đủ: VN (primary) + KM (subtitle)
  - Sortable list (dnd-kit) — drag-drop đổi thứ tự
  - Xóa/thêm trang
  - Quick actions: [Thu ngắn] [Dài thêm] [Kịch tính hơn] [Đơn giản hơn]
  - Chat input
  - Toast báo thay đổi (KHÔNG có nút hoàn tác — xem D07)
  - Nút [Xác nhận nội dung & Sinh ảnh]

### Deliverable
- Flow: nhập mô tả → sinh text VN + KM → edit → confirm
- Text editor song ngữ với quick actions + chat + drag-drop
- Auto-save bản hiện tại
- Dịch VN→KM tự động + spellcheck flags

---

## Phase 4 — Image Generation (3-4 ngày)

### Mục tiêu
Sinh ảnh minh họa cho từng trang (text đã khóa ở Phase 3).

> ⚠️ **OPEN — Gate G2**: Character nào trên từng trang?
> ⚠️ **OPEN — Gate G4**: Cách chạy/retry/progress sinh ảnh?

### Việc cần làm

- [ ] **4.1** Image prompt generator
  - Input: text_en (dịch từ text_vi) + character descriptions + art style
  - Output: prompt EN cho gpt-image-2
  - Luôn chứa visual anchor (appearance_prompt_en đầy đủ)

- [ ] **4.2** Image generation service
  - Gọi gpt-image-2 với prompt + ref images
  - Aspect ratio: 16:9 (landscape)
  - Chi phí: ~$0.13/ảnh
  - Upload kết quả lên R2
  - Retry/progress → **Gate G4**

- [ ] **4.3** Không sinh ảnh bìa; code-template cover được làm cùng Reader/Story Card ở Phase 5 (D27)

- [ ] **4.4** UI progress
  - Progress bar: "🎨 Đang vẽ trang 3/8..."
  - Preview ảnh hiện dần khi gen xong

### Deliverable
- Các trang nội dung có ảnh nhất quán; bìa là code template riêng và không tính là image API call
- Progress tracking hoạt động

---

## Phase 5 — Review, Publish, Reader (4-5 ngày)

### Mục tiêu
Admin duyệt ảnh từng trang, sửa text KM, gen lại ảnh. Xuất bản. Reader đọc truyện.

> Reader public, không yêu cầu đăng nhập (D22).
### Việc cần làm

- [ ] **5.1** API review
  - `PUT /stories/:id/pages/:page_id/review` — approve/reject
  - `PUT /stories/:id/pages/:page_id/text` — sửa text KM
  - `POST /stories/:id/pages/:page_id/regenerate-image` — gen lại ảnh 1 trang
  - `PUT /stories/:id/publish` — xuất bản

- [ ] **5.2** UI review
  - Từng trang: ảnh + text KM (editable) + text VN (đối chiếu)
  - Highlight spellcheck flags
  - Nút: approve, reject, sửa text, tạo lại ảnh
  - Progress: x/n trang đã duyệt

- [ ] **5.3** State machine
  - Implement status transitions
  - Validation: không cho publish nếu chưa approve hết

- [ ] **5.4** API reader
  - `GET /public/stories` — danh sách published
  - `GET /public/stories/:id` — chi tiết + pages
  - Public route, không yêu cầu auth

- [ ] **5.5** UI reader
  - Story list: card grid, ảnh bìa, title KM + VN
  - Page flip: landscape, KM primary + VN subtitle
  - Noto Sans Khmer, 22-26px, line-height 1.8+

- [ ] **5.6** Cross-browser test
  - Chrome, Firefox, Safari
  - Tablet + mobile (xoay ngang)
  - Font Khmer render

### Deliverable
- Review flow hoàn chỉnh
- Reader đẹp, responsive, font Khmer đúng
- Admin xuất bản → reader thấy truyện

---

## Phase 6 — QA, Deploy (2-3 ngày)

### Việc cần làm

- [ ] **6.1** End-to-end test
  - Full flow: tạo truyện → gen text → edit → confirm → gen ảnh → review → publish → đọc
  - Test edge cases: mạng chậm, API timeout, ảnh lỗi

- [ ] **6.2** Deploy production
  - Frontend → Vercel (production branch)
  - Backend → VPS DigitalOcean (Docker)
  - Database → Supabase (đã setup)
  - R2 → Cloudflare (đã setup)

- [ ] **6.3** Performance + security
  - Rate limiting
  - Input validation
  - Error handling
  - CORS config

### Deliverable
- Production deploy hoạt động
- Full flow chạy end-to-end

---

## Phase 7 — NCKH Evaluation (4-6 ngày)

### Mục tiêu
Thu thập dữ liệu, đánh giá, viết báo cáo.

> ⚠️ **Gate G7** (`08-implementation-gates.md`): Thu thập số liệu ngoài hệ thống thế nào?

### Việc cần làm

- [ ] **7.1** Thiết kế rubric đánh giá
  - Tỷ lệ lỗi chính tả Khmer
  - Độ nhất quán nhân vật (reviewer chấm 1-5)
  - Độ phù hợp nội dung (reviewer chấm 1-5)
  - Chất lượng minh họa (reviewer chấm 1-5)

- [ ] **7.2** Tạo dữ liệu
  - 5-10 truyện với combo backbone + genre khác nhau
  - Full pipeline mỗi truyện

- [ ] **7.3** Thu thập số liệu → **Gate G7**
  - OpenAI dashboard cho chi phí
  - Reviewer chấm rubric
  - Phương pháp khác tùy gate G7

- [ ] **7.4** Phân tích & viết báo cáo

### Deliverable
- Bảng số liệu
- Báo cáo NCKH

---

## Risk & Mitigation

| Rủi ro | Xác suất | Ảnh hưởng | Giảm thiểu |
|--------|----------|-----------|------------|
| AI drift nhân vật ở trang 10+ | Cao | Chất lượng ảnh | Giới hạn 16 trang, visual anchor mỗi prompt |
| Dịch Khmer sai ngữ pháp | Cao | Chất lượng nội dung | Spellcheck + reviewer thủ công |
| API timeout khi gen 12+ trang | Trung bình | UX kém | Background job + retry + progress bar |
| Font Khmer render lỗi | Trung bình | Hiển thị sai | Test cross-browser sớm, Noto Sans Khmer |
| Chi phí API vượt budget | Thấp | Tài chính | Giới hạn truyện, xem OpenAI dashboard |
