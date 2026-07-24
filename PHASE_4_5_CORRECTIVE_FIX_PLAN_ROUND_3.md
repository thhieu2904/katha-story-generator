# Phase 4.5 — Corrective Fix Plan (Round 3)

> Trạng thái: **READY FOR DEV**  
> Phạm vi: đóng toàn bộ lỗi còn lại của Workflow UX Refinement  
> Loại thay đổi: frontend orchestration, recovery, responsive UX, accessibility và tests  
> Không gồm: encoded admin route của Phase 4.6, Phase 5, thay đổi DB

## 1. Mục tiêu

Phase 4.5 chỉ được chốt khi:

- outcome bất định không thể phát mutation trùng;
- image generation không thể bắt đầu bằng mapping chưa được xác nhận;
- recovery chỉ mở action sau canonical reread thành công;
- foreground refresh không làm mất local draft;
- GET lỗi/treo không để skeleton vô hạn;
- mobile quick-create, progress và recovery dùng được;
- validation, transitional state, navigation notice và dialog accessibility đầy đủ.

## 2. Invariant bắt buộc

1. Backend canonical state là source of truth.
2. `blocked` khóa toàn bộ dependent mutation family:
   - text-confirm blocked khóa confirm, edit, add/delete/reorder và retranslate;
   - image blocked khóa save mapping, start, retry, resume và finalization.
3. Không gọi image provider nếu canonical mapping, status và capability chưa cho phép.
4. Save mapping đã commit phải được cài vào local state trước khi start.
5. Không rollback canonical mapping chỉ vì start generation thất bại.
6. Resize, rotate, background/foreground không tự gửi mutation.
7. Mobile compact là `width < 768px` **hoặc** `height < 600px`.
8. Deep edit chỉ bật khi đồng thời `width >= 768px` **và** `height >= 600px`.
9. Poll GET lỗi chỉ giữ last-known state và cảnh báo; nó không tự tạo hoặc tự clear mutation-blocked.
10. Phase này không đổi numeric browser route; việc đó thuộc Phase 4.6 và commit riêng.

## 3. Ngoài phạm vi

- Không migration/cột DB.
- Không đổi OpenAI provider/model.
- Không thay lifecycle `draft -> text -> images`.
- Không tạo route review/publish/reader giả.
- Không sửa public share token.
- Không triển khai encoded story key.
- Không gọi live OpenAI chỉ để chứng minh UI.

## 4. Blocker phải đóng

### B1 — Save mapping lỗi vẫn có thể start bằng mapping cũ

Phân loại lỗi theo khả năng backend đã commit, không chỉ theo HTTP class:

- bất định: transport/timeout (`status=0`), `409`, `5xx`, hoặc response mà contract không chứng minh mutation chưa commit;
- xác định chưa commit: `400/401/403/404/422` theo endpoint contract hiện tại.

Với lỗi xác định:

- dừng ngay;
- không canonical reread chỉ để bypass lỗi;
- không gọi `startImageGeneration`;
- giữ local draft để sửa/thử lại.

Với lỗi bất định:

1. Fetch canonical `StoryImagesState`.
2. Normalize mapping thành `page_id -> sorted unique character_ids`.
3. So sánh exact toàn bộ page IDs và character IDs với payload dự kiến.
4. Kiểm tra canonical status/capability:
   - exact mapping + `can_start=true`: start bằng canonical revision;
   - đã `generating_images`: nhận canonical success, không POST start lần hai;
   - `can_retry/can_resume`: chuyển đúng recovery action;
   - mapping locked hoặc downstream status: không POST, route canonical;
   - mapping khác: không start, giữ local draft và chuyển conflict;
   - reread lỗi: `blocked`.

Khi save thành công:

- install ngay full save response trước khi start;
- start lỗi/reread lỗi vẫn giữ canonical mapping/revision mới;
- không bật CTA bằng revision/draft cũ.

Acceptance:

- `422` không reread/start.
- `500` reread; chỉ start khi exact mapping và capability cho phép.
- Timeout + exact mapping + `can_start` start canonical revision.
- Timeout + mapping khác không start.
- Timeout + reread fail blocked.
- Save success + start fail + reread fail vẫn giữ save response.
- Start accepted + canonical GET lỗi không mở CTA bằng state cũ.

### B2 — Create story mất ACK gây duplicate

Áp dụng cùng policy cho `Chỉ lưu nháp` và `Tạo và sinh nội dung`.

- Create `status=0/409` hoặc outcome không xác định:
  - chuyển `blocked`;
  - khóa cả hai create CTA;
  - chỉ cho `Kiểm tra danh sách truyện`;
  - không auto-retry POST.
- Definite validation error cho sửa form.
- Primary create đã trả story ID nhưng generation/reread lỗi:
  - giữ ownership story đó;
  - retry chỉ retry generation;
  - tuyệt đối không POST create lại.
