# 13 — Mở rộng homeserver cho nhiều app (thiết kế: đọc trước, làm sau)

> Tài liệu chị em với `11-deploy-homeserver.md` (runbook Katha = làm theo) và
> `12-giai-thich-kien-truc-deploy.md` (giải thích tại sao).
>
> File này là **bản thiết kế cho lúc homeserver chạy 2+ dự án**.
>
> ✅ CẬP NHẬT 2026-07-27: migration §7 (giai đoạn A + B) **đã thực hiện xong**
> — cloudflared chạy ở stack riêng `/srv/tunnel`, routing public đi qua Caddy
> (`caddy_proxy:80`), Katha có limits + log rotation. Hệ đang chạy đúng "bức
> tranh đích" §1. Thêm dự án mới: lấy §6 (checklist) ra làm theo.

---

## 0. Ba yêu cầu đặt ra

Bối cảnh: 3-4 dự án, mỗi cái domain riêng + frontend Vercel riêng, nhưng mọi
backend đều chạy container trên homeserver. Yêu cầu:

1. **Cô lập port** — dự án 1 chạy cổng 8000 không được liên quan gì tới dự án 2
   cũng chạy cổng 8000 trong container khác.
2. **Khoán tài nguyên** — mỗi container có trần CPU/RAM, một app hư không kéo
   sập app khác.
3. **Một điểm phân luồng** — một "thằng đứng giữa" nhận mọi request, xem thuộc
   app nào rồi chuyển đúng container.

Cả ba đều là tính năng có sẵn của Docker + Caddy, không phải chế thêm:
(1) = Docker network, (2) = cgroups qua compose `limits`, (3) = reverse proxy
theo header `Host`.

## 1. Bức tranh đích

```
 api.katha.io.vn      api.blog.vn        n8n.abc.vn     ← DNS riêng từng app,
        └──────────────────┼──────────────────┘            đều trỏ về Cloudflare
                           ▼
                   Cloudflare edge (TLS kết thúc ở đây)
                           │  MỘT tunnel, nhiều Public Hostname,
                           │  TẤT CẢ đều khai service = HTTP://caddy_proxy:80
                           ▼
              cloudflared (container, trong network `proxy`)
                           │
                           ▼
                   caddy_proxy :80  ── đọc header Host, tra Caddyfile
           ┌───────────────┼────────────────┐
           ▼               ▼                ▼
     katha-api:8000   blog-api:8000    n8n-app:5678     ← cùng port 8000 vô tư,
     (+ limits)       (+ limits)       (+ limits)          vì khác "địa chỉ nhà"
           │               │
           ▼               ▼
     Supabase cloud   db riêng (CHỈ ở network default của app đó)
```

So với hiện tại (file 12 §1) chỉ khác đúng một đoạn: tunnel không trỏ thẳng
từng container nữa mà đổ hết về Caddy, và Caddy phân luồng. Vercel/R2/Supabase
không đổi gì.

## 2. Ba khái niệm nền — hiểu rồi thì mọi cấu hình bên dưới tự hiển nhiên

### 2.1 Port thuộc về IP, không thuộc về máy

Mỗi container Docker có IP riêng trong mạng ảo (`172.x.y.z`). "Port 8000" luôn
là "port 8000 **của một IP**" — hai container cùng nghe 8000 giống hai căn nhà
khác địa chỉ cùng có phòng số 8000, không nhầm được.

Port chỉ đụng nhau khi **publish ra máy host** (`ports: "8000:8000"`) — host
chỉ có một IP, dự án thứ hai đòi đúng port đó sẽ fail ngay lúc `up`.

→ **Quy tắc: không app nào có `ports:` cả.** Mọi truy cập đi qua Caddy bằng
*tên*. Thứ duy nhất phải giữ không trùng là tên/alias, nên đặt **tiền tố dự
án**: `katha-api`, `blog-api`, `n8n-app`.

⚠️ Chi tiết dễ bẫy: Compose còn tự gắn **tên service** làm alias trên *mọi*
network mà service join — service `api` của Katha đã join `proxy`, nên trên
mạng chung gọi được bằng cả `api` lẫn `katha-api`. Khi app thứ hai cũng đặt
service tên `api`, tên trần `api` trên `proxy` thành nhập nhằng (phân giải ra
nhiều container khác dự án). Vì vậy target trong Caddyfile/dashboard **luôn là
alias có tiền tố**, không bao giờ là tên service trần (`api`, `db`).

