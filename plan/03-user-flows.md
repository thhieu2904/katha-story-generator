# Katha — User Flows & UI Wireframes

> Ngày cập nhật: 2026-07-20 — Phase 3C core code-complete offline; Docker/live/native Khmer review pending
> Wireframes dạng text — chỉ mô tả layout, không phải design cuối cùng

---

## 1. Tổng quan màn hình

```
ADMIN FLOW:
  Login → Dashboard → Characters (read-only seed) → Create Story → Review/Edit
  → Generate Images → Review → Publish

USER FLOW:    ← Reader public (D22)
  Story List → Read Story (page flip, bilingual)
```

---

## 2. Admin — Character Bank read-only

```
┌─────────────────────────────────────────────────────────┐
│  🎭 Ngân hàng nhân vật                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│  │  [ảnh]  │  │  [ảnh]  │  │  [ảnh]  │                │
│  │  Srey   │  │  Dara   │  │  Bopha  │                │
│  │  8 tuổi │  │  10 tuổi│  │  6 tuổi │                │
│  └─────────┘  └─────────┘  └─────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Logic MVP (D23)**:
- Chỉ hiển thị 7 nhân vật seed và ảnh reference đã có.
- Không có CTA tạo/sửa/xóa hoặc sinh reference image mới.

---

## 3. Admin — Tạo truyện

### 3.1 Bước 1: Thiết lập

```
┌─────────────────────────────────────────────────────────┐
│  📖 Tạo truyện mới                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Nội dung / Chủ đề (tiếng Việt):                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Câu chuyện về bé Srey học cách chia sẻ đồ chơi │    │
│  │ với bạn Dara khi cả hai cùng chơi ở công viên   │    │
│  │ bên bờ sông Mekong                               │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Nhân vật:    [Srey ✓] [Dara ✓] [Bopha]               │
│                                                         │
│  Cấu trúc:   [▼ Ngụ ngôn — Bài học cuộc sống    ]     │
│               Bài học đạo đức rõ ràng cuối truyện      │
│                                                         │
│  Thể loại:   [▼ Cổ tích                          ]     │
│               Giọng mơ mộng, thần thoại                │
│                                                         │
│  Phong cách:  [▼ Tranh màu nước                  ]     │
│               ┌─────┐                                   │
│               │sample│ ← ảnh mẫu style                  │
│               └─────┘                                   │
│                                                         │
│  Độ dài:      (○) Ngắn   (●) Vừa   (○) Dài            │
│                                                         │
│  Nhóm tuổi:  (○) Mầm non 3-5  (●) Tiểu học sớm 6-8  (○) Tiểu học muộn 9-12  ← D24 chốt│
│                                                         │
│  [Lưu bản nháp]                                         │
└─────────────────────────────────────────────────────────┘
> ✅ Bìa là code template React/Tailwind (D27), không nằm trong story_pages.
```

### 3.2 Bước 2: AI sinh truyện + Review/Edit (D25 — không có outline riêng)

Sau khi setup đã lưu, CTA Phase 3B là **Sinh nội dung truyện**.

```
┌─────────────────────────────────────────────────────────────────────┐
│  📝 Nội dung truyện                                      📄 8 trang│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ≡  (Bìa: code template — không nằm trong story_pages, xem D27)     │
│                                                                     │
│  ≡  Trang 1:                                                 [🗑]   │
│     Ngày xưa, ở một ngôi làng nhỏ bên bờ sông Mekong,             │
│     có một cô bé tên Srey. Srey rất thích chơi một mình           │
│     với con búp bê gỗ mà bà nội đã tặng.                          │
│     កាលពីដើមឡើយ នៅភូមិតូចមួយជាប់មាត់ទន្លេមេគង្គ...              │
│                                                                     │
│  ≡  Trang 2:                                                 [🗑]   │
│     Một buổi sáng, bạn Dara chạy tới rủ Srey ra công viên        │
│     chơi. Srey ôm chặt búp bê, sợ Dara sẽ đòi mượn.             │
│     ព្រឹកមួយថ្ងៃ មិត្តដារ៉ារត់មកជួបស្រី...                        │
│                                                                     │
│  ≡  Trang 3: ...                                             [🗑]   │
│  ≡  ...                                                             │
│                                                                     │
│  [+ Thêm trang]                                                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  QUICK ACTIONS                                                      │
│  [Rút gọn nội dung] [Viết chi tiết hơn] [Kịch tính hơn] [Đơn giản hơn]        │
│                                                                     │
│  💬 Hoặc nhập yêu cầu:                                             │
│  ┌──────────────────────────────────────────────────────┐           │
│  │                                                      │ [Gửi]    │
│  └──────────────────────────────────────────────────────┘           │
├─────────────────────────────────────────────────────────────────────┤
│  [Xác nhận nội dung]                                  │
└─────────────────────────────────────────────────────────────────────┘