- Reload/back không tự gửi create/generate.

### B3 — Confirm text mất ACK vẫn mở lại editor

Khi confirm lỗi bất định:

1. Canonical reread trước khi quyết định.
2. Nếu status đã `text_confirmed`, `generating_images`, `pending_review`, `approved` hoặc `published`:
   - xem confirm đã commit;
   - editor read-only;
   - route image/current workflow.
3. Nếu vẫn `text_draft`:
   - revision khớp: cho retry confirm;
   - revision đổi: install canonical text mới, yêu cầu review lại, không dùng revision cũ.
4. `draft/generating_text`: route canonical, không giả confirm success.
5. `archived`: khóa mutation và về list.
6. Unknown status hoặc reread fail: blocked.
7. Definite `422` hiển thị validation, không giả commit.

### B4 — Blocked bị clear trước refresh thành công

- `refresh()` trả typed result, không nuốt success/failure.
- Không clear blocked trước request.
- Chỉ clear sau canonical state được cài thành công.
- Refresh lỗi giữ blocked và retry.
- Áp dụng cho action bar, dialog reconcile, stale/resume/finalization.
- Poll GET error độc lập với mutation-blocked.

### B5 — Foreground refresh làm mất mapping chưa lưu

Khi dirty/pending/dialog snapshot:

- không overwrite local mapping;
- không reset `mappingDirty`;
- giữ base revision;
- nếu remote revision thay đổi, chuyển `mapping_conflict`.

`mapping_conflict`:

- giữ local draft;
- khóa save/start;
- hiển thị `Dữ liệu trên máy chủ đã thay đổi`;
- cho `Tải trạng thái mới nhất` với xác nhận bỏ local draft;
- nếu canonical đã locked/generating, cập nhật lock/progress ngay và không cho edit.

Khi không dirty/pending, foreground canonical refresh chạy bình thường. Response cũ không được ghi đè response mới.

### B6 — Mobile dirty mapping vẫn auto-save/start

- `isMobileCompact && mappingDirty`:
  - không save-before-start;
  - disable/hide initial start;
  - hướng dẫn mở tablet/máy tính.
- Mobile chỉ start/resume/retry khi canonical mapping đã lưu và capability cho phép.
- Desktop -> mobile khi dirty không tự accept.

### B7 — GET/loading treo vô hạn

Dùng shared read timeout `20_000ms` cho story/list/text/images/config GET.

- Abort khi unmount/route change.
- Timeout thoát skeleton, hiện error + retry.
- Có last-known state thì giữ state cũ và báo refresh/poll error.
- Poll không chạy chồng request.
- Retry GET không phát mutation.
- Backend `/health=200` nhưng story endpoint treo vẫn phải thoát loading.

### B8 — Validation và accessibility

- External action bar phải chạy cùng `validate()` của form.
- Invalid submit phải hiện lỗi, `aria-describedby`, focus/scroll field đầu tiên.
- Không chỉ disable CTA mà không giải thích.
- Dialog start image có initial focus, focus trap, Escape-close khi được phép, restore focus và internal scroll.
- Touch target tối thiểu 44px.

### B9 — Transitional presentation và navigation

- Create first leg chuyển shell sang bước 2 và giữ story ID.
- Confirm first leg chuyển editor read-only/bước 3 trước khi image-plan settle.
- Partial notice sống qua navigation bằng safe notice code/flash state.
- Published completed workflow không mang `aria-current`.
- Loading/error story hiện hữu không giả thành `/new`.
- Historical read-only có CTA về canonical step.
- Recovery giữ progress/gallery làm primary.
- Không dựng canonical object giả hoặc hard-code revision/capability.

## 5. Work packages

### WP-1 — Transition orchestration

Files chính:

- `features/story-workflow/orchestration.ts`
- `features/story-workflow/types.ts`
- `app/admin/stories/new/page.tsx`
- `features/story-editor/components/StoryTextEditor.tsx`

Thực hiện:

- helper phân loại definite/uncertain;
- typed `success | partial | blocked | failed`;
- callback/event cho `story_created`, `text_confirmed`, `mapping_saved`;
- caller cài first-leg canonical state trước second leg;
- remove fake canonical response và hard-coded revision.

### WP-2 — Exact mapping comparator

Pure helper có test:

- reject thiếu/thừa/unknown page;
- unique + sort character IDs;
- exact equality toàn mapping;
- comparator không tự suy capability.

### WP-3 — Image recovery state machine

Files chính:

- `features/story-images/useStoryImages.ts`
- `features/story-images/components/StoryImageWorkspace.tsx`

Thực hiện:

- typed refresh result;
- blocked chỉ clear sau success;
- dirty-safe foreground;
- explicit `mapping_conflict`;
- response ordering/abort guard;
- stale/retry/resume vẫn hiển thị progress/gallery primary.

