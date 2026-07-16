# Katha — Database Schema

> Ngày chốt: 2026-07-11
> Database: PostgreSQL (Supabase free tier)
> Auth: Supabase Auth (bảng `auth.users` tự tạo, không cần quản lý)

---

## Tổng quan

7 bảng, chia 3 nhóm:

```
CONFIG (seed data, ít thay đổi)
├── story_backbones     ← Cấu trúc truyện (3 records)
├── story_genres        ← Thể loại / giọng văn (4 records)
└── art_styles          ← Phong cách vẽ (3 records)

CORE (dữ liệu chính)
├── characters          ← Nhân vật + ảnh reference
├── stories             ← Truyện (metadata + status lifecycle)
├── story_characters    ← Liên kết truyện ↔ nhân vật (junction, M:N)
└── story_pages         ← Từng trang truyện (text + ảnh + review)
```

### Quan hệ giữa các bảng

```
story_backbones ──┐
story_genres ─────┼──→ stories ←──── story_characters ────→ characters
art_styles ───────┘       │
                          │
                          └──→ story_pages
```

- 1 story → 1 backbone, 1 genre, 1 art_style
- 1 story → nhiều characters (qua junction table)
- 1 story → nhiều story_pages
- auth.users (Supabase) → FK cho created_by, reviewed_by

---

## Bảng chi tiết

### 1. story_backbones — Cấu trúc truyện

Seed data cố định, admin chọn 1 khi tạo truyện.
Prompt template quyết định cách AI xây dựng cốt truyện.

```sql
CREATE TABLE story_backbones (
    id              serial PRIMARY KEY,
    name_vi         text NOT NULL,              -- "Ngụ ngôn — Bài học cuộc sống"
    name_en         text NOT NULL,              -- "Fable"
    description_vi  text,                       -- Mô tả cho admin đọc khi chọn
    prompt_template_en text NOT NULL,           -- System prompt gửi cho LLM
    created_at      timestamptz DEFAULT now()
);
```

**Seed data (3 records):**

| name_en | name_vi | Mô tả |
|---------|---------|-------|
| Fable | Ngụ ngôn — Bài học cuộc sống | Bài học đạo đức cuối truyện |
| Three-Act | Ba hồi — Khởi đầu, Thử thách, Kết thúc | Cấu trúc kể chuyện kinh điển |
| Cumulative | Lặp lại — Càng lúc càng nhiều | Mỗi trang lặp + thêm yếu tố mới |

---

### 2. story_genres — Thể loại / giọng văn

Seed data cố định. Là prompt modifier ghép vào sau backbone prompt để thay đổi giọng kể.

```sql
CREATE TABLE story_genres (
    id              serial PRIMARY KEY,
    name_vi         text NOT NULL,              -- "Cổ tích"
    name_en         text NOT NULL,              -- "Fairy Tale"
    description_vi  text,                       -- Mô tả cho admin
    prompt_modifier_en text NOT NULL,           -- Modifier ghép vào prompt
    created_at      timestamptz DEFAULT now()
);
```

**Seed data (4 records):**

| name_en | name_vi |
|---------|---------|
| Fairy Tale | Cổ tích |
| Hero | Anh hùng |
| Comedy | Hài hước |
| Moral | Răn dạy |

---

### 3. art_styles — Phong cách minh họa

Seed data cố định. Admin chọn 1 khi tạo truyện, áp dụng cho tất cả ảnh trong truyện đó.

```sql
CREATE TABLE art_styles (
    id              serial PRIMARY KEY,
    name_vi         text NOT NULL,              -- "Tranh màu nước"
    name_en         text NOT NULL,              -- "Watercolor"
    prompt_modifier_en text NOT NULL,           -- Ghép vào image prompt
                                                -- VD: "soft watercolor illustration,
                                                --      gentle pastel colors..."
    sample_image_url text,                      -- Ảnh mẫu hiển thị cho admin
    created_at      timestamptz DEFAULT now()
);
```

**Seed data (3 records):**

