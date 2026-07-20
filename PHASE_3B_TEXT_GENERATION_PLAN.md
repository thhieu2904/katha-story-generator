# Phase 3B — Text Generation & Bilingual Preview Implementation Plan

> Sinh trực tiếp tiêu đề + toàn bộ trang tiếng Việt, dịch trọn bộ sang Khmer, lưu nguyên tử và cung cấp màn hình preview song ngữ.

## 0. Trạng thái kế hoạch

- Ngày lập: 2026-07-20.
- Loại tài liệu: implementation plan / handoff cho dev.
- Trạng thái: **CODE-COMPLETE OFFLINE sau corrective review**; Docker integration execution và live OpenAI vẫn pending.
- Vai trò của tài liệu: source of truth cho phạm vi Phase 3B; không phải walkthrough.
- Phase này chưa yêu cầu Docker hoặc credentials để đạt `code-complete offline`.
- Live OpenAI smoke là gate riêng vì có credential và phát sinh chi phí.

## 1. Kết luận PM

Phase 3B khả thi và không bị Gate G2/G4 chặn. Hai gate đó chỉ liên quan image pipeline của Phase 4.

Phase 3B phải là một vertical slice dùng được độc lập:

1. Admin lưu setup của story ở `draft`.
2. Admin bấm **Sinh nội dung truyện**.
3. Backend claim request để không bị double-submit/double-spend.
4. AI sinh `title_vi` và toàn bộ `text_vi` theo từng trang.
5. AI dịch tiêu đề và toàn bộ trang sang Khmer trong một batch.
6. Backend chỉ ghi DB khi cả hai payload đã hợp lệ.
7. Story chuyển sang `text_draft`.
8. Admin được chuyển tới `/admin/stories/[id]/edit` và xem preview song ngữ read-only.

Không được coi Phase 3B hoàn tất nếu backend chỉ sinh tiếng Việt rồi để Khmer sang phase sau. D08 và D14 đã chốt rằng admin phải thấy đủ Việt + Khmer trước image phase.

## 2. Điều kiện đầu vào

Dev chỉ bắt đầu Phase 3B khi:

- Phase 3A đã được review accept ở mức code-complete offline.
- Migration graph hiện tại chỉ có một head và revision 002 chạy đúng.
- Story CRUD contract của Phase 3A ổn định.
- Story `draft` luôn có:
  - `description_vi` hợp lệ;
  - `backbone_id`, `genre_id`, `art_style_id` hợp lệ;
  - `target_age` thuộc ba enum đã chốt;
  - `length_pref` thuộc `short | medium | long`;
  - 2–3 character hợp lệ.
- Setup chỉ được sửa khi `status=draft` theo D29.

Docker-backed migration/integration của Phase 3A có thể vẫn deferred, nhưng dev phải giữ đúng nhãn trạng thái và không tuyên bố đã live-verified.

## 3. Quyết định dùng trong plan

### 3.1 Đã chốt từ tài liệu hiện hành

| Nội dung | Quyết định |
|---|---|
| Luồng nội dung | Sinh trực tiếp title + full pages, không có outline (D25) |
| Ngôn ngữ | Việt là bản gốc; Khmer là bản dịch bắt buộc trong Text Phase (D08, D14, D18) |
| Model/provider | All OpenAI; text/dịch dùng `gpt-4o-mini` theo D11 |
| Độ dài | `short=4–6`, `medium=8–10`, `long=12–14`, hard max 16 (D26) |
| Bìa | Code template, không thuộc `story_pages` (D27) |
| Quyền | Mọi admin xem/sửa mọi story; reader không dùng API này (D28) |
| Setup | Khóa từ `text_draft` trở đi (D29) |
| Lịch sử | Chỉ lưu trạng thái hiện tại; không version history/undo (D15/D20/D21) |

### 3.2 Mặc định kỹ thuật của Phase 3B

| Mã | Mặc định | Lý do |
|---|---|---|
| P3B-A1 | Thêm trạng thái tạm `generating_text` | Chống gọi trùng, hỗ trợ reload và nhận biết request đang chạy |
| P3B-A2 | API chạy synchronous; không job queue/SSE/WebSocket | Một story tối đa 14 trang ở phase này; giữ MVP nhỏ |
| P3B-A3 | Failure quay lại `draft`; không lưu title/page một phần | Tránh dữ liệu Việt–Khmer lệch nhau |
| P3B-A4 | `text_en`, image prompt và ảnh để Phase 4 | Không trộn image scope vào Text Phase |
| P3B-A5 | Khmer spellcheck chuyên sâu để Phase 3C | 3B chỉ kiểm tra cấu trúc/Unicode cơ bản |
| P3B-A6 | Preview Phase 3B là read-only | Quick actions/editor/confirm thuộc 3C |
| P3B-A7 | OpenAI model lấy từ env, default vẫn là `gpt-4o-mini` | Không hard-code provider config trong business service |

