# Phase 5 — Human Review, Publish & Public Reader Implementation Plan

> Trạng thái: **READY FOR DEV**
> Ngày lập: 2026-07-22; cập nhật quyết định reader/share/mobile: 2026-07-23
> Baseline triển khai: Phase 4 code-complete offline, Alembic head `005`; dev phải ghi commit hiện hành khi bắt đầu
> Alembic head hiện tại: `005`
> Phạm vi: hoàn tất human-in-the-loop, publish và public reader của Katha MVP
> Nguyên tắc báo cáo: tách riêng **code-complete offline**, **PostgreSQL verified**, **live OpenAI/R2 verified**, **browser accepted** và **deployed**

---

## 1. Kết luận PM

Phase 5 hoàn tất toàn bộ **core feature flow** của MVP:

```text
Tạo story
  -> sinh/sửa/chốt text
  -> lập kế hoạch và sinh ảnh
  -> human review từng trang
  -> hoàn tất duyệt story
  -> publish và tạo liên kết chia sẻ không niêm yết
  -> học sinh mở liên kết, không cần tài khoản
```

Sau khi Phase 5 code-complete, dự án được xem là **feature-complete cho MVP**, nhưng chưa được gọi là hoàn tất tuyệt đối:

- Phase 6 vẫn còn full E2E, security/performance review, cấu hình môi trường, deploy và production smoke.
- Phase 7 vẫn còn tạo bộ truyện nghiên cứu, reviewer rubric, thu thập số liệu và báo cáo NCKH.
- Các gate PostgreSQL/live OpenAI/R2/browser của Phase 4 đang deferred vẫn phải chạy thật. Có thể chạy song song với Phase 5 nhưng không được ghi là đã verify nếu chỉ có mock hoặc collect-only.

Không còn câu hỏi sản phẩm chặn dev bắt đầu Phase 5.

---

## 2. Baseline và các ràng buộc phải giữ

### 2.1 Phase 4 bàn giao

Dev phải coi các invariant sau là baseline, không viết lại tùy ý:

- Story chỉ tới `pending_review` sau khi mọi content page có ảnh hoàn tất.
- `story_pages.image_prompt_en`, `image_character_ids`, `image_url`, `image_status`, attempt/error metadata đã được persist.
- Image mapping đã khóa sau lần bắt đầu sinh ảnh đầu tiên.
- Runner dùng UUID claim + heartbeat + PostgreSQL DB clock và fence mọi write/finalize.
- R2 dùng immutable WebP object key; provider/R2/DB ACK-loss đã có recovery contract.
- Cover không thuộc `story_pages`, không được sinh AI và không tính vào số ảnh nội dung.
- Phase 4 hiện code-complete offline; PostgreSQL integration, live OpenAI/R2 và browser matrix chưa được xem là pass.

### 2.2 Schema và kiến trúc

- Giữ đúng **7 bảng MVP**; Phase 5 không tạo bảng mới.
- Tiếp tục feature-based architecture; không dồn toàn bộ logic vào `stories/service.py`, `StoryImageWorkspace.tsx` hoặc một component lớn.
- Supabase Auth chỉ bảo vệ admin API/UI; reader và public API không yêu cầu login.
- Public reader chỉ truy cập qua opaque bearer link; không có catalogue, search hoặc endpoint liệt kê truyện công khai.
- URL public không chứa internal story ID; stop-sharing phải làm link đọc cũ trả `404`.
- Mọi admin thấy và có thể thao tác mọi story theo D28.
- Không có history/undo/edit log/usage log trong MVP.
- Không hard-code giá một ảnh hay tổng chi phí; giá phụ thuộc provider/model/config tại thời điểm chạy.

### 2.3 Ngoại lệ mới đối với text lock

Quy tắc cũ “text khóa sau `text_confirmed`” phải được làm rõ:

- Vẫn khóa tuyệt đối: `title_vi`, `text_vi`, `text_en`, setup, số trang, thứ tự trang, image scene, prompt gốc, character mapping và art style.
- Chỉ cho sửa thủ công `title_km` và `story_pages.text_km` khi story ở `pending_review`.
- Khmer-only edit không rebuild image plan, không mở mapping và không tự sinh lại ảnh.
- `approved`, `published` và `archived` là read-only đối với content.

---

## 3. Product decisions đã chốt cho Phase 5

Dev phải ghi D36–D42 và D49–D51 vào `plan/01-decisions-log.md`. D43–D48 đã được Phase 4.5 reserve, không được dùng lại.

### D36 — Human review theo từng content page

- Mỗi page được duyệt đồng thời trên ảnh và Khmer.
- Khmer là nội dung chính; Vietnamese chỉ đọc để đối chiếu.
- `review_status`: `pending | approved | rejected`.
- Approve/reject page cuối không tự đổi story sang `approved`.

### D37 — Controlled Khmer edit trong review

- Chỉ `title_km` và `text_km` được sửa ở `pending_review`.
- Sửa page Khmer tăng `text_revision` đúng một lần, clear Khmer validation metadata và reset riêng page đó về `pending`.
- Sửa title Khmer tăng `text_revision`, nhưng không reset các page đã duyệt vì title không thuộc page.
- Validator vẫn warning-only; admin có thể approve sau khi xác nhận rõ warning/unvalidated state.

### D38 — Explicit complete-review action

- Tất cả page approved chỉ làm CTA **Hoàn tất duyệt truyện** khả dụng.
- Chỉ action riêng mới chuyển `pending_review -> approved`.
- Backend phải lock và kiểm tra lại canonical state; frontend state không phải authority.

### D39 — Regenerate đúng một rejected page

- Chỉ page `rejected` có lý do mới được regenerate.
- Effective prompt = prompt gốc đã khóa + rejection reason trong section cố định.
- Không sửa prompt gốc, mapping hoặc reference selection.
- Chỉ một manual regeneration hoạt động trên một story tại một thời điểm.
- Không hard-code chi phí; modal chỉ nói rõ đây là một image operation có thể phát sinh phí.

### D40 — Safe image replacement, không version history

- URL/ảnh cũ vẫn là canonical preview trong khi provider/upload chạy.
- Chỉ swap DB sang URL mới sau khi upload thành công và ownership còn hợp lệ.
- Chỉ sau khi chứng minh DB đã commit URL mới mới best-effort delete object cũ.
- Không có image history, rollback hoặc undo trong MVP.

### D41 — Cover code template

- Cover là component React/Tailwind/SVG dùng chung cho admin share preview và reader.
- Dùng ảnh content page 1 làm visual background khi hợp lệ; có deterministic gradient/SVG fallback.
- Cover có cả hai title; ngôn ngữ đang chọn là title chính, title còn lại là phụ. Text là HTML thật để responsive và accessible.
- Không gọi AI, không upload cover, không ghi `cover_image_url`; field này vẫn nullable/reserved cho future export.

### D42 — Publish/public/archive lifecycle

- `approved -> published` chỉ qua confirmation action và tạo active share token trong cùng transaction.
- Published content vẫn finalized/read-only; trạng thái chia sẻ active/inactive tách khỏi content lifecycle.
- `Ngừng chia sẻ` clear active token nhưng giữ `status=published`; không reopen content và không xóa DB/R2.
- Chia sẻ lại phải sinh fresh token; link cũ tiếp tục `404` theo xác suất an toàn 256-bit. Archive cũng revoke active token trong cùng transaction.
- Public reader chỉ thấy exact `published` story có active token; malformed/revoked/inactive/archived/nonexistent đều trả cùng `404`.

### D49 — Unlisted opaque reader link

- Reader không cần tài khoản; ai có link đều đọc được, nhưng story không được niêm yết trong catalogue hay public search.
- Token do server sinh bằng `secrets.token_urlsafe(32)`: 32 random bytes, base64url case-sensitive dài 43 ký tự, không chứa story ID.
- MVP lưu raw token để admin copy lại sau reload và retry sau ACK-loss trả đúng link cũ. Application error/audit/report không ghi raw token; access-log redaction là gate riêng ở 11.2/Phase 6.
- Route public chuẩn là `/stories/[shareToken]`; backend chỉ trả relative path để frontend ghép với current/canonical app origin.

### D50 — Reader ảnh ngang và chuyển ngôn ngữ

- Mọi viewport dùng một cột: ảnh landscape 16:9 ở trên, text ở dưới; không dùng desktop split image/text và không ép xoay điện thoại.
- Reader mặc định Khmer. Toggle `ខ្មែរ / Tiếng Việt` chỉ hiển thị một body language tại một thời điểm và giữ nguyên page khi đổi.
- Cover vẫn có cả hai title; ngôn ngữ đang chọn là primary. Lựa chọn được giữ khi chuyển trang và có thể lưu local preference.

### D51 — Mobile admin capability policy

- Mobile compact là viewport có `width < 768px` hoặc `height < 600px`; phone xoay ngang vẫn giữ quick-create, list/resume, progress, recovery và share-link actions.
- Deep text edit, add/delete/reorder, image mapping, Khmer deep edit và review/regeneration decisions chỉ bật khi usable canvas có cả `width >= 768px` và `height >= 600px`.
- Backend không khóa theo thiết bị. Mobile mở direct deep route nhận read-only summary/progress và hướng dẫn mở tablet/máy tính.

---

## 4. Scope

### 4.1 P0 bắt buộc

- Admin review workspace cho toàn bộ content pages.
- Edit Khmer title/page với optimistic concurrency.
- Approve/reject từng page; reject bắt buộc reason.
- Regenerate đúng một rejected page với safe old-image swap.
- Explicit complete-review.
- Publish, tạo/copy/mở/ngừng/chia sẻ lại opaque link và archive downstream.
- Public bilingual reader không login, chỉ qua unlisted link; không có catalogue.
- Reader ảnh 16:9 trên, text dưới, Khmer mặc định và toggle Khmer/Việt.
- Mobile admin quick-create/progress/recovery/share actions; deep-edit policy rõ cho tablet/desktop.
- Cover code template.
- Backend/frontend automated tests, PostgreSQL integration tests và manual acceptance matrix.
- Đồng bộ documentation/handoff.