### 2.2 Docker network = ai được nói chuyện với ai; DNS = gọi nhau bằng tên

- Mỗi compose tự tạo network `default` **riêng, cô lập** — container của dự án
  A không thấy dự án B. Đó là cô lập mặc định, giữ nguyên.
- Network `proxy` (external, có sẵn trên server tại `/srv/proxy`) là **mạng
  chung**: service nào cần Caddy/cloudflared gọi tới thì join vào đó kèm alias.
- Trong cùng network, Docker DNS phân giải tên service/alias → IP container.
  Vì thế Caddyfile viết `reverse_proxy katha-api:8000` chứ không có IP nào.
- **DB/redis của từng app KHÔNG join `proxy`** — không ai ngoài app của nó cần
  gọi; join là mở cho mọi container trong `proxy` nhìn thấy, thêm rủi ro không
  công gì.
- `external: true` trong compose nghĩa là "dùng network đã tồn tại, đừng tạo
  mới". Thiếu dòng này, compose tạo network `<thư-mục>_proxy` riêng → alias
  thành vô nghĩa vì Caddy nằm mạng khác.

### 2.3 Header `Host` — cách "thằng đứng giữa" biết request của ai

Mọi request HTTP đều tự khai tên miền người dùng đã gõ:

```
GET /truyen/123 HTTP/1.1
Host: api.katha.io.vn        ← đi theo request từ browser → Cloudflare → tunnel → Caddy
```

cloudflared giữ nguyên header này khi chuyển vào nhà. Caddy chỉ việc đọc nó và
khớp với "sổ định tuyến" (Caddyfile). Vì vậy **một cổng 80 duy nhất của Caddy
phục vụ được vô hạn domain**.

## 3. Thiết kế từng lớp

### 3.1 Network `proxy` — của chung, không dự án nào được "sở hữu"

Trên server hiện tại network `proxy` đã tồn tại (stack `/srv/proxy` dùng).
Hai điều cần biết:

1. Kiểm tra ai đang gắn vào nó: `docker network inspect proxy` — mục
   `Containers` liệt kê **tên container** (vd `caddy_proxy`, `deploy-api-1` —
   tên do compose tự sinh), *không* hiện alias. Muốn xem alias:
   `docker inspect deploy-api-1 --format '{{json .NetworkSettings.Networks.proxy.Aliases}}'`.
2. Nếu một ngày dựng lại server từ đầu: tạo network **bằng tay, trước mọi
   compose** — `docker network create proxy` — để không stack nào sở hữu nó.
   Network do một compose tạo ra sẽ bị `docker compose down` của stack đó gỡ
   theo; network tạo tay thì không ai gỡ nhầm được.

⚠️ Hệ quả vận hành: **đừng bao giờ `docker compose down` stack `/srv/proxy`
khi các app khác đang chạy** — Caddy chết là mọi app public chết theo.
Muốn nạp lại cấu hình Caddy thì dùng `caddy reload` (§3.2), không down.

### 3.2 Caddy trung tâm — Caddyfile là "sổ định tuyến" duy nhất

Caddyfile nằm trên server (stack `/srv/proxy`; xác định đường dẫn bind-mount
chính xác bằng `docker inspect caddy_proxy --format '{{json .Mounts}}'`).
Dạng đích:

```
# ---- Katha ----
http://api.katha.io.vn {
    encode zstd gzip
    reverse_proxy katha-api:8000
}

# ---- Blog (ví dụ dự án thứ 2) ----
http://api.blog.vn {
    encode zstd gzip
    reverse_proxy blog-api:8000
}

# ---- n8n (ví dụ dự án thứ 3) ----
http://n8n.abc.vn {
    reverse_proxy n8n-app:5678
}

# ---- app hls LAN có sẵn: GIỮ NGUYÊN, không đụng ----
:80 {
    handle /hls* {
        # ... như cũ ...
    }
}
```

Bốn điều phải hiểu về file này:

1. **`http://` phía trước hostname là BẮT BUỘC.** Thiếu nó, Caddy coi site là
   HTTPS và gây ra HAI hậu quả: (a) tự đi xin cert Let's Encrypt — nhà CGNAT
   không có port 80/443 vào từ Internet nên ACME fail vĩnh viễn, log đầy lỗi;
   (b) cài redirect HTTP→HTTPS trên cổng 80, nên mọi request từ tunnel vào bị
   trả 308 quay về `https://...` → browser dính **vòng lặp redirect**
   (ERR_TOO_MANY_REDIRECTS). HTTPS đã được Cloudflare kết thúc ở edge
   (file 12 §3.3); trong nhà chỉ nói HTTP thuần là đúng thiết kế, không
   phải làm ẩu.
   - Lưu ý: block global `{ auto_https off }` **không** thay được `http://` —
     nó chỉ tắt việc xin cert + redirect, còn site hostname trần vẫn bind cổng
     443; request vào :80 vẫn không tới app (rơi xuống catch-all `:80`).
2. **Block hostname cụ thể thắng block catch-all `:80`.** Caddy chọn site
   block khớp *cụ thể nhất* với Host của request: request mang
   `Host: api.katha.io.vn` vào block Katha; request LAN gọi bằng IP
   (không khớp hostname nào) rơi xuống `:80` → app hls cũ chạy y nguyên.
3. **Nạp lại cấu hình không downtime:**
   ```bash
   docker exec caddy_proxy caddy validate --config /etc/caddy/Caddyfile   # soát cú pháp trước
   docker exec caddy_proxy caddy reload   --config /etc/caddy/Caddyfile   # nạp, không rớt kết nối
   ```
   (Đường dẫn `/etc/caddy/Caddyfile` là mặc định của image Caddy — đối chiếu
   với kết quả `docker inspect` ở trên nếu stack `/srv/proxy` mount chỗ khác.)
   Lỗi **cú pháp** thì cả validate lẫn reload đều tự chặn, config cũ vẫn chạy
   nguyên. Thứ hai lệnh này KHÔNG bắt được là sai **nội dung** (xoá nhầm
   block, gõ sai tên upstream) — soát bằng mắt + chạy bước test §6-bước-8.
4. ⚠️ **File `deploy/Caddyfile` trong repo Katha là đồ thừa của phương án VPS
   cũ** (`10-deploy-vps.md`): nó viết `api.katha.example.com` *không* có
   `http://` vì VPS có IPv4 public cho Let's Encrypt xác thực. Đem nguyên xi
   lên homeserver là dính đúng cái bẫy ở điểm 1. **Không copy file đó.**

### 3.3 Tunnel — một tunnel, nhiều hostname; và nên tách cloudflared ra stack riêng

**Một tunnel phục vụ được mọi dự án.** Không cần 4 tunnel/4 token. Trên
dashboard (Zero Trust → Networks → Tunnels → Public Hostname) khai nhiều dòng,
tất cả cùng một service:

| Public hostname | Service |
|---|---|
| `api.katha.io.vn` | `HTTP://caddy_proxy:80` |
| `api.blog.vn` | `HTTP://caddy_proxy:80` |
| `n8n.abc.vn` | `HTTP://caddy_proxy:80` |

Cloudflare chỉ còn nhiệm vụ "ném hết vào nhà"; phân luồng là việc của Caddy.
Thêm app mới phía Cloudflare = thêm một dòng y hệt (hoặc dùng wildcard — §5).

**Điều kiện để cloudflared gọi được `caddy_proxy`:** hai container phải chung
network → cloudflared phải **join network `proxy`** (hiện tại nó chỉ ở
`default` của compose Katha — file 12 §3.2; đây là một bước trong migration §7).

**Khuyến nghị kiến trúc: tách cloudflared ra stack riêng.** Hiện cloudflared
sống trong compose của Katha — chấp nhận được khi chỉ có một app, nhưng thành
thiết kế sai khi có nhiều app: `docker compose down` stack Katha sẽ giết luôn
tunnel của *mọi* dự án. Tunnel là hạ tầng chung, xứng đáng một chỗ riêng:

```yaml
# /srv/tunnel/docker-compose.yml — stack hạ tầng, ngang hàng /srv/proxy
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}   # .env riêng tại /srv/tunnel, chmod 600
    networks:
      - proxy
networks:
  proxy:
    external: true
```