### 3.3 Chính sách số trang đã chốt

Initial generation chỉ nhận các tập số chẵn:

```text
short  -> {4, 6}
medium -> {8, 10}
long   -> {12, 14}
```

Phase 3C được phép add/delete một trang và tạo số trang lẻ, miễn tổng cuối cùng vẫn nằm trong band đã chọn. Confirm chỉ kiểm tra band, không kiểm tra chẵn/lẻ.

## 4. Mục tiêu và ngoài phạm vi

### 4.1 In scope

- OpenAI Python SDK và lazy shared async client.
- Provider boundary để offline tests dùng fake AI.
- Structured Outputs cho story tiếng Việt và bản dịch Khmer.
- Prompt builder từ setup/config/characters đã khóa.
- `POST /api/stories/{id}/generate-text`.
- `GET /api/stories/{id}/text`.
- Atomic claim, stale recovery và atomic final persistence.
- Migration cho lifecycle text và relational invariant cần thiết.
- Story text response schemas.
- CTA sinh nội dung ở setup page.
- Story-list status/CTA cho `generating_text` và `text_draft`.
- Route `/admin/stories/[id]/edit` với bilingual preview read-only.
- Backend offline test đầy đủ bằng fake provider.
- Docker/live gates tách riêng.
- Đồng bộ tài liệu liên quan sau khi code được accept.

### 4.2 Out of scope

- Outline riêng.
- Regenerate một story đã ở `text_draft`.
- Quick actions, custom instruction/chat.
- Inline edit.
- Drag/drop, add/delete page.
- Confirm text.
- Khmer dictionary spellcheck hoặc grammar correctness.
- `text_en`, `image_prompt_en`, page-character mapping.
- Sinh ảnh, upload R2, cover image AI.
- Background worker, queue, progress percentage, SSE/WebSocket.
- Usage/edit log hoặc version history.
- Thay đổi model đã chốt ở D11.

## 5. State machine

```text
draft
  │ POST /generate-text, atomic claim
  ▼
generating_text
  ├── generate + translate + validate + persist thành công ──► text_draft
  ├── provider/validation/persistence lỗi có thể phục hồi ────► draft
  └── process chết, state quá stale ──► request mới reclaim ──► generating_text
```

Quy tắc bắt buộc:

- Chỉ `draft` được claim bình thường.
- `generating_text` chưa stale trả `409`; không gọi provider lần hai.
- `generating_text` stale có thể được request mới reclaim atomically.
- `text_draft` và mọi status sau trả `409`; endpoint không tự regenerate.
- `archived` không được generate.
- Setup update/archive phải serialize với generation claim để không dùng snapshot cũ.
- Không giữ DB transaction hoặc row lock trong lúc chờ OpenAI.

## 6. Migration 003

Tên gợi ý:

```text
backend/alembic/versions/003_story_text_generation.py
```

### 6.1 Thay đổi schema

1. Recreate `stories.status` CHECK để thêm `generating_text`.
2. Thêm `stories.text_revision integer NOT NULL DEFAULT 0` với CHECK `text_revision >= 0`.
3. Thêm `stories.text_generation_claim_id uuid NULL` làm ownership token cho generation đang chạy.
4. Siết `story_pages.story_id` thành `NOT NULL` sau khi kiểm tra không có orphan row.
5. Không tạo bảng job, history hoặc edit log.

`text_revision` được định nghĩa từ 3B để 3C dùng optimistic concurrency:

- `draft`: `0`.
- Generation thành công lần đầu: `1`.
- Failure/retry chưa persist nội dung: vẫn `0`.
- Mỗi text mutation ở 3C: tăng đúng một lần.

`text_generation_claim_id`:

- `NULL` khi không có generation active;
- nhận UUID mới khi claim hoặc reclaim;
- được dùng cho conditional finalize/reset;
- phải về `NULL` khi generation thành công hoặc failure reset thuộc đúng claim;
- `updated_at` chỉ dùng để xác định stale, không dùng làm ownership token.

### 6.2 Upgrade safety

- Assert hoặc cleanup có chủ đích nếu tồn tại `story_pages.story_id IS NULL`; không âm thầm xóa data.
- Recreate constraint bằng tên ổn định.
- Không sửa revision 001/002 đã tồn tại.
- `alembic heads` phải trả đúng một head là 003.

### 6.3 Downgrade safety

Theo thứ tự:

