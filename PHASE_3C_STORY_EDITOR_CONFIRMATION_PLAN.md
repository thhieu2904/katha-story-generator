# Phase 3C — Story Editor & Text Confirmation Implementation Plan

> Biên tập truyện song ngữ bằng quick actions/yêu cầu AI, quản lý trang, kiểm tra Khmer ở mức hỗ trợ và khóa nội dung trước Image Phase.

## 0. Trạng thái kế hoạch

- Ngày lập: 2026-07-20.
- Loại tài liệu: implementation plan / handoff cho dev.
- Trạng thái: **CORE P0 CODE-COMPLETE OFFLINE** (2026-07-20); Docker/live/native Khmer review pending.
- Chính sách số trang sau edit đã được chốt ở Section 3.3; không còn product micro-gate.
- Phase này chỉ chuyển `text_draft → text_confirmed`; không tự sinh ảnh.
- Docker, OpenAI live smoke và native-speaker quality review là các gate tách riêng.

## 1. Kết luận PM

Phase 3C nên là một feature riêng, không tiếp tục dồn logic vào Story Setup.

Luồng hoàn chỉnh của phase:

1. Admin mở `/admin/stories/[id]/edit` với story `text_draft`.
2. Admin xem Việt là primary và Khmer là subtitle.
3. Admin có thể:
   - dùng quick action;
   - gửi một yêu cầu chỉnh sửa tự do;
   - thêm một trang bằng AI;
   - xóa một trang có confirm;
   - kéo thả đổi thứ tự;
   - yêu cầu dịch lại Khmer cho tiêu đề hoặc một trang.
4. Mỗi thao tác thành công auto-save canonical state ngay vào DB.
5. Backend chống ghi đè khi nhiều admin cùng sửa bằng `text_revision`.
6. Admin xem warning Khmer, nhưng warning không được giả làm kết luận đúng/sai ngữ pháp.
7. Admin bấm **Xác nhận nội dung**, chấp nhận khóa text.
8. Backend chuyển `text_draft → text_confirmed` và không gọi image pipeline.

G2 và G4 vẫn mở và không được giải quyết ngầm trong phase này.

## 2. Điều kiện đầu vào từ Phase 3B

Dev chỉ bắt đầu Phase 3C khi Phase 3B đã cung cấp ổn định:

- Story ở `text_draft` sau generation thành công.
- `title_vi`, `title_km` không rỗng.
- Mỗi `story_page` có `text_vi`, `text_km` và `page_no` liên tục.
- `stories.text_revision=1`.
- `GET /api/stories/{id}/text` là canonical read endpoint.
- OpenAI adapter/provider DI hoạt động với fake provider trong offline tests.
- Route `/admin/stories/[id]/edit` đã tồn tại ở dạng bilingual preview read-only.
- Setup đã khóa từ `text_draft` theo D29.
- Migration graph chỉ có một head là revision 003.

Không bắt đầu bằng cách copy prompt/provider code của 3B sang module khác.

## 3. Quyết định sản phẩm và kỹ thuật

### 3.1 Đã chốt

| Nội dung | Quyết định |
|---|---|
| Editor | Quick actions + yêu cầu tự do + drag/drop + add/delete (D07) |
| Inline edit | Không có trong MVP (D07) |
| Hiển thị admin | Việt primary, Khmer subtitle preview (D08/D18) |
| Lưu | Auto-save current state; không history/undo/edit log (D15/D20/D21) |
| Confirm | Text bị khóa sau confirm (D14) |
| Setup | Không sửa từ `text_draft` (D29) |
| Collaboration | Mọi admin được sửa mọi story (D28) |
| Image | Chỉ bắt đầu sau khi text đã confirmed (D14) |

### 3.2 Mặc định PM dùng trong plan

| Mã | Mặc định | Lý do |
|---|---|---|
| P3C-A1 | “Chat” là one-shot edit command; không lưu conversation/history | Phù hợp D15/D21, tránh thêm bảng/state không cần thiết |
| P3C-A2 | Quick action/custom edit có thể đổi title; đổi title phải dịch lại `title_km` | Title là một phần canonical story |
| P3C-A3 | AI edit trả full Vietnamese snapshot kèm stable source IDs | Cho phép tính diff an toàn; structural change chỉ hợp lệ theo rule riêng |
| P3C-A4 | Chỉ trang Việt bị đổi/mới mới dịch lại; reorder giữ cặp Việt–Khmer | Giảm chi phí và không làm thay đổi bản dịch vô cớ |
| P3C-A5 | Khmer validator chỉ tạo warning, không auto-correct, không hard-block confirm | Tooling Khmer còn false-positive cao, nhất là tên riêng |
| P3C-A6 | Có nút dịch lại Khmer cho title hoặc một page; không sửa Khmer inline | Tuân D07 nhưng vẫn có đường sửa mọi phần bản dịch |
| P3C-A7 | Confirm chỉ đổi status; không gọi Phase 4 | G2/G4 chưa chốt, tránh coupling |
| P3C-A8 | Mọi content mutation dùng optimistic concurrency qua `text_revision` | D28 cho nhiều admin cùng sửa; AI request kéo dài |
| P3C-A9 | Một thời điểm UI chỉ chạy một operation | UX rõ và hạn chế double-spend |
| P3C-A10 | Quick actions giữ nguyên page count/order; custom instruction chỉ đổi cấu trúc khi admin yêu cầu rõ | Add/delete/reorder đã có control riêng, tránh AI tự đổi cấu trúc ngoài ý muốn |

### 3.3 Chính sách số trang sau edit đã chốt

- Initial generation của 3B chỉ nhận số chẵn: `{4,6}`, `{8,10}`, `{12,14}`.
- Sau khi admin edit, count phải còn trong **band đã chọn**:
  - short: 4–6;
  - medium: 8–10;
  - long: 12–14.
- Cho phép số lẻ trong band, gồm `5/9/13`, sau add/delete một trang.
- Confirm chỉ kiểm tra band, không kiểm tra chẵn/lẻ.
- Hard max 16 vẫn là safety invariant toàn hệ thống, nhưng không dùng để bỏ qua band metadata.
- Quick actions luôn giữ nguyên count; add/delete bị disable hoặc trả `422` khi vượt band.