Chuyển không downtime được, vì **một tunnel cho phép nhiều connector chạy song
song** (cùng token): bật stack mới → dashboard hiện 2 connector → tắt
cloudflared trong compose Katha → còn 1. Chi tiết thứ tự ở §7.

### 3.4 Template compose cho một app mới

Chuẩn hoá từ compose Katha đang chạy thật + bổ sung limits và logging:

```yaml
# /srv/apps/<du-an>/deploy/docker-compose.homeserver.yml
services:
  api:
    build:
      context: ../backend          # tuỳ repo
    env_file: .env                 # secrets chỉ sống trên server, chmod 600
    restart: unless-stopped        # tự dậy sau mất điện/reboot
    networks:
      default: {}                  # nói chuyện nội bộ với db của chính nó
      proxy:
        aliases:
          - <duan>-api             # TÊN TIỀN TỐ DỰ ÁN — thứ duy nhất phải unique
    deploy:
      resources:
        limits:
          cpus: "1.0"              # trần CPU — chạm trần thì CHẬM, không chết
          memory: 1G               # trần RAM — chạm trần thì container NÀY chết, app khác vô can
    logging:
      driver: json-file
      options:
        max-size: "10m"            # không giới hạn thì log phình vô hạn, đầy đĩa
        max-file: "3"
    healthcheck:
      test: ["CMD", "python", "-c",
             "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5)"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s            # chỉnh test theo runtime của app (node/go/…)

  db:                              # NẾU app có DB riêng
    image: postgres:16
    env_file: .env
    restart: unless-stopped
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      default: {}                  # CHỈ default — tuyệt đối không join proxy
    deploy:
      resources:
        limits:
          memory: 1G

volumes:
  db-data:

networks:
  proxy:
    external: true                 # dùng network chung có sẵn, không tạo mới
```

Những dòng **cố ý không có**:
- `ports:` — không publish gì ra host (§2.1). Đường vào duy nhất: Caddy.
- `container_name:` — để compose tự đặt tên theo thư mục, tránh đụng tên
  cứng giữa các dự án.

Tên service để ngắn (`api`, `db`) cho gọn compose — nhưng nhớ tên service
cũng leak lên `proxy` làm alias ngầm (§2.1); muốn triệt để khỏi nhập nhằng
thì đặt luôn tên service có tiền tố. Dù chọn cách nào: mọi target *ngoài*
compose (Caddyfile, dashboard) chỉ dùng alias tiền tố.

Ghi chú: `deploy.resources.limits` có hiệu lực với `docker compose up` bình
thường (Compose v2+, server đang Compose v5) — không cần Swarm.

### 3.5 Giới hạn tài nguyên — hành xử khi chạm trần và cách chọn số

Hai loại trần hành xử **khác nhau**, đừng nhầm:

| | CPU (`cpus`) | RAM (`memory`) |
|---|---|---|
| Chạm trần thì | Bị bóp tốc độ (throttle) — **chậm đi, không chết** | Container bị **kill ngay** (OOM kill) |
| Ảnh hưởng app khác | Không — app khác vẫn đủ phần | Không — chết đúng thằng vượt trần |
| Sau đó | Xong việc nặng thì lại bình thường | `restart: unless-stopped` tự dựng dậy |
| Nếu KHÔNG đặt trần | App nặng (Katha sinh ảnh!) chiếm hết CPU, mọi app cùng lag | App leak RAM → kernel OOM killer giết process ăn RAM nhiều nhất — thường là chính app leak, nhưng có thể trúng nạn nhân vô tội (Postgres, thậm chí dockerd) nếu chúng đang to hơn lúc cạn RAM |

Gợi ý phân bổ cho máy 16GB RAM (điều chỉnh theo thực đo):

| Thành phần | cpus | memory | Ghi chú |
|---|---|---|---|
| katha api | 2.0 | 2G | Nặng nhất — runner sinh ảnh in-process (D35) |
| Mỗi app nhỏ | 1.0 | 1G | Blog/tool/n8n cỡ này là rộng |
| Mỗi DB local | 1.0 | 1G | Postgres mặc định ăn ít, 1G đủ cho hobby |
| Caddy + cloudflared | — | — | Nhẹ (vài chục MB), không cần trần |
| Chừa cho OS + Docker | | ~2-3G | Không phải cấu hình — là phần ĐỪNG khoán hết |