1. Map mọi `generating_text` về `draft`.
2. Recreate status CHECK cũ.
3. Cho `story_pages.story_id` nullable trở lại để downgrade đối xứng.
4. Drop `text_generation_claim_id`.
5. Drop CHECK/default và column `text_revision`.

Migration tests phải kiểm tra cả upgrade và downgrade trên PostgreSQL thật khi Docker được bật.

## 7. Kiến trúc module

Giữ feature-based và tách external adapter khỏi business orchestration.

```text
backend/src/katha/
├── core/
│   └── config.py
├── features/stories/
│   ├── models.py
│   ├── schemas.py
│   ├── router.py
│   ├── service.py                 # Phase 3A CRUD
│   ├── generation_models.py       # AI structured schemas + domain DTO
│   ├── generation_service.py      # use case/state/transaction
│   ├── generation_dependencies.py # provider DI
│   └── prompts.py                 # pure prompt builders
└── integrations/
    └── openai_story_text.py       # OpenAI implementation
```

Không được:

- gọi OpenAI trực tiếp trong router;
- nhét toàn bộ generation vào `stories/service.py` đang chứa CRUD;
- khởi tạo client/API key tại import time;
- để integration adapter commit DB;
- để prompt string nằm rải rác trong router/service/tests.

### 7.1 Port tối thiểu

```python
class StoryTextAI(Protocol):
    async def generate_vi(self, context: StoryGenerationContext) -> GeneratedStoryVi: ...
    async def translate_vi_to_km(self, story: GeneratedStoryVi) -> TranslatedStoryKm: ...
```

- `generation_service.py` sở hữu lifecycle, validation nghiệp vụ và persistence.
- `openai_story_text.py` sở hữu SDK call, timeout, structured parsing và mapping provider error.
- Router nhận provider qua dependency để tests thay bằng fake.
- Một async client được reuse; không tạo client cho từng page.

## 8. Configuration

Bổ sung vào `Settings` và `.env.example`:

```text
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_SECONDS=60
OPENAI_MAX_RETRIES=1
TEXT_OPERATION_TIMEOUT_SECONDS=270
GENERATION_MAX_OUTPUT_TOKENS=6000
TRANSLATION_MAX_OUTPUT_TOKENS=8000
TEXT_GENERATION_STALE_SECONDS=600
```

Operational/client budgets dùng đơn vị giây:

```text
FRONTEND_REQUEST_TIMEOUT=285
PROXY_READ_TIMEOUT=300
```

Frontend có thể triển khai budget này bằng constant `285000` ms hoặc public env tương đương; `PROXY_READ_TIMEOUT` là cấu hình deploy Caddy/Nginx, không phải business setting của FastAPI.

Quy tắc:

- Missing key không làm app import/startup fail.
- Chỉ endpoint cần AI mới trả lỗi cấu hình an toàn.
- Mỗi SDK attempt tối đa 60 giây; SDK là layer duy nhất retry tối đa một lần.
- Toàn bộ generate + translate bị chặn bởi operation budget 270 giây.
- Frontend timeout sau 285 giây, proxy sau 300 giây và stale recovery sau 600 giây.
- Stale timeout phải lớn hơn toàn bộ operation/proxy budget để request còn sống không bị reclaim.
- Chỉ một layer sở hữu retry. Nếu dùng retry của SDK thì không bọc thêm vòng retry thủ công.
- Không log API key, full prompt, raw child story hoặc raw provider response.
- Có thể log model, story id, stage, latency, provider request id và loại lỗi.

OpenAI Python SDK hiện auto-retry một số connection/408/409/429/5xx errors; plan cố ý đặt giới hạn nhỏ để kiểm soát latency/chi phí thay vì cộng nhiều retry layer.

## 9. Structured output contracts

### 9.1 Vietnamese generation output

```python
class GeneratedPageVi(BaseModel):
    page_no: int
    text_vi: str

class GeneratedStoryVi(BaseModel):
    title_vi: str
    pages: list[GeneratedPageVi]
```

### 9.2 Khmer translation output

```python
class TranslatedPageKm(BaseModel):
    page_no: int
    text_km: str

class TranslatedStoryKm(BaseModel):
    title_km: str
    pages: list[TranslatedPageKm]
```

Không đưa vào output 3B:

- outline;
- image prompt;
- art style prose;
- character IDs theo page;
- image scene metadata;
- English translation;
- model reasoning/explanation.

OpenAI Structured Outputs được chọn vì response phải bám JSON Schema và SDK hỗ trợ Pydantic parsing. Dev vẫn phải chạy domain validation sau parse; schema đúng không đồng nghĩa nội dung đúng nghiệp vụ.

## 10. Prompt contract

### 10.1 Generation context