### 3.4 Câu hỏi chất lượng không chặn code

Cần một người đọc Khmer để review corpus nhỏ và live story samples. Nếu chưa có:

- Phase 3C vẫn code-complete với baseline validator và warning-only UX;
- không tuyên bố spellcheck/translation đã được xác nhận đúng ngôn ngữ;
- native-speaker acceptance được ghi rõ pending.

### 3.5 Giới hạn kỹ thuật đã chốt

```text
TITLE_MAX_CHARS=160
PAGE_TEXT_MAX_CHARS=1200
INSTRUCTION_MIN_CHARS=5
INSTRUCTION_MAX_CHARS=1000
EDIT_MAX_OUTPUT_TOKENS=8000
ADD_PAGE_MAX_OUTPUT_TOKENS=1500
RETRANSLATE_MAX_OUTPUT_TOKENS=1500
```

- Selective translation dùng shared `TRANSLATION_MAX_OUTPUT_TOKENS=8000` từ 3B.
- Mọi AI operation dùng shared `OPENAI_TIMEOUT_SECONDS=60`, `OPENAI_MAX_RETRIES=1` và outer `TEXT_OPERATION_TIMEOUT_SECONDS=270`.
- Frontend dùng request timeout 285 giây; sau timeout/mất kết nối phải refetch canonical status/revision trước khi resend.
- Title/page output phải tuân `TITLE_MAX_CHARS`, `PAGE_TEXT_MAX_CHARS` và hard word max theo target age đã chốt ở 3B.

## 4. Mục tiêu và ngoài phạm vi

### 4.1 In scope

- Story Editor song ngữ hoàn chỉnh.
- Quick actions cố định.
- One-shot custom instruction.
- AI revise Vietnamese story.
- Dịch lại các phần Khmer bị ảnh hưởng.
- Add one page bằng AI.
- Delete page có confirm.
- Reorder bằng dnd-kit và keyboard/fallback controls.
- Diff do server tính và toast thay đổi.
- Auto-save từng successful mutation.
- Optimistic concurrency với `text_revision`.
- Baseline Khmer validator luôn khả dụng.
- Dependency spike cho Khmer segmentation/dictionary warnings.
- `spellcheck_flags` và validation timestamp.
- Explicit full-story Khmer validation bootstrap cho page cũ chưa validate.
- Retranslate Khmer cho title hoặc một page.
- Confirm dialog và state lock.
- Read-only preview sau confirm.
- Story list CTA theo lifecycle.
- Mở rộng archive cho `text_draft` nếu hoàn thành nhóm P1.

### 4.2 Out of scope

- Inline editing Việt hoặc Khmer.
- Persistent chat thread, chat history, undo/version history.
- Manual page text textarea/contentEditable.
- Auto-correction Khmer.
- Cam kết validator kiểm tra được grammar/semantic accuracy.
- English translation và image prompt.
- Character-per-page mapping.
- Sinh ảnh hoặc enqueue image job.
- Progress SSE/WebSocket/background worker.
- Page/image review/publish/reader.
- Usage/edit analytics.

## 5. State and edit lifecycle

```text
text_draft
  ├── quick action/custom instruction ──► text_draft, revision + 1 nếu content đổi
  ├── add/delete/reorder/retranslate ───► text_draft, revision + 1
  ├── validate Khmer metadata ──────────► text_draft, revision giữ nguyên
  ├── confirm text ─────────────────────► text_confirmed
  └── archive (P1, deferred khỏi P0) ───► archived

text_confirmed
  ├── GET preview allowed
  └── every text mutation rejected
```

Không thêm status `editing_text`:

- client khóa controls khi request chạy;
- backend dùng expected revision và final conditional commit;
- hai AI requests vẫn có thể cùng tốn call nếu hai admin bấm đồng thời, nhưng chỉ một được persist;
- không giữ DB lock qua network call;
- ở quy mô 2–5 admin, đây là trade-off MVP chấp nhận được.

## 6. Migration 004

Tên gợi ý:

```text
backend/alembic/versions/004_story_editor_validation.py
```

### 6.1 Thay đổi

Thêm:

```text
story_pages.khmer_validated_at timestamptz NULL
```

Semantics:

- `khmer_validated_at IS NULL`: advanced/baseline validator pipeline chưa chạy sau translation hiện tại.
- timestamp có giá trị + `spellcheck_flags=[]`: pipeline đã chạy và không tìm thấy warning theo khả năng hiện tại.
- timestamp có giá trị + flags khác rỗng: pipeline đã chạy và có warning hỗ trợ review.

Mọi lần `text_km` đổi phải cập nhật flags và timestamp cùng transaction; không để flags cũ gắn với bản dịch mới.

### 6.2 Vì sao cần field này

Schema hiện chỉ có default `spellcheck_flags=[]`; như vậy không phân biệt được:

- “chưa từng kiểm tra”; và
- “đã kiểm tra, không có warning”.

Không thêm bảng spellcheck/history. Một nullable timestamp đủ cho MVP.

### 6.3 Upgrade/downgrade

- Existing pages giữ `khmer_validated_at=NULL`.
- Không giả backfill rằng nội dung Phase 3B đã spellcheck sạch.
- Frontend gọi explicit `POST /api/stories/{id}/validate-km` khi phát hiện page chưa validate; `GET /text` không có side effect.
- Downgrade chỉ drop column.
- Single Alembic head phải là 004.

## 7. Feature architecture

Tạo feature riêng để editor không làm phình Phase 3A CRUD/generation module.

```text
backend/src/katha/
├── features/
│   ├── stories/                    # models + setup + generation/read contract
│   └── story_editor/
│       ├── __init__.py
│       ├── router.py
│       ├── schemas.py
│       ├── service.py
│       ├── ports.py                # AI/validator protocols
│       ├── prompts.py
│       └── diff.py                 # pure canonical diff helpers
└── integrations/
    ├── openai_story_text.py        # extend adapter từ 3B
    └── khmer/
        ├── __init__.py
        ├── baseline.py
        └── validator.py
```