Nguyên tắc: tổng các trần RAM *được phép* nhỉnh hơn RAM thật một chút (hiếm
khi mọi app cùng đạp đỉnh), nhưng tổng **mức dùng thường trực** (xem
`docker stats`) nên dưới ~70% máy. Trần CPU thoải mái hơn — CPU throttle chỉ
làm chậm, không gây chết.

Lệnh theo dõi:

```bash
docker stats --no-stream                    # ai đang ăn bao nhiêu, so với trần
docker inspect <container> --format '{{.State.OOMKilled}}'   # true = từng bị giết vì RAM
```

## 4. Phương án thay thế: tunnel trỏ thẳng từng container (không qua Caddy)

Vẫn hợp lệ về kỹ thuật — Public Hostname trỏ thẳng `HTTP://katha-api:8000`,
`HTTP://blog-api:8000`... (mọi app + cloudflared cùng join `proxy`). Khi nào
cân nhắc: chỉ 2 app và lười đụng Caddyfile.

Vì sao thiết kế chính vẫn là Caddy trung tâm:

| | Tunnel trỏ thẳng | Qua Caddy (thiết kế chính) |
|---|---|---|
| Bảng routing nằm ở | Dashboard Cloudflare — **ngoài git**, mất tunnel là dựng lại bằng trí nhớ | Một Caddyfile — đọc/diff/backup được |
| Thêm app | Sửa dashboard | Thêm 3 dòng vào file (+1 dòng dashboard, hoặc 0 nếu wildcard) |
| Muốn thêm auth/rate-limit/log riêng | Không có chỗ đặt | Đặt ngay trong block của app đó |
| Nhìn toàn cảnh traffic | Rải rác | Một chỗ (access log của Caddy) |

## 5. DNS/domain cho dự án mới — ba tình huống

1. **Subdomain của domain đã có** (vd `blog.katha.io.vn`): rẻ nhất — zone đã
   trên Cloudflare, Universal SSL đã cover `*.katha.io.vn`. Chỉ thêm Public
   Hostname (record CNAME do tunnel tự tạo). Không phải chờ gì.
   - ⚠️ Universal SSL chỉ cover **một cấp** sub: `blog.katha.io.vn` OK,
     `api.blog.katha.io.vn` (hai cấp) thì KHÔNG — tránh đặt tên hai cấp.
2. **Domain mới hoàn toàn** (vd `blog.vn`): lặp lại quy trình file 12 §3.3 —
   mua → đổi nameserver về Cloudflare → chờ Universal SSL ký (hôm dựng Katha
   chờ ~40 phút, trong lúc chờ curl lỗi TLS handshake là *bình thường*, đừng
   sửa lung tung). Frontend của dự án đó trên Vercel thì record `www`/root proxy
   TẮT như Katha đã làm.
3. **Wildcard** (vd `*.abc.vn` → mọi sub đổ về Caddy): tunnel hỗ trợ Public
   Hostname wildcard, nhưng record DNS wildcard **phải tự tạo tay**: CNAME
   `*` → `<tunnel-id>.cfargotunnel.com`, proxy bật. Được cái từ đó thêm app
   chỉ còn sửa Caddyfile, không đụng dashboard nữa.

Đừng quên đôi bạn CORS: backend mới nào có frontend riêng thì `CORS_ORIGINS`
của *backend đó* phải khớp origin Vercel *của nó*, từng ký tự, và recreate
container sau khi sửa (bài học trả giá 2 lần — file 12 §3.5).

## 6. Checklist: thêm app thứ N (làm theo thứ tự, mỗi bước có kiểm chứng)

