# Phase 4.5 — Story Creation Workflow UX Refinement Implementation Plan

> Trạng thái: **READY FOR DEV**
> Ngày lập: 2026-07-23
> Phạm vi: tối ưu luồng admin từ tạo story đến khi sẵn sàng human review
> Loại thay đổi: chủ yếu frontend, điều phối lại các API hiện có; **không đổi DB/state machine**
> Thứ tự thực hiện: làm trước hoặc làm thành slice đầu tiên của Phase 5
> Nguyên tắc nghiệm thu: tách riêng automated frontend gates và browser/manual acceptance

---

## 1. Kết luận PM

Luồng hiện tại đúng về nghiệp vụ và có recovery tốt, nhưng UI đang phơi các checkpoint kỹ thuật thành quá nhiều bước người dùng phải tự điều phối.

Happy path hiện cần khoảng 9 lượt bấm điều hướng/quyết định trước khi ảnh bắt đầu được tạo:

```text
Tạo truyện
  -> Lưu bản nháp
  -> Sinh nội dung
  -> Xác nhận nội dung
  -> Xác nhận trong modal
  -> Tiếp tục chuẩn bị minh họa
  -> Tạo kế hoạch minh họa
  -> Bắt đầu sinh ảnh
  -> Xác nhận trong modal
```

Các vấn đề đã được xác nhận trên UI và source hiện tại:

- Sau khi tạo draft, người dùng được đưa sang một màn hình gần như lặp lại toàn bộ form vừa nhập.
- Primary CTA lúc ở cuối form, lúc ở đầu trang, lúc nằm trước phần nội dung cần kiểm tra.
- Editor có thể dài 4–14 trang nhưng CTA xác nhận chỉ nằm cuối danh sách.
- Mapping nằm theo từng trang ở dưới, trong khi nút lưu/start nằm phía trên.
- Trong lúc sinh ảnh, màn hình vẫn ưu tiên text/prompt/mapping dài thay vì progress và gallery.
- `0/N` có thể giữ nguyên vài phút, khiến một ảnh đang chạy trông giống job bị treo.
- Main UI dùng nhiều từ kỹ thuật như `mapping`, `image plan revision`, `job stale`, `reclaim`.
- Nếu nối Phase 5 trực tiếp vào UX hiện tại, tổng số thao tác tới publish sẽ còn tăng đáng kể.

Quyết định: triển khai một workflow shell 4 bước và một action bar nhất quán, đồng thời gộp các thao tác trung gian an toàn ở frontend. Không xây mega wizard, không gom state của setup/editor/images vào một global store và không tạo endpoint “làm tất cả”.

```text
1. Thiết lập -> 2. Nội dung -> 3. Minh họa -> 4. Duyệt & xuất bản
```

Reader là kết quả sau publish, không phải bước thứ 5. Cover code-template thuộc bước review/publish của Phase 5, không thuộc plan này.

---

## 2. Baseline và ràng buộc phải giữ

### 2.1 Baseline chức năng

Dev phải giữ nguyên các invariant đã có:

- Backend là authority cho story status, revision, capability và canonical state.
- Text generation vẫn theo `draft -> generating_text -> text_draft`.
- Confirm text vẫn chuyển `text_draft -> text_confirmed` và khóa phần nội dung đã chốt.
- Image plan dùng `expected_text_revision` và `expected_image_plan_revision`.
- Lưu mapping làm tăng `image_plan_revision`.
- Start/retry/resume/finalization vẫn dùng endpoint và capability hiện tại.
- Ảnh completed không bị sinh lại khi retry/resume.
- Timeout, mất ACK hoặc `409` phải canonical reread/reconcile trước khi cho mutation tiếp theo.
- Poll text và image hiện tại vẫn giữ chu kỳ 3 giây.
- Modal khóa text và modal xác nhận image operation có chi phí vẫn phải tồn tại.
- Không thay đổi Phase 4 runner, UUID claim, heartbeat, R2 key hoặc provider timeout trong task UX này.

### 2.2 Ràng buộc kiến trúc

- Giữ các route độc lập để refresh, deep-link và resume được.
- Giữ feature ownership hiện tại; không tạo một `useStoryWizard()` quản lý mọi mutation/polling.
- Shared workflow layer chỉ làm presentation, navigation và orchestration giữa các API primitive.
- Không sao chép business state machine backend sang nhiều component.
- Không thêm UI framework mới.
- Không thêm DB migration hoặc endpoint backend trong P0.
- Không sửa/revert các thay đổi backend đang được dev khác thực hiện ngoài scope.

### 2.3 Ranh giới với Phase 5

Ở commit Phase 4.5 độc lập:

- `pending_review`, `approved`, `published` vẫn có thể tạm dùng `/admin/stories/{id}/images` vì `/review` chưa tồn tại.
- Stepper được phép hiển thị bước 4, nhưng không được tạo nút approve/reject/publish giả.
- Khi Phase 5 review workspace được triển khai, chỉ thay canonical route/capability mapping và gắn workspace mới vào shell.
- Manual page regeneration của Phase 5 vẫn phải được trình bày ở bước 4; về sau không được suy step chỉ bằng `status=generating_images`.

---

## 3. Mục tiêu và chỉ số thành công

### 3.1 Mục tiêu P0

- Người dùng luôn biết mình đang ở bước nào, bước nào đã xong và việc tiếp theo là gì.
- Primary workflow action luôn xuất hiện ở cùng một vị trí.
- Một màn hình chỉ có một workflow CTA mang visual primary tại một thời điểm.
- Không cần cuộn hết 14 trang để xác nhận text.
- Không cần cuộn ngược lên để lưu mapping/start image generation.
- Khi ảnh đầu tiên đang chạy, UI nói rõ trang nào đang được xử lý.
- Các bước đã hoàn tất hiển thị compact read-only thay vì nguyên form disabled.
- Happy path sau khi điền form còn khoảng 5–6 lượt bấm, trong đó giữ hai confirmation có ý nghĩa.
- Refresh/back/forward/deep-link không gửi lại mutation ngoài ý muốn.

### 3.2 Không dùng làm tiêu chí P0

- Không đặt mục tiêu ETA chính xác cho OpenAI.
- Không giả lập phần trăm tiến độ bên trong một image operation.
- Không giải quyết triệt để việc process reload làm chết in-process worker.
- Không thêm queue/Celery/Redis.
- Không thêm analytics, onboarding tour hoặc animation phức tạp.

### 3.3 Tách P0 và P1 để không chặn Phase 5

**P0 bắt buộc trước Phase 5:**

