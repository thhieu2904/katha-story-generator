# Katha — Nhật ký quyết định

> Ghi lại TẤT CẢ quyết định đã thảo luận, lý do, và trạng thái.
> Ngày cập nhật: 2026-07-20

---

## Quyết định đã chốt ✅

### D01: Tên dự án — Katha
- **Quyết định**: Tên brand "Katha", repo `katha-story-generator`
- **Lý do**: Gốc Pali (កថា = truyện kể), tồn tại trong Khmer/Thai/Lao/Hindi. Đủ trung tính để mở rộng. Ghi điểm học thuật khi trình bày NCKH.
- **Lưu ý**: Cần xác nhận phát âm/chính tả với người bản ngữ Khmer

### D02: Định hướng trang — Landscape
- **Quyết định**: Tất cả truyện dùng layout ngang (landscape)
- **Lý do**: 
  - Chuẩn ngành cho truyện tranh thiếu nhi digital
  - Mô phỏng trải nghiệm sách giấy
  - Phù hợp tablet (target device chính)
  - ~~Mobile yêu cầu xoay ngang~~ — **SUPERSEDED bởi D50**; reader không ép xoay.
- **Nguồn**: BookBeam, WhimsyStudios, BookPrintingChina, SCBWI KiteTales
- **Chi tiết cũ**: ~~Fixed-layout (không reflow)~~ — **SUPERSEDED bởi D50**; mỗi page vẫn có ảnh ngang nhưng reader responsive/scrollable.
- **⚠️ SUPERSEDED một phần bởi D50**: Ảnh nội dung vẫn landscape 16:9, nhưng reader responsive một cột, cho phép vertical scroll và không ép xoay điện thoại/fixed-layout viewport.

### D03: Backbone — 3 loại cho MVP
- **Quyết định**: Fable/Ngụ ngôn, Three-Act/Ba hồi, Cumulative/Lặp lại
- **Lý do**: Đủ cover phần lớn truyện thiếu nhi giáo dục, mỗi loại có đặc trưng riêng

| Backbone | Tên VN | Mô tả | Cấu trúc | Phù hợp | Ví dụ |
|----------|--------|-------|----------|---------|-------|
| Fable | Ngụ ngôn — Bài học cuộc sống | Bài học đạo đức rõ ràng cuối truyện | Giới thiệu → Thử thách → Lựa chọn → Hậu quả → Bài học | Dạy đạo đức, chia sẻ, trung thực | Con rùa và con thỏ |
| Three-Act | Ba hồi — Khởi đầu, Thử thách, Kết thúc | Cấu trúc kể chuyện kinh điển | Hồi 1: Giới thiệu → Hồi 2: Thử thách leo thang → Hồi 3: Giải quyết | Phiêu lưu, cốt truyện phức tạp | Tấm Cám, Thạch Sanh |
| Cumulative | Lặp lại — Càng lúc càng nhiều | Mỗi trang lặp + thêm yếu tố mới | Giới thiệu → Lặp 1 (+A) → Lặp 2 (+B) → Lặp 3 (+C) → Cao trào → Kết | Trẻ 3-5 tuổi, dạy từ vựng | Ông lão kéo củ cải |

### D04: Genre — 4 loại cho MVP
- **Quyết định**: Cổ tích, Anh hùng, Hài hước, Răn dạy
- **Lý do**: Cover đủ phổ rộng giọng văn cho truyện thiếu nhi
- **Kỹ thuật**: Mỗi genre là 1 prompt modifier ghép vào sau backbone prompt

### D05: Art Style — cho chọn, 3 loại
- **Quyết định**: Admin chọn 1 trong 3 khi tạo truyện: Tranh màu nước (Watercolor), Tranh phẳng (Flat illustration), Hoạt hình 3D (3D cartoon)
- **Lý do**: Cả 3 đều phù hợp truyện thiếu nhi, cho chọn tăng đa dạng mà không tốn thêm code
- **Quy tắc**: Cùng 1 truyện = cùng 1 style xuyên suốt
- **Kỹ thuật**: Mỗi style là 1 prompt modifier trong DB

