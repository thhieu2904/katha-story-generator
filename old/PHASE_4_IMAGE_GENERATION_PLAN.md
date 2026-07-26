# Phase 4 — Image Generation Implementation Plan

> Cập nhật: 2026-07-22
> Trạng thái: **IMPLEMENTED — CODE-COMPLETE OFFLINE; full acceptance pending**
> Phạm vi tài liệu: implementation + acceptance record; PostgreSQL/live/browser verification còn pending
> Baseline triển khai: `7a0cd6e` — Phase 3B/3C code-complete offline; Alembic head hiện tại `005`
> Evidence snapshot: backend `245 passed, 37 deselected`; riêng Phase 4 offline `94 passed`; `37` integration tests collect, gồm `11` test Phase 4; frontend Vitest `21 passed`, TypeScript/build pass. PostgreSQL execution và live OpenAI/R2 chưa chạy.

---

## 0. Kết luận PM

Phase 4 đã được triển khai và đạt code-complete offline; không còn câu hỏi sản phẩm nào chặn code. Các P1/P2 code-review đã được xử lý; full acceptance vẫn pending cho đến khi PostgreSQL integration, controlled live OpenAI/R2 và browser/manual matrix có evidence.

Giải pháp chốt cho MVP:

1. AI chuẩn bị **image plan theo từng trang**, gồm bản tiếng Anh, mô tả cảnh và đề xuất nhân vật xuất hiện.
2. Admin review/chỉnh mapping nhân vật bằng checkbox trước khi sinh ảnh.
3. Mapping lưu trực tiếp trên `story_pages`; không thêm bảng thứ tám.
4. Chỉ gửi reference sheet của nhân vật thực sự xuất hiện ở trang đó.
5. Sinh ảnh bằng `gpt-image-2`, tuần tự theo `page_no`, lưu từng ảnh thành công lên R2.
6. API start trả `202`; frontend poll canonical progress mỗi 3 giây.
7. Job dùng UUID claim + heartbeat trong PostgreSQL để chống duplicate/stale worker.
8. Retry/resume chỉ xử lý trang `pending/failed`; trang `completed` không được sinh lại trong Phase 4.
9. Nếu hoàn tất toàn bộ: `generating_images -> pending_review`.
10. Nếu còn trang lỗi/thiếu: story quay về `text_confirmed`, giữ ảnh thành công và cho phép resume.
11. Mapping khóa trong toàn bộ Phase 4 từ lần start đầu tiên, kể cả khi job lỗi một phần và story quay về `text_confirmed`; thay đổi/regenerate thuộc Phase 5.
12. Không sinh bìa AI. Bìa code template thuộc Phase 5 theo D27.

MVP vẫn dùng in-process background task, chưa cần Celery/Redis. Đây là lựa chọn phù hợp deadline nhưng phải ghi rõ giới hạn: task không bền qua restart/deploy; stale-resume là cơ chế phục hồi.

---

## 1. Baseline và điều kiện đầu vào

### 1.1 Đã có từ Phase 3

- Story đã có lifecycle `text_confirmed`, `generating_images`, `pending_review`.
- Canonical source cho Phase 4 là story ở `text_confirmed`.
- Text Việt/Khmer đã khóa; Phase 4 không sửa `text_vi`, `text_km`, title hoặc `text_revision`.
- `story_pages` đã có `text_en`, `image_prompt_en`, `image_url` nhưng chưa có image-plan metadata, progress hay per-page character mapping.
- `characters` có `appearance_prompt_en` và `ref_image_urls`.
- `art_styles` có `prompt_modifier_en`; không dùng `sample_image_url` làm reference ở MVP.
- R2 adapter hiện synchronous; background async phải gọi qua `asyncio.to_thread()` hoặc một async wrapper tương đương.
- `async_session_factory` đã tồn tại và phải được runner dùng để mở session mới.

### 1.2 Verification còn deferred từ các phase trước

- Docker/Testcontainers PostgreSQL chưa chạy thật.
- Live OpenAI chưa chạy với credentials hiện tại.
- Supabase/R2 live chưa được xác minh đầy đủ.
- Native-speaker Khmer review chưa hoàn tất nhưng không chặn việc code Phase 4.

Không được lấy các gate deferred trên làm bằng chứng Phase 4 đã end-to-end verified.

### 1.3 Preflight dev phải làm trước khi sửa code

- Xác nhận worktree sạch hoặc ghi rõ thay đổi có sẵn cần bảo toàn.
- Xác nhận Alembic chỉ có một head là `004`.
- Chạy baseline offline hiện tại trước khi thêm Phase 4.
- Không cần bật Docker để bắt đầu hoặc đạt trạng thái code-complete offline.
- Không gửi OpenAI/R2/Supabase secret vào chat, source, test fixture hoặc commit.

---

## 2. Quyết định sản phẩm và kỹ thuật đã khóa

### 2.1 G2 — Character theo từng trang

- AI đề xuất `character_ids` riêng cho từng page.
- Admin được review/chỉnh bằng checkbox trước lần sinh ảnh đầu tiên.
- Cho phép `[]` cho cảnh không có nhân vật.
- Mỗi page chỉ được chọn ID thuộc 2–3 nhân vật đã gắn với story.
- Không cho duplicate ID; tối đa 3 ID/page.
- Chỉ truyền reference của các ID đã chọn; không truyền toàn bộ cast.
- Một reference sheet canonical/character trong MVP: dùng URL hợp lệ đầu tiên trong `ref_image_urls`.
- Thứ tự character block trong prompt phải trùng thứ tự input image gửi provider.
- Mapping bị khóa từ lần start đầu; individual regenerate/change mapping thuộc Phase 5.

### 2.2 G4 — Job, retry và progress

- Không Celery, Redis, ARQ, WebSocket hoặc SSE trong Phase 4.
- `POST generate-images` claim job trong DB rồi trả `202 Accepted`.
- Job chạy in-process, mở DB session riêng, không tái sử dụng request-scoped session.
- Một story chỉ có một UUID claim hợp lệ tại một thời điểm.
- Sinh tuần tự theo `page_no`; không parallel pages.
- Frontend poll mỗi 3 giây bằng recursive `setTimeout`, không dùng `setInterval` gây request overlap.
- Page status: `pending`, `generating`, `completed`, `failed`.
- OpenAI retry tối đa một lần cho timeout/429/5xx; chỉ một layer được sở hữu retry.
- Mỗi ảnh upload/commit riêng; lỗi trang sau không rollback ảnh trang trước.
- Resume bỏ qua toàn bộ trang `completed`.
- Stale reclaim dùng `clock_timestamp()` của PostgreSQL và claim UUID mới.

### 2.3 Các mặc định PM dùng trong plan

- Route frontend: `/admin/stories/[id]/images`.
- Admin không sửa prompt thủ công trong Phase 4; prompt chỉ-read/collapsible để review.
- Mapping chỉnh local rồi lưu batch một lần, tránh nhiều PATCH tự xung đột revision.
- `gpt-image-2`, Images API trực tiếp.
- Có reference: `images.edit`; không reference: `images.generate`.
- Output native 16:9: `1536x864`.
- `quality=high`, `output_format=webp`, `output_compression=90`, `background=opaque`, `n=1`.
- `input_fidelity` phải bỏ trống với `gpt-image-2`.
- Backend MVP giả định một application instance/worker; in-memory semaphore không phải cluster-wide lock.
- Không tự động resume sau restart vì resume có thể phát sinh chi phí; UI báo stale và admin bấm tiếp tục.