### WP-4 — Mobile quick-create/action bar

- `useIsMobileCompact` fail-safe compact ở render đầu.
- Quick-create summary hiển thị:
  - backbone;
  - genre;
  - art style;
  - target age;
  - length.
- `Tùy chỉnh` mở accordion/sheet và cập nhật đúng payload.
- Không chọn phần tử config đầu tiên làm hidden default.
- Product default chỉ hợp lệ khi hiển thị rõ và chỉnh được.
- Action bar stack/wrap, primary full-width khi cần, safe-area đúng, không overflow 320px.
- `Lưu trữ` không chen ba CTA ngang hàng trên mobile.

### WP-5 — Form/dialog accessibility

- External action dùng form submit/imperative validation thống nhất.
- Focus-first-invalid.
- Error associations đầy đủ.
- Dialog keyboard/focus/viewport-low behavior.

### WP-6 — Presentation/navigation polish

- Transitional shell state.
- Destination notice.
- Published semantics.
- Explicit new/loading/story presentation.
- Historical canonical CTA.
- Bounded loading/error/retry.

## 6. Tests bắt buộc

### 6.1 Orchestration

- Save `422` -> no reread/start.
- Save `500` + exact/capable -> start canonical revision.
- Save `500` + mismatch/locked -> no start.
- Save timeout + reread fail -> blocked.
- Save success + start/reread fail giữ mapping/revision mới.
- Start accepted + GET fail không mở stale CTA.
- Save-only và primary create timeout -> blocked.
- Create success + generate/reread fail giữ story identity; không create lại.
- Create definite `422` không blocked.
- Confirm timeout + confirmed -> image route.
- Confirm timeout + matching draft -> retry-safe.
- Confirm timeout + newer revision -> install canonical, không retry revision cũ.
- Confirm timeout + archived/unknown/reread fail -> fail-safe.
- Confirm definite `422` không blocked.

### 6.2 Hook/component

- Blocked refresh fail vẫn blocked; success mới mở action.
- Foreground không xóa dirty mapping.
- Remote revision change tạo `mapping_conflict`.
- Conflict khóa save/start và confirmation discard hoạt động.
- Out-of-order poll/foreground response không overwrite state mới.
- Mobile dirty mapping không start.
- Resize desktop -> mobile khi dirty không mutation.
- Initial mobile render không flash deep controls.
- Canonical-clean mobile recovery hoạt động.
- External validation hiện lỗi/focus/ARIA.
- First-leg create -> step 2 trước second leg.
- First-leg confirm -> read-only/step 3 trước image plan.
- Quick-create summary/`Tùy chỉnh` tạo đúng payload.
- Double-submit không tạo duplicate.
- Partial notice hiện ở destination.
- Published không `aria-current`.
- Historical canonical CTA.
- Dialog focus trap/Escape/restore focus.
- Hanging GET thoát loading sau `20_000ms`.

### 6.3 Responsive matrix

- `320 × 568`
- `390 × 844`
- `667 × 375`
- `844 × 390`
- `768 × 600`
- `1440 × 900`

Compact acceptance:

- không deep mutation;
- không horizontal overflow;
- quick-create summary nhìn thấy;
- action bar touch-friendly;
- progress/recovery không bị mapping cards chiếm màn hình.

## 7. Quality gates

```bash
cd frontend
npm run test -- --run
npm run lint
npx tsc --noEmit
npm run build
```

```bash
git diff --check
git status --short
```

Không chấp nhận:

- chỉ test happy path;
- lint đỏ nhưng báo pass;
- chưa chạy `844×390` nhưng claim mobile-complete;
- blocked có thể tự clear;
- skeleton/loading vô hạn;
- live OpenAI call chỉ để test UI.

## 8. Commit strategy

Không trộn Phase 4.6.

Khuyến nghị:

1. `fix(workflow): harden Phase 4.5 mutation recovery`
2. `fix(workflow): complete responsive and accessible workflow UX`
3. `test(workflow): cover Phase 4.5 corrective scenarios`

Hoặc squash:

```text
fix(workflow): close Phase 4.5 corrective review
```

## 9. Definition of Done

- B1–B9 có regression test.
- Không duplicate mutation trong outcome bất định.
- Không start image bằng mapping/status/capability chưa xác nhận.
- Mapping save response không bị rollback trong UI.
- Foreground không mất local draft; conflict có đường xử lý.
- Không loading vô hạn.
- Mobile quick-create/progress/recovery đạt matrix.
- Validation, transitional state, notice và dialog accessibility đạt acceptance.
- Không fake canonical/hard-coded revision.
- Test, lint, typecheck, build và `git diff --check` pass.
- Manual browser acceptance có evidence.
- Worktree/commit chỉ chứa Phase 4.5 scope.