### 4.2 Ngoài scope Phase 5

- Bulk approve/reject/regenerate.
- Parallel manual regeneration trong cùng story.
- Sửa Vietnamese/English/structure/setup/prompt/mapping sau `text_confirmed`.
- Full manual image prompt editor.
- Regenerate toàn bộ story từ review.
- Image/review version history, undo hoặc rollback UI.
- AI-generated cover hoặc cover asset upload.
- Reopen approved/published content hoặc restore archived story; stop-sharing không phải reopen.
- Public catalogue/discovery/search, social feed, favorite, comment, QR, PDF/download.
- Reader account, bookmark, lưu tiến độ đọc.
- Audio/TTS, page-flip vật lý phức tạp, offline PWA.
- Durable queue/Celery/Redis hoặc multi-instance global orchestration.
- NCKH rubric/data collection của Phase 7.
- Production deployment của Phase 6.

---

## 5. Canonical state machine

```text
pending_review
  |-- edit Khmer title/page --------------------------> pending_review
  |-- approve/reject one page ------------------------> pending_review
  |-- regenerate one rejected page ------------------> generating_images
  |                                                       |
  |                                                       |-- success -> pending_review
  |                                                       `-- failure -> pending_review
  |-- complete-review, only all pages approved ------> approved
  `-- archive ----------------------------------------> archived

approved
  |-- publish + create share link --------------------> published + share active
  `-- archive ----------------------------------------> archived

published
  |-- stop sharing -----------------------------------> published + share inactive
  |-- create new share link --------------------------> published + share active
  `-- archive ----------------------------------------> archived + share inactive
```

Quy tắc:

- `pending_review -> approved` không bao giờ tự động.
- Manual regeneration tạm dùng `generating_images` để tái sử dụng claim/heartbeat/runner Phase 4.
- `stories.active_image_regeneration_page_id` phân biệt manual regeneration với initial image generation; frontend và finalizer không được suy đoán chỉ từ `status`.
- Trong lúc manual regeneration chạy, review workspace vẫn xem được canonical data nhưng mọi review/content mutation bị disable. MVP ưu tiên một workflow tuần tự, tránh race giữa edit/approve/regenerate.
- Initial generation failure vẫn trở về `text_confirmed` như Phase 4.
- Manual regeneration success hoặc failure đều trở về `pending_review` và clear claim/heartbeat/active target.
- `approved`, `published`, `archived` không quay ngược về `pending_review` trong MVP.
- Share state không được mã hóa bằng cách đưa `published` về `approved`; content status và khả năng truy cập link là hai concern riêng.
- Published active phải có đúng một token; published inactive có token null. Stop/archive clear token atomically; re-share sinh fresh token và không chủ động reuse token cũ.
- Với schema 7 bảng, MVP không lưu toàn bộ revoked-token history; cam kết là entropy 256-bit + operational old-link `404`, không phải chứng minh toán học rằng mọi token lịch sử vĩnh viễn không thể trùng.

---

## 6. Kiến trúc feature

### 6.1 Backend

```text
backend/src/katha/features/
├── story_review/
│   ├── __init__.py
│   ├── schemas.py
│   ├── service.py
│   ├── prompts.py
│   ├── runner.py              # thin review-regeneration orchestration
│   ├── dependencies.py
│   └── router.py
└── public_stories/
    ├── __init__.py
    ├── schemas.py
    ├── service.py
    └── router.py
```

Nguyên tắc:

- `story_review` sở hữu review/KM edit/complete-review/publish/manual regeneration.
- `public_stories` chỉ đọc projection public an toàn.
- Reuse provider, storage, image validation, timeout budget, global semaphore và claim helpers của Phase 4 qua các hàm/port nhỏ có contract rõ.
- Không copy-paste một runner thứ hai hoàn toàn độc lập.
- Không gọi trực tiếp runner Phase 4 hiện tại nếu chưa refactor finalizer để phân biệt initial và review regeneration.
- Không giữ DB transaction hoặc row lock xuyên qua OpenAI/R2 call.

### 6.2 Frontend

```text
frontend/src/features/
├── story-review/
│   ├── api.ts
│   ├── types.ts
│   ├── constants.ts
│   ├── useStoryReview.ts
│   └── components/
│       ├── StoryReviewWorkspace.tsx
│       ├── ReviewProgress.tsx
│       ├── ReviewPageCard.tsx
│       ├── KhmerTextEditor.tsx
│       ├── SpellcheckReview.tsx
│       ├── ReviewDecisionControls.tsx
│       ├── RejectPageDialog.tsx
│       ├── RegenerateImageDialog.tsx
│       ├── CompleteReviewDialog.tsx
│       ├── PublishStoryDialog.tsx
│       ├── ShareLinkPanel.tsx
│       └── StopSharingDialog.tsx
└── reader/
    ├── api.ts
    ├── types.ts
    ├── usePublicStory.ts
    └── components/
        ├── StoryCover.tsx
        ├── StoryReader.tsx
        ├── ReaderPage.tsx
        ├── ReaderLanguageToggle.tsx
        └── ReaderControls.tsx
```

Routes:

```text
/admin/stories/[storyKey]/review   # admin human review
/                            # giữ admin entry/landing hiện hành; không fetch catalogue
/stories/[shareToken]        # unlisted public reader, không login
/login                       # admin login giữ nguyên
```

Không mở rộng `StoryImageWorkspace` thành review/reader all-in-one component.

---

## 7. Migration 006 — Review/Publish hardening

Tên gợi ý:

```text
006_story_review_publish.py
```

Không thêm bảng mới.

### 7.1 Cột mới trên `stories`

```text
active_image_regeneration_page_id integer NULL
published_at                      timestamptz NULL
public_share_token                varchar(43) NULL
public_share_revision             integer NOT NULL DEFAULT 0
public_share_activated_at         timestamptz NULL
public_share_revoked_at           timestamptz NULL
```

Mục đích:

- `active_image_regeneration_page_id` persist chính xác page target của manual regeneration, giúp stale resume, direct-route guard và finalizer không nhầm initial job.
- `published_at` lưu thời điểm content được publish bằng PostgreSQL clock; không dùng làm public sort key vì không có catalogue.
- Share fields biểu diễn một active unlisted link độc lập với content status.

Yêu cầu:

- Giữ cột target là integer không FK để tránh tạo vòng FK `stories -> story_pages -> stories` trong schema MVP.
- Mọi write phải lock story/page và xác minh target tồn tại, thuộc đúng story; application invariant này phải có test PostgreSQL.
- Constraint: active target chỉ được non-null khi story ở `generating_images` và claim/heartbeat đều non-null.
- Initial generation có active target null.
- Manual success/failure/fenced reset phải clear active target cùng claim/heartbeat trong một transaction.
- `status='published'` yêu cầu `published_at IS NOT NULL`; archived story có thể giữ `published_at` để bảo toàn audit metadata.
- Nếu có legacy published row, backfill `published_at` từ `updated_at`, rồi `created_at`, rồi DB clock; không dùng app clock.
- Legacy published row giữ `public_share_token=NULL` để không vô tình expose dữ liệu; admin phải chủ động tạo link.
- Partial unique index trên `public_share_token WHERE public_share_token IS NOT NULL` là authority chống collision.
- Constraint: revision không âm; active token phải đúng regex `^[A-Za-z0-9_-]{43}$`, có `status='published'`, `activated_at` non-null và `revoked_at` null.
- Non-published story không được giữ active token. Published story được phép token null sau `Ngừng chia sẻ`.

### 7.2 Harden `story_pages.review_status`

- Normalize an toàn `review_status IS NULL -> 'pending'` chỉ khi review metadata đều null.
- Nếu row legacy mâu thuẫn metadata, migration hard-fail với thông báo actionable; không silently xóa lịch sử.
- Đặt `review_status NOT NULL DEFAULT 'pending'`.
- Giữ enum check `pending | approved | rejected`.
- Thêm metadata constraint:

```text
pending  => reviewed_by NULL, reviewed_at NULL, review_notes NULL
approved => reviewed_by NOT NULL, reviewed_at NOT NULL, review_notes NULL
rejected => reviewed_by NOT NULL, reviewed_at NOT NULL,
            char_length(btrim(review_notes)) BETWEEN 5 AND 500
```

### 7.3 Migration safety

- Upgrade/downgrade đối xứng.
- Downgrade phải drop share/token index và check constraint trước khi drop column; không tạo cyclic FK cho active target.
- Không chạy lifecycle migration trong transaction/session đang giữ application DML.
- Chỉ một Alembic head `006`.
- Viết offline graph test và PostgreSQL lifecycle/constraint tests.
- Migration không được gọi OpenAI, R2 hoặc phụ thuộc credentials.
- PostgreSQL tests phải cover token uniqueness/format/status constraint, legacy published inactive và lifecycle stop/re-share/archive.

---

## 8. Admin API contract

Tất cả endpoint dưới đây bắt buộc `get_admin_user`; frontend guard chỉ phục vụ UX.

### 8.1 Canonical review state

```http
GET /api/stories/{story_id}/review
```

Cho phép đọc ở:

- `pending_review`;
- `generating_images` khi `active_image_regeneration_page_id` non-null;
- `approved`;
- `published`.

Response tối thiểu:

```json
{
  "story": {
    "id": 42,
    "title_vi": "...",
    "title_km": "...",
    "status": "generating_images",
    "text_revision": 7,
    "target_age": "early_primary",
    "genre": {"id": 1, "name_vi": "...", "name_en": "..."},
    "published_at": null
  },
  "progress": {
    "total": 8,
    "pending": 5,
    "approved": 2,
    "rejected": 1
  },
  "job": {
    "kind": "review_regeneration",
    "active_page_id": 123,
    "is_running": true,
    "is_stale": false,
    "can_resume": false
  },
  "share": {
    "active": false,
    "revision": 0,
    "token": null,
    "path": null,
    "activated_at": null,
    "revoked_at": null
  },
  "capabilities": {
    "can_edit_khmer": false,
    "can_review_pages": false,
    "can_complete_review": false,
    "can_publish": false,
    "can_create_share_link": false,
    "can_revoke_share_link": false,
    "can_archive": false,
    "read_only": true
  },
  "pages": []
}
```

Mỗi page trả:

- `id`, `page_no`;
- `text_km`, `text_vi`;
- `spellcheck_flags`, `khmer_validated_at`;
- `image_url`, `image_status`, `image_attempt_count`, sanitized `image_error_code`;
- `review_status`, `review_notes`, `reviewed_at`;
- capability per page.

Không cần trả claim UUID, raw provider error, `text_en`, raw image prompt hoặc character reference URL cho review UI.

Share token/path chỉ có trong admin-authenticated response. Backend trả relative `path`, không hard-code frontend origin. GET phải side-effect free.

### 8.2 Sửa Khmer title

```http
PATCH /api/stories/{story_id}/review/title-km
```

```json
{
  "text_km": "...",
  "expected_text_revision": 7
}
```

Rules:

- Chỉ `pending_review`, không active regeneration.
- Trim, NFC normalize và reuse Khmer script/control-character validation hiện có.
- Nonblank, tối đa 160 ký tự.
- Lock story, match expected revision, tăng revision đúng một lần.
- Không reset page approvals và không thay bất kỳ image field nào.
- Trả canonical review response.

### 8.3 Sửa Khmer page

```http
PATCH /api/stories/{story_id}/pages/{page_id}/review/text-km
```

```json
{
  "text_km": "...",
  "expected_text_revision": 7
}
```

Rules:

- Chỉ `pending_review`, không active regeneration.
- Page phải thuộc story.
- Trim/NFC/Khmer validation; nonblank, tối đa 1,200 ký tự.
- Lock story rồi page; match revision.
- Tăng `text_revision` đúng một lần.
- Set page `review_status=pending`.
- Clear `reviewed_by`, `reviewed_at`, `review_notes`, `spellcheck_flags`, `khmer_validated_at`.
- Giữ nguyên image URL/status/attempt/prompt/mapping và toàn bộ Vietnamese/English.
- Trả canonical review response.

### 8.4 Chạy lại Khmer validator

Reuse:

```http
POST /api/stories/{story_id}/validate-km
```

- Mở rộng contract có kiểm soát để chấp nhận `pending_review` ngoài `text_draft`.
- Vẫn dùng `expected_revision`.
- GET không được tự validate.
- Validate-only không tăng `text_revision` và không thay `review_status`.
- Warning/unvalidated không tự động reject content.
- Khi approve một page còn warning hoặc chưa validate, request phải có explicit acknowledgment; UI phải hiển thị cảnh báo rõ.
- Không mở lại các edit/retranslate/structure endpoint Phase 3C cho downstream status.

### 8.5 Approve/reject một page

```http
PUT /api/stories/{story_id}/pages/{page_id}/review
```

```json
{
  "decision": "approve",
  "acknowledge_khmer_warnings": true,
  "expected_text_revision": 7,
  "expected_review_status": "pending",
  "expected_image_attempt_count": 2,
  "expected_image_url": "https://..."
}
```

Rules chung:

- Request dùng discriminated union theo `decision`, cả hai branch đều `extra='forbid'`.
- Approve branch không có field `reason`; gửi `reason=null` hoặc extra reason phải trả `422`.
- Reject branch bắt buộc `reason: str`; explicit null/blank phải trả `422`.
- Chỉ story `pending_review`, không active regeneration.
- Lock story rồi page.
- Match story revision và canonical identity của page: current review status, image attempt count và exact image URL.
- Page phải có nonblank Khmer/Vietnamese và usable canonical image.
- Concurrency mismatch trả `409` kèm canonical state hoặc đủ thông tin để frontend refetch.
- Page cuối approved không tự đổi story status.

Decision transition khi story còn `pending_review`:

- `pending -> approved | rejected`.
- `approved -> rejected` nếu admin đổi quyết định trước complete-review.
- `rejected -> approved` nếu admin chấp nhận lại canonical image hiện tại.
- `rejected -> rejected` chỉ được idempotent khi exact identity và normalized reason không đổi; reason mới là mutation mới với reviewer/time mới.
- `approved -> approved` có thể trả canonical success idempotent khi exact identity còn khớp.
- Sau `complete-review`, mọi page decision mutation trả `409`.

Approve:

- Nếu warning/unvalidated, yêu cầu explicit acknowledgment.
- Set `review_status=approved`, `reviewed_by=current_admin`, `reviewed_at=DB clock`.
- Clear rejection note.
- Nếu retry ảnh trước đó thất bại nhưng admin quyết định chấp nhận ảnh cũ, normalize `image_status=completed` và clear regeneration error sau khi identity vẫn khớp.

Reject:

- `reason` bắt buộc sau trim, 5–500 ký tự.
- Set `review_status=rejected`, reviewer/time và canonical reason.
- Giữ nguyên ảnh hiện tại.
- Không tự gọi image provider.

### 8.6 Regenerate một rejected page

```http
POST /api/stories/{story_id}/pages/{page_id}/regenerate-image
```

```json
{
  "expected_text_revision": 7,
  "expected_review_status": "rejected",
  "expected_image_attempt_count": 2,
  "expected_image_url": "https://..."
}
```

Response `202 Accepted`:

```json
{
  "already_running": false,
  "review": {}
}
```

Preconditions:

- Story `pending_review` hoặc stale manual job đúng page.
- Page thuộc story, `review_status=rejected`, reason nonblank.
- Có usable old image URL.
- Prompt gốc, mapping và references vẫn hợp lệ.
- Không có manual regeneration page khác đang active.
- Request identity vẫn match canonical state.

Start transaction:

1. Lock story và toàn bộ pages theo thứ tự ổn định.
2. Revalidate exact target và request identity.
3. Set target `image_status=pending`, clear current regeneration error nhưng **giữ old image URL, reject reason và review metadata**.
4. Set story `status=generating_images`.
5. Set fresh UUID claim, DB-clock heartbeat và `active_image_regeneration_page_id=target`.
6. Commit durable claim trước khi schedule background task.
7. Nếu schedule thất bại, fenced reset về `pending_review`; không mất ảnh cũ/reason.

Fresh duplicate:

- Cùng active target, claim chưa stale: trả `202`, `already_running=true`; không schedule/provider call lần hai.
- Target khác: `409`.
- Stale đúng target: reclaim bằng DB clock + fresh UUID; old worker bị fence.
- Timeout/mất ACK ở client: frontend GET canonical review state trước khi gửi lại.

### 8.7 Hoàn tất review story

```http
POST /api/stories/{story_id}/complete-review
```

```json
{
  "expected_text_revision": 7
}
```

Trong một transaction:

- Lock story và toàn bộ pages theo thứ tự ổn định.
- Story phải là `pending_review`; nếu đã `approved`, có thể trả canonical success idempotent.
- Không có claim/heartbeat/active regeneration target.
- Title VI/KM nonblank.
- Page order liên tục và không rỗng.
- Mọi page có VI/KM nonblank.
- Mọi page có `image_status=completed` và valid URL.
- Mọi page có `review_status=approved`.
- Expected revision phải còn đúng.

Chỉ sau đó set `status=approved`, `updated_at=DB clock`.

### 8.8 Publish và tạo link lần đầu

```http
POST /api/stories/{story_id}/publish
```

```json
{
  "expected_text_revision": 7,
  "expected_share_revision": 0
}
```

Trong một transaction:

- Lock story/pages, revalidate publish invariant và expected revisions thay vì tin frontend.
- Từ `approved`: sinh token bằng `secrets.token_urlsafe(32)`, set `status=published`, DB-clock `published_at/activated_at/updated_at`, clear `revoked_at`, tăng share revision và commit cùng nhau.
- Unique partial index là authority; collision retry bounded tối đa ba lần. Mỗi candidate dùng nested savepoint, hoặc rollback/reacquire lock/revalidate trước candidate tiếp theo vì PostgreSQL unique violation abort transaction hiện tại. Không publish nếu chưa materialize được unique token.
- Sau lock/read, service nhận diện operation đã hoàn tất và trả canonical idempotent **trước** khi reject stale expected revision; đây là điều kiện để ACK-loss retry hoạt động.
- Duplicate khi `published + active`: canonical success cùng token/revision, không rotate và không tăng revision.
- Duplicate publish khi `published + inactive`: trả canonical inactive; tuyệt đối không tự bật sharing lại.
- ACK-loss: retry/canonical reread phải trả đúng token đã commit.
- Không gọi provider/storage. Response trả `share` object và relative `/stories/{token}` path.

### 8.9 Ngừng chia sẻ

```http
POST /api/stories/{story_id}/share-link/revoke
```

```json
{
  "expected_share_revision": 1
}
```

- Admin-only; lock/read story, nhận diện duplicate completed operation trước, rồi mới enforce expected revision nếu còn mutation.
- Chỉ áp dụng cho `published`. Active -> clear token, tăng revision một lần, set DB-clock `revoked_at/updated_at`; giữ content status `published`.
- Duplicate khi đã inactive trả canonical success, không tăng revision/timestamp lần nữa.
- Sau commit, public GET bằng link cũ phải `404`. Content/review metadata và R2 objects được giữ nguyên.
- Không gọi hành động này là reopen/unreview/unpublish content.