Các giá trị provider phải đặt qua config để đổi mà không sửa domain logic.

---

## 3. Mục tiêu và ngoài phạm vi

### 3.1 In scope

- Migration `005` cho image plan, claim, heartbeat, mapping, progress và lỗi.
- AI image-plan structured output cho toàn bộ page snapshot.
- Server-side validation exact page IDs/count/order.
- English translation + visual scene description cho từng page.
- Deterministic prompt builder ghép scene, art style và character anchors.
- Admin review/sửa mapping trước khi start.
- OpenAI image adapter hỗ trợ generate/edit.
- Reference loader an toàn từ R2.
- Native 16:9 output validation.
- Versioned/immutable R2 object key.
- Background runner có claim fencing, partial success và stale resume.
- Canonical progress API và polling UI.
- Auth admin cho toàn bộ Phase 4 APIs/routes.
- Offline tests, PostgreSQL integration tests, docs và handoff evidence.

### 3.2 Out of scope

- AI cover hoặc upload cover.
- Code-template cover implementation; để Phase 5.
- Regenerate riêng một page.
- Approve/reject/review từng ảnh.
- Publish hoặc reader UI.
- Chỉnh lại text đã confirm.
- Chỉnh mapping sau lần start đầu.
- Manual prompt editor.
- Multiple reference sheets cho một character.
- LoRA/fine-tuning/seed control/conversation continuity.
- Durable distributed queue, multi-instance orchestration hoặc global cluster rate limiter.
- Cleanup job quét mọi R2 orphan cũ; Phase 4 chỉ best-effort cleanup orphan vừa tạo.
- Usage-log table. Chi phí vẫn theo OpenAI dashboard theo D21.

---

## 4. OpenAI contract đã đối chiếu

### 4.1 Endpoint chọn cho MVP

Sử dụng Images API trực tiếp để khóa rõ model `gpt-image-2`:

- Không có character reference: `client.images.generate(...)`.
- Có 1–3 character references: `client.images.edit(image=[...], ...)`.
- Output GPT Image trả base64; backend decode, validate rồi upload R2.
- `gpt-image-2` chấp nhận nhiều input images và tự xử lý input ở high fidelity.

Không dùng Responses image tool trong Phase 4 vì không cần hội thoại nhiều lượt và khó khóa model/cost boundary hơn Images API trực tiếp.

### 4.2 Native 16:9

Tài liệu hiện hành cho phép `gpt-image-2` nhận custom size khi thỏa:

- cạnh lớn nhất `<= 3840`;
- hai cạnh là bội số của 16;
- tỷ lệ cạnh không quá `3:1`;
- tổng pixel trong khoảng cho phép.

`1536x864` thỏa các điều kiện trên và là native 16:9. Vì vậy:

- không crop/pad sau generation;
- backend reject output sai kích thước;
- prompt vẫn yêu cầu giữ chủ thể trong safe area, không đặt text/logo lên ảnh.

### 4.3 Cost boundary

Không tiếp tục coi `$0.13/ảnh` là giá cố định. Giá phụ thuộc quality, resolution, text input và image-reference input tokens; reference của `gpt-image-2` luôn high fidelity nên có thể tăng input cost.

UI Phase 4 chỉ xác nhận **số ảnh nội dung N** và ghi rõ **không có bìa**. Nếu hiển thị tiền sau này, phải lấy estimate có ngày hiệu lực/config, không hard-code trong component.

### 4.4 Live-access caveat

OpenAI có thể yêu cầu Organization Verification và model không hỗ trợ free tier. Code-complete offline không chứng minh account live có quyền dùng `gpt-image-2`; đây là live gate riêng.

---

## 5. State machine và invariants

### 5.1 Story lifecycle

```text
text_confirmed + plan_missing
        |
        | POST image-plan
        v
text_confirmed + plan_ready + mapping_unlocked
        |
        | PUT image-plan (0..n lần, tăng image_plan_revision)
        |
        | POST generate-images: commit claim + lock mapping
        v
generating_images + active_claim
        |
        +-- tất cả pages completed ----------> pending_review
        |
        +-- failed/pending còn lại ----------> text_confirmed + mapping_locked
        |
        +-- process crash -------------------> generating_images + stale_claim
                                                   |
                                                   | POST generate-images sau stale
                                                   v
                                             generating_images + new_claim
```

Không có đường quay lại `text_draft` trong Phase 4.

### 5.2 Page lifecycle

```text
pending -> generating -> completed
                    \-> failed -> generating -> completed|failed

stale generating -> failed(STALE_JOB_INTERRUPTED) -> generating
```

`completed` là terminal trong Phase 4. Chỉ Phase 5 mới được tạo lại ảnh completed/rejected theo endpoint riêng.

### 5.3 Invariants P0

1. Image plan chỉ tạo/sửa khi story `text_confirmed` và `image_plan_locked_at IS NULL`.
2. AI output phải chứa đúng page IDs/count/order hiện tại.
3. `image_character_ids` unique, 0–3 phần tử và là subset của `story_characters`.
4. Image plan persist atomically: hoặc tất cả pages đổi, hoặc không page nào đổi.
5. Plan mutation tăng `image_plan_revision`, không tăng `text_revision`.
6. Start phải nhận `expected_image_plan_revision`; stale revision trả `409`.
7. `image_plan_locked_at` set trong lần start đầu và không clear khi partial failure.
8. `mapping_locked` lấy từ `image_plan_locked_at`, không suy ra riêng từ story status.
9. Không giữ DB transaction/row lock trong lúc gọi OpenAI, decode ảnh hoặc R2.
10. Mọi write của runner đều fence bằng `image_generation_claim_id`.
11. Worker cũ không được mark page success/failure, finalize story hoặc reset claim mới.
12. Completed page luôn skip trong retry/resume.
13. `pending_review` chỉ khi mọi page `completed` và có non-empty `image_url`.
14. Cover không tham gia page count, progress, job hoặc chi phí image call.

---

## 6. Migration `005_story_image_generation.py`

### 6.1 Thay đổi `stories`

```sql
ALTER TABLE stories
    ADD COLUMN image_plan_revision integer NOT NULL DEFAULT 0,
    ADD COLUMN image_plan_locked_at timestamptz NULL,
    ADD COLUMN image_generation_claim_id uuid NULL,
    ADD COLUMN image_generation_heartbeat_at timestamptz NULL;
```

Constraints:

```sql
CHECK (image_plan_revision >= 0)

CHECK (
    (image_generation_claim_id IS NULL AND image_generation_heartbeat_at IS NULL)
    OR
    (image_generation_claim_id IS NOT NULL AND image_generation_heartbeat_at IS NOT NULL)
)

CHECK (
    image_generation_claim_id IS NULL OR COALESCE(status = 'generating_images', false)
)
```

Ý nghĩa:

- `image_plan_revision`: optimistic concurrency riêng cho image plan.
- `image_plan_locked_at`: dấu mốc đã từng start; không clear khi retry/failure.
- `image_generation_claim_id`: owner token của runner hiện tại.
- `image_generation_heartbeat_at`: stale detection độc lập với `updated_at`.

### 6.2 Thay đổi `story_pages`