- Workflow mapping, shell, stepper và route guard phân biệt current/read-only/future.
- Sticky action bar và one-primary-CTA.
- Safe create/update -> generate orchestration.
- Confirm text -> prepare plan với partial-success semantics.
- Save mapping -> start bằng canonical revision mới.
- Progress tối thiểu theo từng page, active page rõ ràng và recovery copy/action.
- Read-only summary tối thiểu cho bước setup đã khóa.
- Các regression, accessibility và responsive gate liên quan trực tiếp.

**P1 có thể làm ngay sau Phase 5 core nếu deadline gấp:**

- Thay toàn bộ image-plan card bằng accordion/compact row thiết kế mới.
- Gallery polish nâng cao và page navigator cho editor.
- Full terminology sweep ngoài các headline/action quan trọng.
- Thời gian cập nhật/heartbeat giàu thông tin cần backend contract mới.
- Story-list progress `x/N` cần API projection mới.

P0 không được biến thành frontend rewrite. Dev được reuse component hiện tại miễn đạt one-primary-CTA, sticky navigation và progress rõ ràng.

### 3.4 Phạm vi mobile cho giáo viên/admin

Mobile compact là viewport có `width < 768px` **hoặc** `height < 600px`; vì vậy phone xoay ngang `844x390` không được tự bật deep controls. Đây là P0 cho các tác vụ nhanh:

- quick-create trên một màn hình với description, 2–3 characters, backbone, genre, art style, target age và length; summary hiện đủ năm config, không áp default ẩn;
- `Tùy chỉnh` mở accordion/bottom sheet để đổi config mà không biến thành wizard nhiều màn hình;
- story list/resume và start text generation;
- initial image start chỉ khi canonical mapping đã được lưu và capability cho phép; mapping chưa lưu thì hướng dẫn mở tablet/desktop, không auto-accept;
- xem text/ảnh/status, active page và tiến độ canonical;
- foreground refresh, poll-error recovery, retry/resume/finalization;
- sau Phase 5: copy/open/revoke/re-share link đọc;
- confirmation an toàn, touch target tối thiểu 44px và sticky action có safe-area padding.

Deep work chỉ bật khi usable canvas có `width >= 768px` **và** `height >= 600px`:

- structural text edit/add/delete/reorder;
- image mapping;
- Khmer deep edit;
- approve/reject và quyết định manual regeneration.

Backend không device-gate. Mobile compact mở direct deep route phải nhận read-only summary/progress/recovery và hướng dẫn `Mở trên tablet hoặc máy tính để chỉnh sửa chi tiết`, không `403`, không redirect loop và không gửi mutation chỉ vì resize/rotate/foreground. Capability policy dựa usable viewport/container, không user-agent.

---

## 4. Product/UX decisions đã chốt

Phase 5 đã reserve D36–D42. Khi implementation hoàn tất, dev ghi sáu quyết định UX này vào decision log dưới **D43–D48**; không dùng lại D36–D42.

### UX-01 / D43 — Workflow 4 bước, route riêng

- Bốn bước: Thiết lập, Nội dung, Minh họa, Duyệt & xuất bản.
- Không chuyển thành một trang wizard lớn.
- Canonical backend state quyết định route và step.
- Future step không clickable; completed step chỉ mở được route read-only hợp lệ.

### UX-02 / D44 — Một primary CTA

- Mỗi state chỉ có một workflow primary CTA.
- Local edit action như dịch lại, thêm/xóa trang hoặc lưu riêng dùng secondary/tertiary style.
- Khi đang xử lý remote operation, action bar chuyển sang trạng thái tiến độ; không để nút start disabled gây hiểu nhầm.

### UX-03 / D45 — Sticky workflow action bar

- Workflow action nằm cố định dưới viewport ở setup, editor và image workspace.
- Nội dung trang phải có bottom padding tương ứng, kể cả safe-area trên mobile.
- Modal luôn nằm trên action bar và làm action nền inert.

### UX-04 / D46 — Gộp thao tác, không gộp transaction

- UI có thể gộp nhiều API primitive trong một intent của người dùng.
- Mỗi API vẫn commit/reconcile độc lập; không rollback bước trước chỉ vì bước sau lỗi.
- Không tạo endpoint dài `create -> text -> plan -> images`.

### UX-05 / D47 — Confirmation chỉ cho hành động có hậu quả

Giữ confirmation cho:

- Khóa text.
- Bắt đầu/retry/resume image operation có thể phát sinh chi phí.
- Complete review, publish và archive ở Phase 5.

Không thêm confirmation cho navigation, save thường hoặc tạo image plan.

### UX-06 / D48 — Progress trung thực

- Có thể suy trang đang chạy từ page có `image_status=generating`.
- Không hiển thị ETA hoặc phần trăm nội bộ nếu backend không cung cấp.
- Không gọi `updated_at` là heartbeat nếu contract hiện tại không đảm bảo semantics đó.
- Main copy chỉ hứa những gì hệ thống bảo đảm, ví dụ: “Bạn có thể quay lại xem sau; các ảnh đã hoàn tất sẽ được giữ lại.”

---

## 5. Canonical workflow presentation

Tạo một source of truth duy nhất cho route, stepper và resume label.

| Story state | Step | Canonical route ở Phase 4.5 | Presentation |
|---|---:|---|---|
| Chưa có story | 1 | `/admin/stories/new` | Thiết lập mới |
| `draft` | 1 | `/admin/stories/{id}/setup` | Có thể chỉnh sửa |
| `generating_text` | 2 | `/admin/stories/{id}/edit` | Đang xử lý |
| `text_draft` | 2 | `/admin/stories/{id}/edit` | Có thể biên tập |
| `text_confirmed` | 3 | `/admin/stories/{id}/images` | Chuẩn bị minh họa |
| Initial `generating_images` | 3 | `/admin/stories/{id}/images` | Đang tạo ảnh |
| `pending_review` | 4 | tạm `/admin/stories/{id}/images` | Sẵn sàng duyệt |
| `approved` | 4 | tạm `/admin/stories/{id}/images` | Đã duyệt |
| `published` | 4 hoàn tất | tạm `/admin/stories/{id}/images` | Đã xuất bản |
| `archived` | — | `/admin/stories` | Không hiện workflow |
| Unknown | — | `/admin/stories` | Fail-safe |

Khi Phase 5 có route thật:

```text
pending_review | approved | published
  -> /admin/stories/{id}/review
```

Presentation function nên nhận đúng future-compatible signal đã khóa ở Phase 5:

```ts
imageWorkflowKind?: 'initial' | 'review_regeneration' | null;
activeImageRegenerationPageId?: number | null;
```

Manual regeneration phải ở bước 4 khi `imageWorkflowKind='review_regeneration'`; không tạo generic `workflowStage` khác contract Phase 5.

---

## 6. Target happy path

### 6.1 Luồng đích

```text
Điền setup
  -> Tạo và sinh nội dung
  -> đọc/chỉnh text
  -> Xác nhận và chuẩn bị minh họa
  -> confirmation khóa text
  -> kiểm tra nhân vật từng trang
  -> Bắt đầu sinh N ảnh
  -> confirmation image operation
  -> theo dõi gallery/progress
  -> sẵn sàng human review
```

### 6.2 Click budget

Không tính thao tác nhập/chọn field:

1. `Tạo và sinh nội dung`.
2. `Xác nhận và chuẩn bị minh họa`.
3. Confirm trong text-lock modal.
4. `Bắt đầu sinh N ảnh`.
5. Confirm trong image-operation modal.

Các nhánh chủ động vẫn tồn tại:

- `Chỉ lưu nháp` cho người muốn dừng ở draft.
- `Lưu thay đổi` cho existing draft nhưng chưa muốn gọi AI.
- `Thử lại chuẩn bị minh họa` nếu text đã khóa nhưng image plan thất bại.
- `Tiếp tục K ảnh còn lại`, `Thử lại K ảnh` hoặc `Đồng bộ kết quả` khi recovery.

---

## 7. Kiến trúc frontend đề xuất

### 7.1 Shared feature mới

```text
frontend/src/features/story-workflow/
├── types.ts
├── workflow.ts
├── workflow.test.ts
├── orchestration.ts
├── orchestration.test.ts
└── components/
    ├── StoryWorkflowShell.tsx
    ├── StoryWorkflowStepper.tsx
    ├── WorkflowHeader.tsx
    ├── WorkflowActionBar.tsx
    ├── WorkflowStateMessage.tsx
    └── StorySetupSummary.tsx
```

Tên file có thể điều chỉnh theo convention repo, nhưng boundary phải được giữ.

### 7.2 Presentation model

Ví dụ:

```ts
type WorkflowStepKey = 'setup' | 'text' | 'images' | 'review';

interface WorkflowPresentation {
  currentStep: 1 | 2 | 3 | 4;
  currentKey: WorkflowStepKey;
  completedSteps: WorkflowStepKey[];
  lockedSteps: WorkflowStepKey[];
  canonicalHref: string;
  allowedReadOnlySteps: WorkflowStepKey[];
  resumeLabel: string;
  readOnly: boolean;
}
```

Route guard nhận thêm requested/current href và phải phân loại:

```ts
type WorkflowRouteMode = 'current' | 'historical_readonly' | 'redirect';
```

- Current route: render đủ action canonical.
- Historical route thuộc `allowedReadOnlySteps`: render read-only, không redirect.
- Future/invalid route: redirect về `canonicalHref`.

Ví dụ story ở bước 3 được mở `/setup` hoặc `/edit` để xem read-only; truy cập thẳng `/review` khi route/capability chưa tồn tại phải redirect.

`workflow.ts` phải là pure function:

- Không fetch.
- Không mutation.
- Không đọc router.
- Không tự suy capability phức tạp của image/review.
- Có table-driven tests cho mọi status.

### 7.3 StoryWorkflowShell

Shell sở hữu:

- Breadcrumb/back-to-list thống nhất.
- Story title/status presentation.
- Stepper.
- Layout width/padding.
- Slot cho primary/secondary action.
- Bottom padding để action bar không che content.

Shell không sở hữu:

- Story fetch/poll.
- Setup local form state.
- Text mutation.
- Image mapping draft.
- Modal state.
- Backend capability rules.

Không render nested `<main>`. Mỗi route chỉ có đúng một landmark `<main>`.

### 7.4 WorkflowActionBar

Yêu cầu:

- Fixed dưới viewport hoặc implementation tương đương thực sự luôn nhìn thấy.
- `z-index` dưới modal, trên nội dung.
- Background có blur/contrast đủ đọc.
- Desktop: status/dirty state bên trái, secondary + primary bên phải.
- Mobile: primary full-width; secondary gọn hoặc nằm hàng trên.
- Dùng `padding-bottom: env(safe-area-inset-bottom)`.
- Main content có spacer/padding đủ lớn.
- Không che field đang focus hoặc control cuối trang.

---

## 8. Work packages chi tiết

### WP-1 — Workflow mapping, shell và stepper

Thực hiện:

- Tạo presentation model/pure mapping.
- Di chuyển route/label mapping hiện có về một source of truth; `stories/routes.ts` có thể re-export để giảm churn.
- Tạo shell, stepper và action bar dùng chung.
- Bọc các route:
  - `/admin/stories/new`
  - `/admin/stories/{id}/setup`
  - `/admin/stories/{id}/edit`
  - `/admin/stories/{id}/images`
- Loại bỏ breadcrumb/header bị lặp sau khi bọc shell.
- Route guard phải cho historical completed step ở chế độ read-only; chỉ future/invalid route mới redirect canonical trước khi hiện action sai.
- Loading giữ skeleton của shell/stepper để giảm layout shift.

Stepper desktop:

```text
[✓ Thiết lập] -- [● Nội dung] -- [○ Minh họa] -- [○ Duyệt & xuất bản]
```

Stepper mobile:

```text
Bước 2/4 · Nội dung
```

Acceptance:

- Có đúng một `aria-current="step"` khi workflow chưa completed.
- Current/completed/locked không chỉ phân biệt bằng màu.
- Future step không interactive.
- Completed step chỉ link khi route read-only thực sự hợp lệ.
- Direct navigation vào `/setup` và `/edit` ở downstream status phải có test current/read-only/redirect rõ ràng.
- Published hiển thị đủ bốn bước completed.
- Archived không render stepper.

### WP-2 — Setup UX và create/generate orchestration

#### New story

Action bar:

- Secondary: `Chỉ lưu nháp`.
- Primary: `Tạo và sinh nội dung`.

Primary flow:

```text
validate local form
  -> POST createStory đúng một lần
  -> lưu storyId ngay khi response create thành công
  -> POST generateStoryText(storyId)
  -> reconcile canonical story khi timeout/409/network ambiguity
  -> route /edit nếu generating_text hoặc text_draft
  -> route /setup với notice nếu story vẫn draft
```

Presentation trong operation dài:

- Ngay khi create response trả về và story ID đã biết, shell chuyển local transitional presentation sang bước 2 với copy `Đã lưu bản nháp · đang tạo nội dung`.
- Không navigate/unmount request generation đang chạy chỉ để đổi stepper.
- Khi request settle hoặc canonical reconcile xong mới route `/edit`/`/setup` tương ứng.
- Refresh/back trong second leg không được auto gửi lại create/generate; page load chỉ fetch canonical state rồi đưa người dùng về route phù hợp.
- Nếu component unmount, không có `useEffect` hoặc query flag tự kích hoạt lại mutation.

Failure contract bắt buộc:

- Create lỗi chắc chắn: không gọi generate.
- Create response đã trả ID: mọi retry sau đó chỉ retry generation, không create lại.
- Create request bị network ambiguity trước khi client nhận ID: không auto retry mù vì POST create chưa có idempotency key; hiển thị cảnh báo “Bản nháp có thể đã được tạo” và CTA kiểm tra danh sách.
- Generation lỗi sau create: không rollback/delete draft.
- Reconcile cũng lỗi: block mutation, chỉ cho `Kiểm tra lại trạng thái`.
- Không navigate rồi fire-and-forget generation.
- CTA one-click này là **best-effort khi chưa có create idempotency key**. UI ngăn auto/double-submit nhưng không thể chứng minh không duplicate nếu người dùng tự submit lại sau một create outcome hoàn toàn không xác định.

#### Existing draft

Action bar:

- Secondary: `Lưu thay đổi`.
- Primary: `Lưu và sinh nội dung`.
- Helper copy: `Thiết lập hiện tại sẽ được lưu trước khi tạo nội dung.`

Reuse/tách logic `updateStory -> generateStoryText -> fetchStory reconcile` đang có ở setup page; không copy một phiên bản khác sang new page.

#### Form/accessibility

- `StorySetupForm` không tự quyết định visual hierarchy của workflow CTA ở nhiều nơi.
- Invalid submit focus/scroll tới field lỗi đầu tiên.
- Field error liên kết bằng `aria-describedby`.
- Character và art-style card phải dùng native input/label hoặc button/radio semantics; không dùng clickable `div` không keyboard-accessible.
- Config loading/error không xóa input người dùng đã nhập.
- Mobile compact summary phải hiển thị đúng backbone, genre, art style, target age và length đang chọn; không lấy phần tử config đầu tiên làm hidden default.
- `Tùy chỉnh` dùng accordion/bottom sheet accessible; giá trị hiển thị trong summary phải đúng payload create/update được gửi.
- Non-draft setup dùng `StorySetupSummary` compact read-only, không render toàn bộ form disabled.

### WP-3 — Text editor và confirm/prepare orchestration

Action bar theo state:

| State | Primary action |
|---|---|
| `generating_text` | Không mutation; status-only |
| `text_draft` | `Xác nhận và chuẩn bị minh họa` |
| Confirm pending | `Đang xác nhận nội dung…` disabled |
| Image plan pending | `Đang chuẩn bị minh họa…` disabled |
| `text_confirmed` read-only | Không edit action |

Giữ modal hiện tại vì confirm khóa nội dung. Modal phải nói rõ:

- Nội dung sẽ chuyển read-only.
- Sau xác nhận, hệ thống chuẩn bị kế hoạch minh họa.
- Warning/unvalidated acknowledgment hiện tại vẫn bắt buộc.

Safe chain:

```text
confirmStoryText(expected text revision)
  -> confirm canonical success
  -> fetchStoryImages để lấy text/image-plan revision thật
  -> createImagePlan bằng revision canonical
  -> canonical reconcile nếu timeout/409/network ambiguity
  -> route /images
```

Presentation trong second leg:

- Ngay khi confirm response thành công, editor chuyển read-only và shell chuyển local transitional presentation sang bước 3 với copy `Nội dung đã xác nhận · đang chuẩn bị minh họa`.
- Không unmount request `createImagePlan` đang chạy chỉ để đổi stepper.
- Refresh/back sau confirm chỉ fetch canonical state; không auto-call plan từ `useEffect`, query string hoặc mount side effect.
- Nếu refresh làm mất second leg, `/images` hiển thị canonical `plan_missing` và CTA retry; không confirm text lần hai.

Failure semantics:

- Confirm thất bại: không gọi image plan.
- Confirm thành công nhưng image plan thất bại: text vẫn `text_confirmed`; không báo “xác nhận thất bại”.
- Trường hợp trên phải route sang `/images` với thông báo: `Nội dung đã được xác nhận; kế hoạch minh họa chưa tạo được.`
- CTA tiếp theo là `Thử lại chuẩn bị minh họa`; không yêu cầu confirm text lần nữa.
- Không hard-code image-plan revision `0`.
- Không auto retry remote AI operation sau timeout khi chưa reconcile canonical.
- Loại bỏ extra CTA `Tiếp tục chuẩn bị minh họa` sau khi confirm thành công.

`useStoryEditor.confirm()` hiện chỉ cần được điều chỉnh vừa đủ để caller nhận kết quả canonical/transition result; không refactor toàn bộ hook.

Editor usability:

- Sticky confirm luôn nhìn thấy dù 4 hay 14 trang.
- Thêm page navigator/anchor compact nếu chi phí thấp; đây là P1 nhưng khuyến nghị thực hiện.
- Quick action, add/delete/reorder/retranslate vẫn là local secondary action.
- Khi AI mutation pending, chỉ disable control liên quan theo contract hiện có.
- `text_confirmed` khi mở lại chỉ hiển thị read-only; không render edit controls.

### WP-4 — Image plan/mapping/start orchestration

#### State modes

Image workspace phải render theo mode thay vì một layout cho mọi state:

```text
plan_missing
mapping_review
generating
recovery
complete_readonly
```

#### Plan missing

- Primary: `Chuẩn bị minh họa` hoặc `Thử lại chuẩn bị minh họa`.
- Hiển thị rõ text đã được xác nhận.
- Không lộ revision/status code trong headline.

#### Mapping review

- Heading: `Kiểm tra nhân vật từng trang`.
- P0 có thể reuse page card hiện tại nhưng phải collapse technical content mặc định và giữ action bar luôn thấy.
- P1 khuyến nghị đổi sang compact page row/accordion:
  - số trang;
  - mô tả cảnh ngắn;
  - chip/thumbnail nhân vật;
  - mapping controls;
  - expandable `Xem nội dung và chi tiết kỹ thuật`.
