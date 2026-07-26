# 12 — Giải thích kiến trúc deploy (đọc để hiểu, không phải để làm theo)

> Tài liệu chị em với `11-deploy-homeserver.md` (runbook = làm theo).
> File này trả lời "TẠI SAO cấu hình như vậy" — theo đúng trình tự đã dựng thật
> ngày 2026-07-26.
>
> CẬP NHẬT 2026-07-27: hệ đã nâng cấp lên mô hình multi-app — cloudflared tách
> ra stack `/srv/tunnel`, tunnel trỏ `caddy_proxy:80` (Caddy phân luồng theo
> Host) thay vì `api:8000`. Sơ đồ dưới là bản gốc lúc dựng; hiện trạng xem
> `13-mo-rong-nhieu-app-homeserver.md`.

---

## 1. Bức tranh tổng thể

```
                                  INTERNET
                                     │
        ┌────────────────────────────┼─────────────────────────────┐
        │ (1) tải trang              │ (2) gọi API                  │ (3) tải ảnh
        ▼                            ▼                              ▼
   Vercel (CDN)              Cloudflare edge                 Cloudflare R2
   www.katha.io.vn           api.katha.io.vn                pub-xxx.r2.dev
   frontend Next.js          TLS + DNS + Tunnel             ảnh truyện WebP
        │                           │
        │ build từ GitHub           │ tunnel (kết nối NGƯỢC từ trong nhà ra)
        ▼                           ▼
   GitHub repo  ◄─ git push ─  HOMESERVER (Ubuntu, sau CGNAT)
                               ├─ container cloudflared  ← giữ tunnel
                               ├─ container api (FastAPI) ← backend
                               └─ container caddy_proxy   ← app LAN khác, KHÔNG dính Katha
                                        │
                                        ▼
                               Supabase PostgreSQL (cloud)
```

Một người đọc mở truyện sẽ đi qua đúng 3 đường (1)(2)(3) ở trên — ba đường này
**độc lập nhau**: trang web từ Vercel, dữ liệu từ API nhà bạn, ảnh từ R2. Đó là
lý do ảnh load nhanh dù backend ở nhà: ảnh không hề đi qua homeserver.

## 2. Vấn đề gốc: nhà bạn không có "cửa" cho Internet vào

Khảo sát thực tế trên homeserver cho thấy:

```
$ curl ifconfig.me        → 2001:ee0:... (IPv6)
$ ip addr                 → IPv4 chỉ có 192.168.1.35 (LAN riêng)
```

Nghĩa là ISP (VNPT) không cấp IPv4 public — kiểu **CGNAT**: cả trăm thuê bao
chung một IP công cộng, router nhà bạn không thể "mở port" như hồi có VPS
DigitalOcean (trick `vercel.json` rewrites về `159.89.x.x` hoạt động vì VPS có
IP thật; homeserver thì không).

**Giải pháp: đảo chiều kết nối.** Thay vì Internet gõ cửa vào nhà (bất khả thi),
container `cloudflared` trong nhà **tự mở kết nối RA** tới Cloudflare và giữ
đường ống đó sống mãi. Khi người dùng gọi `api.katha.io.vn`, Cloudflare nhận ở
edge rồi đẩy request *xuôi theo đường ống có sẵn* vào nhà. CGNAT không cản được
vì kết nối là chiều đi ra — giống như bạn xem YouTube được dù không có IP public.

## 3. Từng lớp cấu hình đã làm

### 3.1 Đóng gói backend — `backend/Dockerfile` (2 tầng)

Xem giải thích chi tiết ở `11-deploy-homeserver.md` §4. Tóm tắt: tầng builder
cài dependencies từ lockfile, tầng runner chỉ chứa thành phẩm + chạy user
thường (không root). Sửa code → rebuild ~6 giây nhờ layer cache.

### 3.2 Chạy trên server — `deploy/docker-compose.homeserver.yml`