### 8.10 Tạo liên kết chia sẻ mới

```http
POST /api/stories/{story_id}/share-link
```

```json
{
  "expected_share_revision": 2
}
```

- Lock/read canonical state; active duplicate trả canonical trước stale-revision check. Chỉ enforce expected revision khi thực sự cần tạo token.
- `published + inactive`: tạo fresh 256-bit token, tăng revision, set `activated_at` và clear `revoked_at`; không chủ động reuse token vừa revoke.
- `published + active`: canonical idempotent success với same token.
- Vì không có revoked-token history, accidental match với token lịch sử có xác suất cryptographically negligible; acceptance vẫn phải chứng minh link vừa revoke `404` sau re-share bình thường.
- Approved/draft/archived/generating trả `409` cùng canonical state cần thiết để frontend reconcile.
- Revoke vs re-share dùng row lock + expected revision; stale mutation trả `409`.

### 8.11 Archive

Giữ route hiện tại:

```http
POST /api/stories/{story_id}/archive
```

```json
{
  "expected_status": "published",
  "expected_share_revision": 3
}
```

Mở rộng rule:

- Cho phép `draft` theo behavior hiện có và các review/publish state `pending_review`, `approved`, `published`.
- Archive `text_draft`/`text_confirmed` vẫn ngoài Phase 5 theo D30; không âm thầm sống lại P1 deferred.
- Cấm `generating_text` và mọi `generating_images`; trả `409`.
- Lock/read canonical state; archived duplicate trả canonical trước stale check. Mutation phải match `expected_status`; nếu source là published còn phải match `expected_share_revision`, stale trả `409`.
- `archived` idempotent.
- Nếu published đang active, clear token, tăng share revision và set revoked timestamp trong cùng transaction đổi status.
- Không xóa row, page hoặc R2 object. Link đọc hiện hành trả `404` sau commit.

### 8.12 Concurrency và canonical outcome cho share lifecycle

- Publish vs publish: chỉ một token được tạo; request còn lại trả same canonical token.
- Publish vs archive: row lock + expected source state/revision; mutation commit trước làm request còn lại stale `409`. Không tồn tại `archived + active token`.
- Revoke vs re-share và archive vs re-share: lock + `expected_share_revision`; stale request trả `409`, không silently last-write-wins.
- Public GET bắt đầu trước revoke commit có thể hoàn thành; mọi GET bắt đầu sau commit phải `404`.
- Mất ACK sau publish/revoke/re-share phải canonical reread trước khi frontend cho mutation lại.

---

## 9. Manual image regeneration orchestration

Đây là phần rủi ro cao nhất của Phase 5.

### 9.1 Không xây hệ thống job thứ hai

Reuse:

- story-level UUID claim/heartbeat;
- DB-clock stale detection;
- global image semaphore;
- provider adapter;
- R2 validation/upload/delete;
- page timeout/retry budget;
- immutable object key;
- ACK-loss canonical reread;
- old-worker fencing.

Thêm explicit `active_image_regeneration_page_id` thay vì suy luận job kind chỉ từ status hoặc URL.

### 9.2 Target snapshot

- Manual runner nhận `story_id`, `claim_id`, exact `page_id`.
- Khi snapshot, assert story active target đúng `page_id` và ownership UUID đúng.
- Assert chính xác target page là pending/failed; không snapshot mọi page thiếu/lỗi.
- Các page khác không được mutate hoặc gọi provider.
- Snapshot giữ:
  - base `image_prompt_en`;
  - current rejection reason;
  - locked character references;
  - previous image URL;
  - attempt number.

### 9.3 Effective prompt

Tạo pure builder:

```text
base immutable image prompt

[REVIEW FEEDBACK FOR THIS REPLACEMENT]
<bounded, trimmed rejection reason>

Keep the locked characters, visual identity, art style and story scene.
Address only the review feedback where compatible with those constraints.
```

Yêu cầu:

- Không ghi đè `image_prompt_en` trong DB.
- Không cộng dồn feedback cũ qua nhiều lần.
- Reason là data, giới hạn 500 ký tự và không được thay setup/mapping.
- Effective prompt có hard cap `IMAGE_PROMPT_MAX_CHARS = 8,000` ký tự, tính cả base prompt, delimiter, boilerplate và full normalized reason.
- Builder phải giữ nguyên toàn bộ base prompt và reason; không silently truncate một trong hai.
- Nếu tổng vượt 8,000, endpoint trả `422` trước khi claim/schedule/provider call với lỗi sanitized, actionable.
- Cover case base prompt sát 8,000 và reason min/max trong unit/contract tests.
- Không pass raw note vào logs.

### 9.4 Success path

1. Claim target page và tăng attempt count.
2. Gọi provider ngoài DB transaction.
3. Validate bytes/dimensions/format như Phase 4.
4. Upload immutable key mới; retry upload phải reuse cùng bytes, không gọi lại provider.
5. Lock/fence bằng story claim UUID + active target.
6. Trong cùng transaction, swap `image_url`, set page `completed/pending`, clear page error/reviewer/time/reason, set story `pending_review` và clear claim/heartbeat/active target.
7. Commit đúng một lần; không có intermediate canonical state “page mới nhưng story còn generating”.
8. Nếu commit response mất, canonical reread phải kiểm tra đồng thời new URL/page state **và** story status/claim/target.
9. Chỉ khi toàn bộ canonical invariant chứng minh commit đã apply mới best-effort delete old R2 object với timeout hữu hạn.
10. Nếu canonical outcome chưa xác định, delete neither old nor new object; dừng để reconcile.

R2 cleanup:

- Chỉ delete khi old URL thuộc configured R2 public namespace và đúng story/page asset prefix.
- Không delete nếu old URL bằng new URL hoặc không parse an toàn.
- Delete fail chỉ log sanitized key; không rollback canonical new image.
- Ambiguous DB outcome: delete neither asset cho tới khi reconcile; ưu tiên orphan hơn mất canonical image.

### 9.5 Failure path

- Provider reject/unavailable, invalid image, R2 failure, timeout hoặc internal error phải map thành sanitized code.
- Manual failure handler lock/fence rồi atomically giữ old URL/rejected metadata, set page `image_status=failed` + error code, đưa story về `pending_review` và clear claim/heartbeat/active target trong một commit.
- Nếu failure commit ACK mơ hồ, canonical reread cả page và story trước khi retry/reset; old worker không được finalize claim mới.
- Page khác không đổi.
- Admin có thể retry regeneration hoặc approve lại old image có chủ đích.
- Crash/restart không được tạo state completed/pending page nhưng story vẫn generating; regression test phải inject failure ở commit boundary.

### 9.6 Finalizer regression bắt buộc

Terminalization phải branch bằng explicit job context. Initial job vẫn dùng finalizer Phase 4; manual success/failure dùng atomic terminal write ở 9.4/9.5 và không gọi thêm một second-step finalizer:

- Initial generation all completed -> `pending_review`.
- Initial generation partial/missing URL -> `text_confirmed`.
- Manual regeneration success -> `pending_review`.
- Manual regeneration failure nhưng old URL còn -> `pending_review`.

Không được dùng một rule “có failure -> text_confirmed” cho cả hai mode.

---

## 10. Frontend admin review

### 10.1 Workflow routing

Cập nhật pure route helper và tests:

```text
draft                                  -> /setup
generating_text | text_draft           -> /edit
text_confirmed                         -> /images
generating_images + no active target   -> /images
generating_images + active target      -> /review
pending_review | approved | published  -> /review
archived                               -> /admin/stories
```

Backend phải expose explicit workflow signal cho admin, không để frontend đoán từ status/URL:

- `StoryListItem` và `StoryResponse`: `image_workflow_kind: "initial" | "review_regeneration" | null`.
- Existing Phase 4 image-state response: cùng `image_workflow_kind` và `active_image_regeneration_page_id`.
- Phase 5 review response: job object có kind + active page như contract ở trên.
- Không cần expose claim UUID.

Direct route guard:

- Validate ID là positive integer trước khi render inner component có hooks.
- Story list dùng `StoryListItem.image_workflow_kind`.
- `/review` dùng review response; wrong phase refetch StoryResponse rồi redirect đúng workflow.
- `/images` dùng existing image-state response; gặp pending/approved/published hoặc `review_regeneration` phải redirect `/review`.
- Không conditional hook.

### 10.2 Review workspace

Header:

- Khmer title chính, Vietnamese title phụ.
- Story status badge.
- Progress `x/n trang đã duyệt`.
- Count pending/rejected.
- CTA tổng theo capability.

Mỗi page card:

- Ảnh 16:9 + broken/null fallback.
- Badge pending/approved/rejected/regenerating/failed.
- Khmer primary và explicit edit mode `Lưu/Hủy`.
- Vietnamese read-only comparison.
- Khmer validation badge + warning list.
- Approve/reject controls.
- Rejection reason và regenerate CTA khi rejected.
- Không hiển thị/edit English prompt, mapping hoặc reference URLs.

### 10.3 Mutation UX

- Backend canonical response là source of truth; không optimistic update approve/reject/publish/regenerate.
- Disable double click ngay trước request.
- Một local mutation tại một target.
- `409`: báo admin khác vừa thay đổi, bỏ stale local draft sau cảnh báo và refetch canonical.
- Network/timeout sau mutation: reconcile GET trước khi cho retry.
- `422`: hiện validation sát field/dialog.
- `401/403`: dùng auth UX hiện có.
- `502/503`: giữ state hiện có và cho retry.

Khmer edit:

- Local draft, không auto-save mỗi keystroke.
- Trim/length validation cả client và server.
- Sau page edit: badge pending + “Chưa kiểm tra bản sửa”; ảnh không đổi.
- Cho chạy lại validator.