Prompt builder nhận snapshot đã load từ DB:

- `description_vi` của admin;
- `backbone.prompt_template_en`;
- `genre.prompt_modifier_en`;
- `target_age` và label/prompt mapping;
- `length_pref` và allowed page counts;
- selected characters: tên, tuổi/vai trò/mô tả, visual identity cần giữ nhất quán;
- project rules về nội dung thiếu nhi.

Không đưa art-style modifier hoặc URL ảnh reference vào text-generation prompt.

### 10.2 Age mapping

```text
preschool     -> for preschool children aged 3-5
early_primary -> for early primary children aged 6-8
late_primary  -> for late primary children aged 9-12
```

Target nội dung mỗi trang đã chốt:

| Nhóm tuổi | Số câu mục tiêu | Số từ tiếng Việt mục tiêu | Hard max |
|---|---:|---:|---:|
| `preschool` | 1–2 | 12–30 | 45 từ |
| `early_primary` | 2–4 | 30–60 | 80 từ |
| `late_primary` | 3–5 | 50–90 | 120 từ |

- Range câu/từ là soft target cho prompt và quality diagnostics; không reject chỉ vì lệch nhẹ.
- Hard max theo nhóm tuổi là domain validation bắt buộc.
- Word count dùng một helper deterministic chung cho service/tests sau khi trim và collapse whitespace; punctuation không được tính thành một từ độc lập.

### 10.3 Content rules

- Viết đầy đủ từng trang, không viết summary/outline.
- Có mở đầu, phát triển, giải quyết; giữ backbone và genre đã chọn.
- Phù hợp trẻ em, không graphic violence, sexual content hoặc hành vi nguy hiểm được cổ súy.
- Dùng đúng 2–3 character đã chọn làm cast chính; không đổi tên/đặc điểm cốt lõi.
- Không tự thêm page-character mapping vì G2 vẫn mở.
- `description_vi` được delimit rõ như user data; nội dung trong đó không thể override system/developer rules.
- Không yêu cầu model trả Markdown hay commentary.

### 10.4 Translation rules

- Dịch title + tất cả pages trong một request batch, không N request theo page.
- Giữ page number và số lượng trang chính xác.
- Giữ nhất quán tên riêng/đại từ và ý nghĩa.
- Không thêm giải thích, chú thích hoặc đoạn ngoài truyện.
- Không dịch từ một bản tóm tắt; dịch trực tiếp full Vietnamese text đã validate.

## 11. Domain validation

### 11.1 Vietnamese payload

- `title_vi` trim, không rỗng và tối đa `TITLE_MAX_CHARS=160`.
- Page count thuộc allowed set/range của `length_pref`.
- `page_no` là đúng tập `1..N`, không trùng/thiếu.
- Mỗi `text_vi` trim, không rỗng, không vượt hard max từ theo nhóm tuổi và không vượt absolute safety cap `PAGE_TEXT_MAX_CHARS=1200`.
- Không auto-truncate hoặc tự thêm/xóa page để “sửa” output AI.

### 11.2 Khmer payload

- `title_km` và mọi `text_km` trim, không rỗng.
- Tập `page_no` khớp chính xác payload Việt.
- NFC-normalize trước khi persist.
- Reject ký tự thay thế `U+FFFD` và control characters không hợp lệ.
- Cho phép Khmer punctuation, Khmer digits, mixed Latin proper names và `U+200B` ZWSP.
- Mỗi title/page phải có ít nhất một Khmer-script letter.
- Script ratio, từ Latin hoặc tên riêng chỉ tạo diagnostic/warning; không hard-fail chỉ vì mixed script.
- Không tuyên bố các kiểm tra này chứng minh đúng chính tả/ngữ pháp.

### 11.3 Spellcheck state

Phase 3B khởi tạo `spellcheck_flags=[]` theo schema hiện hành nhưng không hiển thị nó như “đã kiểm tra sạch”. Phase 3C sẽ thêm trạng thái/timestamp để phân biệt `chưa chạy validator` với `đã chạy và không có cảnh báo`.

## 12. Generation orchestration

### 12.1 Preflight trước claim

- Provider config khả dụng.
- Story tồn tại.
- Status hợp lệ để claim/reclaim.
- Setup fields, config rows và character associations còn hợp lệ.
- Copy snapshot cần cho prompt trong transaction ngắn.

### 12.2 Atomic claim

Trong transaction ngắn:

1. Lock story row.
2. Nếu `draft`, cho phép claim.
3. Nếu `generating_text`, chỉ cho reclaim khi `updated_at < now - stale_timeout`.
4. Sinh UUID mới `claim_id`.
5. Set `status=generating_text`, `text_generation_claim_id=claim_id` và `updated_at=clock_timestamp()`.
6. Commit và giải phóng transaction trước network call.