### D06: Số trang — AI suggest + admin tinh chỉnh
- **Quyết định**: 
  - Admin chọn preference (Ngắn / Vừa / Dài), KHÔNG chọn số trang cụ thể
  - AI phân tích nội dung + preference → tự quyết số trang trong outline
  - Admin xem outline → tinh chỉnh bằng quick actions hoặc chat
  - Range cho phép: 4–16 trang
- **Lý do**: Admin không có căn cứ chọn số trang trước khi biết nội dung. AI quyết dựa trên complexity tốt hơn.
- **KHÔNG hiển thị chi phí** cho user
- **⚠️ SUPERSEDED by D25 và D26**: Không có outline riêng; AI sinh trực tiếp title + full story pages. Range hiện hành là short 4–6, medium 8–10, long 12–14 và hard limit 16 trang nội dung.

### D07: Edit flow — Quick actions + Chat (không inline edit trong MVP)

> Semantics/labels của quick actions và structural edit được D30 làm rõ. Quy tắc “không inline edit” được D37 supersede riêng cho controlled `title_km`/`text_km` edit ở `pending_review`; VI/EN/structure vẫn khóa downstream.
- **Quyết định**: 
  - Quick actions: [Rút gọn nội dung] [Viết chi tiết hơn] [Kịch tính hơn] [Đơn giản hơn] + preset khác
  - Chat: nhập yêu cầu tùy ý ("xóa trang 3", "thêm nhân vật Dara vào trang 5")
  - Drag-drop: sortable list để đổi thứ tự trang (dnd-kit, đơn giản)
  - Thêm/xóa trang: nút [+ Thêm trang] và [🗑] trên mỗi trang
  - ~~Inline text edit: KHÔNG có trong MVP~~ — **SUPERSEDED một phần bởi D37** cho Khmer-only review edit; các field còn lại vẫn khóa.
- **Lý do**: Chat + quick actions bao phủ 95% use case mà code ít hơn inline editor rất nhiều. Drag-drop chỉ là sortable list (đơn giản).
- **Thông báo thay đổi**: Khi AI điều chỉnh xong → toast báo thay đổi (trang nào thêm/xóa/gộp). Không có nút hoàn tác trong MVP.

### D08: Song ngữ Khmer/Việt
- **Quyết định**: Truyện hiển thị song ngữ
  - ~~Trong Reader: Khmer primary, Việt subtitle đồng thời~~ — **SUPERSEDED bởi D50** bằng one-language toggle, Khmer mặc định.
  - Trong **Admin** (giáo viên): Việt = primary (vì giáo viên là người Việt)
- **Lý do**: Mục đích là dạy Khmer → Khmer phải nổi bật nhất khi đọc
- **Chi phí API**: KHÔNG tốn thêm — tiếng Việt là bản gốc (đã có sẵn từ bước sinh truyện), chỉ cần 1 lần dịch VN→KM
- **⚠️ SUPERSEDED phần Reader bởi D50**: Reader không hiển thị Khmer và Việt đồng thời; mặc định Khmer và toggle chỉ đưa một body language vào accessibility tree tại một thời điểm.

### D09: Vocabulary — Future phase
- **Quyết định**: KHÔNG nằm trong MVP
- **Schema**: Chưa có trong DB hiện tại. Khi triển khai future phase sẽ thiết kế riêng.
- **Approach khi triển khai**: Hybrid (khmercut match offline + AI on-demand + tra cứu riêng)

### D10: Auth — Đơn giản
- **Quyết định**: 2-5 tài khoản tạo sẵn qua Supabase Auth dashboard
- **Roles**: Admin (tạo truyện, review) + User (đọc truyện)
- **KHÔNG cần**: UI đăng ký, quên mật khẩu, multi-tenant
- **Làm rõ bởi D49**: Role `reader` chỉ còn hữu ích để kiểm tra bị chặn khỏi admin API; unlisted public reader không yêu cầu login hoặc reader account.

