# Katha — Nhật ký quyết định

> Ghi lại TẤT CẢ quyết định đã thảo luận, lý do, và trạng thái.
> Ngày cập nhật: 2026-07-17

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
  - Mobile yêu cầu xoay ngang
- **Nguồn**: BookBeam, WhimsyStudios, BookPrintingChina, SCBWI KiteTales
- **Chi tiết**: Fixed-layout (không reflow), mỗi trang = 1 ảnh ngang + text

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

### D07: Edit flow — Quick actions + Chat (không inline edit trong MVP)
- **Quyết định**: 
  - Quick actions: [Thu ngắn lại] [Dài thêm] [Kịch tính hơn] [Đơn giản hơn] + preset khác
  - Chat: nhập yêu cầu tùy ý ("xóa trang 3", "thêm nhân vật Dara vào trang 5")
  - Drag-drop: sortable list để đổi thứ tự trang (dnd-kit, đơn giản)
  - Thêm/xóa trang: nút [+ Thêm trang] và [🗑] trên mỗi trang
  - Inline text edit: KHÔNG có trong MVP (future)
- **Lý do**: Chat + quick actions bao phủ 95% use case mà code ít hơn inline editor rất nhiều. Drag-drop chỉ là sortable list (đơn giản).
- **Thông báo thay đổi**: Khi AI điều chỉnh xong → toast báo thay đổi (trang nào thêm/xóa/gộp). Không có nút hoàn tác trong MVP.

### D08: Song ngữ Khmer/Việt
- **Quyết định**: Truyện hiển thị song ngữ
  - Trong **Reader** (học sinh): Khmer = primary (lớn, đậm), Việt = subtitle (nhỏ, nhạt hơn)
  - Trong **Admin** (giáo viên): Việt = primary (vì giáo viên là người Việt)
- **Lý do**: Mục đích là dạy Khmer → Khmer phải nổi bật nhất khi đọc
- **Chi phí API**: KHÔNG tốn thêm — tiếng Việt là bản gốc (đã có sẵn từ bước sinh truyện), chỉ cần 1 lần dịch VN→KM

### D09: Vocabulary — Future phase
- **Quyết định**: KHÔNG nằm trong MVP
- **Schema**: Chưa có trong DB hiện tại. Khi triển khai future phase sẽ thiết kế riêng.
- **Approach khi triển khai**: Hybrid (khmercut match offline + AI on-demand + tra cứu riêng)

### D10: Auth — Đơn giản
- **Quyết định**: 2-5 tài khoản tạo sẵn qua Supabase Auth dashboard
- **Roles**: Admin (tạo truyện, review) + User (đọc truyện)
- **KHÔNG cần**: UI đăng ký, quên mật khẩu, multi-tenant

### D14: Tách Text Phase / Image Phase
- **Quyết định**: 
  - **Text Phase** (Bước 1-2): sinh text VN đầy đủ + dịch KM, admin edit thoải mái. Rẻ (~$0.005/lần edit)
  - **Image Phase** (Bước 3): chỉ chạy SAU KHI admin confirm text. Đắt (~$0.13/trang), chạy 1 lần
  - Text bị KHÓA sau khi confirm → không sửa text ở image phase
- **Lý do**: Admin thấy toàn bộ nội dung truyện (VN + KM) TRƯỚC khi tốn tiền ảnh. Sửa text 10 lần = $0.05, trong khi gen lại 8 ảnh = $1.04. Tách ra = tiết kiệm tiền khi iterate.

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

### D17: Archive thay vì Delete
- **Quyết định**: Truyện không ưng → `status = 'archived'`, KHÔNG xóa khỏi DB/R2
- **Lý do**: Data text + ảnh đã tốn tiền sinh ra, giữ lại để:
  - Tham khảo/reuse nội dung sau này
  - Tận dụng cho Phase 7 (NCKH) — thêm data points
  - Storage text gần như miễn phí, ảnh trên R2 rẻ

### D18: Hiển thị song ngữ ở Text Phase (edit stage)
- **Quyết định**: Ở bước edit, hiển thị VN (primary, sửa qua quick actions/chat — xem D07) + KM (subtitle, preview)
- **Khác với Reader**: Ở Reader, KM là primary (đang học Khmer), VN là subtitle
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