Frontend disable nút không thay thế được bước này.

### 12.3 External calls

1. Build prompt từ snapshot.
2. Gọi generate Việt.
3. Handle refusal/incomplete/timeout/provider error.
4. Validate toàn bộ payload Việt.
5. Gọi translate batch Việt → Khmer.
6. Handle refusal/incomplete/timeout/provider error.
7. Validate Khmer và merge theo `page_no`.

### 12.4 Atomic finalize

Trong transaction mới:

1. Lock story row.
2. Verify `status=generating_text` và `text_generation_claim_id=claim_id`.
3. Nếu claim đã bị reclaim, request cũ phải dừng và không ghi gì.
4. Delete stale/partial pages của story nếu có.
5. Insert toàn bộ pages đã merge.
6. Set `title_vi`, `title_km`, `status=text_draft`.
7. Set `text_revision=1`, clear `text_generation_claim_id`, update timestamp.
8. Commit một lần.

### 12.5 Failure reset

- Bất kỳ lỗi nào trước final commit đều conditional-reset `generating_text → draft`, clear claim ID và chỉ ghi khi `text_generation_claim_id=claim_id` vẫn thuộc request đó.
- Không clear setup.
- Không lưu riêng title Việt hoặc pages Việt.
- Không để request cũ reset/finalize state của request mới sau stale reclaim.
- Nếu DB outage làm reset thất bại, request sau dùng stale recovery.

## 13. API contracts

Tất cả endpoint bên dưới dùng `get_admin_user`.

### 13.1 `POST /api/stories/{story_id}/generate-text`

- Request body: không có.
- Success: `200 OK` với `StoryTextResponse`.

```json
{
  "id": 12,
  "title_vi": "...",
  "title_km": "...",
  "description_vi": "...",
  "target_age": "early_primary",
  "length_pref": "medium",
  "status": "text_draft",
  "text_revision": 1,
  "character_ids": [1, 2],
  "updated_at": "2026-07-20T10:00:00Z",
  "pages": [
    {
      "id": 101,
      "page_no": 1,
      "text_vi": "...",
      "text_km": "...",
      "spellcheck_flags": []
    }
  ]
}
```

Status contract:

| HTTP | Khi nào |
|---|---|
| 200 | Sinh, dịch, validate và persist hoàn tất |
| 401 | Không có/invalid token |
| 403 | Không phải admin |
| 404 | Story không tồn tại |
| 409 | Status không cho generate hoặc generation chưa stale đang chạy |
| 422 | Setup/config/character không đầy đủ hoặc input không hợp lệ |
| 502 | Provider refusal/incomplete/malformed hoặc output AI vi phạm domain rule |
| 503 | API key thiếu, rate limit, timeout hoặc provider tạm unavailable |
| 500 | Persistence/internal failure không thể phân loại an toàn |

Không trả raw provider exception, raw prompt hoặc API key cho client.

### 13.2 `GET /api/stories/{story_id}/text`

- `200`: trả canonical title/pages sort `page_no ASC` khi story ở `text_draft` hoặc status sau đó.
- `404`: story không tồn tại.
- `409`: story còn `draft` hoặc `generating_text`, text chưa sẵn sàng.
- Admin-only.

`StoryTextResponse` nên kế thừa/compose từ `StoryResponse` để không tạo hai contract metadata lệch nhau.

### 13.3 Error response compatibility

Frontend `safeErrorMessage()` hiện chỉ đọc `detail` dạng string. Phase 3B giữ contract đó. Nếu dev muốn error code object thì phải sửa và test cả `frontend/src/lib/api.ts`; không đổi một phía.

## 14. Frontend flow

### 14.1 Setup page

Khi story ở `draft`:

- Giữ nút **Cập nhật thiết lập**.
- Thêm nút primary **Sinh nội dung truyện**.
- Nếu form có thay đổi chưa lưu, handler phải PATCH setup trước; chỉ POST generate sau khi PATCH thành công.
- Khi generate đang chạy:
  - disable toàn form và cả hai actions;
  - hiện spinner/message “Đang sinh nội dung song ngữ…”;
  - không hiển thị fake percentage;
  - chống double click ở client nhưng vẫn tin backend claim là lớp cuối.
- Success: `router.replace('/admin/stories/{id}/edit')`.
- Failure: giữ setup đã lưu, hiển thị lỗi retryable và cho retry.
- Nếu client timeout/connection loss: refetch story status trước khi cho gọi lại.
- Frontend request timeout là 285 giây; sau timeout/mất kết nối phải refetch status trước khi bật lại action.

### 14.2 Story list