```text
[ ] 1. DNS sẵn sàng (§5): subdomain có sẵn / zone mới đã Active / wildcard đã tạo
[ ] 2. Code lên GitHub → SSH server: git clone vào /srv/apps/<tên>
[ ] 3. Tạo .env cạnh compose (scp từ máy dev, KHÔNG qua git), chmod 600
[ ] 4. Viết compose theo template §3.4 — soát 5 điểm: alias có tiền tố ∙
       có limits ∙ có logging ∙ KHÔNG có ports: ∙ không chỗ nào target bằng
       tên service trần (§2.1)
[ ] 5. docker compose -f docker-compose.homeserver.yml up -d --build
       → docker compose -f docker-compose.homeserver.yml ps: Up (healthy)
       (file không mang tên mặc định → lệnh compose TRẦN sẽ báo "no
       configuration file" — hoặc tệ hơn, chọn nhầm file khác nếu thư mục có
       docker-compose.yml. Luôn kèm -f.)
[ ] 6. Test app "sống" từ trong network proxy (chưa cần Caddy/tunnel):
       docker run --rm --network proxy curlimages/curl -fsS http://<alias>:<port>/health
[ ] 7. Thêm block http://<hostname> { reverse_proxy <alias>:<port> } vào Caddyfile
       → caddy validate → caddy reload (§3.2)
[ ] 8. Test qua Caddy (giả header Host, vẫn chưa cần tunnel):
       docker run --rm --network proxy curlimages/curl -fsS \
         -H "Host: <hostname>" http://caddy_proxy:80/health
[ ] 9. Dashboard tunnel: thêm Public Hostname <hostname> → HTTP://caddy_proxy:80
       (bỏ qua nếu đã wildcard)
[ ] 10. Test từ Internet thật: curl -fsS https://<hostname>/health
        (domain mới mà curl báo lỗi TLS/SSL — exit 35/6, tương đương "000"
        nếu đo bằng -w '%{http_code}' → xem §8, khả năng cert đang pending)
[ ] 11. Frontend: set NEXT_PUBLIC_API_URL trên Vercel + redeploy;
        backend: CORS_ORIGINS khớp origin Vercel + up -d để recreate
[ ] 12. Ghi vào sổ hạ tầng (§9): app này dùng key/secret nào, hostname nào
```

Bước 6 và 8 là hai "van chặn" quý nhất: fail ở 6 = lỗi app/compose; qua 6 mà
fail ở 8 = lỗi Caddyfile; qua 8 mà fail ở 10 = lỗi tunnel/DNS/cert. Khoanh
vùng xong mới sửa — đừng sửa mù.

## 7. Lộ trình chuyển Katha sang mô hình này (làm khi bắt đầu có app thứ 2)

> ✅ Đã thực hiện trọn vẹn (A1→A3, B1→B4) ngày 2026-07-27, downtime ≈ 0.
> Giữ nguyên nội dung dưới đây làm tài liệu tham chiếu + đường rollback.

Hai giai đoạn, **làm A xong hẳn rồi mới B** — B đòi hỏi connector đang chạy
phải nằm trong network `proxy` (chính là kết quả của A). Mỗi giai đoạn có
rollback riêng, tổng downtime ≈ 0.

### Giai đoạn A — tách cloudflared ra stack riêng `/srv/tunnel`

```text
A1. Tạo /srv/tunnel/{docker-compose.yml,.env} theo §3.3 — .env chmod 600;
    giá trị TUNNEL_TOKEN COPY từ /srv/apps/katha-story-generator/deploy/.env
    có sẵn trên server (grep TUNNEL_TOKEN). KHÔNG tạo tunnel/token mới trên
    dashboard: token khác = tunnel khác, hỏng logic "2 connector cùng tunnel".
A2. docker compose up -d tại /srv/tunnel
    → Dashboard tunnel phải hiện 2 connector (cũ trong compose Katha + mới)
    → Cả hai cùng nhận traffic (Cloudflare tự phân bố — replicas là cơ chế
      dự phòng, không cam kết chia đều). Connector mới với tới backend được
      ngay dù Public Hostname vẫn trỏ api:8000 — vì tên service `api` cũng là
      alias trên network proxy (§2.1). Giai đoạn A tự đứng vững.
A3. Xoá service cloudflared khỏi deploy/docker-compose.homeserver.yml (commit)
    → git pull trên server, rồi tại /srv/apps/katha-story-generator/deploy:
      docker compose -f docker-compose.homeserver.yml up -d --remove-orphans
    → Dashboard còn 1 connector; curl https://api.katha.io.vn/health vẫn OK
    ⚠️ BẮT BUỘC có -f: thư mục deploy/ còn docker-compose.yml của phương án
      VPS cũ — lệnh compose TRẦN sẽ chọn nhầm file đó (recreate api mất
      network proxy + alias, dựng caddy VPS chiếm port 80/443 của host).
      Mọi lệnh compose cho Katha luôn kèm -f docker-compose.homeserver.yml.
Rollback A: chưa A3 → docker compose down tại /srv/tunnel là về nguyên trạng;
    đã A3 → checkout commit cũ + up lại (nhớ -f) là connector cũ quay về.
```