### D14: Tách Text Phase / Image Phase
- **Quyết định**: 
  - **Text Phase** (Bước 1-2): sinh text VN đầy đủ + dịch KM, admin edit thoải mái. Rẻ (~$0.005/lần edit)
  - **Image Phase** (Bước 3): chỉ chạy SAU KHI admin confirm text. Đắt (~$0.13/trang), chạy 1 lần
  - ~~Text bị khóa tuyệt đối sau confirm~~ — **SUPERSEDED một phần bởi D37**; chỉ Khmer review edit là ngoại lệ có kiểm soát.
- **Lý do**: Admin thấy toàn bộ nội dung truyện (VN + KM) TRƯỚC khi tốn tiền ảnh. Sửa text 10 lần = $0.05, trong khi gen lại 8 ảnh = $1.04. Tách ra = tiết kiệm tiền khi iterate.
- **⚠️ SUPERSEDED một phần bởi D37**: Sau confirm vẫn khóa VI/EN/structure/setup/prompt/mapping; Phase 5 cho controlled edit duy nhất đối với `title_km` và `text_km` khi story ở `pending_review`.

### D15: Auto-save + Version history ⚠️ SUPERSEDED 2026-07-11
- **Quyết định gốc (đã thay thế)**:
  - ~~Lưu version cũ vào `story_outlines` table → có thể hoàn tác~~
- **Quyết định mới (2026-07-11)**:
  - Mỗi lần AI trả kết quả → auto-save trạng thái hiện tại vào DB ngay (không cần user bấm "Lưu")
  - **KHÔNG** lưu version history, **KHÔNG** có undo
  - Không có bảng `story_outlines`, `story_edit_logs`, `usage_logs` trong MVP
- **Lý do thay đổi**: Giảm complexity DB và code. MVP chỉ cần auto-save bản hiện tại. Version history/undo là feature nice-to-have, không cần cho NCKH.
- **Xem thêm**: Quyết định chưa chốt → `08-implementation-gates.md`

### D16: Sửa ảnh từng trang riêng lẻ
- **Quyết định**: Review ảnh từng trang, gen lại từng trang. KHÔNG gen lại hàng loạt.
- **Lý do**: Gen lại 1 trang = $0.13 + 10 giây. Gen lại 8 trang = $1.04 + 80 giây. Phần lớn trường hợp chỉ 1-2 trang không ưng.
- **⚠️ SUPERSEDED phần giá bởi D39**: Các số tiền trên chỉ là ước tính lịch sử, không phải runtime/UI contract; chi phí phụ thuộc model/size/quality/pricing hiện hành.

### D17: Archive thay vì Delete
- **Quyết định**: Truyện không ưng → `status = 'archived'`, KHÔNG xóa khỏi DB/R2
- **Lý do**: Data text + ảnh đã tốn tiền sinh ra, giữ lại để:
  - Tham khảo/reuse nội dung sau này
  - Tận dụng cho Phase 7 (NCKH) — thêm data points
  - Storage text gần như miễn phí, ảnh trên R2 rẻ

### D18: Hiển thị song ngữ ở Text Phase (edit stage)
- **Quyết định**: Ở bước edit, hiển thị VN (primary, sửa qua quick actions/chat — xem D07) + KM (subtitle, preview)
- **Khác với Reader**: Ở Reader, KM là primary (đang học Khmer), VN là subtitle
- **⚠️ SUPERSEDED phần Reader bởi D50**: Reader dùng one-language toggle, mặc định Khmer; Việt không còn subtitle hiển thị đồng thời.
- **Lý do**: Admin là người Việt, cần đọc/edit VN. Nhưng cũng cần xem KM preview để biết bản dịch có ổn không trước khi commit.

---

## Quyết định đã chốt (bổ sung sau test) ✅

### D11: Model AI — All OpenAI
- **Quyết định**: 
  - Image gen: `gpt-image-2` (~$0.13/ảnh)
  - Text gen + dịch + agent: `gpt-4o-mini` (~$0.002/call)