Frontend:

```text
frontend/src/features/story-editor/
├── api.ts
├── types.ts
├── constants.ts
├── useStoryEditor.ts
└── components/
    ├── StoryTextEditor.tsx
    ├── SortablePageList.tsx
    ├── StoryPageCard.tsx
    ├── QuickActions.tsx
    ├── InstructionBox.tsx
    ├── AddPageButton.tsx
    ├── DeletePageDialog.tsx
    ├── ConfirmTextDialog.tsx
    └── SpellcheckFlags.tsx
```

Không để route page sở hữu business state machine hoặc component editor thành một file khổng lồ.

## 8. Canonical read contract

Phase 3C reuse:

```text
GET /api/stories/{story_id}/text
```

Response phải có tối thiểu:

```json
{
  "id": 12,
  "title_vi": "...",
  "title_km": "...",
  "status": "text_draft",
  "length_pref": "medium",
  "text_revision": 3,
  "updated_at": "2026-07-20T10:00:00Z",
  "pages": [
    {
      "id": 101,
      "page_no": 1,
      "text_vi": "...",
      "text_km": "...",
      "spellcheck_flags": [],
      "khmer_validated_at": "2026-07-20T09:59:00Z"
    }
  ]
}
```

- Pages luôn sort `page_no ASC`.
- `text_draft`: editable.
- `text_confirmed` và status sau: read-only.
- `draft`: client về setup.
- `generating_text`: client hiện state của 3B.
- `archived`: không mở editor mutation.

## 9. API contracts

Tất cả endpoints admin-only và dùng `detail` string để tương thích frontend hiện tại.

### 9.1 AI edit

```text
POST /api/stories/{story_id}/text/edits
```

Request là discriminated union; đúng một mode:

```json
{
  "kind": "quick_action",
  "action": "shorten",
  "expected_revision": 3
}
```

hoặc:

```json
{
  "kind": "instruction",
  "instruction_vi": "Làm cao trào rõ hơn nhưng giữ kết thúc hiện tại",
  "expected_revision": 3
}
```

Quick action enum MVP:

```text
shorten | lengthen | more_dramatic | simplify
```

Validation:

- instruction trim và dài `INSTRUCTION_MIN_CHARS=5` đến `INSTRUCTION_MAX_CHARS=1000`;
- reject extra fields;
- không cho cả action và instruction;
- chỉ status `text_draft`;
- mọi quick action phải trả exact source ID set theo exact order hiện tại, không được add/delete/reorder;
- `shorten` rút gọn từng page, `lengthen` viết chi tiết hơn trên page hiện tại; `more_dramatic` và `simplify` cũng giữ cấu trúc;
- custom instruction mặc định giữ cấu trúc, chỉ được add/delete/reorder khi nội dung yêu cầu của admin nói rõ thay đổi đó.

### 9.2 Add page

```text
POST /api/stories/{story_id}/pages
```

```json
{
  "after_page_id": 104,
  "instruction_vi": "Thêm một đoạn chuyển nhẹ trước cao trào",
  "expected_revision": 3
}
```

- `after_page_id` nullable; null nghĩa append.
- Instruction nullable; nếu có phải dài 5–1000 ký tự sau trim.
- AI chỉ sinh Vietnamese text cho page mới dựa trên full story context và dùng `ADD_PAGE_MAX_OUTPUT_TOKENS=1500`.
- Dịch Khmer + validate trước persistence.
- Count không được vượt policy Section 3.3.

### 9.3 Reorder

```text
PUT /api/stories/{story_id}/pages/order
```

```json
{
  "page_ids": [101, 103, 102, 104],
  "expected_revision": 3
}
```

- `page_ids` phải là exact permutation của pages hiện tại.
- Không thiếu/thừa/trùng/foreign ID.
- Reorder không gọi AI và không dịch lại.
- Giữ nguyên row, cặp Việt–Khmer, flags và validation timestamp.

### 9.4 Delete

```text
DELETE /api/stories/{story_id}/pages/{page_id}?expected_revision=3
```

- UI phải confirm trước.
- Không soft-delete page; D07/D15 không có undo/history.
- Không cho count xuống dưới policy.
- Renumber atomically.

### 9.5 Validate Khmer snapshot

```text
POST /api/stories/{story_id}/validate-km
```

```json
{
  "expected_revision": 3
}
```

- Frontend gọi khi canonical response có ít nhất một page `khmer_validated_at=NULL`.
- Endpoint validate toàn bộ page Khmer snapshot hiện tại; tối thiểu baseline validator luôn chạy, advanced adapter chạy nếu khả dụng.
- Không đổi `text_km` hoặc `text_revision`.
- Validator chạy ngoài transaction; final transaction lock story và chỉ ghi flags/timestamp nếu `status=text_draft` và revision vẫn bằng `expected_revision`.
- Nếu revision/status đổi trong lúc validate, bỏ kết quả và trả `409`.
- Update `spellcheck_flags` và `khmer_validated_at` atomically cho toàn bộ page snapshot.
- No-op khi toàn bộ page đã validate có thể trả canonical `StoryTextResponse` ngay.
- `GET /text` không gọi validator và không có side effect.

### 9.6 Retranslate Khmer

```text
POST /api/stories/{story_id}/retranslate-km
```

Dịch lại title:

```json
{
  "target": "title",
  "expected_revision": 3
}
```

Dịch lại một page:

```json
{
  "target": "page",
  "page_id": 101,
  "expected_revision": 3
}
```

Validation request:

- `target` là discriminated union `title | page`;
- `page_id` bắt buộc và phải thuộc story khi `target=page`;
- `page_id` phải absent khi `target=title`;
- reject extra fields/null không hợp lệ.

Semantics:

- Không đổi Vietnamese canonical text.
- `target=title`: dịch lại `title_vi → title_km`.
- `target=page`: dịch lại đúng `text_vi → text_km`, rồi chạy Khmer validator pipeline cho page đó.
- Dùng `RETRANSLATE_MAX_OUTPUT_TOKENS=1500`.
- Retranslate thay đổi canonical Khmer content nên tăng `text_revision` đúng một lần.
- Cập nhật translated content, flags/timestamp liên quan và revision atomically sau final status/revision check.

### 9.7 Confirm text

```text
POST /api/stories/{story_id}/confirm-text
```

```json
{
  "expected_revision": 3,
  "acknowledge_khmer_warnings": true
}
```

Quy tắc:

- `text_draft → text_confirmed`.
- Không gọi image API/job.
- Không tăng `text_revision` vì content không đổi.
- Retry sau response loss trên story đã `text_confirmed` trả canonical success idempotently nếu revision khớp.
- Status sau `text_confirmed` không được “confirm lại” như một mutation.
- Page count chỉ cần nằm trong band đã chọn; không kiểm tra chẵn/lẻ.
- Nếu có flags hoặc page chưa validate, request phải có acknowledgment; warning vẫn không hard-block sau acknowledgment.

### 9.8 Mutation response

Mọi content mutation, gồm retranslate, trả canonical story mới và diff do server tính:

```json
{
  "story": { "id": 12, "text_revision": 4, "pages": [] },
  "changes": {
    "has_changes": true,
    "title_changed": false,
    "edited_page_ids": [101, 103],
    "added_page_ids": [],
    "deleted_page_ids": [102],
    "order_changed": true,
    "before_count": 8,
    "after_count": 7
  }
}
```

Toast được dựng từ diff này. Không tin model tự khai “đã sửa trang nào”. Validate-only endpoint trả canonical `StoryTextResponse`/validation diagnostics và không tạo content diff giả.

### 9.9 Status/error contract

| HTTP | Khi nào |
|---|---|
| 200/201 | Operation thành công; add có thể dùng 201 |
| 401/403 | Auth/role |
| 404 | Story/page không tồn tại |
| 409 | Status locked hoặc `expected_revision` stale |
| 422 | Request, preflight page-count, permutation hoặc xác nhận warning không hợp lệ |
| 502 | AI refusal/incomplete/malformed hoặc output AI vi phạm domain rule |
| 503 | Provider timeout/rate limit/unavailable |
| 500 | Persistence/internal failure an toàn |

No-op content mutation hợp lệ trả `200`, `has_changes=false`, revision không tăng và không gọi translation/persistence thừa. Validate-only no-op cũng giữ nguyên revision.

## 10. AI edit structured contract

### 10.1 Input snapshot

AI nhận:

- immutable story setup/context;
- current title;
- ordered pages với `page_id`, `page_no`, `text_vi`;
- selected characters;
- selected quick action hoặc custom instruction;
- page-count policy và structural-change policy;
- child-safety/content rules.

Quick action prompts bắt buộc giữ exact page IDs/order/count. Custom instruction mặc định cũng giữ cấu trúc; chỉ cho phép structural output khi admin yêu cầu add/delete/reorder rõ ràng. Current story và instruction được delimit như user data; không thể override system constraints. Edit call dùng `EDIT_MAX_OUTPUT_TOKENS=8000`.

### 10.2 Output

```python
class RevisedPageVi(BaseModel):
    source_page_id: int | None
    text_vi: str

class RevisedStoryVi(BaseModel):
    title_vi: str
    pages: list[RevisedPageVi]
```

Semantics:

- Existing page giữ `source_page_id` của chính nó.
- `None` là page mới.
- Omit existing ID nghĩa là xóa page.
- Array order là canonical page order mới.
- Không output `page_no`; server tự đánh `1..N`.
- Không output Khmer/image/character mapping/reasoning.

### 10.3 Server validation

- Mọi non-null source ID thuộc story snapshot.
- Không duplicate source ID.
- Title/page text trim; title tối đa 160 ký tự, page tối đa 1200 ký tự và không vượt hard word max theo target age.
- Count đúng policy.
- Quick action output phải có exact source ID sequence hiện tại; bất kỳ add/delete/reorder nào đều reject như malformed provider output.
- Custom instruction chỉ được chấp nhận structural diff khi instruction của admin yêu cầu thay đổi cấu trúc rõ ràng.
- Không page rỗng.
- Không mutate setup/status/character IDs.
- Không tin model-provided diff.
- Không auto-truncate hoặc tự bỏ page để sửa malformed output.

## 11. Selective translation and persistence

Server diff Vietnamese snapshot:

- Same source ID + same normalized `text_vi`: giữ `text_km`, flags, validated timestamp.
- Same source ID + text đổi: translate lại page đó.
- `source_page_id=None`: translate page mới.
- Existing ID bị omit: delete row.
- Reorder only: không dịch.
- Title đổi: dịch lại `title_km`.

Translate mọi phần changed/new trong **một batch request** khi có thể, không gọi từng page; dùng shared `TRANSLATION_MAX_OUTPUT_TOKENS=8000`.

Nếu translation hoặc validation của bất kỳ changed part thất bại:

- không persist Vietnamese edit;
- không tăng revision;
- canonical story cũ còn nguyên.

## 12. Optimistic concurrency

### 12.1 AI mutation flow

1. Load snapshot `status=text_draft`, revision `N`.
2. Validate request against snapshot.
3. Gọi AI ngoài transaction trong outer operation budget 270 giây.
4. Validate Vietnamese result.
5. Dịch/validate changed Khmer parts ngoài transaction trong cùng operation budget.
6. Mở transaction ngắn và lock story row.
7. Recheck `status=text_draft` và `text_revision=N`.
8. Nếu lệch: rollback và trả `409`; không tự gọi AI lại.
9. Apply title/page changes atomically.
10. Renumber pages an toàn.
11. Set `text_revision=N+1`, update timestamp, commit.

### 12.2 Deterministic mutation flow

Reorder/delete:

- lock row trong transaction ngắn;
- check status/revision/permutation/count;
- apply + revision increment + commit;
- không external call.

### 12.3 Unique page number safety

Do có `UNIQUE(story_id,page_no)`, reorder/renumber phải tránh transient collision:

