# 11 — Deploy trên homeserver (thay VPS, tiết kiệm chi phí)

> Biến thể của `10-deploy-vps.md` cho homeserver đã có Tailscale + SSH.
> Frontend vẫn lên Vercel; chỉ backend chạy ở nhà.

---

## 1. Vấn đề then chốt: reader là PUBLIC

Browser của **người đọc** gọi thẳng API (`NEXT_PUBLIC_API_URL`), nên backend
phải truy cập được từ Internet công cộng — **Tailscale không đủ** (chỉ máy trong
tailnet của bạn vào được). Homeserver ở VN thường sau CGNAT, không mở port được.

**Giải pháp: Cloudflare Tunnel** (miễn phí, không cần IP public, không mở port
router, HTTPS tự động — và bạn đã có tài khoản Cloudflare sẵn vì dùng R2):

1. Cloudflare Dashboard → **Zero Trust → Networks → Tunnels → Create tunnel**
   (kiểu Cloudflared) → đặt tên `katha` → copy **token**.
2. Trong tunnel, thêm **Public Hostname**: `api.<domain-của-bạn>` →
   Service `HTTP` → URL `api:8000`.
3. Trên homeserver: thêm dòng `TUNNEL_TOKEN=<token>` vào `deploy/.env`.

Tailscale + SSH giữ nguyên vai trò **quản trị** (vào server, xem log); tunnel
chỉ lo phần public. Đánh đổi so với VPS: uptime phụ thuộc điện/mạng nhà — với
2-5 admin và readership nhỏ của dự án NCKH thì chấp nhận được.

## 2. Chạy backend

```bash
# SSH vào homeserver qua Tailscale
git clone https://github.com/<user>/katha-story-generator.git
cd katha-story-generator/deploy
cp .env.example .env && nano .env    # điền giá trị thật + TUNNEL_TOKEN
docker compose -f docker-compose.homeserver.yml up -d --build
docker compose -f docker-compose.homeserver.yml exec api alembic upgrade head
curl -fsS https://api.<domain>/health   # {"status":"healthy",...}
```

Vercel setup y hệt `10-deploy-vps.md` §3 (`NEXT_PUBLIC_API_URL=https://api.<domain>`,
nhớ cập nhật `CORS_ORIGINS` trong `.env` = domain Vercel rồi recreate api).

## 3. scp hay CI/CD?

**Đừng scp.** Copy tay working directory = không có lịch sử, dễ drift so với
repo, dễ lỡ tay copy cả `.env`/`node_modules`. Repo đã trên GitHub, dùng git.

Lộ trình khuyến nghị theo giai đoạn:

| Giai đoạn | Cách deploy | Khi nào |
|-----------|-------------|---------|
| **Bây giờ** | "Poor man's CD": `ssh` + `git pull` + `compose up --build` (alias bên dưới) | Đủ tốt cho 1 dev, deploy vài lần/tuần |
| **Sau này** | GitHub Actions CI (đã có sẵn `.github/workflows/ci.yml`) chạy lint/test/build mỗi lần push — chưa auto-deploy | Ngay khi push lên GitHub là có |
| **Nếu thấy cần** | CD thật: self-hosted runner trên homeserver, workflow deploy khi push `main` | Khi deploy tay bắt đầu phiền |

Alias deploy một lệnh (chạy từ máy dev, thêm vào `~/.bashrc`/PowerShell profile):

```bash
alias katha-deploy='ssh <homeserver-tailscale-name> "cd ~/katha-story-generator && git pull && cd deploy && docker compose -f docker-compose.homeserver.yml up -d --build && docker compose -f docker-compose.homeserver.yml exec -T api alembic upgrade head"'
```

Lưu ý nếu sau này dùng self-hosted runner: chỉ bật cho repo **private** và chỉ
trigger trên push `main` — không bao giờ chạy workflow của PR người lạ trên
máy nhà.

## 4. Giải thích Dockerfile 2 tầng (multi-stage)

`backend/Dockerfile` có 2 stage với vai trò tách bạch:

```
Stage 1 — builder (python:3.11-slim + uv)
  ├─ COPY pyproject.toml uv.lock     ← layer riêng: chỉ rebuild khi đổi deps
  ├─ uv sync --frozen --no-dev       ← cài dependencies vào /app/.venv
  ├─ COPY src/ alembic/              ← code đổi thường xuyên, layer sau cùng
  └─ uv sync (install project)

Stage 2 — runner (python:3.11-slim SẠCH)
  ├─ COPY --from=builder /app/.venv  ← chỉ lấy thành phẩm
  ├─ COPY --from=builder src/ alembic/
  ├─ USER app                        ← non-root
  └─ CMD uvicorn ...
```

Tại sao 2 tầng đáng giá:

1. **Image cuối nhỏ + sạch**: runner không chứa `uv`, cache pip/uv, layer build
   trung gian — chỉ có Python + venv + code. Kéo image nhanh, ít bề mặt tấn công.
2. **Cache thông minh**: `pyproject.toml`/`uv.lock` được COPY *trước* source
   code, nên sửa code không làm cài lại toàn bộ dependencies — rebuild chỉ mất
   vài giây (bạn đã thấy: build lại ~6s).
3. **Reproducible**: `--frozen` cài đúng từng version trong lockfile, image
   build hôm nay và tháng sau giống hệt nhau.
4. **An toàn**: stage runner chạy user `app` (uid 1000), không root; app chỉ
   ghi stdout/R2/DB nên không cần quyền ghi filesystem.