| name_en | name_vi |
|---------|---------|
| Watercolor | Tranh màu nước |
| Flat Illustration | Tranh phẳng |
| 3D Cartoon | Hoạt hình 3D |

---

### 4. characters — Nhân vật

Ngân hàng nhân vật. Tạo 1 lần, dùng xuyên suốt nhiều truyện.
`appearance_prompt_en` là visual anchor — mô tả chi tiết EN, đưa vào MỌI image prompt
để AI giữ ngoại hình nhất quán.

```sql
CREATE TABLE characters (
    id                   serial PRIMARY KEY,
    name                 text NOT NULL,          -- "Srey"
    age                  int,                    -- 7
    personality_vi       text,                   -- "Tò mò, dũng cảm, hay cười"
    appearance_vi        text,                   -- Mô tả ngoại hình VN (admin nhập)
    appearance_prompt_en text NOT NULL,          -- Mô tả EN chi tiết (LLM expand)
                                                 -- Cố định, dùng làm visual anchor
    ref_image_urls       text[] DEFAULT '{}',    -- URLs ảnh reference trên R2 (1-3 ảnh)
    created_by           uuid REFERENCES auth.users(id),
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);
```

**Dữ liệu hiện có (7 nhân vật, đã gen ref sheets):**

| # | name | age | Vai trò |
|---|------|-----|---------|
| 1 | Srey (ស្រី) | 7 | Protagonist nữ |
| 2 | Dara (ដារ៉ា) | 10 | Protagonist nam |
| 3 | Yeay (យាយ) | 65 | Bà nội |
| 4 | Mae (ម៉ែ) | 35 | Mẹ |
| 5 | Bopha (បុប្ផា) | 6 | Bạn thân Srey |
| 6 | Lok Kru (លោកគ្រូ) | 45 | Thầy giáo |
| 7 | Meas (មាស) | 2 | Mèo cưng (mascot) |

- Ảnh reference: `characters/refs/*.png`
- JSON data: `characters/characters.json`

---

### 5. stories — Truyện

Bảng chính. Chứa metadata truyện và trạng thái lifecycle.

```sql
CREATE TABLE stories (
    id              serial PRIMARY KEY,
    title_vi        text,                       -- Tiêu đề tiếng Việt
    title_km        text,                       -- Tiêu đề tiếng Khmer
    description_vi  text NOT NULL,              -- Mô tả / chủ đề admin nhập
    backbone_id     int REFERENCES story_backbones(id),
    genre_id        int REFERENCES story_genres(id),
    art_style_id    int REFERENCES art_styles(id),
    target_age      int,                        -- Độ tuổi mục tiêu
    length_pref     text CHECK (length_pref IN ('short', 'medium', 'long')),
    status          text DEFAULT 'draft'
                    CHECK (status IN (
                        'draft',                -- Vừa tạo, chưa gen text
                        'text_draft',           -- Đã gen text, đang edit
                        'text_confirmed',       -- Admin chốt text, khóa
                        'generating_images',    -- Đang gen ảnh (background job)
                        'pending_review',       -- Ảnh xong, chờ duyệt
                        'approved',             -- Tất cả trang approved
                        'published',            -- Đã xuất bản, reader thấy
                        'archived'              -- Ẩn khỏi reader, giữ data
                    )),
    cover_image_url text,                       -- Ảnh bìa trên R2
    created_by      uuid REFERENCES auth.users(id),
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);
```

**Status lifecycle (2-phase):**

```
draft → text_draft → text_confirmed → generating_images → pending_review → approved → published
                                                                                    ↘ archived
```

- TEXT PHASE: draft → text_draft ↔ (edit loop) → text_confirmed (text bị khóa)
- IMAGE PHASE: text_confirmed → generating_images → pending_review ↔ (review loop) → approved
- PUBLISH: approved → published hoặc archived

---

### 6. story_characters — Junction table

Quan hệ nhiều-nhiều giữa stories và characters.

```sql
CREATE TABLE story_characters (
    story_id        int REFERENCES stories(id) ON DELETE CASCADE,
    character_id    int REFERENCES characters(id),
    PRIMARY KEY (story_id, character_id)
);
```