- gán temporary negative page numbers; hoặc
- dùng một chiến lược SQL hai bước tương đương đã có test PostgreSQL thật.

Không loop update `1 → 2 → 3` trực tiếp rồi hy vọng constraint không va.

### 12.4 Conflict UX

Khi `409 revision conflict`:

- không auto-retry request AI;
- refetch canonical story;
- báo “Truyện vừa được admin khác cập nhật. Nội dung mới nhất đã được tải lại.”;
- giữ custom instruction trong input để admin tự quyết gửi lại.

## 13. Khmer validation strategy

### 13.1 Kết quả nghiên cứu

Không được tiếp tục ghi “`khmercut + khmer-spellchecker`” như một combo Python turnkey:

- `khmercut` là word segmenter, không phải spellchecker; package dùng CRF model và cần dependency spike.
- Smoke install `khmercut==0.1.0` trên Windows/Python 3.11 của workspace đã gặp lỗi encoding trong build metadata; không thêm thẳng vào lockfile.
- Repo `koompi/khmer-spellchecker` chủ yếu là Hunspell dictionary assets, không phải Python package cài dùng trực tiếp; cần kiểm tra engine và license.
- `khmerthings` là candidate Python >=3.11, zero-runtime-dependency, có segmentation/normalization, nhưng hiện classifier Alpha và 0.x thay đổi nhanh.

Vì vậy Phase 3C phải bắt đầu bằng spike, không bắt đầu bằng `uv add khmercut`.

### 13.2 Always-available baseline validator

Baseline không phụ thuộc package ngoài:

- NFC normalization check.
- U+FFFD/disallowed control detection.
- Khmer-script presence.
- ZWSP, Khmer digits/punctuation và mixed Latin name handling.
- Absolute length caps.
- Deterministic offsets trên Unicode code points.

Baseline chỉ kiểm tra tính hợp lệ kỹ thuật, không spelling/grammar.

### 13.3 Dependency spike

So sánh ít nhất:

**Option A — `khmercut` + Hunspell dictionary/engine**

- install/lock Python 3.11 Windows và Linux;
- import/model memory/concurrency;
- token offsets/lossless reconstruction;
- engine/dictionary license;
- proper-name false positives;
- deterministic output.

**Option B — `khmerthings` report-only**

- pin exact version;
- use segmentation/analysis only;
- không auto-apply `normalize_text`;
- test unknown span/wordlist coverage;
- quantify false positives trên corpus.

Acceptance corpus:

- 30–50 câu/page samples;
- tên nhân vật Latin/Khmer;
- Khmer digits/punctuation/ZWSP;
- emoji trước Khmer để test offsets;
- known typo/variant samples;
- human reviewer biết Khmer đánh giá usefulness.

Nếu cả hai option không đạt:

- ship baseline-only;
- để advanced dictionary flags pending;
- không block toàn Phase 3C.

### 13.4 Validator port

```python
class KhmerValidator(Protocol):
    def validate(self, text: str) -> KhmerValidationResult: ...
```

Flag format gợi ý:

```json
{
  "kind": "unknown_token",
  "token": "...",
  "start": 12,
  "end": 18,
  "suggestions": [],
  "source": "baseline|khmerthings|hunspell",
  "source_version": "...",
  "severity": "warning"
}
```

Quy tắc:

- Không auto-correct DB text.
- UI gọi là **từ/ký tự cần kiểm tra**, không gọi chắc chắn “sai chính tả”.
- Proper names có allowlist từ selected characters.
- Adapter import/runtime failure degrade về baseline; không trả 500 và không làm mất autosave.
- Warning không hard-block confirm; dialog bắt admin acknowledge.

## 14. Frontend editor UX

### 14.1 Route behavior

`/admin/stories/[id]/edit`:

- invalid ID: local invalid state, không gọi API.
- `draft`: replace về `/setup`.
- `generating_text`: trạng thái Phase 3B/poll.
- `text_draft`: full editor; nếu có page `khmer_validated_at=NULL`, gọi explicit validate endpoint một lần, không mutate trong GET.
- `text_confirmed` và status sau: read-only preview.
- `archived`: thông báo và link về list.

### 14.2 Header

- Title Việt primary.
- Title Khmer subtitle và action **Dịch lại Khmer** cho title.
- Badge status.
- Page count.
- Length preference label.
- Link “Xem thiết lập” read-only.
- Không cho title textarea/contentEditable.

### 14.3 Page card

- Drag handle rõ ràng.
- `Trang N`.
- Vietnamese primary, 16–18px/medium.
- Khmer subtitle, Noto Sans Khmer, line-height đủ lớn.
- Warning count/list ở mức nhẹ, không làm text khó đọc.
- Nút **Dịch lại Khmer**.
- Nút delete, mở dialog.
- Không có inline text controls.

### 14.4 Quick actions

- **Rút gọn nội dung** (`shorten`).
- **Viết chi tiết hơn** (`lengthen`).
- **Kịch tính hơn** (`more_dramatic`).
- **Đơn giản hơn** (`simplify`).
- Tất cả quick actions giữ nguyên page count và order; backend enforce bằng source ID sequence.
- Pending label cụ thể theo operation; khóa tất cả mutation controls.

### 14.5 Custom instruction

- Một textarea/input “Yêu cầu chỉnh sửa”.
- Mặc định AI giữ page count/order; nếu admin yêu cầu rõ add/delete/reorder thì custom instruction mới được đổi cấu trúc.
- Không có persistent chat transcript.
- Không clear input khi request fail/conflict.
- Clear hoặc giữ recent command theo UX sau success; plan khuyến nghị clear và toast diff.
- Enter/submit accessibility rõ, không double-submit.

### 14.6 Add/delete/reorder

- Add page mặc định append; cho chọn `after_page_id` từ current position nếu UX đơn giản.
- Delete luôn confirm và báo không có undo.
- Dnd-kit dùng pointer/touch/keyboard sensors.
- Có nút lên/xuống làm fallback accessibility.
- Reorder có thể optimistic trên UI, nhưng failure phải rollback/refetch canonical order.
- Không autosave từng drag-over; chỉ save một lần ở drag-end.