- **Test đã làm**: Gen turnaround sheets cho Srey, Dara bằng cả OpenAI và Gemini 3.1 Pro Preview
- **Kết quả**: OpenAI thắng rõ — prompt adherence tốt hơn, chi tiết văn hóa Khmer, không tự thêm text/labels
- **Gemini vấn đề**: Tự đổi tên nhân vật ("Srey" → "SOPHEA"), thêm labels, style cartoon không kiểm soát
- **Giá**: gpt-4o-mini rẻ hơn Gemini 2.5 Flash (input 2x, output 4x)
- **Chi tiết**: `05-research-notes.md`, Section 9-10

### D12: Số lượng nhân vật — 7 characters, max 2-3/scene
- **Quyết định**: Character bank 7 nhân vật, mỗi truyện dùng 2-3
- **Lý do**: Cognitive load research + AI consistency giảm khi >3 nhân vật/scene
- **Cast**: Srey, Dara, Yeay, Mae, Bopha, Lok Kru, Meas (mèo)
- **Chi tiết**: `characters/README.md`

### D13: Character reference approach — Turnaround sheet (Cách A)
- **Quyết định**: 1 turnaround sheet (4 views) / nhân vật, style-neutral
- **Lý do**: Consistency giữa các góc cao (cùng 1 lần gen), chỉ 7 files quản lý
- **Art style áp dụng qua prompt modifier**, không cần ref riêng cho mỗi style
- **Đã gen xong**: 7 sheets tại `characters/refs/`

### D19: Budget — 500K VND, combo All OpenAI
- **Quyết định**: 500K VND (~$19.6) cho toàn bộ API costs
- **Phân bổ**: ~$2.50 test/ref + ~$11.70 NCKH (10 truyện) + ~$2 gen lại + ~$3.25 buffer
- **Batch API**: Đã nghiên cứu, KHÔNG dùng (UX kém)

### D20: Auto-save bản hiện tại, không version history (2026-07-11)
- **Quyết định**: Auto-save trạng thái hiện tại sau mỗi AI response. Không lưu version history, không undo.
- **Supersedes**: D15 (phần version history)
- **Lý do**: MVP cần đơn giản. Auto-save đủ để không mất data. Undo/version history tăng complexity DB + UI mà không cần cho NCKH.
- **Ảnh hưởng**: Bỏ bảng `story_outlines`. Toast chỉ báo thay đổi, không có nút hoàn tác.

### D21: Không có story_outlines, edit logs, usage logs trong MVP (2026-07-11)
- **Quyết định**: DB MVP chỉ có 7 bảng (xem `07-database-schema.md`). Không tạo:
  - `story_outlines` — không cần undo/version
  - `story_edit_logs` — tracking NCKH sẽ thu thập ngoài hệ thống (xem gate G7)
  - `usage_logs` — xem chi phí trên OpenAI dashboard
- **Lý do**: Giảm complexity. Các bảng này không phục vụ core flow. Data NCKH thu thập bằng cách khác.
- **Xem thêm**: `08-implementation-gates.md` cho các quyết định chưa chốt

### D22: Reader public, khu vực admin bắt buộc role admin (2026-07-17)
- **Quyết định**: Reader sẽ đọc truyện public; các route `/admin/*` và API phục vụ quản trị yêu cầu đăng nhập bằng Supabase Auth với `app_metadata.app_role = "admin"`.
- **Phân quyền**: Backend luôn enforce role; frontend guard chỉ phục vụ UX. Role thiếu hoặc không hợp lệ được xem là `reader`.
- **Không làm trong MVP**: Đăng ký, quên/đổi mật khẩu và quản trị user.
- **Chốt gate**: G1.

### D23: Character Bank chỉ đọc dữ liệu seed trong MVP (2026-07-17)
- **Quyết định**: Phase 2 chỉ hiển thị 7 nhân vật seed qua API và trang admin.
- **Không làm trong Phase 2**: Tạo, sửa, xóa nhân vật; upload hoặc sinh ảnh reference mới.
- **Nguồn ảnh**: `ref_image_urls` do script upload reference của Phase 1 cập nhật.
- **Chốt gate**: G5.