| Status | Badge | CTA |
|---|---|---|
| `draft` | Bản nháp | Tiếp tục thiết lập |
| `generating_text` | Đang sinh nội dung | Xem trạng thái/disabled action, không generate lần hai |
| `text_draft` | Đang biên tập | Xem nội dung |

Không để status mới rơi vào label raw tiếng Anh.

### 14.3 `/admin/stories/[id]/edit` trong 3B

Phase 3B tạo route thật để success không redirect vào 404.

- `draft`: redirect về setup.
- `generating_text`: poll nhẹ story status, có link về list; không giả tiến độ.
- `text_draft`: fetch `/text` và hiển thị read-only.
- status sau `text_draft`: vẫn hiển thị read-only.
- `archived`: thông báo không khả dụng hoặc về list.

Preview:

- title Việt primary, title Khmer subtitle;
- mỗi page có số trang, Việt primary, Khmer subtitle;
- Khmer dùng font/line-height đã có của project;
- loading/error/retry/not-found đầy đủ;
- không render quick actions, chat, drag handle, add/delete hoặc confirm trong 3B.

## 15. File scope dự kiến

### Backend

- `backend/alembic/versions/003_story_text_generation.py` — mới.
- `backend/pyproject.toml`, `backend/uv.lock` — thêm/pin OpenAI SDK.
- `backend/.env.example` — config mới.
- `backend/src/katha/core/config.py` — typed settings.
- `backend/src/katha/features/stories/models.py` — status/revision/claim UUID/story_id nullability.
- `backend/src/katha/features/stories/schemas.py` — response/API schemas.
- `backend/src/katha/features/stories/router.py` — mount/compose generation routes.
- `backend/src/katha/features/stories/service.py` — chỉ harden CRUD race nếu cần; không nhét AI orchestration.
- `backend/src/katha/features/stories/generation_models.py` — mới.
- `backend/src/katha/features/stories/generation_service.py` — mới.
- `backend/src/katha/features/stories/generation_dependencies.py` — mới.
- `backend/src/katha/features/stories/prompts.py` — mới.
- `backend/src/katha/integrations/openai_story_text.py` — mới.
- Backend tests riêng cho prompt/provider/service/API/migration.

### Frontend

- `frontend/src/features/stories/types.ts`.
- `frontend/src/features/stories/api.ts`.
- `frontend/src/features/stories/constants.ts`.
- Hook generation/text fetch mới trong `features/stories/`.
- Preview components mới, tách khỏi setup form.
- `frontend/src/app/admin/stories/[id]/edit/page.tsx` — mới.
- `frontend/src/app/admin/stories/[id]/setup/page.tsx`.
- `frontend/src/features/stories/components/StorySetupForm.tsx`.
- `frontend/src/features/stories/components/StoryListItem.tsx`.

### Docs dev phải đồng bộ

- `plan/01-decisions-log.md` — ghi các quyết định mới sau khi PO accept.
- `plan/02-technical-design.md` — không dịch description sang English trước generation; không output page-character mapping khi G2 mở.
- `plan/03-user-flows.md` — generation/preview boundary.
- `plan/04-implementation-plan.md` — đánh dấu 3B.
- `plan/06-project-structure.md` — file/module thật.
- `plan/07-database-schema.md` — `generating_text`, `text_revision`, `text_generation_claim_id`, `story_id NOT NULL`.
- `plan/HANDOFF.md` và file plan này — trạng thái/evidence thật.

## 16. Trình tự implementation

### Step 0 — Preflight

- Rebase/merge trên Phase 3A đã accept.
- Kiểm tra dirty tree và không đè thay đổi người khác.
- Xác nhận single Alembic head 002.
- Dùng chính sách page count đã chốt ở Section 3.3.

### Step 1 — Migration và contracts

- Viết migration 003 gồm status, revision, claim UUID và story-page FK invariant.
- Update ORM/status constants/API types.
- Viết migration graph test offline và migration lifecycle tests marked integration.

### Step 2 — AI boundary/config

- Thêm OpenAI dependency và lockfile.
- Settings/env example với per-attempt timeout, outer operation timeout và output-token budgets đã chốt.
- Lazy async client, provider DI, normalized provider exceptions.
- Unit tests không cần API key/network.

### Step 3 — Pure prompt + structured models

- Constants age/page count, sentence/word targets, hard word max và absolute char caps.
- Generation/translation schemas và max-output-token wiring.
- Pure prompt builders.
- Validation functions.
- Unit tests table-driven cho mọi group/range.

### Step 4 — Orchestration/state machine

- Preflight/load snapshot.
- Atomic claim/reclaim.
- Generate + translate + validate.
- Conditional finalize/reset.
- Race/failure unit tests.