- Không mở sẵn toàn bộ Vietnamese + Khmer + English prompt cho mọi trang.
- Main UI ẩn `image plan revision`; chỉ để ở technical details nếu thật sự cần debug.

Action bar:

- Mapping clean: primary `Bắt đầu sinh N ảnh`.
- Mapping dirty: vẫn primary `Bắt đầu sinh N ảnh`; helper `Thay đổi nhân vật sẽ được lưu trước khi bắt đầu`.
- Có thể giữ secondary `Lưu thay đổi` để người dùng rời trang mà chưa muốn sinh ảnh.

Khi user xác nhận modal image operation:

```text
if mapping dirty:
    saveImagePlanMapping(current revision, complete page payload)
    use canonical image_plan_revision returned by save
startImageGeneration(canonical revision)
reconcile canonical state on timeout/409/network ambiguity
```

Failure contract:

- Save mapping lỗi: không gọi start.
- Save mapping thành công nhưng start lỗi: không rollback mapping; hiển thị `Lựa chọn nhân vật đã lưu, quá trình tạo ảnh chưa bắt đầu.`
- Không start bằng revision cũ trong closure sau save.
- Không bỏ hàng rào `blocked`; action bar không được bypass reconcile.
- Double click/Enter lặp không tạo hai request.
- Modal start/retry/resume/finalization hiện tại vẫn phân biệt đúng mode.

Để chain an toàn, `saveMapping()` nên trả canonical `StoryImagesState` hoặc discriminated result thay vì chỉ boolean. `startGeneration()` phải nhận/use revision vừa được persist.

### WP-5 — Image generation progress/gallery

Khi `generating_images`, chuyển trọng tâm khỏi plan editor sang progress/gallery.

Header/action bar status:

```text
Bước 3/4 · Minh họa
Đang tạo trang 1 · 0/6 ảnh hoàn tất
```

Progress view:

- P0 có list/grid trạng thái đúng N page và active page rõ ràng; có thể reuse `GeneratedImageCard`.
- P1 polish thành gallery/strip hoàn chỉnh.
- Mỗi tile thể hiện một trong bốn trạng thái:
  - Đang chờ.
  - Đang tạo.
  - Hoàn tất với thumbnail.
  - Cần thử lại.
- Active page nổi bật và có label rõ.
- Completed image xuất hiện dần theo canonical poll.
- P1 có nút/anchor `Đi tới trang đang xử lý` nếu danh sách dài.
- Text/prompt/mapping chuyển vào collapsed technical detail, không chiếm main viewport.
- Poll error giữ last-known progress/thumbnail; không quay về skeleton rỗng.
- `aria-live=polite` chỉ announce khi active page/count/status thay đổi, không announce mỗi poll.
- Broken/null image giữ fallback hiện tại và phải thử URL mới khi canonical URL đổi.

Copy an toàn:

```text
Mỗi ảnh có thể mất vài phút.
Bạn có thể quay lại xem sau; các ảnh đã hoàn tất sẽ được giữ lại.
```

Không hiển thị ETA giả.

#### Recovery copy/action

| Canonical capability | Headline | Primary CTA |
|---|---|---|
| `can_resume`, còn K trang | `Quá trình tạo ảnh bị gián đoạn` | `Tiếp tục K ảnh còn lại` |
| `can_retry`, K failed/pending | `Có K ảnh cần thử lại` | `Thử lại K ảnh` |
| finalization-only | `Ảnh đã được lưu, cần đồng bộ trạng thái` | `Đồng bộ kết quả` |
| poll error, chưa stale | `Chưa cập nhật được tiến độ mới nhất` | Không generation CTA; secondary `Kiểm tra lại` |

Không dùng `job`, `stale`, `reclaim` trong main UI.

#### Complete state

- Hiển thị gallery read-only.
- `pending_review`: step 4 active, nhưng Phase 4.5 độc lập chỉ hiện `Sẵn sàng duyệt`; không tạo API review giả.
- Khi Phase 5 route tồn tại, CTA đổi thành `Đi tới duyệt truyện` và canonical href `/review`.

### WP-6 — Story list, read-only history và terminology

Story card phải dùng cùng workflow mapping với shell:

| Status | Resume label |
|---|---|
| `draft` | Tiếp tục thiết lập |
| `generating_text` | Xem tiến độ nội dung |
| `text_draft` | Tiếp tục biên tập |
| `text_confirmed` | Chuẩn bị minh họa |
| `generating_images` | Xem tiến độ ảnh |
| `pending_review` | Sẵn sàng duyệt |
| `approved` | Đã duyệt |
| `published` | Quản lý chia sẻ |
| `archived` | Không workflow CTA |

Khi Phase 5 có share state, presentation không được suy CTA chỉ từ `status`:

- `approved`: primary `Xuất bản và tạo liên kết`;
- `published + active`: primary `Sao chép liên kết`, `Mở bản đọc` secondary, revoke/archive destructive;
- `published + inactive`: primary `Tạo liên kết chia sẻ mới`, không render `Xem truyện`;
- Story card chỉ dùng share-aware CTA nếu list projection có canonical `share_active`; không cần raw token/path ở list. Card route tới `/review` để fetch share object đầy đủ, không đoán link.

Nếu list API chưa có page progress thì không tự bịa `x/N` ở card.

Chuẩn hóa copy:

| Không dùng trong main UI | Thay bằng |
|---|---|
| `Đã duyệt text` | `Đã xác nhận nội dung` |
| `Review mapping nhân vật` | `Kiểm tra nhân vật từng trang` |
| `Mapping nhân vật đã khóa` | `Lựa chọn nhân vật đã khóa` |
| `image plan revision` | Ẩn khỏi main UI |
| `Job sinh ảnh bị gián đoạn` | `Quá trình tạo ảnh bị gián đoạn` |
| `reclaim job` | `Tiếp tục các ảnh còn lại` |
| `Band` | `Độ dài đã chọn` |

Internal status/revision có thể nằm trong expandable technical details, không làm headline.

---

## 9. Transition orchestration contract

Không để mỗi page tự viết một bản reconcile khác nhau. Shared orchestration có thể trả discriminated result:

```ts
type WorkflowTransitionResult<T> =
  | { kind: 'success'; canonical: T; nextHref: string }
  | { kind: 'partial'; canonical: T; message: string; nextHref: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'failed'; message: string };
```

Tên/type cụ thể tùy dev, nhưng phải phân biệt:

- Bước đầu chưa commit.
- Bước đầu đã commit nhưng bước sau lỗi.
- Mutation outcome không chắc chắn và canonical reread thành công.
- Mutation outcome không chắc chắn và canonical reread cũng lỗi.