### D24 — Target age dùng ba nhóm text
- Ngày: 2026-07-19
- Quyết định: target_age lưu text: preschool (3-5), early_primary (6-8), late_primary (9-12). Không dùng integer.
- Lý do: Rõ ràng hơn cho prompt và UI; tránh nhập tuổi cụ thể
- Trạng thái: ✅ Chốt

### D25 — Không có outline riêng
- Ngày: 2026-07-19
- Quyết định: Phase 3B sinh trực tiếp title + full story pages. Không tạo outline riêng.
- Lý do: Giảm complexity; outline tích hợp trong prompt
- Trạng thái: ✅ Chốt

### D26 — Mapping length và hard limit

> Initial-even và odd-after-edit policy được D30 làm rõ.
- Ngày: 2026-07-19
- Quyết định: short=4-6 trang, medium=8-10, long=12-14. Hard limit 16 trang nội dung.
- Lý do: Phù hợp lứa tuổi và chi phí AI
- Trạng thái: ✅ Chốt

### D27 — Bìa code template
- Ngày: 2026-07-19
- Quyết định: Bìa là React/Tailwind/SVG template, không sinh AI. Không nằm trong story_pages.
- Lý do: Nhất quán thương hiệu, giảm chi phí, dễ chỉnh layout
- Trạng thái: ✅ Chốt

### D28 — Mọi admin thấy/sửa mọi story
- Ngày: 2026-07-19
- Quyết định: Không filter story theo created_by. Mọi admin truy cập được tất cả story.
- Lý do: Đội nhỏ, cần cộng tác
- Trạng thái: ✅ Chốt

### D29 — Setup editable ở draft, khóa từ text_draft
- Ngày: 2026-07-19
- Quyết định: Story setup chỉ sửa khi status=draft. Từ text_draft trở đi, setup bị khóa.
- Lý do: Đảm bảo nhất quán giữa config và nội dung AI sinh
- Trạng thái: ✅ Chốt

### D30 — Page count và structural edit policy
- Ngày: 2026-07-20
- Quyết định:
  - Phase 3B initial generation chỉ sinh số trang chẵn: short `{4,6}`, medium `{8,10}`, long `{12,14}`.
  - Sau edit cho phép mọi số trong band, gồm `5/9/13`; confirm không kiểm tra chẵn/lẻ.
  - Mọi quick action giữ nguyên page count/order. Label: `Rút gọn nội dung`, `Viết chi tiết hơn`, `Kịch tính hơn`, `Đơn giản hơn`.
  - Add/delete/reorder dùng control riêng; custom instruction luôn giữ cấu trúc; add/delete/reorder chỉ qua control riêng.
  - Archive `text_draft` deferred khỏi Phase 3C P0, chỉ là P1 nếu còn thời gian.
- Lý do: Giữ UX rõ, tránh AI tự đổi cấu trúc và vẫn hỗ trợ add/delete một trang trong band.
- Trạng thái: ✅ Chốt

### D31 — Target độ dài nội dung theo nhóm tuổi
- Ngày: 2026-07-20
- Quyết định:
  - `preschool`: 1–2 câu, 12–30 từ mục tiêu, hard max 45 từ/page.
  - `early_primary`: 2–4 câu, 30–60 từ mục tiêu, hard max 80 từ/page.
  - `late_primary`: 3–5 câu, 50–90 từ mục tiêu, hard max 120 từ/page.
  - Soft ranges chỉ dùng cho prompt/quality diagnostics; hard max mới reject output bất thường.
  - Absolute caps: title 160 ký tự, page 1200 ký tự, instruction 5–1000 ký tự.
- Lý do: Kiểm soát độ khó đọc, output token và nội dung bất thường mà không hard-reject sai vì lệch nhẹ soft target.
- Trạng thái: ✅ Chốt