Vì sao A đứng độc lập được: Compose gắn tên service làm DNS alias trên *mọi*
network mà service join (§2.1), nên `api:8000` vẫn phân giải được từ network
`proxy`. Nhưng đó là đường sống **tạm** — khi app thứ hai cũng có service tên
`api` join `proxy`, tên trần này thành nhập nhằng. Đích đến vẫn là B: mọi
target chuyển về `caddy_proxy:80`, từ đó chỉ Caddyfile giữ tên có tiền tố.

### Giai đoạn B — routing qua Caddy (sau khi A xong)

```text
B1. Thêm vào Caddyfile server (/srv/proxy):
        http://api.katha.io.vn {
            encode zstd gzip
            reverse_proxy katha-api:8000
        }
    → caddy validate → caddy reload. (Chưa ảnh hưởng ai — chưa request nào
      mang Host này tới Caddy.)
B2. Test đường mới trước khi trỏ thật:
    docker run --rm --network proxy curlimages/curl -fsS \
      -H "Host: api.katha.io.vn" http://caddy_proxy:80/health
B3. Dashboard: sửa Public Hostname api.katha.io.vn
    Service: HTTP://api:8000  →  HTTP://caddy_proxy:80   (hiệu lực ~ngay)
B4. curl -fsS https://api.katha.io.vn/health + mở web đọc thử một truyện
Rollback B: đổi Service về HTTP://api:8000 trên dashboard — vài giây, hoạt
    động với bất kỳ connector nào đang sống (tên `api` phân giải được trên
    network proxy — xem ghi chú cuối giai đoạn A). Đường lui này chỉ mất khi
    có app thứ hai cũng đặt service tên `api` — lúc đó rollback về
    HTTP://katha-api:8000.
```

Sau A+B, thêm limits cho api Katha (compose hiện chưa có — §3.5 đề xuất
`cpus: "2.0"`, `memory: 2G`) rồi `up -d` (kèm `-f` như mọi khi) để áp.
Không sửa gì code backend, network default + alias `katha-api` giữ nguyên.

## 8. Sự cố thường gặp — tra theo triệu chứng