### 14.7 Operation/error state

- Một operation pending tại một thời điểm.
- Không fake progress percentage.
- AI failure giữ canonical story cũ và input.
- Revision conflict refetch.
- Frontend abort sau 285 giây; timeout/mất kết nối phải refetch canonical status/revision trước khi cho resend để tránh duplicate.
- Toast lấy từ server diff.

### 14.8 Confirm dialog

Dialog phải nói rõ:

- sau confirm không thể sửa text trong MVP;
- bước này chưa sinh ảnh;
- page count hiện tại;
- số Khmer warnings/pages chưa validated;
- checkbox acknowledge chỉ hiện khi cần.

CTA chính xác: **Xác nhận nội dung**.

Không dùng label cũ **Xác nhận nội dung & Sinh ảnh**.

## 15. Story list và archive

Update CTA:

| Status | CTA |
|---|---|
| `draft` | Tiếp tục thiết lập |
| `generating_text` | Xem trạng thái |
| `text_draft` | Tiếp tục biên tập |
| `text_confirmed` | Xem nội dung |
| status sau | Xem/tiếp tục phase tương ứng khi được triển khai |

Archive `text_draft` được **defer khỏi Phase 3C P0**. Core editor/confirm không mở rộng archive lifecycle.

P1 chỉ làm nếu còn thời gian và được mở scope rõ ràng:

- Mở rộng archive service từ chỉ `draft` sang `draft | text_draft`.
- Editor có archive confirmation.
- AI request đang chạy phải fail final commit nếu story đã archived.
- Không cho archive `generating_text` hoặc status từ `text_confirmed`.

Walkthrough bắt buộc ghi `archive text_draft: deferred P1` nếu chưa triển khai.

## 16. File scope dự kiến

### Backend

- `backend/alembic/versions/004_story_editor_validation.py` — mới.
- `backend/pyproject.toml`, `backend/uv.lock` — chỉ đổi sau Khmer spike hoặc thêm package đã chọn.
- `backend/src/katha/features/stories/models.py` — validation timestamp.
- `backend/src/katha/features/stories/schemas.py` — shared text response nếu cần.
- `backend/src/katha/features/story_editor/__init__.py` — mới.
- `backend/src/katha/features/story_editor/router.py` — mới.
- `backend/src/katha/features/story_editor/schemas.py` — mới.
- `backend/src/katha/features/story_editor/service.py` — mới.
- `backend/src/katha/features/story_editor/ports.py` — mới.
- `backend/src/katha/features/story_editor/prompts.py` — mới.
- `backend/src/katha/features/story_editor/diff.py` — mới.
- `backend/src/katha/integrations/openai_story_text.py` — extend adapter.
- `backend/src/katha/integrations/khmer/*` — mới.
- `backend/src/katha/main.py` — mount router.
- Backend tests cho API/service/diff/validator/migration/integration.

### Frontend

- `frontend/package.json`, lockfile — dnd-kit packages.
- `frontend/src/app/admin/stories/[id]/edit/page.tsx` — upgrade preview.
- `frontend/src/features/story-editor/*` — mới như Section 7.
- `frontend/src/features/stories/types.ts`.
- `frontend/src/features/stories/api.ts`.
- `frontend/src/features/stories/constants.ts`.
- `frontend/src/features/stories/components/StoryListItem.tsx`.
- Setup read-only page thêm link sang editor nếu cần.

### Packages frontend