### D32 — Khmer validation và retranslation contract
- Ngày: 2026-07-20
- Quyết định:
  - `GET /text` không có side effect.
  - `POST /api/stories/{id}/validate-km` validate toàn bộ page snapshot; ghi flags/timestamp chỉ khi revision vẫn đúng và không tăng `text_revision`.
  - `POST /api/stories/{id}/retranslate-km` dùng union target `title | page`; retranslate thay đổi canonical Khmer content nên tăng revision.
  - Validator warning-only, không auto-correct và không giả là proof spelling/grammar.
- Lý do: Có đường validate page cũ của 3B và sửa cả title/page Khmer mà vẫn bảo toàn optimistic concurrency.
- Trạng thái: ✅ Chốt

### D33 — Text generation claim và timeout budget
- Ngày: 2026-07-20
- Quyết định:
  - Migration 003 thêm `text_generation_claim_id uuid NULL`; UUID quyết định ownership, `updated_at` chỉ xác định stale.
  - Timeout seconds: SDK attempt 60, one retry, whole operation 270, frontend 285, proxy 300, stale 600.
  - Output token caps: generation 6000, translation/edit 8000, add-page/retranslate 1500.
  - Sau timeout/mất kết nối, frontend refetch status/revision trước khi resend.
- Lý do: Ngăn request cũ finalize/reset sau stale reclaim và giữ synchronous MVP trong budget vận hành rõ ràng.
- Trạng thái: ✅ Chốt

---

## Quyết định đã chốt — Phase 4 MVP (2026-07-21)

### D34 — Image plan, per-page mapping và cost presentation
- **Quyết định**:
  - G2: AI đề xuất và admin được chỉnh 0–3 character của truyện cho từng page; persist full mapping trên `story_pages` và khóa từ lần generation đầu tiên.
  - Image plan phải bao phủ đúng toàn bộ page hiện tại; prompt được rebuild deterministic từ scene, art style và selected characters.
  - Không hiển thị/commit giá cố định cho một ảnh hoặc một truyện; số tiền phụ thuộc cấu hình image và pricing provider hiện hành.
  - Phase 4 không manual regenerate một page; đây là action review của Phase 5.
  - Migration 005 hard-fail trước DDL khi có legacy `story_pages.image_url` không rỗng hoặc story downstream `pending_review`/`approved`/`published` chưa có Phase 4 state; legacy `generating_images` không owner được normalize về `text_confirmed`.
- **Lý do**: Giữ image plan đầy đủ, mapping có revision/lock rõ ràng và không hứa chi phí sai theo thời điểm.
- **Trạng thái**: ✅ Chốt

### D35 — In-process image job, retry và progress
- **Quyết định**:
  - G4: dùng FastAPI `BackgroundTasks` sequential trong một app instance, UUID claim + heartbeat, `GET /images` polling và retry/resume trang `pending`/`failed`.
  - Claim phải commit trước khi schedule; trang `completed` là terminal trong Phase 4 và không bị sinh lại khi retry/resume.
  - Runner dùng DB-clock stale detection và claim fencing; partial failure giữ URL đã hoàn tất, story quay về `text_confirmed`, toàn bộ hoàn tất chuyển `pending_review`.
  - Task không bền qua restart/deploy; admin chủ động stale-resume. Durable queue, multi-instance orchestration và global cluster rate limit nằm ngoài MVP.
  - Default page budget `330s`: reserve toàn bộ provider retry budget `150s × 2 = 300s`, giữ `5s` finalization margin và tối đa `25s` botocore transport cho hai runner upload attempts; custom config bị reject nếu transport budget dưới `1s`; botocore không hidden retry.
  - Docker/PostgreSQL migration, browser matrix và live OpenAI/R2 smoke là verification gates deferred, không phải bằng chứng đã chạy.
- **Lý do**: Đủ an toàn cho MVP một app instance mà không thêm queue infrastructure, đồng thời giữ recovery và progress canonical trong PostgreSQL.
- **Trạng thái**: ✅ Chốt