```yaml
services:
  api:            # backend FastAPI
    build: ../backend
    env_file: .env          # toàn bộ secrets nằm ở file này TRÊN SERVER
    networks:
      default: {}           # mạng riêng của compose này → cloudflared gọi được
      proxy:                # mạng CHUNG có sẵn của server (caddy_proxy đang dùng)
        aliases: [katha-api]
  cloudflared:    # người giữ đường ống
    command: tunnel --no-autoupdate run
    environment: [TUNNEL_TOKEN=${TUNNEL_TOKEN}]
networks:
  proxy: {external: true}   # "external" = dùng mạng đã tồn tại, không tạo mới
```

Ba điểm cần hiểu:

1. **`api` không publish port nào ra ngoài** (không có `ports:`). Nó chỉ tồn tại
   trong 2 mạng Docker nội bộ. Muốn gọi nó phải là: cloudflared (đi qua mạng
   `default`, gọi bằng tên `api:8000`) hoặc container khác trong mạng `proxy`
   (gọi bằng alias `katha-api:8000`). Máy lạ trong LAN cũng không gọi được —
   an toàn mặc định.
2. **Chỉ chạy đúng 1 container api** — runner tạo ảnh là in-process (D35),
   2 bản sao sẽ giành claim của nhau.
3. **Docker DNS**: trong cùng một mạng Docker, tên service = hostname. Đó là lý
   do Public Hostname của tunnel khai `HTTP://api:8000` — "api" là tên container
   nhìn từ cloudflared, không phải localhost.

### 3.3 Cloudflare — DNS, Tunnel, TLS (3 vai trò riêng)

- **DNS**: mua `katha.io.vn` → đổi nameserver về Cloudflare → Cloudflare thành
  "người trả lời" mọi câu hỏi tên miền. Record `api` do tunnel TỰ tạo (CNAME
  → `<tunnel-id>.cfargotunnel.com`, proxy bật); record `www`/root do Vercel
  hướng dẫn tạo (CNAME `cname.vercel-dns.com` / A `76.76.21.21`, proxy TẮT —
  vì Vercel muốn tự lo TLS phần của họ).
- **Tunnel**: định danh bằng TOKEN (chuỗi `eyJ...` dán vào `.env`). Mapping
  "hostname nào → service nào" khai trên dashboard (Public Hostname), không
  nằm trong code.
- **TLS**: HTTPS kết thúc tại edge Cloudflare bằng **Universal SSL cert**
  (miễn phí, tự phát hành cho `katha.io.vn` + `*.katha.io.vn`). Lúc mới add
  domain phải chờ CA ký (trạng thái "Pending Validation (TXT)" — hôm dựng chờ
  ~40 phút, HTTP 000/handshake failure trong lúc đó là bình thường). Từ edge
  vào nhà, traffic đi trong đường ống tunnel đã mã hoá sẵn.

### 3.4 Caddy của bạn — VAI TRÒ THẬT trong hệ này: KHÔNG THAM GIA

Đây là chỗ dễ hiểu lầm nhất nên nói thẳng: container `caddy_proxy` có sẵn của
bạn (Caddyfile `:80 { handle /hls* ... }`) chỉ phục vụ app hls trong **mạng
LAN**, và **Katha không đi qua nó** — đường public của Katha là Cloudflare
Tunnel như trên.

Thứ duy nhất mình làm liên quan Caddy: cho `api` join mạng `proxy` với alias
`katha-api`, để NẾU sau này bạn muốn truy cập backend trực tiếp trong LAN
(không vòng ra Internet), chỉ cần thêm vào Caddyfile:

```
# ví dụ, tùy chọn, hiện CHƯA cấu hình:
:8080 {
    reverse_proxy katha-api:8000
}
```

Không thêm thì thôi — hệ vẫn chạy đủ. "Chỉnh server rồi Caddy" thực chất là
"chỉnh server, còn Caddy chỉ chuẩn bị chỗ cắm sẵn chứ chưa cắm".

