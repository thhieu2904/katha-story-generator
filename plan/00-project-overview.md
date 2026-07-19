# Katha Story Generator — Tổng quan dự án

> Ngày cập nhật: 2026-07-20
> Trạng thái: Phase 3A — Code-complete offline; Docker/live verification pending

---

## 1. Dự án là gì?

**Katha** (កថា — từ tiếng Pali, nghĩa "truyện kể") là nền tảng web tạo truyện tranh minh họa cho thiếu nhi bằng AI, phục vụ giáo dục ngôn ngữ Khmer.

- **Tên repo**: `katha-story-generator`
- **Git description**: AI-powered story creation platform — generates illustrated children's stories with consistent characters, structured narratives, and integrated vocabulary learning. Built for Khmer language education research.
- **Bối cảnh**: Đồ án nghiên cứu khoa học kỹ thuật (NCKH) cấp THPT

---

## 2. Vấn đề giải quyết

Giáo viên dạy tiếng Khmer cần truyện tranh minh họa để hỗ trợ giảng dạy, nhưng:
- Tài liệu truyện Khmer cho thiếu nhi rất ít
- Tự vẽ/viết tốn nhiều thời gian và chi phí
- Dùng AI sinh truyện thì nhân vật mỗi trang mỗi khác, không nhất quán

**Katha giải quyết bằng cách**:
- Ngân hàng nhân vật cố định → nhất quán xuyên suốt
- Backbone + Genre → cấu trúc truyện chuyên nghiệp
- Hub tiếng Anh → sinh ảnh chất lượng
- Song ngữ Khmer/Việt → phục vụ cả người học và người dạy

---

## 3. Đối tượng sử dụng

| Role | Ai? | Làm gì? |
|------|-----|---------|
| **Admin / Giáo viên** | Người Việt biết tiếng Khmer | Chọn 7 nhân vật seed, tạo truyện, review/edit, xuất bản |
| **User / Học sinh** | Người đang học Khmer | Đọc truyện, xem song ngữ |

---

## 4. Scope — MVP vs Tương lai

### MVP (8 tuần)
- ✅ Ngân hàng nhân vật read-only với 7 nhân vật seed
- ✅ Tạo truyện (backbone + genre + AI sinh `title_vi` và full story pages trực tiếp theo D25)
- ✅ Sinh ảnh minh họa (nhất quán nhân vật)
- ✅ Dịch sang Khmer + spellcheck
- ✅ Review workflow (admin duyệt)
- ✅ Web reader (landscape, lật trang, song ngữ KM/VN)
- ✅ Auth đơn giản (2-5 tài khoản tạo sẵn)
- ✅ Phase đánh giá khoa học

### Future phases
- 🔮 Vocabulary layer (highlight từ, tra cứu, phát âm)
- 🔮 Đa ngôn ngữ (Trung, Hàn, Nhật...)
- 🔮 Multi-tenant (nhiều trường/tổ chức)
- 🔮 Mobile app

---

## 5. Tech Stack

| Layer | Công nghệ | Deploy |
|-------|-----------|--------|
| Frontend | Next.js (TypeScript) | Vercel |
| Backend | Python FastAPI | VPS |
| Database | PostgreSQL | Supabase |
| Storage | Cloudflare R2 | Cloudflare |
| AI (text) | OpenAI gpt-4o-mini | API |
| AI (image) | OpenAI gpt-image-2 | API |
| Khmer NLP | baseline Unicode validator; advanced adapter deferred P1 | Cài trên VPS |

---

## 6. Tên và branding

- **Katha** (កថា): gốc Pali/Sanskrit, nghĩa "truyện kể"
- Tồn tại trong Khmer (កថា), Thai (กถา), Hindi (कथा), Lao
- Mở rộng thương hiệu: Katha Studio (tạo), Katha Reader (đọc), Katha Learn (từ vựng)
- Cần xác nhận cách đọc/viết chính xác với người bản ngữ Khmer