Approve:

- Disable nếu image không usable hoặc local edit chưa save.
- Nếu flags/unvalidated, confirmation phải yêu cầu explicit acknowledgment.

Reject:

- Dialog reason bắt buộc 5–500 ký tự.
- Nói rõ reason sẽ được đưa vào lần tạo lại ảnh.
- Reject không tự gọi provider.

### 10.4 Regeneration UX

Confirmation dialog phải ghi:

- Chỉ tạo lại **1 ảnh nội dung**.
- Dùng prompt gốc + lý do từ chối.
- Không đổi nhân vật/mapping/art style.
- Ảnh cũ được giữ tới khi ảnh mới hoàn tất.
- Có thể phát sinh chi phí theo provider/config hiện hành; không hiện số tiền hard-code.

Runtime:

- Sau `202`, poll recursive `setTimeout` mỗi 3 giây; không request overlap.
- Overlay “Đang tạo bản thay thế” trên ảnh cũ.
- Trong lúc job chạy, disable mọi review mutation của story.
- Poll error giữ state/ảnh cũ, hiện banner + `Kiểm tra ngay`.
- Cancel timer khi unmount, đổi story hoặc job kết thúc.
- Success: ảnh URL mới, page về pending, admin phải duyệt lại.
- Failure: ảnh cũ còn, page rejected, hiện sanitized error + retry.
- Không có rollback/version chooser.

### 10.5 Complete review / publish / share / archive

- Page cuối approved chỉ update progress; không auto-navigation hoặc auto-approve story.
- CTA `Hoàn tất duyệt truyện` chỉ enable khi backend capability cho phép và không local draft.
- Complete-review có confirmation.
- Approved workspace read-only + CTA `Xuất bản và tạo liên kết`.
- Confirmation phải nói rõ link không được liệt kê công khai nhưng bất kỳ ai có link đều đọc được.
- Published active: primary duy nhất `Sao chép liên kết`; `Mở bản đọc` là secondary; `Ngừng chia sẻ` và `Lưu trữ` là destructive actions, không cạnh tranh visual primary.
- Published inactive: primary duy nhất `Tạo liên kết chia sẻ mới`; không render `Mở/Xem bản đọc`; nói rõ link cũ tiếp tục không hoạt động.
- `Sao chép liên kết` phải copy absolute URL được ghép an toàn từ canonical app origin + backend relative path, không copy path tương đối. `Mở bản đọc` dùng URL đó và `noopener/noreferrer` nếu mở tab mới.
- Ưu tiên Web Share API trên thiết bị hỗ trợ, nhưng luôn có copy fallback; QR chỉ P1.
- Network/timeout sau mutation phải reconcile canonical `share.revision/active/path` trước khi đổi CTA.
- Archive published có warning rõ link hiện hành sẽ ngừng hoạt động nhưng data/ảnh được giữ.

### 10.6 Responsive admin capability policy

Mobile compact là viewport có `width < 768px` **hoặc** `height < 600px`; không chỉ “co desktop lại”:

- Quick-create trên **một màn hình**: ý tưởng, 2–3 nhân vật, backbone, genre, art style, target age và length preference; required values hiện trong compact setup summary.
- Không áp hidden default. `Tùy chỉnh` mở accordion/bottom sheet accessible; summary phải phản ánh đúng payload gửi backend. Sticky CTA `Tạo và sinh nội dung`; secondary `Chỉ lưu nháp`.
- Mobile được start text generation, xem text/ảnh/review status, progress polling, canonical foreground refresh và recovery `retry/resume/finalize`.
- Initial image start chỉ hiện khi canonical mapping đã được lưu và backend capability cho phép. Nếu mapping chưa được review/lưu, mobile chỉ hướng dẫn mở tablet/desktop; không auto-accept mapping.
- Copy/open/revoke/re-share link và các confirmation an toàn.
- Không horizontal overflow, touch target tối thiểu 44px và sticky action có safe-area padding.

Deep work chỉ bật khi usable canvas có `width >= 768px` **và** `height >= 600px`:

- structural text edit/add/delete/reorder;
- image mapping;
- Khmer deep edit;
- approve/reject và quyết định manual regeneration.

Backend không device-gate. Nếu mobile compact mở trực tiếp deep route, UI phải render canonical read-only summary/progress/recovery và lời hướng dẫn `Mở trên tablet hoặc máy tính để chỉnh sửa chi tiết`, không trả `403` và không redirect vòng lặp. App/tab trở lại foreground phải fetch canonical state đúng một lần, không phát mutation trùng. Policy dùng viewport/container capability, không user-agent.

`StoryListItem` phải có canonical `share_active` (không bắt buộc trả raw token/path ở list). Card published-active dùng `Quản lý chia sẻ`; published-inactive dùng `Tạo liên kết`; cả hai route tới review workspace để fetch share object đầy đủ. Không suy `Xem truyện` chỉ từ `status=published`.

---

## 11. Public API và unlisted share contract

Không gắn auth dependency. Không có public list/catalogue endpoint.

### 11.1 Exact-token detail

```http
GET /api/public/shared-stories/{share_token}
```

- Validate trước DB: exact 43 ký tự, chỉ `[A-Za-z0-9_-]`, case-sensitive.
- Lookup exact token cùng `status='published'`.
- Malformed, numeric ID, random, revoked, published-inactive, approved, archived và nonexistent đều trả cùng `404 {"detail":"Story not found"}`; không trả `422/403` làm lộ state.
- Pages sort `page_no ASC`; public response không chứa internal story/page ID.

Response projection tối thiểu:

```json
{
  "title_km": "...",
  "title_vi": "...",
  "target_age": "early_primary",
  "page_count": 6,
  "cover": {"background_url": "https://..."},
  "pages": [
    {
      "page_no": 1,
      "text_km": "...",
      "text_vi": "...",
      "image_url": "https://..."
    }
  ]
}
```

Không trả `text_en`, setup IDs, scene/prompt, character mapping/reference URL, review metadata, `created_by`, claim/heartbeat, attempts/errors/provider internals hoặc share token/revision metadata.

### 11.2 Freshness, headers và frontend fetch boundary

Public API response, public 404 và reader document route phải có policy đã test; `Referrer-Policy` trên document ngăn share token trong reader URL bị gửi sang R2 khi tải ảnh. Reader document/data cũng phải dynamic/no-store, không static/CDN-cache story sau revoke:

```text
Cache-Control: private, no-store
Referrer-Policy: no-referrer
X-Robots-Tag: noindex, nofollow, noarchive
```

- Stop-sharing/archive làm exact old link `404` sau canonical commit; re-share không hồi sinh token cũ.
- Tạo `frontend/src/lib/public-api.ts` độc lập: không đọc Supabase session, không gắn Authorization, không trigger admin sign-out và không persist response.
- Reader page đặt robots metadata `noindex, nofollow`; không redirect numeric ID sang token và không có endpoint enumeration.
- Application logs/errors không ghi raw token. Access-log redaction/suppression cho route token phải được kiểm tra; production proxy log policy là Phase 6 gate. Evidence chỉ dùng token đã redact hoặc fingerprint không thể dùng để truy cập.

### 11.3 Giới hạn bảo mật của public R2

`Ngừng chia sẻ` vô hiệu hóa Katha reader route và public story API; nó không thể thu hồi direct R2 URL hoặc bản sao mà người nhận đã lưu trước đó, vì image objects hiện public/immutable.

UI/docs phải mô tả đúng giới hạn này, không gọi đây là DRM/private storage. Thu hồi ảnh nghiêm ngặt cần private bucket + proxy/presigned URL và nằm ngoài Phase 5 MVP.
---

## 12. Cover và Reader UI

### 12.1 Entry và public route

- Root `/` giữ admin entry/landing hiện hành; không fetch catalogue và không liệt kê story public.
- Reader mở trực tiếp `/stories/[shareToken]`, không yêu cầu login hoặc Supabase session.
- Loading/error/retry đầy đủ; mọi invalid/inactive link dùng một public 404 UI chung.
- Không có `Về danh sách` vì không tồn tại public catalogue. Page cuối dùng `Về bìa` hoặc `Đọc lại`.

### 12.2 `StoryCover`

- Shared component giữa admin share preview và reader cover.
- Ảnh content page 1 làm background khi hợp lệ; deterministic SVG/pattern/gradient fallback nếu null/broken.
- Gradient overlay bảo đảm contrast; text là DOM với đúng `lang`, không rasterize lên canvas/image.
- Cover có cả hai title: Khmer mode dùng Khmer primary + Việt subtitle; Vietnamese mode đảo lại.
- Long title wrap responsive; không đọc/ghi `cover_image_url` trong Phase 5 runtime.

### 12.3 Reader `/stories/[shareToken]`

