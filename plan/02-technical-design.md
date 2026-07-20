# Katha — Thiết kế kỹ thuật

> Ngày cập nhật: 2026-07-20
> Trạng thái: Đồng bộ corrective review Phase 3B/3C; 151 offline tests pass, Docker/live/native Khmer pending

---

## 1. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js / Vercel)                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │ Admin Pages  │  │ Reader Pages │  │ Auth (Supabase Client) │    │
│  │ - Characters │  │ - Story list │  │                        │    │
│  │ - Create     │  │ - Page flip  │  │                        │    │
│  │ - Review     │  │ - Bilingual  │  │                        │    │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘    │
│         │                 │                                         │
│         └────────┬────────┘                                         │
│                  │ REST API                                         │
└──────────────────┼──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI / VPS)                     │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │ API Routes   │  │ Background   │  │ AI Service Layer       │    │
│  │ - CRUD       │  │ Tasks        │  │ ┌──────────────────┐   │    │
│  │ - Story gen  │  │ (Gate G4 —   │  │ │ ImageGenerator   │   │    │
│  │ - Review     │  │  cách chạy   │  │ │ (ABC)            │   │    │
│  │              │  │  chưa chốt,  │  │ │ └─ OpenAI impl   │   │    │
│  │              │  │  xem 08)     │  │ ├──────────────────┤   │    │
│  │              │  │              │  │ │ TextGenerator    │   │    │
│  │              │  │              │  │ │ (ABC)            │   │    │
│  │              │  │              │  │ │ └─ OpenAI impl   │   │    │
│  │              │  │              │  │ ├──────────────────┤   │    │
│  │              │  │              │  │ │ Translator       │   │    │
│  │              │  │              │  │ │ VN→KM (Phase 3)  │   │    │
│  │              │  │              │  │ ├──────────────────┤   │    │
│  │              │  │              │  │ │ KhmerValidator   │   │    │
│  │              │  │              │  │ │ baseline warnings│   │    │
│  │              │  │              │  │ └──────────────────┘   │    │
│  └──────────────┘  └──────────────┘  └────────────────────────┘    │
│                                                                     │
└──────────────────┬──────────────────┬───────────────────────────────┘
                   │                  │
         ┌─────────┘                  └──────────┐
         ▼                                       ▼
┌─────────────────┐                    ┌─────────────────┐
│   Supabase      │                    │   Cloudflare R2 │
│   (PostgreSQL)  │                    │   (Object Store)│
│                 │                    │                 │
│ - characters    │                    │ - Ảnh ref nhân  │
│ - stories       │                    │   vật           │
│ - story_pages   │                    │ - Ảnh minh họa  │
│ - backbones     │                    │   truyện        │
│ - genres        │                    │ - Audio (future)│
│ - art_styles    │                    │                 │
│ - users         │                    │                 │
└─────────────────┘                    └─────────────────┘
```

---

## 2. Database Schema

> ⚠️ Schema duy nhất: xem [`07-database-schema.md`](07-database-schema.md)
>
> 7 bảng (3 config + 4 core). Không có `story_outlines`, `story_edit_logs`, `usage_logs`, `vocabulary` trong MVP.

---

## 3. AI Pipeline — Sinh truyện

### 3.1 Flow tổng thể — 2 PHASE: Text trước, Ảnh sau

> Nguyên tắc cốt lõi: Tách TEXT PHASE (rẻ, lặp thoải mái) khỏi IMAGE PHASE 
> (đắt, chạy 1 lần). Admin chốt nội dung trước, rồi mới tốn tiền sinh ảnh.

```
INPUT (từ admin)
│
├── description_vi: "Câu chuyện về bé Srey học cách chia sẻ..."
├── backbone_id: 1 (Fable)
├── genre_id: 1 (Cổ tích)
├── art_style_id: 1 (Watercolor)
├── length_pref: "medium"
├── character_ids: [1, 2]  (Srey, Dara)
│
▼
═══════════════════════════════════════════════════════════
  TEXT PHASE — Lặp thoải mái, ~$0.005/lần edit
