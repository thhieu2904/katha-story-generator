# Phase 4.6 — Opaque Admin Story Route Plan

> Trạng thái: **READY FOR DEV AFTER PHASE 4.5 ACCEPTED**  
> Mục tiêu: bỏ numeric story ID khỏi browser URL admin  
> Kiến trúc: encode integer ID hiện có, không cột DB, không migration  
> Commit: tách hoàn toàn khỏi Phase 4.5 và Phase 5

## 1. Quyết định đã chốt

1. `stories.id` integer tiếp tục là primary key/FK nội bộ.
2. Không thêm `story_uid`, `slug` hoặc route column.
3. Browser URL admin dùng opaque versioned key:

```text
/admin/stories/s1_UkLWZg9D/images
```

4. Backend là owner duy nhất của encode/decode.
5. Frontend coi `StoryRouteKey` là opaque string.
6. Numeric admin URL cũ **trả 404**; không compatibility redirect vì dự án chưa production.
7. Public reader không dùng admin route key, vẫn dùng non-expiring share token:

```text
/stories/{shareToken}
```

8. Route key là UX locator, không phải security token.
9. Mọi resolver/admin API vẫn bắt Supabase admin JWT.
10. Title/slug không làm identity vì có thể chưa tồn tại, thay đổi hoặc trùng.

## 2. Tại sao không thêm cột DB

- Không migration/backfill.
- Không thay foreign key hay transaction/concurrency code.
- Existing services tiếp tục nhận `story_id: int`.
- Create/list response có thể tính route key trực tiếp từ ID.
- Deep link được resolve về ID mà không query thêm theo cột mới.
- Public share lifecycle không phụ thuộc admin locator.

Sqids được thiết kế để biến numeric primary key thành short URL-safe ID. Tài liệu chính thức cũng nói đây không phải encryption và không phù hợp làm security control:

- https://sqids.org/python
- https://sqids.org/faq

## 3. Frozen S1 contract

Không dùng mutable default của thư viện.

```text
S1_PREFIX = "s1_"
S1_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
S1_MIN_LENGTH = 8
S1_BLOCKLIST = ()
S1_MAX_ENCODED_INPUT_LENGTH = 32
S1_MIN_STORY_ID = 1
S1_MAX_STORY_ID = 2_147_483_647
```

Giải thích:

- `S1_BLOCKLIST=()` được truyền tường minh để update default blocklist của thư viện không làm key cũ đổi.
- Alphabet là ASCII cố định, case-sensitive.
- `min_length=8` là minimum, không phải exact/max length.
- Encoded suffix dài hơn 32 bị reject trước decode.
- ID bound khớp PostgreSQL `Integer`.
- Dependency phải được pin qua `uv.lock`.
- Bất kỳ thay đổi alphabet, blocklist hoặc algorithm nào phải dùng prefix `s2_`.

### 3.1 Golden vectors bắt buộc

Tests phải khóa các vector:

```text
1             -> s1_UkLWZg9D
42            -> s1_JgaEBgzn
1_000_000     -> s1_gMvFoHJd
2_147_483_647 -> s1_UKrsQ1FL
```

Ngoài ra verify implementation khớp vector chính thức của Sqids:

```text
[1, 2, 3]             -> 86Rf07
[1, 2, 3], min=10     -> 86Rf07xd4z
```

Không update golden vectors để “làm test xanh” nếu chưa tạo version prefix mới.

## 4. Validation và canonical behavior

Một route key hợp lệ phải:

1. Có đúng prefix `s1_`.
2. Suffix dài từ 8 đến 32 ký tự.
3. Mọi ký tự thuộc exact `S1_ALPHABET`.
4. Decode ra đúng một integer.
5. Integer nằm trong `1..2_147_483_647`.
6. Encode lại integer bằng frozen S1 config phải bằng đúng input.

Malformed, random, non-canonical, out-of-range và nonexistent đều trả admin `404`.

### 4.1 Auth/error precedence

Resolver nhận raw `str`, không dùng FastAPI path regex/min-length làm framework trả `422` trước auth.

Thứ tự:

- unauthenticated + malformed -> `401`;
- reader + malformed -> `403`;
- admin + malformed/random/nonexistent/too-long -> `404`;
- admin + valid existing -> `200`.

Admin dependency phải chạy trước manual route-key validation.

### 4.2 Future S2

Khi có S2:

- giữ decoder S1;
- resolver chấp nhận S1 nhưng response trả current canonical `route_key` S2;
- frontend dùng `router.replace` sang S2 sau successful authenticated resolve;
- không xóa decoder S1 nếu chưa có explicit deprecation/migration decision.

MVP chỉ phát S1.

## 5. Backend architecture

### 5.1 Pure utility

Tạo:

```text
backend/src/katha/features/stories/route_keys.py
```

API:

```python
encode_story_route_key(story_id: int) -> str
decode_story_route_key(route_key: str) -> int | None
```

Yêu cầu:

- frozen constants ở cùng module;
- không đọc alphabet từ env;
- không log decode details cho malformed input;
- utility không query DB;
- canonical re-encode check bắt buộc.

### 5.2 Admin response contract

Thêm computed field vào **admin DTOs בלבד**:

```json
{
  "id": 1,
  "route_key": "s1_UkLWZg9D"
}
```

Áp dụng:

- create response;
- detail response;
- list item;
- update/archive response nếu dùng chung `StoryResponse`.

Không lưu `route_key` trong ORM/DB.

Public reader projection phải tách riêng và không bao giờ trả:

- internal `id`;
- `route_key`;
- admin URL;
- Sqids metadata.

### 5.3 Resolver endpoint

```text
GET /api/stories/by-route-key/{route_key}
```

Behavior:

- admin-only;
- raw string path param;
- manual validate sau auth;
- decode thành internal ID;
- gọi existing `get_story`;
- trả admin `StoryResponse`;
- GET side-effect free;
- static route khai báo trước generic `/stories/{story_id}`.

Existing business APIs vẫn numeric:

```text
PATCH /api/stories/{story_id}
POST  /api/stories/{story_id}/generate-text
GET   /api/stories/{story_id}/images
```

Frontend resolve browser key một lần rồi dùng internal ID cho business APIs.

## 6. Frontend architecture

### 6.1 Branded route type

Tạo named/branded type:

```ts
type StoryRouteKey = string & { readonly __brand: 'StoryRouteKey' };
```

Mục tiêu:

- route helpers không nhận nhầm numeric ID;
- data hooks vẫn nhận `storyId: number`;
- không encode/decode Sqids ở frontend.

### 6.2 Atomic folder migration

Next App Router không được giữ đồng thời sibling `[id]` và `[storyKey]`.

Move atomically:

```text
app/admin/stories/[id]/setup/page.tsx
app/admin/stories/[id]/edit/page.tsx
app/admin/stories/[id]/images/page.tsx
```

thành:

```text
app/admin/stories/[storyKey]/setup/page.tsx
app/admin/stories/[storyKey]/edit/page.tsx
app/admin/stories/[storyKey]/images/page.tsx
```

Mỗi wrapper:

1. Nhận opaque `storyKey`.
2. Gọi authenticated resolver.
3. Malformed/numeric/nonexistent -> 404/fail-safe.
4. Không render mutation trước resolve.
5. Truyền internal `storyId` vào feature hook.
6. Truyền `storyKey` vào workflow navigation.

Không `parseInt(params.storyKey)`.

### 6.3 Route-helper signatures

Chốt:

```ts
getCanonicalHref(storyKey: StoryRouteKey, status: string)
getWorkflowPresentation(storyKey: StoryRouteKey, status: string)
```

Data/service APIs tiếp tục:

```ts
fetchStory(storyId: number)
fetchStoryImages(storyId: number)
```

### 6.4 Navigation conversion

Rà toàn bộ:

- story cards;
- create success;
- setup save/generate;
- text confirm;
- image prepare/start/retry/resume;
- workflow stepper;
- historical CTA;
- archive/list return;
- tests và docs.

Create/list dùng `route_key` do backend trả.

Static gate:

```bash
rg -n "/admin/stories/\\$\\{[^}]*\\.id\\}|/admin/stories/\\$\\{storyId\\}" frontend/src
```

Kết quả phải rỗng đối với browser URL builders.

## 7. Numeric legacy policy

Chốt clean cut:

- `/admin/stories/1/setup` -> `404`;
- `/admin/stories/1/edit` -> `404`;
- `/admin/stories/1/images` -> `404`;
- không authenticated redirect;
- không resolver fallback từ numeric string;
- không numeric public route;
- business API numeric nội bộ vẫn giữ nguyên.

Lý do: dự án chưa production, không cần mang compatibility branch và enumeration surface sang Phase 5.

## 8. Public-reader separation

Public route vẫn là:

```text
/stories/{shareToken}
```

Share token:

- không TTL;
- valid đến khi admin `Ngừng chia sẻ` hoặc archive;
- revoke làm old link `404`;
- re-share sinh token mới;
- không dùng Sqids;
- không redirect numeric ID;
- không expose `id` hoặc `route_key`.

Negative contract test bắt buộc cho:

```text
GET /api/public/shared-stories/{shareToken}
```

Response không chứa `id`, `route_key`, setup IDs hoặc admin locator.

## 9. Work packages

### WP-1 — Backend route-key utility

Files dự kiến:

- `backend/pyproject.toml`
- `backend/uv.lock`
- `backend/src/katha/features/stories/route_keys.py`
- route-key unit tests

### WP-2 — Admin schemas/resolver

- Thêm `route_key` vào admin Story/List DTO.
- Explicit response mapping.
- Admin resolver với auth-first/manual validation.
- Public DTO giữ tách biệt.

### WP-3 — Frontend API/types

- `StoryRouteKey` type.
- `route_key` trong admin Story/List types.
- `fetchStoryByRouteKey`.
- Workflow helpers nhận key.

### WP-4 — Atomic route migration

- Move cả dynamic folder trong một changeset.
- Update tất cả browser links.
- Numeric browser URL 404.
- Deep-link/refresh không cần prior client state.

### WP-5 — Phase 5 alignment

Đổi admin browser route trong Phase 5 plan:

```text
/admin/stories/[storyKey]/review
```

Giữ:

```text
/stories/[shareToken]
/api/stories/{story_id}/review
```

Không đổi share entropy, no-TTL, revoke/re-share/archive contract.

## 10. Tests bắt buộc

### 10.1 Backend

- Golden vectors S1.
- Roundtrip toàn boundary.
- Deterministic output sau process restart.
- Reject wrong prefix/charset/length/multiple IDs/zero/out-of-range/non-canonical alias.
- Auth/error precedence:
  - unauth malformed 401;
  - reader malformed 403;
  - admin malformed/random/nonexistent/too-long 404.
- Create/detail/list trả đúng `route_key`.
- Resolver existing story 200.
- Numeric business APIs vẫn hoạt động.
- Public DTO không có `id/route_key`.

### 10.2 Frontend

- List/create navigation dùng `route_key`.
- Setup/edit/images deep-link resolve đúng.
- Refresh/copy-paste tab mới hoạt động.
- Numeric browser key 404.
- Malformed key fail-safe.
- Workflow/historical CTA giữ cùng key.
- Không double fetch/mutation trong resolve.
- Không browser URL builder dùng `story.id`.

### 10.3 Regression

- Phase 4.5 tests vẫn pass.
- Public share token không đi qua Sqids.
- Numeric public route không tồn tại.
- Route key không thay thế admin authorization.

## 11. Quality gates

Backend:

```bash
cd backend
uv lock --check
uv run ruff check src/ tests/
uv run ruff format --check src/ tests/
uv run mypy src/
uv run pytest tests/ -m "not integration"
```

Frontend:

```bash
cd frontend
npm run test -- --run
npm run lint
npx tsc --noEmit
npm run build
```

Repo/manual:

```bash
git diff --check
```

- list -> setup -> edit -> images đều encoded;
- refresh từng deep route;
- copy/paste route sang tab mới;
- numeric browser routes 404;
- không xuất hiện `/admin/stories/1/...` sau navigation;
- public share route vẫn hoạt động độc lập.

## 12. Commit strategy

Chỉ bắt đầu sau khi Phase 4.5 được accept và commit.

Một commit độc lập:

```text
feat(routes): use opaque story keys in admin URLs
```

Không squash vào Phase 4.5. Không đưa Phase 5 implementation vào commit này.

## 13. Definition of Done

- Browser admin URL không còn numeric story locator.
- Numeric legacy browser URL 404.
- Không migration/cột DB.
- Integer PK/FK và existing services giữ nguyên.
- Frozen S1 constants/golden vectors có tests.
- Backend là owner duy nhất của encode/decode.
- Auth/error precedence đúng.
- Admin DTO có route key; public DTO không có `id/route_key`.
- Atomic dynamic-route migration hoàn tất.
- Deep-link/refresh/list/create/workflow navigation đều dùng canonical key.
- Public reader tiếp tục dùng non-expiring share token riêng.
- Backend/frontend gates và manual acceptance pass.
- Commit chỉ chứa Phase 4.6 scope.