- Cover là step 0; sau cover là content pages `1..n` theo `page_no`. Counter hiển thị `Bìa` hoặc `Trang x/n`, `n` không tính cover.
- Mọi viewport, kể cả desktop/tablet/mobile, dùng một cột: ảnh landscape 16:9 ở trên, text được chọn ở dưới; không dùng split two-column.
- Ảnh dùng `object-contain`, không crop. Container centered với max-width phù hợp.
- Không ép xoay màn hình. Ở `667x375` và `844x390`, media 16:9 không vượt khoảng `65dvh`; page vẫn vertical-scroll, không khóa `100dvh/overflow:hidden`, sticky pager không che text.
- Language control là segmented/radiogroup `ខ្មែរ / Tiếng Việt`; lần đầu mặc định Khmer.
- Chỉ một body language hiển thị/accessibility tree tại một thời điểm. Toggle không đổi page, không reload ảnh và không quay về cover.
- Giữ language khi chuyển trang; P0 có thể lưu `localStorage`, nhưng chưa có preference thì Khmer luôn là default.
- Khmer text dùng font hỗ trợ Khmer, 22–26px ở viewport phù hợp và line-height tối thiểu 1.8; Vietnamese có `lang="vi"`.
- Previous/Next buttons, ArrowLeft/ArrowRight và swipe ngang có threshold. Swipe chỉ thắng khi chuyển động ngang rõ, không chặn vertical scroll và không bắt đầu trên interactive control.
- Sticky navigation có bottom content padding + `safe-area-inset-bottom`; touch targets tối thiểu 44px.
- Disable đúng ở biên; không index âm/vượt cuối/skip hai trang khi rapid input.
- Transition nhẹ, tôn trọng `prefers-reduced-motion`; preload đúng ảnh kế tiếp, không eager toàn bộ 14 ảnh.
- Slow/broken image có 16:9 placeholder/fallback nhưng text/navigation vẫn hoạt động.
- Không cần `react-pageflip`, 3D flip, autoplay, TTS hoặc offline trong Phase 5.

### 12.4 Accessibility

- Toggle dùng radio semantics hoặc `aria-pressed`; nhãn bằng chữ, không dùng cờ quốc gia.
- Chỉ selected language được screen reader đọc; content có `lang="km"` hoặc `lang="vi"` đúng mode.
- Mỗi page dùng `article` + accessible heading `Trang n`.
- Page change announce `Trang x trên n, tiếng Khmer/Tiếng Việt` bằng `aria-live="polite"`, không tự đọc lại toàn bộ story.
- Global arrow handler bỏ qua khi focus ở toggle/button/link/input; focus-visible rõ.
- Alt dùng ngôn ngữ đang chọn khi khả thi, tối thiểu `Minh họa trang n của {title}`.
- Test Khmer glyph/dấu không bị cắt, 200% zoom, keyboard-only, touch và reduced-motion.

### 12.5 Device/manual matrix bắt buộc

- `320x568`, `360x800`, `390x844` portrait.
- `667x375`, `844x390` landscape.
- `768x1024` portrait tablet, `1024x768` landscape tablet.
- `1280x720` và `1440x900` desktop.
- Chrome Android; Safari iOS nếu không có environment phải ghi deferred.
- Reader không horizontal overflow; mobile admin quick actions và desktop/tablet deep controls đúng D51.
---

## 13. Backend automated tests

### 13.1 Auth và contract

- 401 thiếu/invalid token và 403 reader role cho mọi admin endpoint.
- Exact-token public endpoint chạy không auth.
- Admin path ID phải positive integer; public token phải đúng 43-char base64url và mọi malformed token normalize về public `404`, không `422`.
- Extra fields, explicit null sai chỗ, blank và oversize trả 422.
- 404/409/422 contract ổn định; không leak raw exception/provider payload.
- GET review/public side-effect free.

### 13.2 Khmer edit/validation

- Title/page edit chỉ ở `pending_review`.
- Stale `expected_text_revision` -> 409, không mutate.
- Unicode normalization/control-character/length cases.
- Page edit tăng revision đúng một lần.
- Page edit reset review + clear validator metadata.
- Title edit không reset page approvals.
- VI/EN/prompt/mapping/image URL bất biến.
- Validate ở pending_review không tăng revision/status.
- Warning acknowledgment contract khi approve.

### 13.3 Page review

- Approve/reject ghi đúng reviewer và DB-clock time.
- Approve body có `reason` và reject reason thiếu/null/blank/dưới 5/over-500 đều bị reject.
- Approve clear note; reject giữ current image.
- Page cuối approved không tự đổi story.
- Approved/rejected transition matrix và same-decision idempotency đúng contract.
- Expected status/attempt/URL cũ -> 409.
- Concurrent approve/reject chỉ một request thắng.
- Approve old image after failed regeneration normalize state đúng.

### 13.4 Complete review/publish/share/archive

- Complete-review fail khi còn pending/rejected/unusable image/missing Khmer/revision stale/active job.
- Complete-review lock/recheck canonical pages trong transaction; approved idempotency.
- First publish tạo đúng một 43-char token, DB-clock timestamps và tăng share revision atomically.
- Duplicate publish active trả same token/revision; duplicate publish inactive không tự re-share.
- Token collision retry bounded; exhausted collision không để lại published state nửa vời.
- Revoke clear token; duplicate revoke idempotent và không tăng revision lần nữa.
- Re-share bình thường tạo token khác token vừa revoke; duplicate active share không rotate. Contract không giả vờ lưu toàn bộ historical token set.
- Published content endpoints đều locked; stop-sharing không mở edit/review.
- Archive chỉ `draft|pending_review|approved|published`, cấm status khác, archived idempotent và clear active token.
- Publish/revoke/re-share/archive ACK-loss canonical reread đúng; không delete DB/R2.

### 13.5 Manual regeneration

- Chỉ đúng một rejected page được target.
- Base prompt + current reason; base prompt DB không đổi.
- Effective prompt đúng full reason và không vượt 8,000; oversize trả 422 trước claim/provider.
- Mapping/reference không đổi.
- Exactly one provider output cho fresh job.
- Fresh duplicate same target không double bill.
- Different target conflict.
- Stale reclaim dùng DB clock; old UUID không write/fail/finalize/reset job mới.
- Không giữ DB transaction qua provider/R2.
- Upload retry reuse bytes; không gọi provider lại.
- Success swap URL, reset review pending, clear reason/error.
- Page success + story finalize/claim clear là một atomic commit; inject crash boundary không để story kẹt.
- Old object delete chỉ sau proven canonical commit.
- Delete failure không rollback.
- Provider/R2/timeout/internal failure giữ old URL/reason.
- Failure page state + story reset là một atomic fenced commit.
- Ambiguous commit outcome canonical reread đúng.
- Systemic failure không mutate page khác.
- Initial runner regression: partial initial failure vẫn về `text_confirmed`.
- Manual failure regression: story về `pending_review`, không `text_confirmed`.

### 13.6 Public projection

- Exact active token trả `200`, không auth; không tồn tại list/catalogue endpoint.
- Malformed, numeric, random, revoked, inactive, approved, archived và nonexistent đều cùng `404`.
- Page order liên tục; response không chứa internal story/page IDs hoặc admin/provider/share fields.
- Verify `Cache-Control`, `Referrer-Policy`, `X-Robots-Tag` trên API **và reader document**; document không static-cache sau revoke.
- Revoke/archive làm old token `404`; normal re-share tạo fresh token và old link tiếp tục `404`. Không tuyên bố absolute historical non-collision khi MVP không lưu token history.
- Public request/error không ghi raw token và không ảnh hưởng Supabase/admin session; reader document không leak token qua Referer khi tải R2.

---

## 14. PostgreSQL integration tests

Gắn `pytest.mark.integration`; collect-only không được khởi động Testcontainers.

### 14.1 Migration 006

- Single graph head `006` offline.
- `005 -> 006 -> 005 -> 006` lifecycle trên PostgreSQL thật.
- Safe null-review normalization.
- Invalid legacy review metadata preflight hard-fail.
- Review status NOT NULL + metadata constraints.
- Active regeneration target/status/claim constraint.
- Active target cross-story/dangling ID bị application lock/ownership check reject.
- Published timestamp constraint/backfill.
- Share revision/token format/status constraints và partial unique index.
- Legacy published row inactive, không auto-expose.
- Upgrade/downgrade drop index/check đúng thứ tự.

### 14.2 Concurrency/fencing

- Two-session approve/reject race.
- Khmer edit vs complete-review race.
- Reject/regenerate vs complete-review race.
- Concurrent regenerate same page only one claim/provider call.
- Different-page concurrent regenerate returns conflict.
- Stale reclaim và old-worker fencing.
- Publish vs publish chỉ một token; publish vs archive không tạo archived-active state.
- Revoke vs re-share, archive vs re-share và public GET sau revoke commit.
- Token collision retry và commit ACK-loss canonical reread.

### 14.3 Full Phase 5 flow

```text
pending_review
  -> edit Khmer page
  -> validate
  -> approve some pages
  -> reject one page with reason
  -> regenerate exactly that page
  -> approve replacement
  -> approve remaining pages
  -> complete-review
  -> publish và nhận opaque link
  -> mở link ở incognito/no-login
  -> numeric/malformed token 404
  -> ngừng chia sẻ, old link 404
  -> tạo link mới, new link 200 và old link vẫn 404
  -> archive
  -> current link 404
```

Ngoài ra phải chạy lại toàn bộ Phase 4 integration suite để bảo đảm finalizer refactor không phá initial generation.

---

## 15. Frontend automated tests

### 15.1 Routes/contracts

- Workflow mapping cho mọi status + active target.
- Positive ID wrapper; không conditional hooks.
- Root không fetch catalogue; `/stories/[shareToken]` không cần session và không redirect login.
- Public helper không đọc Supabase session/Authorization và không sign-out user do 404/network.
- Admin routes vẫn validate positive ID; public route giữ opaque token nguyên case.

### 15.2 Review workspace/hook

- Loading/error/retry/404/read-only states.
- Progress counts và capabilities.
- Khmer edit save/cancel, validation reset và 409 reconcile.
- Reject reason validation.
- Approve warning acknowledgment.
- Page cuối approve không auto-complete story.
- Stale image identity bị reconcile.
- Regenerate double-submit, 3-second non-overlap polling, unmount cancel.
- Old image vẫn hiển thị khi running/failure.
- Success URL change reset page pending.
- Poll error giữ state và `Kiểm tra ngay`.
- Complete-review chỉ enable đúng điều kiện.
- Approved/published read-only.
- Publish/copy/open/revoke/re-share/archive actions đổi theo canonical share state.
- Network/409 reconcile không rotate token hoặc phát mutation trùng.
- Dialog accessible names/focus behavior.