```sql
ALTER TABLE story_pages
    ADD COLUMN image_scene_en text NULL,
    ADD COLUMN image_character_ids integer[] NOT NULL DEFAULT '{}'::integer[],
    ADD COLUMN image_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN image_attempt_count integer NOT NULL DEFAULT 0,
    ADD COLUMN image_error_code text NULL;
```

Constraints:

```sql
CHECK (image_status IN ('pending', 'generating', 'completed', 'failed'))
CHECK (image_attempt_count >= 0)
CHECK (cardinality(image_character_ids) <= 3)
CHECK (image_status <> 'completed' OR NULLIF(image_url, '') IS NOT NULL)
```

Vai trò các text field:

- `text_en`: bản dịch tiếng Anh trung thành với `text_vi` đã confirm.
- `image_scene_en`: visual brief do image planner sinh, không chứa appearance anchors.
- `image_prompt_en`: prompt cuối cùng đã materialize từ scene + style + selected anchors; đây là prompt dùng cho image call.

Tách `image_scene_en` khỏi `image_prompt_en` để khi admin đổi checkbox, server rebuild prompt một cách deterministic mà không cần gọi AI lại hoặc parse prompt cũ.

### 6.3 Validation không làm được bằng DB

PostgreSQL array không thể gắn FK cho từng phần tử. Service bắt buộc kiểm tra:

- ID dương;
- không duplicate;
- đúng subset của `story_characters`;
- exact page set khi save batch.

Không thêm `story_page_characters` vì trái scope bảy bảng hiện tại và không cần thiết với tối đa 16 pages/story.

### 6.4 Backfill và downgrade

Upgrade:

- mọi page hiện tại bắt đầu với `image_status='pending'`; migration không tự suy ra completed chỉ từ legacy URL;
- current baseline phải có zero legacy `image_url`; nếu phát hiện URL cũ, migration/preflight dừng với lỗi rõ để PO chọn preserve/import hoặc clear, không tạo trạng thái completed nhưng mapping vẫn unlocked;
- nếu có legacy story `generating_images` nhưng không có claim, đưa về `text_confirmed` để không tạo trạng thái không owner;
- không tự coi image plan ready nếu thiếu `text_en`, `image_scene_en` hoặc `image_prompt_en`.

Không được backfill `completed` trong khi `image_plan_locked_at=NULL`; trạng thái đó sẽ cho recreate mapping nhưng retry lại skip ảnh cũ.

Downgrade:

- drop constraints trước;
- drop các column Phase 4;
- giữ nguyên legacy `image_url`, `text_en`, `image_prompt_en` đã tồn tại trước migration;
- downgrade/upgrade lifecycle phải chạy được trên PostgreSQL thật.

Không cần index mới ở MVP; mỗi story chỉ có tối đa 16 page và đã query theo `story_id/page_no`.

---

## 7. Feature architecture

Không tiếp tục dồn Phase 4 vào `features/stories/router.py`. Tạo feature module riêng:

```text
backend/src/katha/
├── features/
│   ├── stories/
│   │   └── models.py                 # bổ sung ORM columns
│   └── story_images/
│       ├── __init__.py
│       ├── dependencies.py
│       ├── models.py                 # structured AI/domain payloads
│       ├── ports.py                  # planner/image/storage protocols
│       ├── prompts.py                # pure prompt builders
│       ├── schemas.py                # API request/response
│       ├── service.py                # plan/read/start contracts
│       ├── runner.py                 # background job lifecycle
│       └── router.py
├── integrations/
│   ├── openai_story_images.py        # text planner + image adapter
│   └── r2_storage.py                 # download/upload/delete primitives
└── main.py                           # mount router
```

Boundary:

- `story_images` biết domain/state/claim nhưng không biết SDK internals.
- OpenAI/R2 nằm trong `integrations` và implement protocol.
- Prompt builder và output validator là pure functions, test không cần network/DB.
- Runner nhận factories/adapters; không import secret trực tiếp.
- Router chỉ auth, parse request, gọi service và schedule task khi service trả `should_schedule=True`.

---

## 8. Configuration

Bổ sung vào `Settings` và `.env.example`:

```text
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=1536x864
OPENAI_IMAGE_QUALITY=high
OPENAI_IMAGE_OUTPUT_FORMAT=webp
OPENAI_IMAGE_OUTPUT_COMPRESSION=90
OPENAI_IMAGE_TIMEOUT_SECONDS=150
OPENAI_IMAGE_MAX_RETRIES=1
IMAGE_PLAN_OPERATION_TIMEOUT_SECONDS=180
IMAGE_PAGE_OPERATION_TIMEOUT_SECONDS=330
IMAGE_GENERATION_STALE_SECONDS=900
IMAGE_MAX_CONCURRENT_JOBS=1
IMAGE_MAX_OUTPUT_BYTES=20971520
```

Validation P0:

- image max retries chỉ `0..1`; mặc định `1`.
- compression `0..100`.
- size parse được, hai cạnh bội 16 và đúng constraint gpt-image-2.
- stale seconds phải lớn hơn page operation timeout + safety margin.
- concurrency tối thiểu 1; mặc định 1.
- output max bytes dương và có hard cap hợp lý.

Retry ownership:

- OpenAI SDK sở hữu provider retry qua `max_retries=1`.
- Runner không bọc thêm provider retry loop.
- Whole-page timeout vẫn bao toàn bộ provider + validation + R2 operation.
- Với defaults, page budget `330s` reserve đủ hai OpenAI attempts (`150s × 2 = 300s`), `5s` cho finalization margin và tối đa `25s` botocore transport cho hai R2 upload attempts; botocore không tự retry bên trong.
- Image-plan structured call tiếp tục dùng `OPENAI_TEXT_MODEL`; không dùng image model để lập plan.

---

## 9. Image-plan AI contract

### 9.1 Input snapshot

Snapshot immutable trước khi gọi AI:

- `story_id`, `text_revision`, `image_plan_revision`;
- target age;
- title/description nếu cần ngữ cảnh;
- pages ordered: `id`, `page_no`, `text_vi`;
- cast: `id`, `name`, personality và appearance descriptions;
- art-style name/modifier.

Không gửi R2 credentials hoặc public URLs vào text-planner prompt.

### 9.2 Structured output

```python
class PlannedImagePage(BaseModel):
    page_id: int
    page_no: int
    text_en: str
    image_scene_en: str
    character_ids: list[int]


class StoryImagePlanOutput(BaseModel):
    pages: list[PlannedImagePage]
```

Prompt contract:

- đúng một item cho mỗi page;
- giữ nguyên page ID/order/count;
- `text_en` là faithful translation, không thêm tình tiết;
- `image_scene_en` chỉ mô tả một khoảnh khắc trực quan rõ ràng;
- chọn chỉ character thực sự xuất hiện trong cảnh;
- dùng ID từ allowed cast, không tự tạo ID;
- cảnh không người/nhân vật trả `[]`;
- không mô tả bìa, typography, caption hoặc chữ trong ảnh.

### 9.3 Domain validation

Reject toàn bộ output nếu:

- thiếu/thừa/trùng/sai thứ tự page;
- page ID không khớp page number hiện tại;
- text/scene rỗng hoặc vượt cap;
- character ID không hợp lệ, duplicate hoặc quá 3;
- output bị refusal/incomplete/unparseable.