═══════════════════════════════════════════════════════════
│
▼
BƯỚC 1: Sinh toàn bộ text tiếng Việt + dịch Khmer (~30-60 giây)
│
│  System prompt = base_prompt
│                + backbone.prompt_template_en
│                + genre.prompt_modifier_en
│                + character descriptions (appearance_prompt_en)
│                + user description (giữ nguyên tiếng Việt)
│                + length preference
│
│  Output: TEXT ĐẦY ĐỦ cho từng trang (không phải tóm tắt)
│  [
│    {page_no: 1, text_vi: "Ngày xưa, ở một ngôi làng nhỏ bên bờ 
│     sông Mekong, có một cô bé tên Srey..."},
│    {page_no: 2, text_vi: "Một buổi sáng, bạn Dara chạy tới rủ 
│     Srey ra công viên chơi..."},
│    ...
│  ]
│
│  Sau khi có full Vietnamese snapshot → dịch title + toàn bộ pages VN→KM trong một structured call
│  → Auto-save DB: story_pages.text_vi + story_pages.text_km
│  → story.status = 'text_draft'
│
│  Hiển thị cho admin:
│  ┌────────────────────────────────────────────────┐
│  │ Trang 2:                                       │
│  │                                                │
│  │ Một buổi sáng, bạn Dara chạy tới rủ Srey     │ ← VN: primary
│  │ ra công viên chơi. Srey ôm chặt búp bê...    │    (edit qua chat —
│  │                                                │     D07: không inline)
│  │                                                │
│  │ ព្រឹកមួយថ្ងៃ មិត្តដារ៉ារត់មកជួបស្រី...         │ ← KM: subtitle
│  │                                                │    (preview)
│  └────────────────────────────────────────────────┘
│
▼
BƯỚC 2: Admin edit (lặp nhiều lần — rẻ)
│
│  Quick actions: [Rút gọn nội dung] [Viết chi tiết hơn] [Kịch tính hơn] [Đơn giản hơn]
│  Custom instruction: "Làm trang 4 ấm áp hơn" (luôn giữ page IDs/count/order)
│  Drag-drop: đổi thứ tự trang
│  Thêm/xóa trang bằng control riêng
│
│  Mỗi edit:
│    1. Gọi LLM sửa text VN (API call #1) → ~$0.003
│    2. Dịch lại VN→KM cho trang bị ảnh hưởng (API call #2) → ~$0.002
│    Tổng: ~$0.005/lần edit
│    Auto-save DB ngay sau khi AI trả kết quả
│
│  Admin thấy cập nhật real-time: text VN + KM mới
│  Toast: "✅ Đã cập nhật trang 3-5."
│
│  Sửa 10 lần = $0.05 — rẻ, thoải mái iterate
│
│  [Xác nhận nội dung] ← admin ưng text VN + KM rồi
│  → story.status = 'text_confirmed'
│  → Text bị KHÓA từ đây (không sửa text nữa)
│
▼
═══════════════════════════════════════════════════════════
  IMAGE PHASE — Chạy 1 lần duy nhất, ~$0.13/trang
═══════════════════════════════════════════════════════════
│
▼
BƯỚC 3: Sinh ảnh minh họa (Background job, ~2-5 phút)
│
│  Cho mỗi trang:
│  ┌─────────────────────────────────────────────────┐
│  │ 3a. Dịch text_vi → text_en (hub, cho image)    │
│  │     → story_pages.text_en                       │
│  │                                                  │
│  │ 3b. Sinh image prompt EN                         │
│  │     = art_style.prompt_modifier_en               │
│  │     + character.appearance_prompt_en (anchor)    │
│  │     + scene description from text_en             │
│  │     → story_pages.image_prompt_en                │
│  │                                                  │
│  │ 3c. Sinh ảnh (Image API + character ref images)  │
│  │     → upload R2 → story_pages.image_url          │
│  │                                                  │
│  │ 3d. Validate KM (baseline technical validator)        │
│  │     → story_pages.spellcheck_flags               │
│  └─────────────────────────────────────────────────┘
│
│  Progress: cách tracking chưa chốt — xem Gate G4 (08-implementation-gates.md)
│  "🎨 Đang vẽ trang 3/8..."
│  Ảnh hiện dần khi gen xong từng trang
│
│  → story.status = 'pending_review'
│
▼
BƯỚC 4: Review ảnh (sửa TỪNG TRANG riêng lẻ)
│
│  Admin thấy: ảnh + text KM + text VN (đối chiếu) + spellcheck flags
│  
│  Ảnh ưng → approve trang đó
│  Ảnh không ưng → [🔄 Tạo lại ảnh trang này] (chỉ gen lại 1 ảnh, ~$0.13)
│  Text đã khóa; Khmer chỉ được retranslate trước confirm ở Phase 3C
│
│  KHÔNG gen lại hàng loạt — từng trang một
│
│  Khi tất cả trang approved → story.status = 'approved'
│
▼
BƯỚC 5: Xuất bản
│
│  Admin bấm [Xuất bản] → story.status = 'published'
│  Truyện xuất hiện trong Reader
│
│  Truyện không ưng → story.status = 'archived' (KHÔNG XÓA)
│  Text + ảnh vẫn giữ trong DB/R2
```

### Chi phí ước tính 1 truyện 8 trang nội dung

| Bước | Chi phí |
|------|---------|
| Sinh text VN lần đầu | ~$0.003 |
| Dịch VN→KM lần đầu | ~$0.002 |
| Edit 5 lần × $0.005 | ~$0.025 |
| Dịch VN→EN (cho ảnh) | ~$0.002 |
| Sinh 8 ảnh nội dung × $0.13 | ~$1.04 |
| Validate KM | ~$0 (offline) |
| **Tổng** | **~$1.07** |

> Chi phí $0.13/ảnh (gpt-image-2). Nếu gen lại 2 ảnh: +$0.26 → ~$1.33
> Bìa là code template nên không gọi Image API và không tính vào chi phí ảnh.

### 3.2 Prompt Engineering — Cách ghép prompt

```python
# Ví dụ system prompt khi sinh truyện

system_prompt = f"""
You are an expert children's book author. 

STORY STRUCTURE (Backbone):
{backbone.prompt_template_en}
# Ví dụ: "Follow the Fable structure: Situation → Temptation/Challenge 
# → Character's Choice → Consequence → Moral Lesson"

WRITING STYLE (Genre):
{genre.prompt_modifier_en}
# Ví dụ: "Write in a fairy tale tone: dreamy, magical, 'Once upon a time...' 
# style opening, gentle resolution"

CHARACTERS:
{chr(10).join([
    f"- {c.name}: {c.appearance_prompt_en}. Personality: {c.personality_vi}"
    for c in characters
])}
# Ví dụ: "- Srey: A 7-year-old Khmer girl with long black hair in twin 
# braids, wearing a traditional green sampot, bright curious eyes, 
# small golden earrings. Personality: tò mò, dũng cảm, hay cười"

LENGTH PREFERENCE: {length_pref}
# "medium" → AI tự quyết số trang phù hợp

Create the Vietnamese title and full page-by-page story directly
(no separate outline step per D25) for a children's story about:
{description_vi}

Return:
- title_vi
- pages:
  - page_no
  - text_vi (the complete narration for that page, not a summary)
"""
```

Phase 3B phải chốt riêng mọi field phục vụ image pipeline, field đó transient hay persisted, và mapping vào schema/API nào. Round 3 không áp đặt characters-per-page, scene hint hoặc field image mới.

### 3.3 Image Prompt — hướng Phase 4, chưa phải contract hiện hành

> Đoạn dưới chỉ là định hướng. Các placeholder trong code chưa tồn tại trong schema/API; Gate G2/G4 phải được chốt ở Phase 4.

```python
# Prompt cho mỗi ảnh trang

image_prompt = f"""
{art_style.prompt_modifier_en}
# "Soft watercolor illustration, gentle pastel colors, 
#  hand-painted texture, children's storybook style"

Scene: {image_scene_prompt}
# "Srey sitting under a sugar palm tree, looking up at the sky 
#  with wonder, butterflies around her"

Characters in this scene:
{chr(10).join([
    f"- {c.name}: {c.appearance_prompt_en}"
    for c in characters_for_image  # Gate G2, chưa chốt mapping theo page
])}
# Visual anchor — MÔ TẢ ĐẦY ĐỦ mỗi lần, không phụ thuộc memory

Maintain absolute visual consistency with the reference images provided.
Wide landscape composition (16:9 aspect ratio).
"""

# Gọi API kèm ref images:
# generate_image(prompt=image_prompt, reference_images=character_ref_urls)
```

---

## 4. AI Service — Abstract Layer

```python
# ai/base.py
from abc import ABC, abstractmethod

class ImageGenerator(ABC):
    @abstractmethod
    async def generate(
        self, 
        prompt: str, 
        reference_images: list[str] = None,
        aspect_ratio: str = "16:9"
    ) -> bytes:
        """Generate image from prompt + optional reference images."""
        ...

class TextGenerator(ABC):
    @abstractmethod
    async def generate(
        self, 
        system_prompt: str, 
        user_prompt: str,
        response_format: dict = None
    ) -> str:
        """Generate text completion."""
        ...

class Translator(ABC):
    @abstractmethod
    async def translate(
        self, 
        text: str, 
        source_lang: str, 
        target_lang: str
    ) -> str:
        ...

# ai/openai_impl.py
class OpenAIImageGenerator(ImageGenerator):
    async def generate(self, prompt, reference_images=None, aspect_ratio="16:9"):
        # Gọi GPT Image 2 API
        ...

# config.py — MVP dùng All OpenAI, giữ abstract layer cho khả năng mở rộng
IMAGE_PROVIDER = os.getenv("IMAGE_PROVIDER", "openai")
TEXT_PROVIDER = os.getenv("TEXT_PROVIDER", "openai")
```

**MVP: All OpenAI (gpt-image-2 + gpt-4o-mini). Giữ abstract layer để đổi provider sau nếu cần.**

---

## 5. Song ngữ — Chiến lược hiển thị

### Trong Reader (học sinh đọc truyện)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│            [ẢNH MINH HỌA LANDSCAPE]             │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ក្មេងស្រីម្នាក់រស់នៅក្នុងភូមិតូចមួយ             │  ← Khmer: font lớn (24px+),
│                                                 │     Noto Sans Khmer, đậm,
│  Một cô bé sống trong một ngôi làng nhỏ          │     line-height: 1.8
│                                                 │
│                                                 │  ← Việt: font nhỏ hơn (16px),
│                                                 │     màu nhạt hơn (opacity 0.6)
│                                 [◀ 2/8 ▶]      │
└─────────────────────────────────────────────────┘
```

### Trong Admin (giáo viên tạo/review)

```
┌─────────────────────────────────────────────────┐
│ Trang 3                                         │
│                                                 │
│ Nội dung VN (gốc):                              │  ← Việt: primary, font đậm
│ Srey tìm thấy đôi cánh kỳ lạ bên bờ sông       │
│                                                 │
│ Bản dịch KM:                                    │  ← Khmer: secondary
│ ស្រីរកឃើញស្លាបចម្លែកនៅមាត់ទន្លេ               │     nhưng vẫn rõ ràng
│                                                 │
│ ⚠ Từ nghi ngờ: "ស្រី" — cần kiểm tra            │
│ [Sửa text KM] [Tạo lại ảnh]                    │
└─────────────────────────────────────────────────┘
```

### Font Khmer

- **Primary**: Noto Sans Khmer (Google Fonts, miễn phí, hỗ trợ Unicode đầy đủ)
- **Backup**: Kantumruy Pro
- **Line-height**: 1.8 trở lên (chữ Khmer có dấu xếp chồng, line-height thường bị cắt)
- **Font-size tối thiểu**: 20px cho body text (chữ Khmer nhỏ quá khó đọc)