| Triệu chứng | Nguyên nhân khả dĩ | Chẩn đoán / xử lý |
|---|---|---|
| Cloudflare báo 502/Bad Gateway ở một hostname | cloudflared không với tới service khai trên dashboard (sai tên, hoặc chưa chung network) | `docker logs <cloudflared>` — tìm lỗi dial/connection refused; `docker network inspect proxy` xem hai đầu có chung mạng không |
| Site dính vòng lặp redirect (ERR_TOO_MANY_REDIRECTS), log Caddy đầy `obtaining certificate`/ACME failed | Quên `http://` trước hostname → Caddy coi site là HTTPS: đòi cert sau CGNAT + trả 308 về `https://` cho mọi request vào :80 (§3.2 điểm 1) | Thêm `http://`, `caddy reload` |
| `network proxy declared as external, but could not be found` | Server dựng lại từ đầu, network chưa tồn tại | `docker network create proxy` (§3.1) rồi up lại |
| `Bind for 0.0.0.0:XXXX failed: port is already allocated` | Ai đó thêm `ports:` vào một app, đụng port host với app khác | Xoá `ports:` — mô hình này không app nào publish port (§2.1) |
| Một app chết đi sống lại theo chu kỳ | RAM chạm trần → OOM kill → restart → lặp | `docker inspect <c> --format '{{.State.OOMKilled}}'` ra `true` → tăng `memory` hoặc sửa leak |
| Mọi app cùng chậm bất thường | Một app đang ăn CPU không trần (thủ phạm quen: Katha sinh ảnh), hoặc đang có `--build` chạy | `docker stats --no-stream` — nhìn cột CPU%; đặt/đối chiếu limits §3.5 |
| Domain mới curl lỗi TLS handshake (exit 35/6; đo `-w '%{http_code}'` ra 000) dù DNS đúng | Universal SSL cert chưa ký xong cho zone mới | Chờ (Katha từng chờ ~40'); phân biệt với lỗi cấu hình bằng cách thử từ 2 máy khác stack TLS (file 12 §4) |
| Sửa `.env` xong không thấy tác dụng | Env chỉ đọc lúc **tạo** container — `restart` không đủ | `docker compose up -d` để recreate (file 12 §3.5) |
| `caddy reload` xong site chết/lạc đường | Caddyfile hợp lệ cú pháp nhưng sai **nội dung** (xoá nhầm block, gõ sai tên upstream) — lỗi cú pháp thì reload tự fail và giữ nguyên config cũ, không làm chết site | Diff Caddyfile với bản backup (§9); `validate` chỉ bắt cú pháp, không bắt sai nội dung |
| App A tự nhiên gọi được DB của app B | DB bị join nhầm vào `proxy` | DB chỉ ở `default` của app nó (§2.2) |
| Đĩa đầy, mọi container cùng lăn ra | Image/build-cache/log tích tụ ×N dự án | `docker system df` xem ai chiếm; dọn theo §9 |

## 9. Vệ sinh định kỳ — nợ nhỏ của mô hình nhiều app

```bash
# cron hằng tuần trên server (crontab -e):
0 4 * * 0  docker image prune -af --filter "until=168h" && docker builder prune -af --filter "until=168h"
```

- **Log container**: đã chặn từ gốc bằng `logging.options.max-size` trong
  template §3.4 — app nào thiếu thì thêm vào (cần recreate để áp).
- **Đĩa**: thỉnh thoảng `df -h` + `docker system df`. Đĩa đầy = mọi app cùng
  chết, kể cả DB — đây là sự cố "cả nhà cùng khổ" số một của homeserver.
- **Sổ hạ tầng** (một file markdown, KHÔNG chứa giá trị secret): app nào dùng
  key nào (OpenAI? R2? DB nào?), hostname nào, limits bao nhiêu. Trả lời được
  câu "rotate key X phải sửa mấy chỗ?" trong 30 giây.
- **Backup Caddyfile**: nó là bảng routing của cả hệ — đưa `/srv/proxy` vào
  một repo git riêng (Caddyfile không chứa secret nên an toàn).
- **Cập nhật image hạ tầng** (`caddy`, `cloudflared`): compose hiện dùng
  `cloudflare/cloudflared:latest` — thi thoảng pull tag mới một cách *chủ
  động* lúc rảnh (hoặc pin version cụ thể), đừng để `:latest` tự nhảy version
  vào đúng lúc bận.

## 10. Câu hỏi tự kiểm tra (đọc xong thử trả lời)

1. Hai app cùng nghe cổng 8000 trong container — có đụng nhau không? Khi nào
   mới đụng? (Không — port thuộc IP, mỗi container một IP. Chỉ đụng khi cả hai
   cùng `ports:` publish ra host.)
2. Caddy dựa vào đâu để biết request thuộc app nào? (Header `Host` — browser
   gửi kèm, Cloudflare/tunnel giữ nguyên tới tận Caddy.)
3. Thêm app thứ 5 phải đụng những chỗ nào? Có phải sửa app 1-4 không? (Compose
   của app mới + 1 block Caddyfile + 1 Public Hostname [0 nếu wildcard]. Bốn
   app cũ không đụng một ký tự.)
4. App bị OOM kill thì app bên cạnh có bị gì không? (Không — cgroup giết đúng
   container vượt trần RAM của nó, `restart` dựng lại. Không đặt trần mới lây.)
5. Vì sao DB không join network `proxy`? (Chỉ app của nó cần gọi nó; join
   `proxy` là phơi ra cho mọi container trong mạng chung — thêm rủi ro, không
   thêm lợi ích.)
6. `docker compose down` ở `/srv/proxy` nguy hiểm ra sao khi có 4 app? (Caddy
   chết → mọi đường public chết; muốn nạp cấu hình mới dùng `caddy reload`,
   không down.)
7. Vì sao cloudflared nên nằm stack riêng thay vì trong compose Katha? (Nó là
   hạ tầng chung của mọi app — nằm trong compose Katha thì down Katha là chết
   tunnel của cả nhà.)