Sau validation, server build `image_prompt_en` cho từng page. Chỉ khi toàn bộ pages hợp lệ mới lock row và persist atomically.

### 9.4 Concurrency khi tạo plan

Flow:

1. Read snapshot và ghi nhận `expected_text_revision`, `expected_image_plan_revision`.
2. Không giữ row lock trong AI call.
3. Sau AI call, lock story `FOR UPDATE`.
4. Recheck story vẫn `text_confirmed`, mapping chưa khóa, text/image revision còn đúng.
5. Persist tất cả pages; tăng `image_plan_revision` đúng một lần; commit.
6. Nếu stale: rollback và trả `409`; output cũ không được overwrite plan mới.

Existing valid plan phải được giữ nguyên nếu provider timeout/invalid hoặc finalize conflict.

---

## 10. Deterministic image prompt và references

### 10.1 Prompt composition

Prompt cuối phải được build bằng pure function theo thứ tự cố định:

1. task: one children’s-book illustration for this page;
2. `image_scene_en`;
3. art-style `prompt_modifier_en`;
4. selected character blocks: ID/name + full `appearance_prompt_en`;
5. mapping input image number -> character name;
6. consistency instruction;
7. composition: wide 16:9, all main subjects inside central safe area;
8. safety/output: age-appropriate, no text, captions, logos, watermark hoặc UI;
9. only include selected recurring characters; background extras không được giống cast khác.

Không phụ thuộc “memory” của request trước; mỗi page là stateless call và phải re-anchor đầy đủ.

### 10.2 Mapping edit

`PUT image-plan` nhận full page mapping. Server:

- validate exact page set;
- validate subset/unique/0–3 IDs;
- rebuild tất cả affected `image_prompt_en` từ stored `image_scene_en`;
- tăng `image_plan_revision` một lần;
- persist atomically.

Không gọi AI khi admin chỉ đổi checkbox.

### 10.3 Reference selection

- Canonical ordering: sort selected character IDs tăng dần hoặc dùng một helper ổn định duy nhất.
- Mỗi character lấy URL hợp lệ đầu tiên trong `ref_image_urls`.
- Character block trong prompt và input images dùng cùng ordering.
- Nếu selected character thiếu reference: start preflight trả `422`, không sinh unanchored image.
- Nếu `character_ids=[]`: dùng `images.generate`, không gửi placeholder/reference giả.
- Không gửi `art_styles.sample_image_url`; D13 đã chốt style qua prompt modifier.

### 10.4 Provider request

```text
model=gpt-image-2
size=1536x864
quality=high
output_format=webp
output_compression=90
background=opaque
n=1
moderation=auto
```

Với `gpt-image-2`, không truyền `input_fidelity` vì model tự xử lý mọi image input ở high fidelity.

---

## 11. API contracts

Tất cả endpoint dưới đây yêu cầu backend `get_admin_user`.

### 11.1 `GET /api/stories/{story_id}/images`

Read-only canonical endpoint dùng cho initial load và polling; không schedule/recover job.

Response tối thiểu:

```json
{
  "story_id": 12,
  "title_vi": "...",
  "status": "generating_images",
  "text_revision": 4,
  "image_plan_revision": 2,
  "image_plan_ready": true,
  "mapping_locked": true,
  "job_id": "uuid-or-null",
  "job_stale": false,
  "can_start": false,
  "can_retry": false,
  "can_resume": false,
  "progress": {
    "total": 8,
    "pending": 4,
    "generating": 1,
    "completed": 2,
    "failed": 1
  },
  "available_characters": [
    {
      "id": 1,
      "name": "Srey",
      "thumbnail_url": "https://..."
    }
  ],
  "pages": [
    {
      "id": 71,
      "page_no": 1,
      "text_vi": "...",
      "text_km": "...",
      "text_en": "...",
      "image_scene_en": "...",
      "image_prompt_en": "...",
      "character_ids": [1],
      "image_status": "completed",
      "image_url": "https://...",
      "image_attempt_count": 1,
      "image_error_code": null,
      "updated_at": "..."
    }
  ]
}
```

Derived flags phải được tính ở backend, đặc biệt `mapping_locked` không được frontend tự suy ra từ status.

`text_en`, `image_scene_en` và `image_prompt_en` đều nullable khi chưa có plan. Default `image_character_ids=[]` không chứng minh plan đã sẵn sàng. `image_plan_ready=true` chỉ khi revision > 0 và mọi current page có đủ ba text field non-empty cùng mapping hợp lệ.

Truth table:

| Flag | Điều kiện authoritative |
|---|---|
| `mapping_locked` | `image_plan_locked_at IS NOT NULL` |
| `job_stale` | status `generating_images`, claim/heartbeat tồn tại và DB clock vượt stale budget |
| `can_start` | `text_confirmed`, plan ready, mapping chưa khóa và còn page chưa completed |
| `can_retry` | `text_confirmed`, plan ready, mapping đã khóa và còn `pending/failed` |
| `can_resume` | `job_stale=true`; POST sẽ quyết định reclaim lại trong transaction |

R2/model readiness vẫn được recheck trong POST preflight; không thực hiện network I/O chỉ để tính flag cho GET.

### 11.2 `POST /api/stories/{story_id}/image-plan`

Body:

```json
{
  "expected_text_revision": 4,
  "expected_image_plan_revision": 0
}
```

Behavior:

- chỉ `text_confirmed`, unlocked;
- tạo/recreate toàn bộ plan bằng structured text AI;
- trả `200` canonical image state;
- synchronous operation với timeout riêng;
- không partial write khi lỗi.

### 11.3 `PUT /api/stories/{story_id}/image-plan`

Body:

```json
{
  "expected_image_plan_revision": 1,
  "pages": [
    {"page_id": 71, "character_ids": [1]},
    {"page_id": 72, "character_ids": []}
  ]
}
```

Behavior:

- full replacement mapping cho exact current page set;
- atomic update;
- rebuild prompts;
- tăng revision một lần;
- reject nếu locked hoặc stale.

### 11.4 `POST /api/stories/{story_id}/generate-images`

Body:

```json
{
  "expected_image_plan_revision": 2
}
```

Initial và retry/resume dùng chung endpoint.

Fresh start:

- validate plan complete và all selected refs available;
- lock story;
- tạo UUID claim + heartbeat bằng DB clock;
- set `generating_images`;
- set `image_plan_locked_at` nếu NULL;
- commit trước khi schedule;
- trả `202`.

Fresh duplicate/lost response:

- nếu claim hiện tại còn fresh, trả cùng canonical `202`, `already_running=true`;
- không schedule runner thứ hai.

Stale duplicate:

- reclaim bằng UUID mới;
- reset page `generating` của claim cũ thành retryable failure;
- commit rồi schedule một runner mới.

Response:

```json
{
  "job_id": "uuid",
  "already_running": false,
  "status": "generating_images",
  "progress": {"total": 8, "pending": 8, "generating": 0, "completed": 0, "failed": 0}
}
```

### 11.5 Error contract

| HTTP | Trường hợp |
|---|---|
| `401` | thiếu/invalid token |
| `403` | user không phải admin |
| `404` | story/page không tồn tại |
| `409` | sai status, stale revision, mapping locked, claim conflict, story đã hoàn tất |
| `422` | plan/mapping invalid hoặc missing character reference |
| `502` | image-plan provider trả output invalid/rejected |
| `503` | image-plan provider timeout/unavailable hoặc OpenAI/R2 integration chưa configure |