### 15.3 Cover/Reader

- Cover first-image/fallback, hai title và hierarchy đổi đúng theo language mode.
- Reader cover step + page counter; Khmer là default.
- Toggle Khmer/VI giữ current page, không reload image; chỉ selected body visible và accessible.
- 16:9 image-top/text-bottom ở mobile/tablet/desktop; no-crop fallback giữ aspect ratio.
- Previous/Next boundaries, keyboard arrows và rapid-input không skip page.
- Swipe threshold; vertical-win và interactive-control start không trigger page change.
- Reduced-motion, slow/broken image fallback và chỉ preload next image.
- Active, malformed, revoked, archived public states map đúng reader/404 UI.

### 15.4 Mobile admin

- Mobile compact: quick-create payload đủ description/characters/backbone/genre/art-style/age/length, call order đúng, `Chỉ lưu nháp`, double-submit và create-success/generate-fail không duplicate story.
- Phân biệt start text với initial image start: mapping thiếu/chưa lưu không có mutation sinh ảnh; canonical mapping đã lưu mới theo backend capability.
- Progress giữ last-known state; foreground refresh, polling non-overlap và retry/resume/finalization đúng canonical capability.
- Share actions usable với touch target/safe-area; published active/inactive giữ đúng one-primary-CTA.
- Mobile compact gồm cả `844x390`: direct deep route render read-only summary + tablet/desktop guidance.
- Full edit/mapping/review/regeneration chỉ xuất hiện khi đồng thời `min-width:768px` và `min-height:600px`; policy không dựa user-agent.

---

## 16. Manual/browser/live acceptance

Tạo file:

```text
plan/PHASE_5_MANUAL_VERIFICATION.md
```

Mỗi row ghi ngày, environment, story/page ID, result, screenshot/evidence và deferred reason nếu có. Không ghi secret/raw token/raw base64.

### 16.1 Admin review

1. Load pending-review story đủ 4 page và 14 page.
2. Edit title Khmer; page approvals không reset.
3. Edit page Khmer; đúng page reset pending + validation cleared.
4. Validate lại; warning hiển thị đúng, không giả là proof ngữ pháp.
5. Approve/reject trong hai browser/tab để thấy conflict recovery.
6. Approve page cuối; story vẫn pending_review.
7. Complete-review mới chuyển approved.

### 16.2 Controlled live one-page regeneration

1. Dùng một short story, reject đúng một page với reason rõ.
2. Modal nói một ảnh, không giá hard-code.
3. Double click/network resend không tạo provider call thứ hai.
4. Old image vẫn hiển thị trong lúc chạy.
5. Refresh giữa job; review route phục hồi đúng target/progress.
6. Success swap sang immutable URL mới; page về pending.
7. Verify old object cleanup best-effort sau DB commit.
8. Simulate provider/R2 failure; old URL/reason còn và retry được.
9. Ghi usage/cost thật từ provider dashboard theo timestamp, không biến thành giá cố định trong product.

### 16.3 Publish/share/reader

1. Complete-review -> `Xuất bản và tạo liên kết`; URL dùng opaque token, không internal ID.
2. Mở incognito/no-login đọc được; root không có catalogue.
3. Reader mặc định Khmer; toggle VI giữ page và ảnh; mọi viewport ảnh 16:9 trên, text dưới.
4. `Ngừng chia sẻ` -> old link `404` ngay sau commit.
5. Tạo liên kết mới -> new link đọc được, old link vẫn `404`.
6. Archive -> current link `404`; admin endpoints vẫn 401/403 đúng.
7. Xác nhận giới hạn: direct R2 URL đã lưu có thể vẫn truy cập; report không được tuyên bố revoke ảnh tuyệt đối.

### 16.4 Browser/device

Reader:

- Chrome, Firefox, Safari; nếu không có Safari environment phải ghi deferred rõ.
- `320x568`, `360x800`, `390x844`, `667x375`, `844x390`, `768x1024`, `1024x768`, `1280x720`, `1440x900`.
- Khmer dài, language toggle, image-top/text-bottom, landscape height cap, safe-area, broken/slow image.
- Keyboard-only, touch/swipe, 200% zoom và reduced-motion.

Admin:

- Mobile quick-create, text/image progress, foreground recovery và share-link actions.
- Mobile direct deep route read-only đúng contract; tablet/desktop full edit/mapping/review/regenerate.
- Nhờ người đọc Khmer review sample thật; automated validator không thay thế native review.

---

## 17. Implementation slices và dependency

### 5A — Contracts, migration, review core (1–1.5 ngày)

- Ghi D36–D42, D49–D51 và sửa text-lock/share/mobile contradictions trong docs.
- Migration 006 + ORM/schema, gồm token/revision/timestamps/index/constraints.
- Canonical review GET.
- Khmer title/page edit + validate extension.
- Approve/reject page + complete-review.
- Backend contract/unit/PostgreSQL tests.
- Khóa API response types trước khi tách frontend.

### 5B — Admin review UI (1–1.5 ngày)

- `/admin/stories/[storyKey]/review`.
- Route map/direct guards.
- Review cards, progress, Khmer edit, validator flags.
- Approve/reject/complete-review dialogs và reconcile.
- Responsive admin policy: mobile quick-create/progress/recovery, tablet/desktop deep controls.
- Frontend tests/accessibility cơ bản.

### 5C — Single-page regeneration (1.5–2 ngày)

- Active regeneration target + story-level claim integration.
- Effective prompt builder.
- Exact-page runner + finalizer branch.
- Old-image swap/cleanup safety.
- Poll/retry/stale recovery UI.
- Regression/concurrency tests.

Đây là slice khó và rủi ro nhất; không gộp chung một commit khổng lồ với reader nếu có thể tránh.

### 5D — Publish, share lifecycle, cover và reader (2–2.5 ngày)

- Publish/revoke/re-share/archive transactions và concurrency/ACK-loss tests.
- Exact opaque-token public projection; không list/catalogue.
- Root/admin entry giữ nguyên; route `/stories/[shareToken]` dùng public fetch helper riêng.
- Shared cover template, Khmer-default language toggle.
- Reader 16:9 image-top/text-bottom, pager/responsive/keyboard/swipe.
- Public headers/security, R2 limitation copy và frontend tests.

### 5E — Acceptance, docs và handoff (1 ngày)

- Full offline quality gates.
- PostgreSQL execution nếu Docker có sẵn.
- Controlled live one-page OpenAI/R2 smoke nếu credentials local có sẵn.
- Browser/manual/native Khmer matrix.
- Đồng bộ docs/evidence.
- Commit sạch; không push nếu user chưa yêu cầu.

### Parallelization

Sau khi 5A khóa migration và JSON contracts:

- Dev backend có thể làm 5C.
- Dev frontend/public có thể làm 5B/5D.
- Một integration owner duy nhất merge `main.py`, story models/schemas, route map và shared types để tránh conflict.

Ước lượng thực tế:

- Một dev: khoảng 7–9 dev-days gồm share lifecycle, responsive hardening và test.
- Hai dev sau contract freeze: khoảng 4–6 calendar days nếu review/merge liên tục.
- Live provider/browser issues có thể kéo dài acceptance nhưng không được che bằng nhãn code-complete offline.

---

## 18. File scope dự kiến

### Backend

```text
backend/
├── alembic/versions/006_story_review_publish.py
├── src/katha/main.py
├── src/katha/features/stories/models.py
├── src/katha/features/stories/schemas.py
├── src/katha/features/stories/service.py          # archive rule only
├── src/katha/features/story_editor/service.py     # controlled validate extension only
├── src/katha/features/story_images/runner.py      # shared primitives/finalizer refactor
├── src/katha/features/story_review/*
├── src/katha/features/public_stories/*
├── tests/test_phase5_api.py
├── tests/test_story_review_service.py
├── tests/test_story_review_jobs.py
├── tests/test_public_stories.py
├── tests/test_phase5_integration.py
└── tests/test_migration.py
```

### Frontend

```text
frontend/src/
├── app/page.tsx
├── app/stories/[shareToken]/page.tsx
├── app/admin/stories/[storyKey]/review/page.tsx
├── lib/public-api.ts
├── features/stories/routes.ts
├── features/stories/routes.test.ts
├── features/story-review/*
└── features/reader/*
```

### Documentation

```text
PHASE_5_HUMAN_REVIEW_PUBLISH_READER_PLAN.md
plan/PHASE_5_MANUAL_VERIFICATION.md
plan/00-project-overview.md
plan/01-decisions-log.md
plan/02-technical-design.md
plan/03-user-flows.md
plan/04-implementation-plan.md
plan/06-project-structure.md
plan/07-database-schema.md
plan/HANDOFF.md
README.md
backend/README.md
```

File list là boundary dự kiến, không phải lý do sửa unrelated code.

---

## 19. Quality gates

### 19.1 Backend offline — bắt buộc

Chạy tại `backend/`:

```text
uv lock --check
uv run ruff check src/ tests/ alembic/versions/006_story_review_publish.py
uv run ruff format --check src/ tests/ alembic/versions/006_story_review_publish.py
uv run mypy src/
uv run pytest tests/ -m "not integration" -v
uv run pytest tests/ -m integration --collect-only
uv run alembic heads
```

### 19.2 Frontend offline — bắt buộc

Chạy tại `frontend/`:

```text
npm run test -- --run
npm run lint
npx tsc --noEmit
npm run build
```

### 19.3 Repository — bắt buộc

- `git diff --check`.
- Secret scan source/fixtures/docs/report.
- Không stage/commit unrelated user changes.
- Báo worktree state và commit hash trung thực.
- Không ghi API key/JWT/R2 secret/raw base64/raw provider response vào report.

