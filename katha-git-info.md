# Katha — Git Repository Info

## Repository Name
```
katha-story-generator
```

## Git Description (About)
```
AI-powered story creation platform — generates illustrated children's stories 
with consistent characters, structured narratives (backbone + genre), and 
bilingual output (Khmer/Vietnamese). Built for Khmer language education research.
```

## Topics / Tags
```
ai, khmer, storytelling, education, nextjs, fastapi, openai, 
children-stories, language-learning, narrative-structure, 
supabase, python, typescript
```

## README.md (đoạn mở đầu)

```markdown
# Katha — កថា

> AI-powered multilingual story creation platform

Nền tảng tạo truyện tranh minh họa bằng AI, với:

- 🎭 **Ngân hàng nhân vật** — tạo một lần, dùng xuyên suốt, ngoại hình nhất quán
  qua mọi trang và mọi truyện
- 📖 **Kiến trúc tường thuật 2 lớp** — Backbone (cấu trúc truyện: ngụ ngôn,
  hành trình anh hùng...) + Genre (giọng văn: cổ tích, hài hước, răn dạy...)
- 🌐 **Đa ngôn ngữ** — viết bằng tiếng Việt, AI xử lý bằng tiếng Anh, xuất ra
  ngôn ngữ đích (hiện tại: Khmer)
- 📚 **Học từ vựng** *(future phase — không thuộc MVP)* — highlight từ khó, phát âm, giải thích
  trong ngữ cảnh

---

An AI-powered platform for generating illustrated children's stories with
reusable characters, structured narrative templates, and built-in vocabulary
tools — designed for Khmer language education research.

## Tech Stack

- **Frontend**: Next.js (Vercel)
- **Backend**: Python FastAPI (VPS)
- **Database**: PostgreSQL (Supabase)
- **Storage**: Cloudflare R2
- **AI**: OpenAI (gpt-image-2 + gpt-4o-mini)

## Project Context

Đồ án nghiên cứu khoa học kỹ thuật (NCKH) cấp THPT, phục vụ mục tiêu hỗ trợ
giáo dục ngôn ngữ Khmer cho học sinh.
```

## .gitignore (gợi ý)
```
node_modules/
.next/
__pycache__/
*.pyc
.env
.env.local
.env.production
venv/
dist/
.vercel/
```

## Branch Strategy (gợi ý)
```
main        — production (deploy Vercel)
develop     — integration branch
feature/*   — feature branches
```