Background image errors không trả ngược qua `POST 202`; runner persist sanitized `image_error_code` để polling UI hiển thị.

---

## 12. Background job orchestration

### 12.1 Scheduling

- Service claim transaction trả `should_schedule`.
- Router chỉ add background task khi `should_schedule=True`.
- `202` chỉ được trả sau khi claim commit thành công.
- Runner nhận primitive `story_id`, `claim_id`; không nhận `AsyncSession` từ request.
- Runner mở short-lived sessions từ `async_session_factory` cho từng DB phase.
- In-process semaphore giới hạn `IMAGE_MAX_CONCURRENT_JOBS=1`.
- Runner đang chờ semaphore phải refresh heartbeat theo chu kỳ ngắn hơn stale budget; nếu không, job xếp hàng lâu có thể bị reclaim nhầm.

### 12.2 Claim/heartbeat

Mọi timestamp claim/reclaim/heartbeat dùng `SELECT clock_timestamp()`.

Runner check claim:

1. trước khi claim page;
2. trước provider call nếu snapshot chuẩn bị lâu;
3. sau provider call, trước upload;
4. sau upload, trước DB finalize;
5. trước mark failure;
6. trước finalizing story;
7. trước reset/clear claim trong exception handler.

Mất ownership ở bất kỳ checkpoint nào: worker dừng im lặng sau best-effort orphan cleanup; không write trạng thái cho claim mới.

### 12.3 Per-page flow

Runner startup sau khi lấy semaphore:

1. Mở transaction ngắn và verify story claim.
2. Nếu bất kỳ page nào đang `generating` dưới current story claim, đây là duplicate runner: terminate toàn runner, không skip sang page sau.
3. Snapshot đúng một lần ordered `target_page_ids` từ `pending/failed` (gồm stale pages vừa reset khi reclaim), rồi commit/close session.

Duplicate detection phải đi qua control-flow riêng `DUPLICATE_SAME_CLAIM`: return ngay, bypass generic failure/finally, không cleanup, không finalize, không clear claim/heartbeat và không sửa page/story. UUID fencing một mình không bảo vệ trường hợp này vì hai runner đang dùng cùng UUID.

Chỉ runner đã acquire được page hoặc runner primary đã đi hết immutable target list mới được chạy finalization.

`target_page_ids` là immutable trong lifetime của claim; page vừa fail không được query lại rồi append vào cùng job.

Với mỗi target theo `page_no`:

1. Mở transaction ngắn, lock story/page, verify claim.
2. Skip nếu page đã `completed` + valid URL do canonical state thay đổi.
3. Nếu page đã `generating` trong current claim, terminate toàn runner; tuyệt đối không xử lý page kế tiếp.
4. `pending|failed -> generating`, clear error, increment `image_attempt_count`, update heartbeat, commit.
5. Load immutable snapshot/reference bytes ngoài transaction.
6. Gọi `images.generate` hoặc `images.edit` ngoài transaction.
7. Decode base64 với strict size cap.
8. Validate MIME, WebP decode và exact `1536x864`.
9. Verify claim còn current.
10. Upload R2 bằng immutable key.
11. Lock story/page, verify claim và page vẫn `generating`.
12. Set `image_url`, `image_status='completed'`, clear error; reset image review metadata về pending; update heartbeat; commit.
13. Nếu commit raise với outcome không rõ, mở session mới đọc canonical page trước khi quyết định giữ/xóa object.
14. Tiếp tục target kế tiếp.

Không giữ DB connection/transaction trong provider/R2 latency window.

`image_attempt_count` đếm số lần page được runner claim để xử lý, không phải số HTTP call nội bộ của SDK retry.

Mỗi target chỉ có tối đa một orchestration attempt trong một claim; SDK retry một lần vẫn nằm bên trong attempt đó.

### 12.4 Error classification

| Error | Auto retry | Page result | Job behavior |
|---|---:|---|---|
| timeout/connection/429/5xx | SDK tối đa 1 | `failed/PROVIDER_UNAVAILABLE` sau khi hết retry | dừng job, để pages sau `pending` |
| moderation/refusal/invalid provider output | 0 | `failed/PROVIDER_REJECTED` hoặc `INVALID_IMAGE` | tiếp tục page sau |
| selected ref missing/invalid trước start | 0 | không start | API `422` |
| ref biến mất sau start | storage retry hợp lý | `failed/REFERENCE_UNAVAILABLE` | dừng job |
| R2 upload transient | retry upload tối đa 1 với cùng bytes/key | `failed/R2_UPLOAD_FAILED` | dừng job |
| DB/claim lost | 0 | worker cũ không đổi page | dừng worker |
| unexpected internal error | 0 | sanitized `INTERNAL_ERROR` nếu còn claim | dừng job |

Nguyên tắc:

- upload retry không được gọi OpenAI lại;
- không log raw base64, full prompt, secret hoặc raw provider response;
- logs chỉ chứa story/page/job IDs, stage, duration và sanitized error class.

### 12.5 Finalize job

Trong transaction cuối, lock story và verify claim:

- tất cả pages `completed` + URL hợp lệ:
  - story `pending_review`;
  - clear claim + heartbeat.
- còn `pending/failed/generating`:
  - stale `generating` của chính claim chuyển `failed`;
  - story `text_confirmed`;
  - clear claim + heartbeat;
  - giữ `image_plan_locked_at` và mọi completed URL.

Failure/reset handler phải vừa so claim UUID vừa xác nhận runner không ở nhánh `DUPLICATE_SAME_CLAIM`. Same-claim duplicate không được vào finalizer/resetter dù UUID vẫn khớp.

Worker cũ không được reset job mới; duplicate cùng claim không được reset runner hợp lệ.

---

## 13. R2 consistency và security

### 13.1 Immutable object key

Không dùng key cố định kiểu `stories/{story_id}/pages/{page_id}.webp`.

Dùng:

```text
stories/{story_id}/pages/{page_id}/{claim_id}-{image_attempt_count}.webp
```

Lý do:

- old worker upload muộn không overwrite ảnh của claim mới;
- browser/CDN không giữ cache ảnh cũ ở URL canonical;
- DB `image_url` là pointer authoritative.

Set metadata:

- `Content-Type: image/webp`;
- `Cache-Control: public, max-age=31536000, immutable`.

### 13.2 Orphan handling

- Claim mất trước DB finalize hoặc transaction chắc chắn rollback: re-read canonical page; chỉ delete best-effort khi row không tham chiếu candidate URL/key.
- Nếu commit raise/mất connection với outcome không rõ, mở session mới đọc canonical state.
- Nếu canonical page là `completed` và `image_url` đúng candidate URL, coi commit đã thành công và không delete.
- Nếu không thể xác minh outcome, giữ object và dừng/reconcile; ưu tiên một orphan có thể dọn sau hơn là xóa asset mà DB đã commit.
- Cleanup fail chỉ log sanitized key; không được báo page completed.
- Không cần viết global orphan sweeper trong Phase 4.

### 13.3 Reference loading

Không HTTP-fetch URL tùy ý từ DB.

R2 adapter phải:

- xác minh URL thuộc configured `R2_PUBLIC_URL`;
- chuyển URL thành safe bucket key;
- download qua authenticated R2 client;
- giới hạn bytes/content type;
- không cho path traversal hoặc arbitrary host SSRF.

