# 10 — Deploy: Frontend Vercel + Backend Docker trên VPS

> Runbook Phase 6. Kiến trúc theo quyết định đã chốt (HANDOFF §4):
> FE Next.js → Vercel · BE FastAPI → VPS (Docker + Caddy) · DB → Supabase · Ảnh → Cloudflare R2.

---

## 0. Điều kiện tiên quyết

- VPS Ubuntu (DigitalOcean droplet 1GB là đủ cho 2-5 admin) + SSH.
- 1 domain/subdomain cho API, ví dụ `api.katha.example.com`, A record trỏ IP VPS.
- Tài khoản Vercel (free) nối GitHub repo.
- Supabase project + R2 bucket + OpenAI API key (đã có từ dev).

## 1. Chuẩn bị VPS (một lần)

```bash
# Cài Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout/login lại

git clone https://github.com/<user>/katha-story-generator.git
cd katha-story-generator/deploy
cp .env.example .env
nano .env        # điền giá trị thật — xem bảng dưới
nano Caddyfile   # thay api.katha.example.com bằng domain thật
```

Biến quan trọng trong `deploy/.env`:

| Biến | Giá trị production |
|------|--------------------|
| `DATABASE_URL` | Chuỗi pooler Supabase (`postgresql+asyncpg://...pooler.supabase.com:5432/postgres`) |
| `SUPABASE_URL` | URL project Supabase (verify JWT admin) |
| `CORS_ORIGINS` | `["https://<app>.vercel.app"]` — thêm custom domain nếu có, JSON array |
| `R2_*` | Endpoint + key + bucket + public URL như dev |
| `OPENAI_API_KEY` | Key thật (billing đã bật) |
| Còn lại | Giữ default như `.env.example` |

## 2. Khởi chạy backend

```bash
cd ~/katha-story-generator/deploy
docker compose up -d --build
docker compose exec api alembic upgrade head   # migration TRƯỚC khi dùng
curl -fsS https://api.katha.example.com/health # kỳ vọng {"status":"ok",...}
```

> ⚠️ **Chỉ chạy đúng 1 container `api`** (không scale replicas). Runner tạo ảnh
> là in-process theo D35 (UUID claim + heartbeat, single instance). Job đang chạy
> không bền qua restart — UI đã có stale-recovery ("Khôi phục tạo lại ảnh").

## 3. Deploy frontend lên Vercel

1. Vercel → **Add New Project** → import repo, **Root Directory = `frontend`**.
2. Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://api.katha.example.com`
   - `NEXT_PUBLIC_SUPABASE_URL` = như dev
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = như dev
3. Deploy. Lấy domain Vercel thật → quay lại VPS cập nhật `CORS_ORIGINS` trong
   `deploy/.env` rồi `docker compose up -d` (recreate api).

## 4. Cập nhật phiên bản sau này

```bash
cd ~/katha-story-generator && git pull
cd deploy
docker compose up -d --build
docker compose exec api alembic upgrade head
```

Rollback: `git checkout <commit-cũ>` → `docker compose up -d --build`
(+ `alembic downgrade <rev>` nếu bản mới có migration — 006 có downgrade đối xứng).
Frontend rollback bằng nút Redeploy bản cũ trên Vercel.

## 5. Checklist trước khi công bố (từ HANDOFF "Bước tiếp theo")

- [ ] Chạy integration suite trên máy có Docker: `cd backend && uv run pytest -m integration` (65 test, Testcontainers tự kéo `postgres:16-alpine`).
- [ ] Live smoke tạo lại ảnh (reject → regenerate) với OpenAI/R2 thật (~$0.13/ảnh).
- [ ] Đăng nhập admin trên browser thật, đi hết flow tạo → duyệt → publish.
- [ ] Nhờ người đọc Khmer bản ngữ review sample.
- [ ] Đổi `READER_CREDIT` trong `frontend/src/features/reader/constants.ts` thành câu credit chính thức.
