# Phase 2 — Config + Character Bank Implementation Plan

> Trạng thái: Phase 2 code-complete offline, pending Docker + Supabase/R2 live verification
> Phạm vi: API config, Character Bank seed-only, Supabase Auth cho khu vực admin
> Thời lượng dự kiến: 3–4 ngày phát triển + 0.5 ngày nghiệm thu live
> Phụ thuộc: Phase 1 scaffold đã code-complete; migration/seed/R2 live có thể hoàn tất song song

> **Supersession Phase 5**: D49–D51 thay mọi giả định tương lai trong tài liệu Phase 2 về public catalogue/login reader/layout/mobile. Public reader hiện chỉ qua opaque `/stories/[shareToken]`, không login/catalogue; D50 dùng one-language image-top reader; D51 giữ mobile admin quick/progress/recovery/share nhưng khóa deep mutation theo usable canvas.

---

## 1. Mục tiêu

Biến scaffold Phase 1 thành một lát cắt ứng dụng có thể sử dụng:

- Admin đăng nhập bằng tài khoản Supabase Auth đã tạo sẵn.
- Backend xác minh Supabase access token và phân biệt `admin`/`reader`.
- Admin đọc được danh sách backbone, genre, art style và 7 nhân vật seed qua API.
- Frontend có login flow và trang `/admin/characters` hiển thị Character Bank.
- Ảnh reference được đọc từ `ref_image_urls`; UI có placeholder nếu URL thiếu hoặc tải lỗi.
- Không mở rộng database schema và không bắt đầu story/image-generation pipeline.

Phase này hoàn thiện **auth + read-only application slice**, không phải toàn bộ backend.

---

## 2. Quyết định phạm vi dùng cho plan này

### G1 — Reader public, khu vực admin bắt buộc đăng nhập

- Phase 5 supersede ghi chú cũ này bằng D49: reader chỉ đọc exact opaque link qua `/api/public/shared-stories/{share_token}`; không có public catalogue/list endpoint.
- Các endpoint Phase 2 phục vụ màn hình quản trị và tạo truyện về sau, nên yêu cầu tài khoản admin.
- Frontend route `/admin/*` yêu cầu session hợp lệ và role `admin`.
- Backend luôn là lớp enforcement cuối cùng; frontend guard chỉ phục vụ UX.
- Không làm đăng ký, quên mật khẩu, đổi mật khẩu hoặc quản trị user.

### G5 — Character Bank seed-only trong MVP

- Chỉ đọc 7 nhân vật đã seed.
- Không có POST/PUT/DELETE character.
- Không có UI tạo/sửa/xóa nhân vật.
- Không upload hoặc sinh ảnh reference mới trong Phase 2.
- Script upload 7 ảnh của Phase 1 tiếp tục là nguồn cập nhật `ref_image_urls`.

### Role contract

- Role ứng dụng được lưu server-side trong Supabase `app_metadata.app_role`.
- Hai giá trị hợp lệ trong MVP: `admin`, `reader`.
- Backend đọc claim theo đường dẫn `payload["app_metadata"]["app_role"]`.
- Thiếu role hoặc role không hợp lệ được normalize thành `reader`.
- Tuyệt đối không dùng `user_metadata` để authorize.
- Việc gán `app_metadata` chỉ thực hiện qua Supabase Dashboard hoặc Admin API chạy ở trusted environment; không đưa secret/service-role key ra frontend.

Sau khi Product Owner xác nhận, cập nhật G1/G5 trong `08-implementation-gates.md` và ghi quyết định tương ứng vào `01-decisions-log.md` trước khi merge Phase 2.

---

## 3. Ngoài phạm vi

- Reader UI và public story API.
- Character CRUD hoặc character image generation.
- Story CRUD, tạo outline, sinh/dịch/chỉnh sửa nội dung.
- OpenAI integration.
- RLS redesign hoặc thêm bảng `profiles`/`user_roles`.
- SSR authentication với `@supabase/ssr`.
- Pagination cho config và 7 nhân vật.
- Generic response wrapper chỉ để “dùng sau”.
- Dashboard thống kê.

---

## 4. Kiến trúc và nguyên tắc

### Backend

Giữ modular monolith theo feature:

```text
backend/src/katha/
├── core/
│   └── config.py
├── features/
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── dependencies.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── config_data/
│   │   ├── models.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── service.py
│   └── characters/
│       ├── models.py
│       ├── router.py
│       ├── schemas.py
│       └── service.py
└── main.py
```

Luồng phụ thuộc:

```text
router -> auth dependency + service -> SQLAlchemy model/database
```

- Router chỉ nhận request, inject dependency, trả response.
- Service chứa truy vấn và quy tắc sắp xếp/not-found.
- Schema kiểm soát dữ liệu được expose.
- Feature không import router của feature khác.
- Không đặt business logic trong `main.py`.

### Frontend

Giữ App Router và feature-based:

```text
frontend/src/
├── app/
│   ├── login/page.tsx
│   └── admin/
│       ├── layout.tsx
│       └── characters/page.tsx
├── components/
│   ├── layout/AdminHeader.tsx
│   └── ui/
├── features/
│   ├── auth/
│   │   ├── AuthProvider.tsx
│   │   ├── RequireAdmin.tsx
│   │   ├── auth.ts
│   │   └── useAuth.ts
│   └── characters/
│       ├── api.ts
│       ├── types.ts
│       ├── useCharacters.ts
│       └── components/CharacterCard.tsx
└── lib/
    ├── api.ts
    └── supabase.ts
```

- `app/` chỉ đảm nhiệm route composition.
- Logic Supabase session nằm trong feature `auth`.
- Logic fetch/cache nhân vật nằm trong feature `characters`.
- UI primitive dùng chung đặt trong `components/ui`.
- Component layout đặt trong `components/layout`, không đặt Navbar trong `shared/ui`.

---

## 5. Backend authentication

### 5.1 Dependencies và cấu hình

Thêm production dependency:

```toml
"pyjwt[crypto]"
```

Không cần thêm `cachetools` nếu JWKS client của thư viện đã có cache phù hợp. Không tự viết thuật toán JWT.

Backend environment:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
```

Không cần `SUPABASE_SERVICE_ROLE_KEY` để verify JWT.

Trước live verification, xác nhận Supabase project đang sử dụng asymmetric signing key và JWKS endpoint trả public keys:

```text
GET <SUPABASE_URL>/auth/v1/.well-known/jwks.json
```

Nếu project vẫn dùng legacy HS256, không tự fallback sang verify bằng shared JWT secret. Product Owner cần chuyển sang asymmetric signing key hoặc duyệt phương án gọi Auth server để verify token.

### 5.2 Token model

`features/auth/schemas.py`:

```python
class TokenUser(BaseModel):
    id: UUID
    email: str | None = None
    app_role: Literal["admin", "reader"] = "reader"