Boto3 synchronous calls phải chạy qua `asyncio.to_thread()` để không block event loop.

---

## 14. Frontend UX

### 14.1 Route và workflow navigation

Tạo route:

```text
/admin/stories/[id]/images
```

Tạo pure helper `getStoryWorkflowHref(status)` và dùng ở list/editor:

- `draft` -> `/setup`;
- `generating_text`, `text_draft` -> `/edit`;
- `text_confirmed`, `generating_images`, `pending_review`, `approved`, `published` -> `/images`;
- `archived` -> story list.

Sau confirm text, editor hiện CTA **Tiếp tục chuẩn bị minh họa**; không tự gọi image-plan AI.

Direct access guard trên route `/images` phải đọc canonical status: draft chuyển setup, generating-text/text-draft chuyển editor, archived chuyển list với thông báo. `approved/published` chỉ hiển thị read-only trong Phase 4; Phase 5 có thể đổi route đích.

Backend GET trả `409` kèm canonical status cho story chưa tới image phase; frontend không render workspace editable từ dữ liệu stale.

### 14.2 UI states

1. **Initial loading**: skeleton hữu hạn.
2. **Initial error**: error screen + retry; không skeleton vô hạn.
3. **Plan missing**: nút `Tạo kế hoạch minh họa`.
4. **Preparing plan**: disable duplicate action, giữ current data.
5. **Plan ready/unlocked**:
   - card theo page order;
   - text Việt/Khmer;
   - English scene/prompt collapsed, read-only;
   - checkbox + thumbnail chỉ của story cast;
   - cho phép zero character;
   - local dirty state + nút save batch.
6. **Start dialog**:
   - `Sẽ tạo N ảnh nội dung`;
   - `Không tạo ảnh bìa`;
   - không hiển thị giá hard-code.
7. **Generating**:
   - khóa checkbox;
   - hiện `completed/total`, không dùng fake percentage;
   - page cards update dần;
   - `aria-live` cho status.
8. **Partial failure**:
   - giữ preview completed;
   - mapping vẫn read-only dù story là `text_confirmed`;
   - một CTA `Thử lại X trang lỗi/thiếu`;
   - không có per-page regenerate.
9. **Stale job**:
   - dừng normal polling;
   - báo job bị gián đoạn;
   - admin bấm `Tiếp tục sinh ảnh` để reclaim.
10. **Completed**:
    - status `pending_review`;
    - Phase 4 chỉ cho về story list; Phase 5 sẽ nối CTA review.

### 14.3 Mapping save/revision conflict

- Checkbox sửa local, không gọi API mỗi click.
- Save gửi toàn bộ page mappings + expected revision.
- `409`: refetch canonical state, bỏ dirty draft cũ sau khi cảnh báo admin khác đã cập nhật.
- Start bị disable khi local mapping chưa save.
- Double click start chỉ tạo một request ở frontend; backend claim vẫn là authority cuối.

### 14.4 Polling

- Recursive `setTimeout(..., 3000)` sau khi request trước kết thúc.
- Cancel timer khi unmount hoặc không còn `generating_images`.
- Poll error tạm thời: giữ ảnh/progress hiện có, hiện banner và tiếp tục poll.
- Nếu POST start timeout/mất response: GET canonical state trước khi cho gửi POST lại.
- Không poll khi `pending_review` hoặc partial job đã finalize về `text_confirmed`.

### 14.5 Image rendering

- URL null/broken dùng SVG placeholder.
- Có meaningful alt text `Minh họa trang N`.
- Unique immutable URL tránh stale browser cache.
- Dùng Next image configuration hoặc `<img>` có lý do/document warning; không tạo warning lint mới không giải thích.

---

## 15. File scope dự kiến

### Backend

```text
backend/
├── alembic/versions/005_story_image_generation.py
├── src/katha/core/config.py
├── src/katha/main.py
├── src/katha/features/stories/models.py
├── src/katha/features/story_images/
│   ├── __init__.py
│   ├── dependencies.py
│   ├── models.py
│   ├── ports.py
│   ├── prompts.py
│   ├── schemas.py
│   ├── service.py
│   ├── runner.py
│   └── router.py
├── src/katha/integrations/openai_story_images.py
├── src/katha/integrations/r2_storage.py
├── tests/test_story_image_plan.py
├── tests/test_story_image_jobs.py
├── tests/test_openai_story_images.py
├── tests/test_phase4_api.py
├── tests/test_phase4_integration.py
├── pyproject.toml
├── uv.lock
└── .env.example
```

`Pillow` có thể thêm làm runtime dependency để verify format/dimensions an toàn; không dùng để tạo/chỉnh nội dung ảnh.

### Frontend

```text
frontend/src/
├── app/admin/stories/[id]/images/page.tsx
├── features/story-images/
│   ├── api.ts
│   ├── types.ts
│   ├── constants.ts
│   ├── useStoryImages.ts
│   └── components/
│       ├── StoryImageWorkspace.tsx
│       ├── ImagePlanCard.tsx
│       ├── CharacterMapping.tsx
│       ├── ImageGenerationProgress.tsx
│       ├── GeneratedImageCard.tsx
│       └── StartImageGenerationDialog.tsx
├── features/stories/routes.ts
├── features/stories/components/StoryListItem.tsx
└── features/story-editor/components/StoryTextEditor.tsx
```

### Frontend test tooling

Do polling/state/routing có rủi ro cao, Phase 4 nên thêm Vitest + React Testing Library. Nếu deadline buộc defer test runner mới, phải ghi rõ là P1/deferred và vẫn hoàn tất manual matrix; không được báo automated frontend tests đã pass.

---

## 16. Trình tự implementation

### Step 0 — Freeze contract/docs

- Ghi D34 cho per-page mapping/image plan.
- Ghi D35 cho in-process job/retry/progress.
- Mark G2/G4 `CHỐT` ngày 2026-07-21.
- Chốt JSON request/response examples trước khi backend/frontend tách nhánh.

### Step 1 — Migration và ORM

- Viết migration 005 + model columns/constraints.
- Update migration graph/offline tests.
- Chạy upgrade/downgrade lifecycle trên PostgreSQL khi Docker có sẵn; trước đó chỉ code/collect/offline graph.

### Step 2 — Domain contracts và prompt builder

- Structured plan models.
- Exact page/mapping validators.
- Deterministic prompt builder.
- Unit tests pure trước provider/service.

### Step 3 — Image-plan provider và service

- OpenAI text planner adapter.
- Snapshot/finalize optimistic concurrency.
- POST/PUT/GET plan contracts.
- Provider/transaction tests.

### Step 4 — Image/R2 adapters

- `gpt-image-2` generate/edit adapter.
- Decode/output validation.
- Safe reference download.
- Immutable upload/delete.
- Fake adapters cho offline tests.

### Step 5 — Claim và runner

- Start/fresh duplicate/stale reclaim.
- Separate-session background runner.
- Sequential page processing.
- Error classification, page commit, finalization.
- Claim fencing/race tests.

### Step 6 — API integration

- Mount router.
- Schedule only after committed claim.
- Auth/error contracts.
- Full offline API tests.

### Step 7 — Frontend vertical slice