### 19.4 PostgreSQL — acceptance riêng

```text
uv run pytest tests/ -m integration -v
```

- Collect-only không được tính là passed.
- Docker tắt không chặn nhãn code-complete offline nhưng chặn PostgreSQL verified.
- Phải chạy lại Phase 4 integration vì runner/finalizer được refactor.

### 19.5 Live OpenAI/R2 — acceptance riêng

- Chỉ chạy sau khi user cấu hình credentials local; không yêu cầu gửi secret vào chat.
- Chỉ controlled one-page regeneration đầu tiên, không chạy story dài ngay.
- Verify provider call count, R2 swap/cleanup và dashboard usage thật.
- Live gate fail không được thay bằng mock pass.

---

## 20. Definition of Done theo tầng

### 20.1 Phase 5 code-complete offline

Chỉ được báo khi:

- 5A–5D P0 đã implement.
- Alembic single head `006`.
- Backend Ruff/format/mypy/offline pytest pass.
- Integration suite collect được mà không khởi động Docker.
- Frontend Vitest/lint/typecheck/build pass.
- Không còn auto-approve, fixed-price, AI cover hoặc absolute text-lock contradiction.
- Public API không leak internal fields; không catalogue/numeric-ID reader.
- Opaque link publish/revoke/re-share/archive lifecycle và token rotation có test.
- Reader Khmer-default toggle + image-top/text-bottom và mobile-admin capability policy có automated/manual coverage.
- Docs/evidence đồng bộ.

### 20.2 Phase 5 PostgreSQL verified

Chỉ khi migration/concurrency/full-flow integration chạy thật trên PostgreSQL và pass.

### 20.3 Phase 5 live regeneration verified

Chỉ khi controlled OpenAI/R2 single-page regenerate chạy thật và chứng minh:

- không double provider call;
- old image được giữ trong lúc chạy/failure;
- new URL swap sau success;
- cleanup an toàn;
- page/story state đúng.

### 20.4 Phase 5 accepted end-to-end

Chỉ khi:

- PostgreSQL integration pass;
- live regeneration pass;
- admin review -> complete -> publish/link -> no-login read -> revoke/404 -> re-share/new-link -> archive chạy thật;
- browser/device/font/accessibility matrix có evidence;
- native Khmer sample review đã chạy hoặc được ghi deferred có chủ đích.

### 20.5 Project completion

- Sau Phase 5: **core MVP feature-complete**.
- Sau Phase 6: MVP mới được xem là QA/deploy/production-ready nếu production gates pass.
- Sau Phase 7: mới hoàn tất phần đánh giá NCKH/báo cáo nghiên cứu.

---

## 21. Review blockers — REQUEST CHANGES nếu vi phạm

### P0

- Auto chuyển story sang approved khi approve page cuối.
- Cho sửa VI/EN/structure/setup/prompt/mapping downstream.
- Dùng current Phase 4 finalizer khiến manual failure quay về `text_confirmed`.
- Không persist exact active regeneration target hoặc frontend đoán job mode chỉ từ status.
- Snapshot/retry nhầm page khác trong manual regeneration.
- Không match expected text/status/attempt/URL trước review mutation.
- Giữ DB transaction/lock qua OpenAI/R2.
- Không commit claim trước `202`.
- Fresh duplicate gây provider call thứ hai.
- Old worker không bị UUID fence.
- Ghi đè base prompt bằng rejection reason.
- Silently truncate base prompt/reason hoặc gọi provider khi effective prompt vượt hard cap.
- Commit page replacement và story finalization thành hai transaction, tạo crash window làm story kẹt.
- Xóa old image trước proven DB commit hoặc sau ambiguous outcome.
- Provider/R2 failure làm mất old URL/reason.
- Archive `text_draft/text_confirmed` trái D30 mà không có scope decision mới.
- Published vẫn sửa/review/regenerate được; stop-sharing mở lại content hoặc đổi content status trái D42.
- Không có revoke/re-share; duplicate publish rotate token; re-share reuse old token; archived vẫn giữ active token.
- Có public list/catalogue, numeric-ID reader hoặc public response leak story/page IDs, prompt/reviewer/claim/share metadata.
- Malformed/revoked/inactive/archived link không trả cùng public 404, reader link vẫn bắt login hoặc reader document leak token qua Referer/log.
- Reader hiện đồng thời Khmer/VI, không default Khmer hoặc dùng desktop split image/text trái D50.
- Mobile mất quick-create/progress/recovery/share actions, hidden defaults sai payload hoặc phone landscape bật deep mutation trái D51.
- Published active/inactive không giữ one-primary-CTA, copy path tương đối hoặc card suy `Xem truyện` chỉ từ status.
- Sinh/upload cover hoặc ghi `cover_image_url` trái D41.
- Hard-code giá provider trong UI/API/docs active.
- Báo Docker/live/browser verified khi chỉ mock/collect/build.

### P1 có thể deferred nếu ghi rõ

- Safari manual run khi không có môi trường.
- Advanced Khmer dictionary/native-language quality conclusion.
- Automated orphan sweeper.
- Durable queue/multi-instance concurrency.
- QR code/native share refinement ngoài copy/Web Share fallback.
- Sophisticated page-flip animation.

---

## 22. Documentation dev phải đồng bộ

- `plan/01-decisions-log.md`: D36–D42 và D49–D51; không dùng lại D43–D48.
- `plan/07-database-schema.md`: migration 006, review metadata, active target, share token/revision/timestamps/index/constraints.
- `plan/02-technical-design.md`: review service, safe regeneration swap, unlisted token projection, share lifecycle, cover runtime.
- `plan/03-user-flows.md`: explicit complete-review, copy/open/revoke/re-share, reader language toggle và mobile capability policy.
- `plan/04-implementation-plan.md`: Phase 5 contract thực tế và trạng thái.
- `plan/06-project-structure.md`: feature modules mới.
- `plan/00-project-overview.md`: core MVP flow.
- `plan/HANDOFF.md`: Phase 4 deferred gates, Phase 5 evidence và next Phase 6.
- `README.md`, `backend/README.md`: public/admin routes, env/run/test/live smoke.
- `plan/PHASE_5_MANUAL_VERIFICATION.md`: evidence matrix.
- File plan này: dev chỉ cập nhật status/evidence sau khi work thật sự hoàn tất; không sửa requirement để khớp shortcut implementation.

Các câu cũ phải được sửa:

- “Không inline text edit trong MVP” -> ngoại lệ Khmer-only review.
- “Text khóa tuyệt đối sau text_confirmed” -> VI/EN/structure/image inputs khóa; Khmer review edit là controlled exception.
- “All pages approved tự chuyển approved” -> explicit complete-review.
- “Cover asset/URL” -> runtime code template, first-page background/fallback.
- Fixed image price -> provider/config dependent, dated usage evidence only.
- `pending_review/approved/published -> /images` -> `/review`.
- Public catalogue hoặc `GET /api/public/stories?limit` -> không có list endpoint.
- `/stories/[id]` -> `/stories/[shareToken]`; numeric ID không phải public locator.
- “Archive để ẩn truyện” -> explicit `Ngừng chia sẻ`; archive là lifecycle riêng.
- “Khmer chính + Việt phụ cùng lúc” -> one-language toggle, Khmer default.
- “Desktop two-column reader” -> ảnh 16:9 trên, text dưới ở mọi viewport.

---

## 23. Evidence dev phải bàn giao

1. Commit hash và `git status --short`.
2. Danh sách file thêm/sửa, xác nhận không có unrelated diff.
3. Alembic head + lifecycle result.
4. Backend Ruff/format/mypy/pytest counts.
5. Integration collected count và executed pass count tách riêng.
6. Frontend Vitest/lint warnings/errors/typecheck/build.
7. API contract examples sanitized.
8. Evidence no-auto-approve + explicit complete-review.
9. Evidence stale image identity/conflict handling.
10. Evidence one-page target + duplicate/stale fencing.
11. Evidence old-image safe swap/cleanup and failure retention.
12. Evidence initial Phase 4 runner regressions vẫn pass.
13. Screenshot/recording admin share panel, incognito reader, Khmer/VI toggle và desktop/mobile top-image layout.
14. Evidence revoke old-link 404, re-share token rotation và archive current-link 404; token phải redact phần lớn trong report.
15. Evidence mobile quick-create/progress/recovery/share và tablet/desktop deep controls.
16. PostgreSQL/live/browser/native Khmer gate nào pass, gate nào deferred và lý do.
17. Provider usage/cost chỉ ghi từ dashboard live có ngày, không biến thành fixed product price.
18. Không stage/commit/push nếu chưa được user yêu cầu ở bước tương ứng.

---

## 24. Handoff sang Phase 6

Phase 5 chỉ handoff sang QA/deploy khi core path đã tồn tại:

```text
create -> text -> images -> review -> approved
-> publish + unlisted link -> no-login reader -> stop sharing
```

Handoff phải liệt kê riêng:

- baseline/Phase 5 commit;
- Alembic head `006`;
- offline test counts;
- PostgreSQL executed hoặc deferred;
- controlled OpenAI/R2 result hoặc deferred;
- browser/native Khmer result hoặc deferred;
- public/admin route map;
- known limitations: in-process job, one manual regeneration/story, no content reopen/history, public R2 URL không bị revoke tuyệt đối;
- active/inactive share state, current token revision và old-link verification;
- mobile-admin capability policy và reader language/layout contract;
- production env/deploy chưa chạy.

Phase 6 sau đó chịu trách nhiệm:

- full live E2E từ đầu đến cuối;
- production CORS/rate limiting/security/performance review;
- Supabase migration/seed/test users;
- R2/OpenAI/Vercel/VPS configuration;
- deploy, health check, logs/monitoring và rollback runbook;
- production acceptance.