Khi AI xử lý edit xong → toast notification:
  ┌─────────────────────────────────────────┐
  │ ✅ Đã lưu: sửa 3 trang        │
  │    Quick action giữ nguyên số trang và thứ tự          │
  └─────────────────────────────────────────┘
```

**Hiển thị song ngữ ở bước này:**
- **VN**: font 16-18px, font-weight 500, color primary → admin đọc, edit qua quick actions/chat (D07: không inline edit)
- **KM**: font 14-16px, font-weight 400, color text-secondary (opacity 0.5) → preview dịch
- Mỗi lần sửa text VN → auto dịch lại KM trang đó (~$0.005/lần)
- Auto-save DB ngay sau mỗi AI response (bản hiện tại, không undo/version history trong MVP)

**Interactions**:
- `≡` = drag handle, kéo đổi thứ tự (dnd-kit sortable)
- `[🗑]` = xóa trang (có confirm)
- `[+ Thêm trang]` = AI suggest nội dung trang mới dựa trên context
- Quick actions = preset prompts gửi cho AI
- Chat = custom request
- Badge `📄 8 trang` = cập nhật real-time khi thêm/xóa
- ~~Hoàn tác~~ — KHÔNG CÓ trong MVP (xem `01-decisions-log.md` D15)

### 3.3 Bước 3: Image Phase — Sinh ảnh (progress screen)

> Text VN + KM đã chốt ở Bước 2. Bước này CHỈ sinh ảnh.

```
┌─────────────────────────────────────────────────────────┐
│  🎨 Đang vẽ minh họa "Bé Srey và bài học chia sẻ"     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🎨 Vẽ minh họa          ████████░░░░░░░░░░░░░░ 3/8   │
│                                                         │
│  Trang đã xong:                                        │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │     [ảnh 1]      │  │     [ảnh 2]      │            │
│  │  ក្មេងស្រី...      │  │  ស្រីនិងដារ៉ា...  │            │
│  │  Bé Srey...      │  │  Srey và Dara... │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│  Đang vẽ trang 3/8...                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘

Ảnh hiện dần khi gen xong từng trang. Text đã có sẵn từ Text Phase.
```

### 3.4 Bước 4: Review

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Duyệt truyện — "Bé Srey và bài học chia sẻ"  [2/8 duyệt] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ◀ Trang 3/8 ▶                                                 │
│                                                                 │
│  ┌───────────────────────────────────┐                          │
│  │                                   │                          │
│  │       [ẢNH MINH HỌA TRANG 3]     │                          │
│  │                                   │                          │
│  └───────────────────────────────────┘                          │
│  [🔄 Tạo lại ảnh trang này]                                    │
│                                                                 │
│  Khmer (draft):                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ស្រីមានប្រដាប់ប្រដាក្មេងលេងថ្មីស្អាតណាស់              │   │
│  │                                                 [Sửa]  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚠ Từ cần kiểm tra: "ប្រដាក្មេង" — không tìm thấy trong từ điển│
│                                                                 │
│  Tiếng Việt (gốc, đối chiếu):                                 │
│  Srey có món đồ chơi mới rất đẹp                               │
│                                                                 │
│  [❌ Từ chối] [✅ Duyệt trang này]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. User — Đọc truyện

### 4.1 Danh sách truyện

> Reader là public và không yêu cầu đăng nhập (D22).

```
┌─────────────────────────────────────────────────────────┐
│  📚 Truyện                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────┐  ┌────────────────────┐        │
│  │    [ảnh bìa]       │  │    [ảnh bìa]       │        │
│  │                    │  │                    │        │
│  │ បេស្រីនិងមេរៀន      │  │ ដារ៉ានិងព្រៃព្រឹក្ស │        │
│  │ ចែករំលែក           │  │                    │        │
│  │                    │  │                    │        │
│  │ Bé Srey và bài học │  │ Dara và khu rừng   │        │
│  │ chia sẻ            │  │ buổi sáng          │        │
│  │                    │  │                    │        │
│  │ 8 trang · Cổ tích  │  │ 12 trang · Phiêu lưu│       │
│  └────────────────────┘  └────────────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘

Tiêu đề hiển thị: KM (primary) + VN (subtitle)
```

### 4.2 Đọc truyện — Page flip

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                   [ẢNH MINH HỌA LANDSCAPE]                      │
│                                                                 │
│                                                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ស្រីមានប្រដាប់ប្រដាក្មេងលេងថ្មីស្អាតណាស់                    │
│                                                                 │
│    Srey có món đồ chơi mới rất đẹp                              │
│                                                                 │
│                                                    ◀ 3/8 ▶     │
└─────────────────────────────────────────────────────────────────┘

- Khmer: Noto Sans Khmer, 22-26px, font-weight: 600, color: primary
- Việt: 14-16px, font-weight: 400, color: text-secondary (opacity 0.6)
- Line-height Khmer: 1.8+ (tránh cắt dấu chồng)
- Lật trang: react-pageflip animation hoặc swipe gesture
- Landscape layout, aspect ratio ảnh: 16:9 hoặc 3:2
```

---

## 5. State Machine — Trạng thái truyện (2-phase)

```
                    ┌──────────────────────┐
                    │                      │
  [Tạo truyện] ──► │       draft          │
                    │                      │
                    └──────────┬───────────┘
                               │ [Sinh text VN + dịch KM]
                               ▼
              ╔════════════════════════════════════╗
              ║         TEXT PHASE (rẻ)            ║
              ╠════════════════════════════════════╣
              ║  ┌──────────────────────┐          ║
              ║  │                      │          ║
              ║  │     text_draft       │ ◄─── Edit loop
              ║  │                      │      (quick actions,
              ║  └──────────┬───────────┘       chat, drag-drop,
              ║             │ [Xác nhận nội dung]  thêm/xóa trang)
              ║             ▼                      ║
              ║  ┌──────────────────────┐          ║
              ║  │                      │          ║
              ║  │   text_confirmed     │ ← Text KHÓA
              ║  │                      │          ║
              ║  └──────────┬───────────┘          ║
              ╚═════════════╪══════════════════════╝
                            │ [Sinh ảnh]
                            ▼
              ╔════════════════════════════════════╗
              ║         IMAGE PHASE (đắt)          ║
              ╠════════════════════════════════════╣
              ║  ┌──────────────────────┐          ║
              ║  │                      │          ║
              ║  │  generating_images   │ ← Background job
              ║  │                      │          ║
              ║  └──────────┬───────────┘          ║
              ║             │ [Job xong]           ║
              ║             ▼                      ║
              ║  ┌──────────────────────┐          ║
              ║  │                      │ ◄─── Review loop
              ║  │   pending_review     │      (approve/reject
              ║  │                      │       từng trang ảnh,
              ║  └──────────┬───────────┘       gen lại 1 ảnh)
              ╚═════════════╪══════════════════════╝
                            │ [Tất cả trang approved]
                            ▼
                    ┌──────────────────────┐
                    │                      │
                    │      approved        │
                    │                      │
                    └──────────┬───────────┘
                            ╱          ╲
                           ╱            ╲
                          ▼              ▼
            ┌──────────────────┐  ┌──────────────────┐
            │                  │  │                  │
            │    published     │  │    archived      │
            │                  │  │  (KHÔNG XÓA)     │
            └──────────────────┘  └──────────────────┘
            ← User thấy           ← Giữ data, ẩn khỏi Reader
```