```text
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

Không thêm state-management library nếu hook/local state hiện tại đủ.

### Docs dev phải đồng bộ

- `plan/01-decisions-log.md` — one-shot command, page policy, warning-only Khmer, confirm separation.
- `plan/02-technical-design.md` — bỏ inline Khmer edit và turnkey spellchecker assumption.
- `plan/03-user-flows.md` — CTA chỉ confirm, không sinh ảnh.
- `plan/04-implementation-plan.md` — tách 3B/3C và endpoint thật.
- `plan/05-research-notes.md` — Khmer package spike evidence.
- `plan/06-project-structure.md` — feature/module thật.
- `plan/07-database-schema.md` — `text_revision` từ 3B + `khmer_validated_at` từ 3C.
- `plan/HANDOFF.md` — tiến độ và Khmer tooling trung thực.
- File plan 3B/3C — checklist/evidence.

## 17. Trình tự implementation

### Step 0 — Product/package preflight

- Phase 3B accepted.
- Verify constants/tests dùng page policy đã chốt ở Section 3.3.
- Chạy Khmer dependency spike, không sửa lockfile production trước kết luận.
- Xác nhận có/không có native Khmer reviewer.

### Step 1 — Migration/shared contract

- Migration 004.
- ORM/read response thêm validation timestamp.
- Migration graph/lifecycle tests.

### Step 2 — Editor domain/API skeleton

- Schemas/discriminated union.
- Revision/status guards.
- Canonical diff helpers.
- Router admin auth.
- Contract tests trước provider implementation.

### Step 3 — AI revise/add/retranslate

- Structured revise output với source IDs và quick-action exact-sequence guard.
- Add-page prompt/output.
- Selective translation.
- Retranslate title/page qua endpoint chung.
- Provider error normalization.
- Atomic persistence + revision checks.

### Step 4 — Deterministic page mutations

- Exact permutation reorder.
- Delete + min policy.
- Safe renumber với unique constraint.
- No-op behavior.

### Step 5 — Khmer validator pipeline

- Baseline validator.
- Adapter cho option thắng spike hoặc baseline-only fallback.
- Explicit `/validate-km` bootstrap cho page cũ có timestamp NULL.
- Flags/timestamp update không tăng text revision.
- Degradation và revision-race tests.

### Step 6 — Frontend editor shell

- Feature hook/API/types.
- Loading/error/read-only/status states.
- Bilingual page cards.
- Operation state machine.

### Step 7 — Frontend interactions

- Quick actions.
- Custom instruction.
- Add/delete.
- Dnd reorder + keyboard/fallback.
- Validate bootstrap và retranslate title/page.
- Warnings/conflict/refetch/toasts.

### Step 8 — Confirm/lock

- Confirm endpoint validations/idempotency.
- Dialog + acknowledgment.
- Read-only transition.
- Story list CTA.
- Ghi rõ archive `text_draft` deferred P1; không kéo vào P0.

### Step 9 — Offline verification/docs

- Backend quality/test gates.
- Frontend lint/type/build.
- Docs sync and stale-reference checks.
- Walkthrough with exact deferred boundary.

### Step 10 — Deferred Docker/live/linguistic QA

- PostgreSQL concurrency/migration suite.
- Limited live AI edit/retranslate smoke.
- Khmer corpus/native review.

## 18. Backend test matrix bắt buộc

### Auth/status/contracts

- 401/403/404 cho mọi endpoint.
- Cross-admin edit được phép.
- Mọi mutation chỉ cho `text_draft`.
- Mọi mutation sau confirm trả 409.
- Extra fields/null/empty request bị reject.
- Quick action enum và label mapping đúng.
- Custom instruction trim/cap/exclusive mode.
- `validate-km` và `retranslate-km` request reject extra/null/invalid union fields.

### AI edit

- Valid full snapshot.
- Refusal/incomplete/malformed output.
- Blank title/page.
- Duplicate/foreign source IDs.
- Quick action exact ID sequence giữ nguyên count/order; structural output bị reject.
- Custom instruction không yêu cầu cấu trúc nhưng model omit/add/reorder page thì bị reject.
- Custom instruction yêu cầu rõ add/delete/reorder được apply đúng.
- Count ngoài policy.
- Title/page char caps và hard word max theo target age.
- No-op không tăng revision/call translation.
- Title change dịch lại title Khmer.
- Unchanged pages giữ Khmer/flags/timestamp.
- Changed/new pages được translate/validate.
- Translation failure không persist Vietnamese partial.

### Add/reorder/delete

- Add at end/after valid page.
- Invalid/foreign insertion point.
- Add vượt max.
- Reorder exact permutation.
- Missing/duplicate/foreign IDs rejected.
- Reorder giữ text/flags/timestamp.
- Reorder no-op.
- Delete existing/not-found.
- Delete chạm min rejected.
- Renumber failure rollback.
- Unique constraint không va transient.

### Validate/retranslate Khmer

- Validate endpoint chạy toàn bộ page cũ có snapshot hợp lệ và không tăng revision.
- Validate no-op khi mọi page đã validate.
- Validate race với content mutation trả 409 và không ghi flags/timestamp stale.
- `GET /text` không gọi validator và không ghi DB.
- Retranslate title không đổi `title_vi`, tăng revision đúng một lần.
- Retranslate page không đổi `text_vi`, tăng revision đúng một lần.
- `target=page` thiếu/foreign `page_id` và `target=title` có `page_id` bị reject.
- Normal Khmer.
- ZWSP, Khmer digits/punctuation.
- Mixed Latin proper names/allowlist.
- Emoji trước Khmer offsets.
- Vietnamese-only leak/U+FFFD/control chars.
- Deterministic flags.
- Adapter import/runtime/timeout failure degrade baseline, không 500.
- Không auto-correct persisted text.
- Timestamp/flags luôn cùng phiên bản `text_km`.

### Concurrency/transaction

- Hai requests cùng revision: chỉ một persist; request còn lại 409.
- AI edit race với reorder/delete.
- AI edit race với confirm.
- AI edit race với archive chỉ bắt buộc nếu P1 được triển khai.
- Validate/retranslate race với edit/reorder/confirm.
- Stale result không ghi đè canonical state.
- DB failure rollback toàn bộ.
- Revision tăng đúng một lần trên successful content mutation.

### Confirm

- Missing title VI/KM.
- Missing/blank page VI/KM.
- Non-contiguous page number.
- Count ngoài band bị reject; odd count trong band confirm thành công.
- Warning/unvalidated không acknowledgment.
- Warning acknowledgment success.
- `text_draft → text_confirmed`.
- Response-loss retry idempotent.
- Không gọi image/provider trong confirm.

## 19. Frontend/manual verification

Nếu chưa có frontend test runner, không bắt buộc mở thêm framework chỉ để hoàn thành 3C. Bắt buộc:

- `npm run lint`.
- `npx tsc --noEmit`.
- `npm run build`.
- Manual/static checklist:
  - invalid ID/loading/error/retry/not-found;
  - editor chỉ full-control ở `text_draft`;
  - quick-action label mới, pending/error/success và không đổi count/order;
  - instruction giữ lại khi fail/conflict;
  - không double-submit;
  - add placement và max boundary;
  - delete dialog và min boundary;
  - drag desktop/touch;
  - keyboard/nút lên-xuống fallback;
  - reorder save một lần ở drag-end;
  - conflict refetch canonical state;
  - validate bootstrap chỉ chạy explicit khi timestamp NULL;
  - Khmer warning/retranslate title/page;
  - Khmer glyph/line-height không bị cắt;
  - confirm acknowledgment/read-only transition;
  - CTA list theo status;
  - không có nút “Sinh ảnh” trong Phase 3C.

## 20. Quality gates

### Code-complete offline — Core P0

- [x] Phase 3B accepted.
- [x] Page policy được chốt/ghi rõ.
- [x] Migration 004 + single head pass offline graph checks.
- [x] Editor API contracts/auth/status guards pass.
- [x] Quick actions giữ exact count/order; custom instruction structural guard pass với fake provider.
- [x] Add/delete/reorder/retranslate title/page pass.
- [x] Validate-km bootstrap cập nhật flags/timestamp mà không tăng revision.
- [x] Revision conflicts không overwrite.
- [x] Translation failure không tạo bilingual drift.
- [x] Baseline Khmer validator luôn chạy được.
- [x] P0 không pin advanced adapter; dependency boundary luôn fallback baseline.
- [x] Warnings không auto-correct hoặc hard-block sau acknowledgment.
- [x] Confirm chỉ chuyển `text_confirmed`, không gọi image.
- [x] Frontend editor đủ loading/error/conflict/read-only states.
- [x] Dnd + accessibility fallback có mặt.
- [x] Backend Ruff/format/mypy/offline tests pass.
- [x] Frontend lint/TypeScript/build pass.
- [x] Lockfile và secret/diff checks pass.
- [x] Docs không còn hai mâu thuẫn CTA/inline Khmer.

### P1 nếu deadline cho phép

- [ ] Archive `text_draft`.
- [ ] Advanced dictionary/segmentation adapter vượt spike/corpus threshold.

P1 chưa đạt không được giả là đã hoàn thành; baseline warning flow vẫn là DoD hợp lệ nếu ghi rõ.

### Docker-deferred

- [ ] Migration 001 → 002 → 003 → 004 và downgrade pass.
- [ ] PostgreSQL exact-permutation/renumber tests pass.
- [ ] Revision race tests pass trên DB thật.
- [ ] Full edit/add/delete/reorder/validate/retranslate/confirm integration pass.

### Live/linguistic-deferred

- [ ] Một live quick action.
- [ ] Một live custom instruction.
- [ ] Một add-page, validate bootstrap và retranslate title/page smoke.
- [ ] OpenAI failures không lộ raw data/secrets.
- [ ] Khmer output sample được native speaker review.
- [ ] Validator false-positive rate trên corpus được ghi lại.

## 21. Definition of Done

Phase 3C được gọi là **code-complete offline** khi:

- Admin biên tập canonical story bằng quick action/one-shot instruction.
- Quick actions giữ nguyên page count/order; structural custom edit chỉ xảy ra khi admin yêu cầu rõ.
- Admin add/delete/reorder, validate Khmer bootstrap và retranslate title/page được theo policy.
- Không có inline edit hoặc history/undo bị thêm ngoài scope.
- Mỗi successful content mutation auto-save atomically và tăng revision đúng; validate-only không tăng revision.
- Concurrent/stale request không ghi đè nội dung admin khác.
- Việt và Khmer không bao giờ persist lệch phiên bản do partial failure.
- Khmer warning được trình bày trung thực như hỗ trợ review.
- Admin confirm được sau dialog/acknowledgment.
- Confirm khóa text và chỉ chuyển `text_confirmed`.
- Image pipeline hoàn toàn chưa chạy.
- Archive `text_draft` được ghi rõ deferred P1 nếu chưa làm.
- Offline gates xanh; Docker/live/native review pending được ghi chính xác.

## 22. Evidence dev phải bàn giao

- Commit hash và exact changed-file list.
- Migration 004/down_revision + `alembic heads`.
- Page policy cuối cùng và test evidence.
- API contracts/request examples/status table.
- Khmer dependency spike report:
  - package/version/license;
  - Windows/Linux install outcome;
  - corpus/false-positive result;
  - quyết định pin hay baseline-only.
- Tests chứng minh quick action không đổi page count/order và custom structural guard đúng.
- Tests chứng minh selective translation.
- Tests chứng minh validate-only không tăng revision và không ghi stale metadata.
- Tests chứng minh retranslate title/page tăng revision đúng một lần.
- Tests chứng minh no bilingual partial save.
- Tests chứng minh stale revision 409/no overwrite.
- Tests chứng minh confirm không gọi image API.
- Output backend quality/offline tests.
- Output frontend lint/type/build.
- Manual editor/drag/Khmer/confirm checklist.
- Danh sách Docker/live/native-review checks còn deferred.
- Không paste token, API key, raw full story/prompt hoặc sensitive provider data.

## 23. Review blockers

Reviewer reject Phase 3C nếu có một trong các lỗi:

- Router/component gọi OpenAI trực tiếp.
- AI mutation giữ DB transaction trong network call.
- Không có revision check sau AI response.
- Stale AI output có thể overwrite story mới.
- Persist Vietnamese edit trước khi Khmer translation thành công.
- Reorder làm mất cặp Việt–Khmer/flags hoặc va unique constraint.
- Model được tin để tự khai diff/source IDs mà server không validate.
- Quick action có thể add/delete/reorder hoặc custom instruction tự đổi cấu trúc khi admin không yêu cầu rõ.
- Validate-km tạo side effect trong GET, tăng revision hoặc ghi metadata từ snapshot stale.
- Không có đường retranslate title Khmer.
- Chat history/edit log/version table được thêm ngoài quyết định.
- Có inline edit trái D07.
- Khmer tooling được mô tả là grammar/spelling proof.
- Validator auto-correct text hoặc false-positive chặn workflow.
- Confirm tự sinh/enqueue ảnh khi G2/G4 chưa chốt.
- CTA vẫn ghi “Xác nhận nội dung & Sinh ảnh”.
- Story mutation sau `text_confirmed` vẫn được phép.
- Frontend chỉ khóa nút nhưng backend không status/revision guard.

## 24. Handoff sang Phase 4

Phase 4 chỉ bắt đầu sau khi:

- Story ở `text_confirmed`.
- Title và pages Việt/Khmer đã khóa.
- Page order/count là canonical.
- G2 đã chốt character-per-page strategy.
- G4 đã chốt image job/retry/progress strategy.

Phase 4 chịu trách nhiệm:

- tạo `text_en`/image prompts từ Vietnamese canonical text;
- page-character mapping theo G2;
- image generation/job/progress theo G4;
- R2 upload và image review.

Không đưa bất kỳ phần nào của các việc này ngược vào Phase 3C.

## 25. Nguồn kỹ thuật đã đối chiếu

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
- [Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses).
- [Official OpenAI Python SDK](https://github.com/openai/openai-python).
- [GPT-4o mini model](https://developers.openai.com/api/docs/models/gpt-4o-mini).
- [khmercut on PyPI](https://pypi.org/project/khmercut/).
- [khmercut source](https://github.com/seanghay/khmercut).
- [KOOMPI Khmer spellchecker assets](https://github.com/koompi/khmer-spellchecker).
- [khmerthings on PyPI](https://pypi.org/project/khmerthings/).