### 9.1 Create -> generate

| Tình huống | Hành vi bắt buộc |
|---|---|
| Create fail | Không generate |
| Create success, generate success/running | Route `/edit` |
| Create success, generate fail, canonical `draft` | Giữ draft, route `/setup`, cho retry generate |
| Generate timeout, canonical `generating_text/text_draft` | Route `/edit`, không gửi lại |
| Generate uncertain, reconcile fail | Block, chỉ `Kiểm tra lại trạng thái` |
| Create response mất trước khi có ID | Không auto retry create; hướng người dùng kiểm tra danh sách |

### 9.2 Confirm -> image plan

| Tình huống | Hành vi bắt buộc |
|---|---|
| Confirm fail | Không prepare plan |
| Confirm success, plan success | Route `/images` với plan ready |
| Confirm success, plan fail | Route `/images`; text vẫn confirmed; CTA retry plan |
| Plan timeout/409, canonical plan ready | Route `/images`, không gọi lại |
| Plan uncertain, reconcile fail | Route `/images` ở blocked/reconcile state; không confirm lại |

### 9.3 Mapping -> start

| Tình huống | Hành vi bắt buộc |
|---|---|
| Mapping clean | Start bằng canonical current revision |
| Mapping dirty, save success | Start bằng revision trả về từ save |
| Save fail | Không start |
| Save success, start fail | Mapping giữ nguyên; start retry riêng |
| Start timeout/409, canonical generating | Chuyển progress mode |
| Start uncertain, reconcile fail | Block mọi generation mutation |

---

## 10. File scope dự kiến

### 10.1 File mới

```text
frontend/src/features/story-workflow/types.ts
frontend/src/features/story-workflow/workflow.ts
frontend/src/features/story-workflow/workflow.test.ts
frontend/src/features/story-workflow/orchestration.ts
frontend/src/features/story-workflow/orchestration.test.ts
frontend/src/features/story-workflow/components/StoryWorkflowShell.tsx
frontend/src/features/story-workflow/components/StoryWorkflowStepper.tsx
frontend/src/features/story-workflow/components/WorkflowHeader.tsx
frontend/src/features/story-workflow/components/WorkflowActionBar.tsx
frontend/src/features/story-workflow/components/WorkflowStateMessage.tsx
frontend/src/features/story-workflow/components/StorySetupSummary.tsx
frontend/src/features/story-images/components/ImagePageProgressGrid.tsx
frontend/src/features/story-images/components/ImagePlanCompactRow.tsx
```

Đây là file map dự kiến, không bắt buộc tạo file rỗng nếu component đủ nhỏ. Không dồn tất cả vào `StoryImageWorkspace.tsx`.

### 10.2 File chỉnh sửa chính

```text
frontend/src/app/admin/stories/new/page.tsx
frontend/src/app/admin/stories/[id]/setup/page.tsx
frontend/src/app/admin/stories/[id]/edit/page.tsx
frontend/src/app/admin/stories/[id]/images/page.tsx
frontend/src/features/stories/routes.ts
frontend/src/features/stories/routes.test.ts
frontend/src/features/stories/components/StorySetupForm.tsx
frontend/src/features/stories/components/StoryListItem.tsx
frontend/src/features/story-editor/useStoryEditor.ts
frontend/src/features/story-editor/components/StoryTextEditor.tsx
frontend/src/features/story-editor/components/ConfirmTextDialog.tsx
frontend/src/features/story-images/useStoryImages.ts
frontend/src/features/story-images/types.ts
frontend/src/features/story-images/components/StoryImageWorkspace.tsx
frontend/src/features/story-images/components/ImageGenerationProgress.tsx
frontend/src/features/story-images/components/ImagePlanCard.tsx
frontend/src/features/story-images/components/StartImageGenerationDialog.tsx
```

### 10.3 Backend

P0 dự kiến **không chỉnh backend**.

Nếu dev thấy cần backend change để hoàn thành P0, phải dừng và báo PM trước; không tự mở migration/API contract.

Optional enhancements phải tách task:

- Idempotency key/client request ID cho create story.
- `active_page_no`, sanitized heartbeat/resume time.
- `workflow_stage` và Phase 5 capability flags.
- Durable external worker/queue.

### 10.4 Documentation sau implementation

```text
plan/01-decisions-log.md
plan/03-user-flows.md
plan/04-implementation-plan.md
plan/HANDOFF.md
```

Chỉ cập nhật status sau khi gate tương ứng thật sự pass.

`PHASE_5_HUMAN_REVIEW_PUBLISH_READER_PLAN.md` hiện là tài liệu baseline riêng. Dev Phase 4.5 **không sửa/stage file này**; chỉ ghi trong handoff rằng Phase 5 phải reuse shell và đổi route mapping. PM sẽ đồng bộ Phase 5 plan sau khi baseline tài liệu được commit hoặc giao cùng scope rõ ràng.

---

## 11. Automated test matrix

### 11.1 Workflow mapping

- Mọi known status map đúng step, completed/locked, canonical href và resume label.
- Unknown status fail-safe về story list.
- Archived không có workflow CTA.
- `pending_review/approved/published` không trỏ `/review` trước khi route thật tồn tại.
- Sau Phase 5, `imageWorkflowKind=review_regeneration` và active page marker giữ manual regeneration ở step 4.
- Historical `/setup` và `/edit` downstream render read-only; future/invalid route redirect canonical.

### 11.2 Stepper/action bar

- Có accessible nav name và đúng một `aria-current=step`.
- Future step không interactive.
- Completed step không mở edit controls.
- Tại mỗi state chỉ có một workflow primary action.
- Modal mở thì background action không click/focus được.
- Action pending disable ngay; double click/Enter không gọi mutation hai lần.

### 11.3 Setup orchestration

- `createStory` chạy trước `generateStoryText`.
- Create fail không gọi generate.
- Create success + generate fail chỉ tạo đúng một draft.
- Timeout generation + canonical generating route đúng `/edit`.
- Reconcile fail khóa mutation.
- Existing draft update chạy trước generate.
- Secondary save không gọi AI.
- Sau create commit, transitional presentation chuyển step 2 trong khi generation request còn pending.
- Unmount/refresh/back không gửi create/generate lần hai.

### 11.4 Text orchestration