- 1 truyện dùng 2-3 nhân vật (khuyến nghị max 3 cho consistency)
- 1 nhân vật xuất hiện ở nhiều truyện

---

### 7. story_pages — Trang truyện

Bảng nặng nhất — chứa toàn bộ nội dung text (3 ngôn ngữ) + ảnh + review cho mỗi trang.

```sql
CREATE TABLE story_pages (
    id              serial PRIMARY KEY,
    story_id        int REFERENCES stories(id) ON DELETE CASCADE,
    page_no         int NOT NULL,               -- Thứ tự trang (1, 2, 3...)

    -- Nội dung text (3 ngôn ngữ)
    text_vi         text,                       -- Bản gốc tiếng Việt (admin edit)
    text_en         text,                       -- Bản dịch tiếng Anh (dùng cho image prompt)
    text_km         text,                       -- Bản dịch Khmer (AI dịch, admin có thể sửa)

    -- Ảnh minh họa
    image_prompt_en text,                       -- Prompt đã dùng sinh ảnh
    image_url       text,                       -- URL ảnh trên R2

    -- Khmer validation
    spellcheck_flags jsonb DEFAULT '[]',        -- Từ Khmer nghi sai chính tả
                                                -- VD: [{"word": "ប្រដាក្មេង", "position": 12}]

    -- Review (từng trang riêng lẻ)
    review_status   text DEFAULT 'pending'
                    CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_by     uuid REFERENCES auth.users(id),
    reviewed_at     timestamptz,
    review_notes    text,

    -- Meta
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE (story_id, page_no)
);
```

**Lưu ý:**
- `text_vi` là bản gốc — admin nhập/edit bằng VN
- `text_en` dùng nội bộ cho image prompt, user không thấy
- `text_km` là bản hiển thị cho reader — KM primary
- `review_status` duyệt TỪNG TRANG, không phải cả truyện
- `spellcheck_flags` chạy tự động sau khi dịch KM (khmercut + spellchecker)

---

## Indexes gợi ý

```sql
-- Tìm trang theo truyện (query thường xuyên nhất)
CREATE INDEX idx_story_pages_story_id ON story_pages(story_id);

-- Tìm truyện published (reader)
CREATE INDEX idx_stories_status ON stories(status);

-- Tìm truyện theo user
CREATE INDEX idx_stories_created_by ON stories(created_by);
```

---

## Không có trong schema

| Bảng đã bỏ | Lý do |
|-------------|-------|
| ~~story_outlines~~ | Không cần undo/version history cho MVP |
| ~~story_edit_logs~~ | Không cần metric NCKH trên hệ thống |
| ~~usage_logs~~ | Tracking chi phí xem trên OpenAI dashboard |
| ~~vocabulary~~ | Feature riêng, không thuộc Katha MVP |

---

## Hướng dẫn cho dev

### 1. Setup database
- Tạo project trên [Supabase](https://supabase.com) (free tier)
- Copy connection string vào `.env` backend
- Chạy migration (Alembic) hoặc paste SQL trực tiếp trên Supabase SQL Editor

### 2. Seed data
Sau khi tạo bảng, insert seed data:
- 3 records vào `story_backbones` (xem bảng ở mục 1)
- 4 records vào `story_genres` (xem bảng ở mục 2)
- 3 records vào `art_styles` (xem bảng ở mục 3)
- 7 records vào `characters` (xem bảng ở mục 4, data từ `characters/characters.json`)

### 3. Auth
- Dùng Supabase Auth — tạo 2-5 tài khoản qua dashboard
- Backend verify JWT token từ frontend (không tự build auth)
- Bảng `auth.users` do Supabase quản lý, chỉ cần FK reference

### 4. Quy tắc quan trọng
- **KHÔNG XÓA dữ liệu** — truyện không ưng → `status = 'archived'`
- **Text bị KHÓA** sau `text_confirmed` — không sửa text ở image phase
- **Review từng trang** — không approve/reject cả truyện 1 lúc
- Tối đa **2-3 nhân vật / truyện** cho consistency ảnh tốt nhất