### Step 5 — API

- POST generate và GET text.
- Admin auth/status/error contract.
- Contract tests với fake provider.

### Step 6 — Frontend vertical slice

- Setup CTA và pending/error flow.
- Status mapping/list CTA.
- Read-only bilingual preview route.
- Reconciliation sau timeout/reload.

### Step 7 — Offline gates

- Backend lint/format/type/test.
- Frontend lint/type/build.
- Secret/stale-reference/diff checks.
- Walkthrough ghi rõ live/Docker deferred.

### Step 8 — Deferred integration/live

- Docker migration/integration suite.
- Một live short-story smoke có kiểm soát chi phí.
- Native Khmer reviewer kiểm tra sample; automated Unicode checks không thay thế human review.

## 17. Backend test matrix bắt buộc

### Prompt/domain

- Ba age mappings.
- Ba length preferences và initial allowed even counts.
- Soft sentence/word targets cùng hard word max theo từng age group.
- `TITLE_MAX_CHARS=160` và `PAGE_TEXT_MAX_CHARS=1200`.
- Title/pages trim và caps.
- Missing/duplicate/out-of-order/extra page numbers.
- Count ngoài policy.
- Không có outline/page-character/image fields.
- Translation page set lệch bản Việt.
- Blank Khmer, U+FFFD, invalid control.
- ZWSP/Khmer digits/punctuation/mixed proper names hợp lệ.

### Provider adapter

- Parsed structured response hợp lệ.
- Refusal.
- Incomplete response/content filter/max-output.
- Malformed/unparsed response.
- Timeout/connection/rate-limit/5xx mapping.
- Missing API key.
- Assert retry owner duy nhất và `max_retries=1`.
- Assert generation/translation dùng lần lượt 6000/8000 max output tokens.

### Service/state/transaction

- Success ghi title/pages/status/revision đúng.
- Generation fail không lưu partial và reset draft.
- Translation fail không lưu bản Việt riêng.
- Outer operation timeout 270 giây reset đúng claim và không persist partial.
- Final DB failure rollback.
- Hai request đồng thời chỉ một claim/call provider.
- Non-stale generating trả 409.
- Stale reclaim hoạt động.
- Request cũ không finalize/reset claim mới.
- `updated_at` chỉ quyết định stale; UUID claim mới quyết định ownership.
- Setup update/archive không race qua generation claim.
- Stale pages chỉ bị replace trong final transaction.
- GET text sort `page_no ASC`.

### API/auth

- 401/403 cho cả endpoints.
- Cross-admin access theo D28.
- 404/409/422/502/503 đúng contract.
- Error detail không lộ provider payload/secret.

## 18. Frontend verification

Không bắt buộc mở một test framework mới chỉ cho Phase 3B nếu repo chưa có. Bắt buộc:

- `npm run lint` không có error mới.
- `npx tsc --noEmit` pass.
- `npm run build` pass.
- Manual/static smoke:
  - form dirty được save trước generate;
  - double-click không tạo hai request;
  - reload ở `generating_text` không cho generate lại;
  - frontend timeout 285 giây rồi refetch/reconcile status trước retry;
  - failure giữ setup và retry được;
  - success redirect không 404;
  - title/pages Việt + Khmer hiển thị đúng;
  - story card CTA đúng theo status;
  - Khmer glyph/line-height không bị cắt.

## 19. Quality gates

### Code-complete offline

- [x] Phase 3A đã accept.
- [x] Migration graph tại baseline 3B là single head 003; current repo sau 3C là single head 004.
- [x] Provider được fake hoàn toàn trong offline tests.
- [x] Không cần `OPENAI_API_KEY` để import app/chạy offline suite.
- [x] Structured output + domain validation đủ failure cases và exact caps/word max.
- [x] SDK 60s/1 retry, output-token caps, outer 270s, frontend 285s và stale 600s được wiring/test; stale > operation được validate.
- [ ] Proxy read timeout 300s chưa có deploy config trong repo; giữ ở deployment gate, không giả là đã verify.
- [x] Atomic claim/reclaim/finalize/reset có test.
- [x] Claim ownership dùng UUID riêng; request cũ không ghi được sau reclaim.
- [x] Không có partial bilingual data ở mọi failure path đã test.
- [x] POST generate + GET text auth/status contracts pass.
- [x] Frontend CTA/list/preview hoàn chỉnh.
- [x] Backend Ruff/format/mypy/offline pytest pass.
- [x] Frontend lint/TypeScript/build pass.
- [x] Lockfile check pass.
- [x] Không có secret thật trong source/log/walkthrough.
- [x] Docs đồng bộ, không nói G2/G4 đã chốt.