- Confirm fail không gọi create image plan.
- Confirm success gọi fetch canonical image state trước plan.
- Plan dùng đúng text/image-plan revision canonical.
- Confirm success + plan fail không hiện lỗi “xác nhận thất bại”.
- Confirm success route `/images`; không còn extra continue CTA.
- Warning/unvalidated acknowledgment không regress.
- Poll và editor mutation hiện tại không regress.
- Sau confirm commit, transitional presentation chuyển step 3 trong khi plan request còn pending.
- Refresh/back không auto-call image plan từ mount effect.

### 11.5 Mapping/start

- Mapping clean gọi start trực tiếp sau modal confirm.
- Mapping dirty gọi save rồi start theo đúng thứ tự.
- Start dùng revision trả về từ save.
- Save fail không gọi start.
- Save success + start fail giữ mapping canonical.
- Timeout/409 canonical generating chuyển progress mode.
- Blocked state không gửi mutation.
- Retry/resume/finalization mode và modal reconciliation hiện tại không regress.

### 11.6 Progress/gallery

- Page có `generating` hiển thị `Đang tạo trang X` kể cả completed = 0.
- N tile khớp N pages.
- Completed URL render thumbnail; failed/pending/generating có label riêng.
- Poll error giữ last-known canonical state.
- Null `updated_at` không crash.
- Broken image fallback và URL-change retry regression vẫn pass.
- `aria-live` không announce lại khi poll không đổi meaningful state.

### 11.7 Route/list regressions

- Story list và workflow shell dùng cùng presentation mapping.
- Wrong deep-link redirect canonical.
- Back/forward không trigger orchestration lại.
- Auth/admin guard không đổi.
- Existing loading/error/retry paths vẫn pass.

---

## 12. Accessibility và responsive acceptance

### 12.1 Automated/component expectations

- Stepper dùng `<nav aria-label="Tiến trình tạo truyện">` và ordered list.
- Status không phụ thuộc riêng màu sắc.
- Character/style selection thao tác được bằng keyboard.
- Dialog có accessible title, focus trap, Escape khi chưa pending và focus restore.
- Progress có accessible status/value text.
- Form error liên kết đúng label/description.
- Focus-visible không bị tắt.

### 12.2 Manual viewport matrix

Chạy tối thiểu:

- 320 × 568.
- 360 × 800.
- 390 × 844.
- 667 × 375 landscape, vẫn mobile compact.
- 844 × 390 landscape, vẫn mobile compact dù width trên 768px.
- 768 × 1024.
- 1280 × 720.
- 1440 × 900.
- Browser zoom 200%.

Kiểm tra:

- Không horizontal overflow.
- Sticky action bar không che field, Khmer text, page card hoặc CTA cuối trang.
- Modal dài scroll bên trong viewport.
- Keyboard-only hoàn thành được happy path.
- Focus ring luôn nhìn thấy.
- Khmer không bị cắt dòng.
- Reduced motion không làm mất thông tin trạng thái.
- Mobile quick-create/progress/recovery dùng được bằng touch; deep route degrade read-only đúng 3.4.
- Resize/rotate và app trở lại foreground không reset state hoặc phát duplicate mutation.
- Deep controls chỉ xuất hiện khi đồng thời đủ `min-width: 768px` và `min-height: 600px`; không dùng user-agent.

---

## 13. Manual/browser acceptance scenarios

### Scenario A — Create và generate thành công

1. Mở `/admin/stories/new`.
2. Điền setup hợp lệ.
3. Xác nhận stepper ở bước 1 và action bar luôn nhìn thấy.
4. Bấm `Tạo và sinh nội dung` một lần.
5. Xác nhận chỉ một story được tạo.
6. UI chuyển bước 2 và phản ánh generating/text draft đúng canonical state.

### Scenario B — Create thành công, generation lỗi

1. Làm generation fail/timeout có kiểm soát.
2. Xác nhận draft vẫn tồn tại.
3. Không có story duplicate.
4. CTA chỉ retry generation, không create lại.

### Scenario B2 — Create outcome hoàn toàn không xác định

1. Mô phỏng mất response của `POST /stories` trước khi client nhận story ID.
2. Xác nhận UI không auto retry create và không tự gọi generation.
3. Hiển thị rõ `Bản nháp có thể đã được tạo` cùng CTA kiểm tra danh sách.
4. Ghi nhận limitation: khi chưa có idempotency key, không thể định danh chắc chắn draft vừa tạo nếu nhiều admin đồng thời tạo nội dung giống nhau.

### Scenario C — Text confirm và plan partial failure

1. Confirm text draft.
2. Làm image plan fail.
3. Xác nhận text vẫn `text_confirmed` và read-only.
4. `/images` nói rõ plan chưa tạo được.
5. Retry plan không yêu cầu confirm text lần hai.

### Scenario D — Dirty mapping và start

1. Sửa mapping ở trang cuối.
2. Không cuộn ngược lên; action bar vẫn nhìn thấy.
3. Bấm `Bắt đầu sinh N ảnh`, xác nhận modal.
4. Xác nhận mapping save trước và start dùng revision mới.
5. Completed page không bị reset.

### Scenario E — Long-running first image

1. Bắt đầu story 6+ trang.
2. Khi completed vẫn `0/N`, UI phải hiện rõ `Đang tạo trang X`.
3. Scroll toàn trang; compact progress/action vẫn nhìn thấy.
4. Completed thumbnail xuất hiện dần.

### Scenario F — Poll error và stale recovery

1. Tạm làm poll lỗi nhưng job chưa stale.
2. Last-known progress vẫn hiển thị; không có nút start/retry sai.
3. Khi canonical `can_resume`, CTA đổi thành `Tiếp tục K ảnh còn lại`.
4. Sau reconcile, modal/action tự đổi theo canonical state mới.

### Scenario G — Read-only previous steps

1. Từ step 3 mở step 1 hoặc step 2 đã hoàn tất.
2. Chỉ xem summary/content read-only.
3. Không có save/generate/edit controls.
4. Có action rõ để quay lại current canonical step.

---

## 14. Quality gates

### 14.1 Frontend automated — bắt buộc

```powershell
cd frontend
npm run test -- --run
npm run lint
npx tsc --noEmit
npm run build
```

Yêu cầu:

- 0 test failure.
- 0 lint error; warning cũ phải báo rõ, không tạo warning mới.
- TypeScript clean.
- Production build pass.

### 14.2 Repository — bắt buộc

```powershell
git diff --check
git status --short
```

- Không stage/commit file backend hoặc plan Phase 5 không thuộc task.
- Không commit secret, `.env`, log hoặc ảnh test tạm.
- Không ghi đè thay đổi đang có của dev khác.

### 14.3 Browser/manual — bắt buộc để gọi UX accepted

Automated frontend pass chỉ được gọi **code-complete offline**.