```

Không trả raw token hoặc toàn bộ claims ra API.

### 5.3 Verification contract

`features/auth/service.py` chịu trách nhiệm:

1. Đọc `kid` và `alg` từ token header.
2. Chỉ chấp nhận algorithm bất đối xứng được cấu hình, tối thiểu `RS256`/`ES256`; không tin trực tiếp `alg` do token tự khai báo.
3. Lấy đúng public key từ JWKS theo `kid`.
4. Verify signature.
5. Verify `exp`.
6. Verify `iss = <SUPABASE_URL>/auth/v1`.
7. Verify `aud = authenticated`.
8. Yêu cầu `sub` và parse thành UUID.
9. Đọc email nếu có.
10. Đọc `app_metadata.app_role`, normalize về `admin` hoặc `reader`.

Failure contract:

- Thiếu Bearer token: `401`.
- Token sai signature, hết hạn, sai issuer/audience hoặc malformed: `401`.
- Token hợp lệ nhưng không đủ role: `403`.
- Response không lộ exception, key material hoặc raw token.
- `401` có header `WWW-Authenticate: Bearer`.

### 5.4 FastAPI dependencies

`features/auth/dependencies.py`:

```python
async def get_current_user(...) -> TokenUser
async def get_admin_user(user: TokenUser = Depends(get_current_user)) -> TokenUser
async def get_optional_user(...) -> TokenUser | None
```

Trong Phase 2:

- `get_current_user`: dùng cho `/api/auth/me`.
- `get_admin_user`: dùng cho toàn bộ config/character API.
- `get_optional_user`: có thể định nghĩa nếu cần cho Phase 5, nhưng không bắt buộc viết sớm nếu chưa có consumer.

### 5.5 Auth endpoint

Thêm:

```text
GET /api/auth/me
Authorization: Bearer <access_token>
```

Response `200`:

```json
{
  "id": "<uuid>",
  "email": "admin@example.com",
  "app_role": "admin"
}
```

Endpoint này giúp frontend xác nhận backend chấp nhận session và role, thay vì chỉ tin dữ liệu client-side.

---

## 6. Backend Config Data API

### 6.1 Response schemas

Các schema dùng `ConfigDict(from_attributes=True)`.

`BackboneOut`:

```text
id, name_vi, name_en, description_vi
```

`GenreOut`:

```text
id, name_vi, name_en, description_vi
```

`ArtStyleOut`:

```text
id, name_vi, name_en, sample_image_url
```

Không expose:

- `prompt_template_en`
- `prompt_modifier_en`
- `created_at` nếu UI chưa dùng

### 6.2 Endpoints

| Method | Endpoint | Auth | Response |
|---|---|---|---|
| GET | `/api/backbones` | Admin | `list[BackboneOut]` |
| GET | `/api/genres` | Admin | `list[GenreOut]` |
| GET | `/api/art-styles` | Admin | `list[ArtStyleOut]` |

Service requirements:

- Dùng `AsyncSession` được inject từ `get_db`.
- Query bằng SQLAlchemy `select`.
- `ORDER BY id ASC` để response ổn định.
- Không hardcode seed records trong router/service.

---

## 7. Backend Character API

### 7.1 Response schemas

`CharacterOut` dùng cho list:

```text
id, name, age, personality_vi, appearance_vi, ref_image_urls
```

`CharacterDetailOut` dùng cho detail:

```text
id, name, age, personality_vi, appearance_vi,
appearance_prompt_en, ref_image_urls, created_at
```

`appearance_prompt_en` chỉ xuất hiện trên endpoint admin detail. Không đưa prompt này vào list nếu UI chưa dùng.

### 7.2 Endpoints

| Method | Endpoint | Auth | Response |
|---|---|---|---|
| GET | `/api/characters` | Admin | `list[CharacterOut]` |
| GET | `/api/characters/{character_id}` | Admin | `CharacterDetailOut` |

Rules:

- `character_id` là integer dương.
- List `ORDER BY id ASC`.
- Không tìm thấy trả `404` với message ổn định: `Character not found`.
- Không có POST/PUT/PATCH/DELETE trong Phase 2.
- Không tự tạo signed R2 URL; dùng public URL đã seed vào `ref_image_urls`.

---

## 8. Router registration và API behavior

Trong `main.py` chỉ mount routers:

```python
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(config_router, prefix="/api", tags=["config"])
app.include_router(characters_router, prefix="/api", tags=["characters"])
```

Giữ nguyên:

- `GET /health` public.
- CORS đọc từ environment.
- Không đổi database schema/migration nếu Phase 2 không phát hiện lỗi thật trong schema đã chốt.

API không cần response wrapper chung ở phase này. FastAPI validation/error format được dùng nhất quán.

---

## 9. Frontend authentication flow

### 9.1 Supabase client

Tiếp tục dùng `@supabase/supabase-js` ở browser với:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- Chỉ publishable key được đặt trong `NEXT_PUBLIC_*`.
- Không đưa secret/service-role key vào frontend.
- Không gọi trực tiếp Supabase Database từ frontend; chỉ dùng Supabase Auth.

### 9.2 AuthProvider

`AuthProvider` quản lý:

- Trạng thái `loading`, `authenticated`, `unauthenticated`.
- Supabase session hiện tại.
- User/role đã được backend xác nhận qua `/api/auth/me`.
- Subscription `onAuthStateChange` và cleanup khi unmount.
- `signIn(email, password)`.
- `signOut()`.

Không authorize admin chỉ bằng cách decode JWT ở frontend. Backend `/api/auth/me` là nguồn xác nhận role cho UI.

### 9.3 API client

`apiFetch`:

- Lấy access token hiện tại từ Supabase session.
- Thêm `Authorization: Bearer <token>` nếu có.
- Giữ header caller truyền vào.
- Parse response có kiểm soát.
- `401`: sign out/đưa về `/login` khi đang ở admin route.
- `403`: hiển thị “Tài khoản không có quyền quản trị”, không tự retry vô hạn.
- Network error và non-JSON error phải cho UI nhận được message an toàn.

Không log access token ra console.

### 9.4 Login page

Route: `/login`

Yêu cầu:

- Form email + password.
- Validate required fields trước khi submit.
- Disable submit và hiển thị loading trong lúc gọi API.
- Hiển thị lỗi sai credentials/network bằng message thân thiện.
- Login thành công, backend `/api/auth/me` xác nhận admin rồi redirect `/admin/characters`.
- Tài khoản reader đăng nhập được nhưng nhận trang “không có quyền quản trị”; không được vào `/admin/*`.
- Không có sign-up/forgot-password.

### 9.5 Admin route guard

`/admin/layout.tsx` dùng `RequireAdmin`:

- Auth đang load: hiển thị skeleton/spinner, không flash nội dung admin.
- Chưa login: redirect `/login` và giữ `next` path nếu triển khai đơn giản được.
- Role reader: render forbidden state hoặc redirect trang an toàn.
- Role admin: render admin layout.

Đây là client-side UX guard. Mọi API vẫn phải dùng `get_admin_user`.

### 9.6 Navigation

`AdminHeader` tối thiểu gồm:

- Tên/logo Katha.
- Link “Nhân vật”.
- Email tài khoản hiện tại.
- Nút đăng xuất.
- Responsive ở mobile/tablet.

Không cần sidebar/dashboard lớn trong Phase 2.

---

## 10. Frontend Character Bank

Route: `/admin/characters`

### Data fetching

- Cài và dùng SWR theo kiến trúc đã chốt, hoặc giữ một fetch hook nhỏ nếu dev chứng minh không cần dependency mới; không đặt fetch logic trực tiếp rải rác trong card.
- Fetch `GET /api/characters` qua `apiFetch`.
- Không fetch trực tiếp Supabase tables.

### UI states

Trang phải có đủ:

1. Loading skeleton.
2. Success grid.
3. Empty state.
4. API/network error + nút thử lại.
5. Unauthorized/forbidden được xử lý bởi auth layer.

### Character card

Hiển thị:

- Ảnh reference đầu tiên trong `ref_image_urls`.
- Placeholder nếu array rỗng hoặc ảnh lỗi.
- Tên.
- Tuổi.
- `personality_vi` dạng rút gọn.
- Responsive grid: 1 cột mobile, 2 tablet, 3–4 desktop.

Phase 2 chưa cần modal/detail page nếu list đã đáp ứng deliverable. Endpoint detail vẫn được làm và test để chuẩn bị cho Character Picker/inspection về sau.

### Root route

Thay màn hình scaffold ở `/` bằng điều hướng tối thiểu:

- Admin session hợp lệ -> `/admin/characters`.
- Chưa đăng nhập -> `/login`.
- **SUPERSEDED bởi D49**: Root không trở thành public story list. Reader chỉ mở exact opaque `/stories/[shareToken]`; không có catalogue/search.

Không xóa health endpoint backend; status UI Phase 1 không còn là landing chính của sản phẩm.

---

## 11. Testing plan

### 11.1 Auth unit tests — không cần Docker

Tạo test keypair/JWKS cục bộ hoặc mock JWKS client; không gọi Supabase thật trong automated tests.

Các case bắt buộc:

- Token admin hợp lệ -> `TokenUser(app_role="admin")`.
- Token reader hợp lệ -> `TokenUser(app_role="reader")`.
- Thiếu `app_metadata.app_role` -> reader.
- Token hết hạn -> 401.
- Sai signature -> 401.
- Sai issuer -> 401.
- Sai audience -> 401.
- Thiếu/malformed `sub` -> 401.
- Không có Authorization header -> 401.
- Reader gọi admin endpoint -> 403.
- Admin gọi admin endpoint -> không bị auth chặn.
- Error response không chứa raw token/JWKS/exception nội bộ.

### 11.2 API tests

Config:

- Admin `GET /api/backbones` -> 200, đúng 3 records sau seed.
- Admin `GET /api/genres` -> 200, đúng 4 records.
- Admin `GET /api/art-styles` -> 200, đúng 3 records.
- Response không chứa `prompt_template_en`/`prompt_modifier_en`.
- Không token -> 401.
- Reader token -> 403.

Characters:

- Admin `GET /api/characters` -> 200, đúng 7 records sau seed.
- Response list được sort theo ID.
- List không expose `appearance_prompt_en`.
- Detail tồn tại -> 200 và đúng schema.
- ID không tồn tại -> 404.
- Không hardcode giả định `id=1` luôn là Srey; lấy ID từ dữ liệu test/seed.
- Không token -> 401.
- Reader token -> 403.

`/api/auth/me`:

- Token hợp lệ -> đúng id/email/role.
- Token không hợp lệ -> 401.

### 11.3 Database integration tests — cần Docker

- Chạy migration từ empty PostgreSQL.
- Chạy seed hai lần để xác minh idempotency.
- Chạy API tests trên DB đã seed.
- Không thay thế migration test bằng mock hoàn toàn.

### 11.4 Frontend verification

Automated quality gates:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Manual smoke:

- Sai password hiển thị lỗi.
- Admin login thành công và đến `/admin/characters`.
- Refresh trang vẫn giữ session.
- Logout quay về `/login`.
- Reader không vào được admin route.
- Hiển thị đủ 7 card.
- Ảnh R2 hiển thị; URL lỗi có placeholder.
- Loading, empty, error và retry state hoạt động.
- Không có token/secret trong console hoặc rendered HTML.

---

## 12. Quality gates

### Backend offline gates

```bash
cd backend
uv lock --check
uv run ruff check src/ tests/
uv run ruff format --check src/ tests/
uv run mypy src/
uv run pytest tests/test_auth.py -v
```

Auth unit tests phải chạy được khi Docker tắt và không có Supabase credentials.

### Backend integration gates

```bash
cd backend
uv run pytest tests/ -v
docker build -t katha-backend .
```

Có thể hoãn đến khi Docker Desktop bật, nhưng không được ghi “fully verified” trước khi chạy.

### Frontend gates

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

---

## 13. Live verification

Yêu cầu credentials/config hợp lệ nhưng không ghi secrets vào repo.

### Supabase preparation

1. Xác nhận migration Phase 1 đã chạy.
2. Xác nhận seed có 3 backbones, 4 genres, 3 art styles, 7 characters.
3. Tạo tối thiểu:
   - 1 admin account với `app_metadata.app_role = "admin"`.
   - 1 reader account với `app_metadata.app_role = "reader"` hoặc không có role.
4. Xác nhận project dùng asymmetric JWT signing key/JWKS.
5. Login lại hoặc refresh session sau khi đổi metadata để token mới nhận role.

### R2 preparation

1. Chạy script upload Phase 1 nếu chưa chạy.
2. Xác minh 7 `ref_image_urls` trong DB.
3. Mở từng public URL và xác minh HTTP 200/image content.

### Live smoke sequence

1. Start backend với Supabase/R2 environment.
2. `GET /health` -> 200 healthy.
3. Login admin trên frontend.
4. `/api/auth/me` -> admin.
5. Config endpoints -> đúng số lượng.
6. `/api/characters` -> 7 records có public image URLs.
7. `/admin/characters` -> 7 cards có ảnh.
8. Login reader -> admin endpoints trả 403.

---

## 14. Thứ tự triển khai

### Step 0 — Chốt và ghi quyết định

- Product Owner xác nhận baseline G1/G5.
- Cập nhật gates và decision log.
- Tạo branch/commit mốc Phase 1 trước khi bắt đầu Phase 2.

### Step 1 — Auth core

- Thêm dependency/config.
- Viết `TokenUser`, JWT verifier, `get_current_user`, `get_admin_user`.
- Viết auth unit tests trước khi mount vào API.

### Step 2 — Backend read APIs

- Config schemas/service/router.
- Character schemas/service/router.
- Auth `/me` endpoint.
- Mount routers trong `main.py`.
- Viết API contract tests.

### Step 3 — Frontend auth

- AuthProvider/useAuth.
- Bearer token injection.
- Login page.
- RequireAdmin và admin layout/header.

### Step 4 — Character Bank UI

- Types/API hook.
- CharacterCard.
- `/admin/characters` với đầy đủ UI states.
- Root redirect.

### Step 5 — Offline verification

- Backend lint/format/mypy/auth tests.
- Frontend lint/typecheck/build.
- Review diff và dependency lockfiles.

### Step 6 — Integration/live verification

- Docker test suite và Docker build khi môi trường sẵn sàng.
- Supabase login/JWKS/API smoke.
- R2 images/UI smoke.
- Commit Phase 2 sau khi evidence đạt yêu cầu.

---

## 15. Definition of Done

### Code-complete offline

- [x] G1/G5 đã được ghi vào gates và decision log.
- [x] Auth verifier kiểm tra signature, expiry, issuer, audience và subject.
- [x] Role đọc từ `app_metadata.app_role`, không từ `user_metadata`.
- [x] `/api/auth/me` hoạt động qua mocked/test token.
- [x] 5 read endpoints đã implement và đều yêu cầu admin.
- [x] Config response không lộ prompt nội bộ.
- [x] Character list không lộ `appearance_prompt_en`.
- [x] Login, logout, session restore và admin guard đã implement.
- [x] `/admin/characters` có loading/success/empty/error/placeholder states.
- [x] Backend offline gates pass.
- [x] Frontend lint/typecheck/build pass.
- [x] Không có secrets hoặc `.env` thật trong Git.

### Verified integration/live

- [ ] Full backend tests pass với Docker/Testcontainers.
- [ ] Backend Docker image build pass.
- [ ] Admin và reader test accounts tồn tại.
- [ ] Admin token được backend xác minh; reader bị 403 ở admin APIs.
- [ ] Supabase DB có đúng dữ liệu seed.
- [ ] 7 ảnh R2 truy cập được và hiển thị trên UI.
- [ ] `/health` live trả 200 healthy.
- [ ] Manual login/logout/refresh smoke pass.

Chỉ đánh dấu Phase 2 hoàn tất tuyệt đối khi cả hai nhóm đều đạt. Nếu mới đạt offline gates, dùng trạng thái **Phase 2 code-complete, pending live verification**.

---

## 16. Evidence dev phải bàn giao để review

- Danh sách file thay đổi.
- Quyết định G1/G5 đã cập nhật ở tài liệu nào.
- Output backend lint, format, mypy và auth tests.
- Output frontend lint, typecheck và build.
- Danh sách endpoint kèm auth requirement.
- Bằng chứng response không expose prompt fields.
- Bằng chứng 401/403/200 cho no-token/reader/admin.
- Khi live: ảnh chụp hoặc response sanitized của `/api/auth/me`, `/api/characters`, `/health` và Character Bank UI.
- Không gửi credentials hoặc access token nguyên văn trong walkthrough.

---

## 17. Rủi ro và cách kiểm soát

| Rủi ro | Ảnh hưởng | Kiểm soát |
|---|---|---|
| Supabase project còn dùng legacy HS256 | JWKS verifier không hoạt động | Xác nhận signing key trước live QA; không dùng shared secret nếu chưa được duyệt |
| Role đặt nhầm trong `user_metadata` | User có thể tự nâng quyền | Chỉ authorize từ `app_metadata.app_role` |
| Chỉ guard frontend | API vẫn bị gọi trực tiếp | Mọi admin endpoint dùng `get_admin_user` |
| Token/JWKS bị log | Lộ thông tin bảo mật | Sanitize exceptions và walkthrough output |
| R2 URL thiếu/hỏng | UI vỡ card | Placeholder + `onError` fallback |
| Tests phụ thuộc Docker quá sớm | Chậm vòng phát triển | Tách auth unit tests offline và DB integration tests |
| Scope trượt sang CRUD/AI | Tăng thời gian và rủi ro | Giữ G5 seed-only; POST/PUT/DELETE để phase sau |

---

## 18. Tài liệu tham chiếu

- `01-decisions-log.md` — D10, D12, D13.
- `04-implementation-plan.md` — scope gốc Phase 2.
- `06-project-structure.md` — kiến trúc feature-based.
- `07-database-schema.md` — database source of truth.
- `08-implementation-gates.md` — G1 và G5.
- Supabase JWT verification: <https://supabase.com/docs/guides/auth/jwts>
- Supabase signing keys: <https://supabase.com/docs/guides/auth/signing-keys>
- Supabase JWT claims: <https://supabase.com/docs/guides/auth/jwt-fields>
- Supabase user metadata: <https://supabase.com/docs/guides/auth/users>