- Route/types/API/hook.
- Plan/mapping UI.
- Start dialog/progress/partial error/stale resume.
- Workflow routing from story list/editor.
- Poll/reconcile tests or explicit manual evidence if test runner deferred.

### Step 8 — Offline gates

- Backend lint/format/type/tests.
- Frontend lint/type/test/build.
- Secret scan, lock checks, diff check.
- Docs sync.

### Step 9 — Deferred Docker/live verification

- PostgreSQL concurrency/migration integration tests.
- Live OpenAI model access + output contract.
- R2 upload/public URL.
- Controlled four-page story smoke before any 8–14 page story.

---

## 17. Backend test matrix bắt buộc

### 17.1 Plan/domain

- exact page IDs/count/order accepted.
- missing/extra/duplicate/reordered page rejected atomically.
- faithful fields empty/over cap rejected.
- character subset/unique/positive/max-three.
- zero-character page accepted.
- unknown character rejected.
- prompt contains only selected character anchors.
- prompt/reference ordering deterministic.
- art style modifier included; sample image not sent.
- mapping change rebuilds prompt without AI call.
- plan/mapping increments image revision, never text revision.
- locked mapping rejected even after partial status returns `text_confirmed`.

### 17.2 Provider adapter

- zero refs calls `images.generate`.
- 1–3 refs calls `images.edit` with exact order.
- request uses `gpt-image-2`, `1536x864`, high/WebP/opaque/n=1.
- `input_fidelity` absent.
- valid base64 WebP accepted.
- missing base64, bad base64, oversized bytes, wrong MIME/dimensions rejected.
- timeout/connection/429/5xx maps to transient provider error.
- 4xx/refusal maps to non-transient sanitized error.
- no secrets/raw base64 in logs.
- actual provider calls tối đa two when SDK retry is one.

### 17.3 Start/claim/concurrency

- initial start commits claim then returns `202`.
- two concurrent starts yield one claim/one scheduled runner.
- fresh duplicate returns same job ID and no reschedule.
- duplicate runner với cùng claim terminate toàn bộ; không provider call thứ hai và không claim page N+1.
- same-claim duplicate không đổi page/story, không clear claim/heartbeat, không cleanup/finalize; runner hợp lệ vẫn hoàn tất bình thường.
- queued runner refreshes heartbeat while waiting for global semaphore.
- target page IDs được snapshot đúng một lần cho mỗi claim.
- stale detection uses DB clock.
- stale reclaim issues new UUID and resets only stale generating pages.
- stale expected image revision returns `409`.
- start with incomplete plan/missing refs returns `422`, no claim.
- start sets mapping lock exactly once.
- request-scoped session is never passed to runner.

### 17.4 Page processing/failure

- process in ascending `page_no`.
- completed pages always skipped.
- `pending/failed` pages become generating and increment attempt count.
- page failed chỉ được orchestration attempt một lần trong current claim; local failure xong phải đi N+1.
- successful page commits before next page.
- page N local content failure does not erase N-1 and may continue N+1.
- systemic provider/storage failure stops safely, leaving later pages pending.
- upload retry reuses same image bytes and does not call provider again.
- provider success/R2 fail never marks completed.
- DB transaction chắc chắn rollback + canonical row không tham chiếu candidate URL thì orphan được delete best-effort.
- DB commit đã apply nhưng response/connection mất: canonical reread thấy matching URL thì giữ object và coi success.
- Commit outcome không xác minh được thì không delete asset mù.
- orphan delete fail does not corrupt DB status.
- immutable key prevents old worker overwrite.

### 17.5 Fencing/finalization

- old claim cannot mark page completed.
- old claim cannot mark page failed.
- old claim cannot clear/reset new claim.
- old claim cannot finalize story.
- all completed -> `pending_review`, claim/heartbeat cleared.
- partial -> `text_confirmed`, claim/heartbeat cleared, mapping remains locked.
- completed URLs survive failure/retry.
- cover URL/count untouched.

### 17.6 API/auth

- every endpoint 401/403 coverage.
- 404/409/422/502/503 contracts.
- GET is side-effect free.
- POST plan failure preserves canonical previous plan.
- PUT mapping exact full set.
- polling response counts always sum to total.
- raw internal/provider error never leaks to response.

### 17.7 PostgreSQL integration — Docker deferred

- migration 004 -> 005 -> downgrade -> upgrade lifecycle.
- constraints/backfill on real PostgreSQL.
- claim non-null + status NULL bị DB constraint reject.
- legacy `image_url` preflight không silently backfill completed/unlocked state.
- concurrent `FOR UPDATE` start race.
- DB `clock_timestamp()` stale reclaim.
- per-page durable commit across later rollback.
- crash/resume with stale generating page.
- claim fencing with two sessions.

Integration tests phải collect được khi Docker tắt và gắn `pytest.mark.integration`; offline suite không được khởi tạo Testcontainers.

Trạng thái 2026-07-22: coverage trên đã được implement; `11` Phase 4 integration tests collect thành công nhưng chưa execute vì Docker/PostgreSQL gate còn deferred.

---

## 18. Frontend verification matrix

- Status routing đúng setup/edit/images.
- Mở page không tự gọi AI.
- Prepare button chỉ gọi một lần khi double click.
- Render đúng page ID/order và đúng story cast.
- Zero-character selection hoạt động.
- Dirty mapping bắt buộc save trước start.
- Save gửi full mapping + revision.
- `409` refetch canonical và báo conflict.
- Mapping khóa sau start và sau partial failure.
- Dialog ghi đúng N content images, không có cover.
- POST mất response thì GET reconcile trước retry.
- Poll 3 giây, không overlap, cancel on unmount.
- Poll error giữ ảnh/progress hiện có.
- Completed preview xuất hiện dần.
- Partial failure chỉ có global retry missing/failed.
- Không có per-page regenerate.
- `pending_review` dừng polling.
- Null/broken URL dùng SVG fallback.
- 401/403/404/network có UX rõ.
- Checkbox có label; progress có accessible current/max; status có `aria-live`.
- Không tạo lint warning mới không giải thích.

---

## 19. Quality gates

### 19.1 Code-complete offline — bắt buộc

Backend:

```text
uv lock --check
uv run ruff check src/ tests/ alembic/versions/005_story_image_generation.py
uv run ruff format --check src/ tests/ alembic/versions/005_story_image_generation.py
uv run mypy src/
uv run pytest tests/ -m "not integration" -v
uv run pytest tests/ -m integration --collect-only
uv run alembic heads
```

Frontend:

```text
npm run lint
npx tsc --noEmit
npm run test -- --run       # nếu test runner được thêm trong Phase 4
npm run build
```

Repository:

- `git diff --check`.
- không secret thật trong source/fixtures/log snapshot.
- một Alembic head là `005`.
- worktree/touched files được báo cáo trung thực.

### 19.2 Docker-deferred

```text
uv run pytest tests/ -m integration -v
```

Docker tắt không chặn code-complete offline. Dev phải báo số test `passed/deselected/collected` riêng, không gộp collect-only thành passed.

### 19.3 Live OpenAI/R2-deferred

Chỉ mark live verified sau khi có credentials local và chạy thật:

1. Verify organization/account gọi được `gpt-image-2`.
2. Verify image-plan structured output.
3. Verify một page không character qua `images.generate`.
4. Verify page 1 và 2 characters qua `images.edit`.
5. Verify output native `1536x864` WebP.
6. Verify R2 public URL tải được và cache header đúng.
7. Chạy một story short bốn page; không chạy 14 page ngay lần đầu.
8. Quan sát ảnh hiện dần, refresh giữa job vẫn phục hồi canonical progress.
9. Simulate một failure/resume; completed pages không bị gọi lại.
10. Xác nhận đúng bốn image API outputs, không có cover call.
11. Ghi usage/cost thật từ dashboard và cập nhật dated estimate nếu cần.

Không yêu cầu user gửi secret vào chat.

---

## 20. Definition of Done

### 20.1 Code-complete offline

Được phép báo **Phase 4 code-complete offline** khi:

- migration/models/contracts/adapters/runner/UI đã implement;
- G2/G4 docs đã chốt;
- toàn bộ offline backend gates pass;
- integration tests collect nhưng không khởi động Docker;
- frontend lint/type/test nếu có/build pass;
- mocks chứng minh claim, retry, partial success và resume;
- docs/evidence đầy đủ;
- chưa tuyên bố chất lượng ảnh thật, R2 live hoặc end-to-end live.

### 20.2 PostgreSQL integration verified

Chỉ khi Docker-backed suite chạy thật và pass migration/race/crash-resume cases.

### 20.3 Live verified

Chỉ khi controlled live smoke với OpenAI + R2 pass và ảnh được review thủ công về:

- đúng nhân vật;
- reference consistency chấp nhận được;
- đúng art style;
- không chèn text/logo không mong muốn;
- composition phù hợp 16:9;
- public URL hoạt động.

Phase 4 chưa được gọi là hoàn tất tuyệt đối nếu chỉ có mock/offline tests.

---

## 21. Evidence dev phải bàn giao

1. Commit hash và `git status --short`.
2. Danh sách file thêm/sửa.
3. Alembic head + migration lifecycle status.
4. Backend Ruff/format/mypy/pytest output và số test cụ thể.
5. Integration collect count; nếu Docker chạy thì pass count riêng.
6. Frontend lint errors/warnings, TypeScript, tests và build.
7. API contract examples thực tế.
8. Test evidence cho concurrent start/stale claim/old-worker fencing.
9. Test evidence completed pages bị skip khi retry.
10. Test evidence immutable R2 key + orphan cleanup path.
11. Screenshot hoặc screen recording mapping/progress/partial failure UI nếu browser QA chạy.
12. Live gate nào chạy, gate nào deferred và lý do.
13. Không ghi secret, raw image base64 hoặc raw provider payload vào report.

---

## 22. Review blockers — REQUEST CHANGES nếu vi phạm

### P0

- Tạo thêm bảng/junction page-character thay vì column đã chốt mà không xin scope change.
- Suy ra mapping lock chỉ bằng story status.
- Cho sửa mapping sau lần start đầu hoặc partial failure.
- Dùng request-scoped DB session trong background task.
- Giữ row lock/transaction xuyên qua OpenAI/R2 call.
- Không commit claim trước `202`.
- Fresh duplicate schedule runner thứ hai.
- Duplicate runner skip page đang generating rồi xử lý page kế tiếp thay vì terminate.
- Same-claim duplicate đi vào generic cleanup/finalize/reset và làm hỏng runner hợp lệ.
- Re-query `pending/failed` trong cùng claim khiến page vừa fail bị gọi lại vô hạn.
- Không fence mọi write/reset/finalize bằng UUID claim.
- Dùng app clock thay PostgreSQL `clock_timestamp()` để stale reclaim.
- DB claim constraint vẫn cho claim non-null khi status NULL.
- Dùng R2 key cố định và có thể overwrite bởi worker cũ.
- Xóa R2 object sau ambiguous DB commit mà không canonical reread.
- Retry provider ở cả SDK và orchestration.
- Retry upload bằng cách gọi lại image API.
- Retry/regenerate page `completed` trong Phase 4.
- Partial failure vẫn chuyển `pending_review`.
- Pass reference của toàn bộ cast thay vì page mapping.
- Selected character thiếu ref nhưng vẫn generate unanchored.
- Truyền `input_fidelity` cho `gpt-image-2`.
- Sinh/cộng cover vào job/progress/cost.
- Hard-code `$0.13/ảnh` như giá authoritative.
- Log secret, raw base64 hoặc raw provider error ra client.
- Báo live/Docker verified khi chỉ collect/mock.

### P1/deferred hợp lệ nếu ghi rõ

- Durable queue/Celery/Redis.
- Multi-instance global concurrency.
- Per-page regeneration/review.
- Automated R2 orphan sweeper.
- Multiple refs/character.
- Manual image prompt editor.
- Frontend automated test runner mới nếu deadline không cho phép, với điều kiện manual matrix có evidence.

---

## 23. Docs phải đồng bộ trong PR Phase 4

- `plan/01-decisions-log.md`: thêm D34/D35.
- `plan/08-implementation-gates.md`: G2/G4 -> `CHỐT` ngày 2026-07-21.
- `plan/07-database-schema.md`: migration fields, constraints, lifecycle partial failure.
- `plan/02-technical-design.md`: image plan/job/claim/R2 flow; bỏ Khmer validation khỏi Image Phase.
- `plan/03-user-flows.md`: mapping review, progress, partial failure, stale resume.
- `plan/04-implementation-plan.md`: thay OPEN gates bằng scope đã chốt; bỏ fixed `$0.13`.
- `plan/06-project-structure.md`: feature-based module thực tế.
- `plan/HANDOFF.md`: Phase 3 complete offline, Phase 4 status và deferred gates.
- `backend/README.md` và `.env.example`: config/run/test/live smoke.
- File plan này: dev chỉ cập nhật status/evidence sau khi implementation thật sự hoàn tất.

Historical research notes có thể giữ số liệu cũ nếu gắn rõ ngày snapshot; active handoff/technical design không được trình bày giá cũ như hiện hành.

---

## 24. Handoff sang Phase 5

Phase 4 phải bàn giao cho Phase 5:

- story `pending_review` chỉ khi mọi content page có ảnh;
- `image_url`, prompt, mapping, attempt/error metadata còn nguyên;
- cover vẫn chưa sinh và không nằm trong `story_pages`;
- text vẫn locked;
- Phase 5 mới thêm approve/reject, regenerate một page, code-template cover, publish và reader.

Không triển khai trước endpoint `regenerate-image` trong Phase 4.

---

## 25. Nguồn kỹ thuật đã đối chiếu

- [GPT Image 2 model](https://developers.openai.com/api/docs/models/gpt-image-2)
- [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
- [Create image API reference](https://developers.openai.com/api/reference/resources/images/methods/generate)
- [Create image edit API reference](https://developers.openai.com/api/reference/resources/images/methods/edit)

Các contract cần lưu ý từ nguồn chính thức tại ngày lập plan:

- `gpt-image-2` hỗ trợ generation và edit với text/image input.
- Edit hỗ trợ nhiều input images; dự án chỉ dùng tối đa ba.
- Model hỗ trợ custom resolution theo constraint, nên `1536x864` dùng native 16:9.
- Image API trả base64 và hỗ trợ PNG/JPEG/WebP.
- `gpt-image-2` không cho tùy chỉnh `input_fidelity`; phải omit.
- Complex prompts có thể mất tới khoảng hai phút, nên timeout/stale budget phải đủ rộng.