Chỉ gọi **UX accepted** sau khi:

- Scenario A–G được chạy trên app thật.
- Viewport matrix được kiểm tra.
- Ít nhất một text generation và một image generation live được quan sát từ UI, hoặc ghi rõ gate live vẫn deferred vì chi phí/provider.

---

## 15. Implementation slices và sequencing

### Slice 1 — Presentation foundation

- Workflow pure mapping/tests.
- Shell, stepper, header và action bar.
- Route integration và story-list mapping.

Không làm API orchestration trong slice này.

### Slice 2 — Setup và text journey

- Setup CTA/sticky UX.
- Shared create/update -> generate reconciliation.
- Text sticky confirm.
- Confirm -> image plan partial-success semantics.
- Compact read-only setup.

### Slice 3 — Image workspace

- Plan/mapping compact mode.
- Save mapping -> start safe chain.
- Progress/gallery mode.
- Recovery copy/action.

### Slice 4 — Hardening và acceptance

- Accessibility/responsive fixes.
- Full Vitest regressions.
- Browser scenarios.
- Docs/handoff.

Ước lượng tham khảo cho một dev frontend đã quen repo: **P0 khoảng 1.5–2.5 ngày**, P1 polish thêm khoảng **1–1.5 ngày**, chưa tính live provider waiting và review vòng sau. Không dùng estimate này để bỏ test hoặc gộp commit quá lớn.

Khuyến nghị commit tách:

1. `Phase 4.5: Thêm workflow shell và điều hướng thống nhất`.
2. `Phase 4.5: Rút gọn luồng thiết lập và xác nhận nội dung`.
3. `Phase 4.5: Tối ưu mapping và tiến độ sinh ảnh`.
4. `Phase 4.5: Hoàn thiện kiểm thử và tài liệu UX`.

---

## 16. Definition of Done

Phase 4.5 được gọi **code-complete offline** khi:

- Có workflow shell 4 bước trên mọi admin story workspace hiện tại.
- Story list, stepper và canonical redirect dùng chung một presentation mapping.
- Route guard phân biệt current, historical read-only và future/invalid route.
- Mỗi state chỉ có một workflow primary CTA.
- Setup, editor và image action luôn ở vị trí nhất quán.
- New story có `Chỉ lưu nháp` và `Tạo và sinh nội dung` với partial-failure handling.
- Create unknown-outcome được xử lý best-effort; DoD không tuyên bố idempotency tuyệt đối khi backend chưa có key.
- Text confirm không còn extra continue click và phân biệt đúng confirm success/plan failure.
- Dirty mapping được save-before-start bằng revision canonical mới.
- Generating mode hiển thị active page và page-status gallery.
- Main UI không còn copy kỹ thuật đã liệt kê.
- Previous completed steps read-only compact.
- Automated frontend/repository gates pass.
- Mobile quick-create payload/summary đáp ứng 3.4; deep controls chỉ interactive khi usable canvas đủ cả width và height.
- Published action hierarchy sau Phase 5 dùng canonical share state và vẫn giữ one-primary-CTA.
- Không thay DB/backend state machine.

Phase 4.5 chỉ được gọi **UX accepted** khi manual/browser scenarios và viewport matrix pass.

---

## 17. Review blockers — REQUEST CHANGES nếu vi phạm

### P0 blocker

- Xây một mega wizard/global store thay vì giữ route/canonical feature state.
- Thêm backend endpoint/migration mà không được PM chấp thuận.
- Auto retry create khi chưa biết story ID, có thể tạo draft trùng.
- Confirm thành công nhưng plan lỗi lại báo toàn bộ confirm thất bại.
- Save mapping xong start bằng revision cũ.
- Bypass `blocked`/canonical reconcile để cho mutation tiếp.
- Auto-resume stale job hoặc auto-retry image operation có chi phí.
- Bỏ modal text lock hoặc modal image cost.
- Hiển thị fake ETA/percent.
- Render future review buttons/API giả.
- Một màn hình có nhiều workflow primary CTA cạnh tranh.
- Sticky bar che nội dung hoặc không keyboard-accessible.
- Mobile mất quick-create/progress/recovery, dùng hidden config default, có horizontal overflow hoặc phone landscape bật deep mutation trái capability policy.
- Published active/inactive cùng hiện `Xem truyện` hoặc nhiều primary CTA cạnh tranh.
- Previous completed step mở lại quyền sửa.
- Regression làm completed image bị sinh lại.
- Stage/commit thay đổi backend đang thuộc dev khác.
- Ghi UX decisions đè D36–D42 đã reserve cho Phase 5.

### P1 có thể deferred nếu ghi rõ

- Page navigator cho editor.
- Last-update time giàu thông tin khi backend chưa expose heartbeat an toàn.
- Story-list review progress `x/N` vì list API chưa có field.
- Backend idempotency key cho create.
- Durable queue/external worker.

---

## 18. Evidence dev phải bàn giao

Walkthrough cuối phải có:

1. Danh sách file changed/new theo work package.
2. Bảng status -> step -> route -> primary CTA.
3. Bằng chứng create/generate partial-failure tests.
4. Bằng chứng confirm/plan partial-success tests.
5. Bằng chứng dirty mapping save-before-start dùng revision mới.
6. Screenshot hoặc video ngắn:
   - desktop setup với sticky bar;
   - mobile stepper/action bar;
   - text editor nhiều trang;
   - image progress khi `0/N` nhưng có active page;
   - stale/retry state;
   - read-only previous step.
7. Output đầy đủ của Vitest, lint, typecheck và production build.
8. Kết quả browser/manual matrix; gate nào chưa chạy phải ghi `deferred`, không ghi pass.
9. `git status --short` và commit scope chứng minh không kéo file ngoài task.

---

## 19. Handoff sang Phase 5

Sau khi Phase 4.5 hoàn tất, Phase 5 phải reuse workflow shell thay vì tạo navigation riêng.

Phase 5 chỉ cần:

- Thêm route `/admin/stories/{id}/review`.
- Map `pending_review/approved/published` sang route thật.
- Dùng backend capability cho approve/reject/regenerate/complete-review/publish.
- Giữ manual regeneration ở step 4 qua `workflow_stage` hoặc capability/active regeneration marker.
- Đổi complete-state CTA từ placeholder sang `Đi tới duyệt truyện`.
- Gắn cover preview và public-reader CTA ở bước 4.

Không được viết lại stepper/action bar trong `story-review`; Phase 5 chỉ cung cấp workspace content và action capability cho shell đã có.