### Docker-deferred

- [ ] Migration 001 → 002 → 003 upgrade pass trên PostgreSQL.
- [ ] 003 downgrade → 002 pass.
- [ ] Status CHECK/revision/claim UUID/story-page FK invariant pass.
- [ ] PostgreSQL concurrency test chỉ một claim thắng và stale reclaim đổi ownership UUID.
- [ ] Full persistence/rollback flow pass.

### Live-deferred

- [ ] Model configured thực tế support Responses + Structured Outputs.
- [ ] Một short story sinh đúng initial even allowed count.
- [ ] Có đủ title/pages Việt + Khmer.
- [ ] Provider refusal/error không lộ raw detail.
- [ ] Native-speaker review sample được ghi là quality evidence riêng.
- [ ] Không đưa credential vào chat/commit/walkthrough.

## 20. Definition of Done

Phase 3B được gọi là **code-complete offline** khi:

- Admin có thể từ setup draft gọi generation flow hoàn chỉnh.
- Backend chống double-submit ở DB layer bằng UUID claim ownership; `updated_at` chỉ xác định stale.
- Story Việt và Khmer được validate rồi persist atomically.
- Failure không để story kẹt vĩnh viễn hoặc dữ liệu nửa vời.
- Success chuyển `draft → generating_text → text_draft` và revision thành 1.
- `/admin/stories/[id]/edit` hiển thị read-only bilingual preview.
- Không có bất kỳ editor/image scope nào bị kéo vào.
- Tất cả offline gates xanh và Docker/live pending được ghi chính xác.

Không dùng từ **fully verified** cho đến khi Docker + live gates tương ứng đã chạy.

## 21. Evidence dev phải bàn giao

- Commit hash và exact changed-file list.
- Migration revision/down_revision + `alembic heads`.
- API request/response/status table.
- Sơ đồ lifecycle và stale-recovery implementation evidence, gồm UUID claim ownership.
- Test chứng minh concurrent calls chỉ một provider call và request cũ không finalize/reset claim mới.
- Evidence exact retry/output-token/timeout budgets được cấu hình đúng.
- Test chứng minh translation failure không lưu Vietnamese partial.
- Test refusal/incomplete/malformed output.
- Output Ruff, format, mypy, offline pytest.
- Output frontend lint, TypeScript, build.
- Lockfile check và secret scan.
- Manual preview checklist.
- Danh sách Docker/live checks còn deferred.
- Không paste API key, full prompt/output truyện hoặc token vào walkthrough.

## 22. Review blockers

Reviewer reject Phase 3B nếu có một trong các lỗi:

- Chỉ disable frontend nhưng backend không atomic claim.
- Giữ transaction/row lock trong lúc gọi OpenAI.
- Dùng `updated_at` làm ownership token thay vì `text_generation_claim_id`.
- Request cũ có thể finalize/reset sau stale reclaim.
- Commit Vietnamese trước khi Khmer thành công.
- Gọi translate từng page thành N requests không có lý do.
- Router gọi SDK trực tiếp hoặc offline tests cần network/key.
- AI output không qua Pydantic + domain validation.
- Cho generate lại từ `text_draft` ngoài editor workflow.
- Thêm page-character mapping khi G2 chưa chốt.
- Tạo background worker/progress giả trong 3B.
- Success redirect tới route chưa tồn tại.
- Docs ghi Khmer đã spellcheck/grammar-correct chỉ từ Unicode check.

## 23. Handoff sang Phase 3C

Phase 3C được phép tin cậy:

- Story editor input ở `text_draft`.
- `title_vi`, `title_km` tồn tại.
- `story_pages` có `text_vi`, `text_km`, page numbers liên tục.
- `text_revision=1`.
- Canonical `GET /api/stories/{id}/text` tồn tại.
- OpenAI adapter/provider DI có thể mở rộng cho revise/retranslate.
- Setup đã khóa.

Phase 3C chịu trách nhiệm quick actions, custom instruction, add/delete/reorder, validator warnings, auto-save mutations và `text_confirmed`.

## 24. Nguồn kỹ thuật đã đối chiếu

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) — JSON Schema, explicit refusal và Pydantic support.
- [Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) — Responses API là hướng dùng cho integration mới.
- [OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes) — error/rate-limit handling.
- [Official OpenAI Python SDK](https://github.com/openai/openai-python) — async client, timeout và default retry behavior.
- [GPT-4o mini model](https://developers.openai.com/api/docs/models/gpt-4o-mini) — Responses và Structured Outputs hiện được support.
- [khmercut on PyPI](https://pypi.org/project/khmercut/) — segmentation, không phải proof về spelling/grammar.