---

## Quyết định đã chốt — Phase 5 Review & Public Reader (2026-07-24)

### D36 — Human review theo từng content page
- **Quyết định**: Mỗi page được duyệt đồng thời trên ảnh và Khmer; Khmer là nội dung chính, Vietnamese dùng để đối chiếu. `review_status` gồm `pending | approved | rejected`. Approve page cuối không tự chuyển story sang `approved`.
- **Trạng thái**: ✅ Chốt

### D37 — Controlled Khmer edit trong review
- **Quyết định**: Chỉ `title_km` và `story_pages.text_km` được sửa ở `pending_review`. Sửa page tăng `text_revision` đúng một lần, clear validation và reset riêng page về `pending`; sửa title tăng revision nhưng không reset page. Validator warning-only và approve warning/unvalidated cần xác nhận tường minh.
- **Trạng thái**: ✅ Chốt

### D38 — Explicit complete-review action
- **Quyết định**: Tất cả page approved chỉ làm CTA **Hoàn tất duyệt truyện** khả dụng. Chỉ action riêng, sau khi backend lock và revalidate canonical state, mới chuyển `pending_review -> approved`.
- **Trạng thái**: ✅ Chốt

### D39 — Regenerate đúng một rejected page
- **Quyết định**: Chỉ page `rejected` có lý do mới được regenerate. Effective prompt ghép prompt gốc đã khóa với rejection reason trong section cố định; không sửa prompt/mapping/reference. Mỗi story chỉ có một manual regeneration hoạt động và UI không hard-code giá.
- **Trạng thái**: ✅ Chốt

### D40 — Safe image replacement, không version history
- **Quyết định**: URL cũ vẫn là canonical preview trong khi provider/upload chạy. Chỉ swap URL sau upload thành công và ownership còn hợp lệ; chỉ best-effort delete object cũ sau khi chứng minh DB đã commit URL mới. MVP không có image history, rollback hoặc undo.
- **Trạng thái**: ✅ Chốt

### D41 — Cover code template
- **Quyết định**: Cover là component React/Tailwind/SVG dùng chung cho admin preview và reader, ưu tiên ảnh trang 1 với deterministic fallback, hiển thị cả hai title bằng DOM. Không gọi AI, upload cover hoặc ghi `cover_image_url` trong Phase 5.
- **Trạng thái**: ✅ Chốt

### D42 — Publish/public/archive lifecycle
- **Quyết định**: Publish chuyển `approved -> published` và tạo active token atomically. Stop-sharing giữ `published` nhưng clear token; re-share luôn sinh token mới; archive revoke token atomically. Public reader chỉ trả exact published story có active token, mọi trạng thái/token không hợp lệ đều cùng 404.
- **Trạng thái**: ✅ Chốt

### D49 — Unlisted opaque reader link
- **Quyết định**: Reader không cần tài khoản và không có catalogue/search. Server sinh token bằng `secrets.token_urlsafe(32)`, route chuẩn `/stories/[shareToken]`; backend trả relative path và không ghi raw token vào application error/audit/report.
- **Trạng thái**: ✅ Chốt

### D50 — Reader ảnh ngang và chuyển ngôn ngữ
- **Quyết định**: Mọi viewport dùng một cột với ảnh landscape 16:9 ở trên và text ở dưới. Reader mặc định Khmer; toggle `ខ្មែរ / Tiếng Việt` chỉ hiển thị một body language, giữ nguyên page. Cover luôn có cả hai title và đổi hierarchy theo language mode.
- **Trạng thái**: ✅ Chốt

### D51 — Mobile admin capability policy
- **Quyết định**: Mobile compact khi `width < 768px` hoặc `height < 600px` vẫn giữ quick-create/list/progress/recovery/share. Deep text/image mapping/Khmer review/regeneration chỉ bật khi cả `width >= 768px` và `height >= 600px`; backend không device-gate và direct deep route trên mobile hiển thị canonical read-only guidance.
- **Trạng thái**: ✅ Chốt