### 3.5 Env & secrets — cái gì nằm ở đâu, tại sao

| Nơi | Chứa gì | Lý do |
|-----|---------|-------|
| `deploy/.env` **trên server** (chmod 600) | DATABASE_URL, OPENAI_API_KEY, R2 keys, TUNNEL_TOKEN, CORS_ORIGINS | Secrets thật chỉ sống cạnh tiến trình cần nó; đưa lên server bằng `scp` (máy→máy qua SSH, không qua git) |
| GitHub repo | **KHÔNG có secret nào** | CI chỉ lint/test với provider giả lập; repo public cũng không lộ gì |
| Vercel env | 3 biến `NEXT_PUBLIC_*` | Loại "publishable" — vốn dĩ nhúng vào JS gửi xuống browser |

Bài học CORS đã trả giá 2 lần khi dựng: origin phải **khớp từng ký tự** với
header `Origin` browser gửi (`https://www.katha.io.vn` — không dấu `/` cuối,
không markdown, không path), và sửa xong phải `docker compose up -d` để
recreate container (env chỉ đọc lúc tạo container).

### 3.6 Đường deploy — tại sao git chứ không scp

```
máy dev ── git push ──► GitHub ──► (CI tự chạy test)
                          │
   ssh homeserver "git pull && docker compose up -d --build
                   && alembic upgrade head"
```

`scp` chở *working tree* (kể cả code dở/chưa commit) → server không biết mình
đang chạy bản nào. `git pull` chở *đúng một commit đã push* → rollback = checkout
commit cũ. Số thao tác như nhau, độ đảm bảo khác hẳn. Chi tiết + alias 1 lệnh:
`11-deploy-homeserver.md` §3.

## 4. Những sự cố đã gặp khi dựng (và cách đọc triệu chứng)

| Triệu chứng | Nguyên nhân thật | Bài học |
|---|---|---|
| `alembic` trong container báo `No module named 'psycopg2'` | Driver sync cho migration nằm ở nhóm dev-deps, image production cài `--no-dev` | Dev và prod cài khác nhau — thứ gì runtime prod cần phải nằm ở dependencies chính (fix: commit `8c5b987`) |
| `curl https://api...` ra `HTTP 000` / TLS handshake failure, dù DNS đúng | Universal SSL cert chưa phát hành xong cho zone mới | Cert cần thời gian ký; phân biệt "lỗi cấu hình" với "đang chờ hàng đợi" bằng cách thử từ 2 máy khác stack TLS |
| CORS "không nhận" origin mới | Dấu `/` cuối + URL bị editor bọc markdown; sửa file dev nhưng chưa scp/recreate | Origin so khớp exact-match; env đọc lúc tạo container |
| Test integration treo 2 giờ | Deadlock 2-session trong test race (tái hiện được cả trên CI Linux) | Đang gác lại — xem repro trong lịch sử phiên làm việc; CI job integration sẽ đỏ tới khi fix |

## 5. Câu hỏi tự kiểm tra (đọc xong thử trả lời)

1. Người đọc mở một trang truyện — ảnh minh hoạ đi qua homeserver không? (Không — R2 trực tiếp.)
2. Mất điện nhà bạn — cái gì chết, cái gì sống? (API chết → không đọc/duyệt được; trang Vercel + ảnh R2 vẫn mở nhưng báo lỗi tải truyện.)
3. Muốn đổi domain API sang `api.tenmoi.vn` cần đụng mấy chỗ? (4: Public Hostname của tunnel, `NEXT_PUBLIC_API_URL` + redeploy Vercel, `CORS_ORIGINS`... và zone mới trên Cloudflare.)
4. Vì sao service URL của tunnel là `api:8000` chứ không phải `localhost:8000`? (cloudflared và api là 2 container khác nhau — localhost của cloudflared là chính nó; chúng gọi nhau bằng Docker DNS.)
