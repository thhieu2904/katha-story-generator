# 11 — Deploy trên homeserver (thay VPS, tiết kiệm chi phí)

> Biến thể của `10-deploy-vps.md` cho homeserver đã có sẵn: Caddy trên host
> (nhận traffic public) + Tailscale/SSH (đường quản trị & deploy).
> Frontend vẫn lên Vercel; chỉ backend chạy ở nhà.

---

## 1. Topology

```
Người đọc/Admin ──HTTPS──> Caddy (host, IP nhà) ──> 127.0.0.1:8000 (container api)
Máy dev ──Tailscale/SSH──> homeserver        ← chỉ để deploy & quản trị
```

- `deploy/docker-compose.homeserver.yml` chạy **một** container `api`, bind
  `127.0.0.1:8000` (không lộ port ra LAN/Internet — chỉ Caddy trên host thấy).
- Thêm block vào Caddyfile **trên host** của bạn:

  ```
  api.<domain> {
      reverse_proxy 127.0.0.1:8000
  }
  ```

- **DNS**: A record `api.<domain>` → IP public nhà. Lưu ý IP nhà thường là IP
  động → dùng DDNS (Cloudflare API cập nhật A record) nếu ISP đổi IP.
- **Đính chính một chi tiết**: Vercel không "trỏ về IP máy bạn" — frontend chỉ
  cần build với `NEXT_PUBLIC_API_URL=https://api.<domain>`; **browser của người
  đọc** gọi thẳng domain đó, DNS mới là thứ trỏ về IP nhà. Nhớ set
  `CORS_ORIGINS` trong `.env` = domain Vercel.
- **Fallback nếu ISP CGNAT/không mở port được**: bật profile Cloudflare Tunnel
  (`--profile tunnel`, token trong `.env`) — miễn phí, không cần IP public;
  khi đó không cần block Caddy phía trên.

## 2. Chạy backend (lần đầu)

```bash
# SSH vào homeserver (qua Tailscale như bạn vẫn làm)
git clone https://github.com/<user>/katha-story-generator.git
cd katha-story-generator/deploy
cp .env.example .env && nano .env    # điền giá trị thật
docker compose -f docker-compose.homeserver.yml up -d --build
docker compose -f docker-compose.homeserver.yml exec api alembic upgrade head
curl -fsS https://api.<domain>/health   # {"status":"healthy",...}
```

Vercel setup y hệt `10-deploy-vps.md` §3.

## 3. Cập nhật phiên bản: scp vs GitHub Actions

Hai hướng bạn cân nhắc, so sánh thẳng:

| | scp qua Tailscale | GitHub Actions CD |
|---|---|---|
| Cái được copy | Working tree máy dev (kể cả thứ chưa commit) | Đúng commit trên `main` |
| Lịch sử/rollback | Không — server không biết đang chạy bản nào | Có — mỗi deploy gắn với 1 commit |
| Drift | Dễ (quên add file, build từ bản dở) | Không |
| Setup thêm | Không | Secrets + workflow (một lần) |

**Khuyến nghị: bỏ scp, giữ nguyên ý tưởng nhưng thay "copy file" bằng "git pull"** —
vẫn là SSH qua Tailscale, vẫn một lệnh từ máy dev, nhưng server luôn chạy đúng
một commit đã push:

```bash
# alias trên máy dev — "poor man's CD", đủ dùng tới khi thấy phiền
alias katha-deploy='ssh <homeserver> "cd ~/katha-story-generator && git pull && cd deploy && docker compose -f docker-compose.homeserver.yml up -d --build && docker compose -f docker-compose.homeserver.yml exec -T api alembic upgrade head"'
```

Điểm mấu chốt: scp *nhanh hơn 0 giây* so với alias trên (cả hai là một lệnh),
nhưng mất toàn bộ đảm bảo về version. Không có lý do kỹ thuật nào để chọn scp
khi repo đã trên GitHub.

**Khi nào nâng lên GitHub Actions CD**: khi bạn muốn "push main là tự deploy".
Workflow mẫu đã có sẵn ở `.github/workflows/deploy.yml` (mặc định chỉ chạy tay
qua nút Run workflow — chưa auto). Nó nối vào tailnet bằng Tailscale OAuth
ephemeral node rồi SSH y hệt alias trên. Cần tạo 4 secrets trong repo Settings:

| Secret | Lấy ở đâu |
|--------|-----------|
| `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` | Tailscale admin → OAuth clients (scope `auth_keys`, tag `tag:ci`) |
| `HOMESERVER_HOST` | Tên máy trong tailnet (vd `homeserver`) |
| `HOMESERVER_SSH_KEY` | Private key deploy riêng (tạo mới, add public key vào `authorized_keys`) |

Muốn auto-deploy thật sự: đổi `workflow_dispatch` thành `push: branches: [main]`
— nhưng nên để CI (`ci.yml`) xanh vài tuần trước đã.

> Ghi chú: CI (`ci.yml`) đã chạy sẵn mỗi lần push — lint/type/test cả backend
> (gồm 65 integration test bằng Testcontainers) lẫn frontend. CD chỉ là bước
> "chở bản đã xanh lên server".

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
   vài giây (đã đo thực tế: ~6s).
3. **Reproducible**: `--frozen` cài đúng từng version trong lockfile, image
   build hôm nay và tháng sau giống hệt nhau.
4. **An toàn**: stage runner chạy user `app` (uid 1000), không root; app chỉ
   ghi stdout/R2/DB nên không cần quyền ghi filesystem.
