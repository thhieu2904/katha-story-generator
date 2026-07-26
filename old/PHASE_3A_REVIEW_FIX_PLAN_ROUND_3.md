# Phase 3A — Review Fix Plan (Round 3)

> Trạng thái: Ready for implementation
> Mục tiêu: Đóng các blocker còn lại sau review Round 2
> Phạm vi: Sửa test infrastructure, deferred integration tests, image fallback và tài liệu
> Không mở rộng sang Phase 3B, OpenAI, translation hoặc `story_pages`
> Docker không bắt buộc để đạt trạng thái code-complete offline
> Ngày lập plan: 2026-07-20

---

## 1. Kết quả mong muốn

Sau Round 3, Phase 3A phải đạt được hai trạng thái tách biệt:

### Code-complete offline

- Các fix B1–B5 của Round 2 vẫn được giữ nguyên và không regression.
- Toàn bộ test không cần Docker chạy bằng một command chuẩn, không phải liệt kê thủ công bốn file.
- Migration graph test chạy được khi Docker tắt.
- Các test Docker-deferred được viết đúng schema và không có lỗi hiển nhiên khiến chắc chắn fail khi bật Docker.
- Image URL null hoặc tải lỗi đều hiện placeholder thật.
- Tài liệu vận hành không còn mâu thuẫn với D22–D29 và các gate đã chốt.

### Integration/live pending

- Migration lifecycle trên PostgreSQL thật.
- Story CRUD integration trên PostgreSQL thật.
- Full Docker-backed suite.
- Docker image build.
- Supabase/R2 live smoke.

Không được ghi “fully verified” khi nhóm integration/live chưa chạy.

---

## 2. Baseline đã xác minh — không làm lại không cần thiết

Các phần sau hiện đã đúng và chỉ cần regression test:

- Frontend config contract dùng `name_vi`, `name_en`, `description_vi` và `sample_image_url` đúng backend.
- Route `/admin/stories/[id]/setup` dùng wrapper/inner component, `useParams()` và kiểm tra ID nguyên dương.
- Archive dùng `router.replace('/admin/stories')`.
- `StoryUpdate` reject explicit `null`, body `{}` và extra fields.
- Description được trim trước khi kiểm tra độ dài ở create/update.
- Migration `002` đã qua Ruff/format ở changed-file scope.
- 27 story API contract tests đang pass.
- Bốn suite offline hiện tại cho tổng 52 tests pass.
- Frontend lint/typecheck/build pass.

Không refactor lại các phần này nếu không cần cho blocker Round 3.

---

## 3. Blocker còn lại

### R3-B1 — Migration revision test đang fail offline

Test hiện import:

```python
importlib.import_module("alembic.versions.002_target_age_groups")
```

Local migration không phải subpackage của thư viện `alembic`, nên test trả:

```text
ModuleNotFoundError: No module named 'alembic.versions'
```

### R3-B2 — Docker-deferred tests chưa runnable

Story integration seed đang thiếu các cột `NOT NULL`:

- `story_backbones.prompt_template_en`
- `story_genres.prompt_modifier_en`
- `art_styles.prompt_modifier_en`
- `characters.appearance_prompt_en`

Test cũng chưa insert admin UUID vào `auth.users`, trong khi `stories.created_by` có foreign key tới bảng này.

### R3-B3 — Migration lifecycle có nguy cơ deadlock

Test đang giữ transaction của async `SELECT`, sau đó chạy Alembic `ALTER TABLE` bằng connection khác. Alembic có thể chờ lock trong khi chính test bị block và không thể kết thúc transaction cũ.

### R3-B4 — Offline/integration test boundary chưa rõ

- `pytest tests/` hiện vẫn collect các suite Testcontainers và fail khi Docker tắt.
- `HAS_DOCKER` chỉ phản ánh package import được, không phản ánh Docker daemon đang chạy.
- Marker `integration` chưa được đăng ký.

### R3-B5 — Broken image không hiện placeholder

Khi URL tồn tại nhưng tải lỗi, `onError` chỉ đặt `display: none` cho `<img>`. SVG chỉ nằm ở nhánh URL null nên card trở thành ô trống.

### R3-B6 — Tài liệu vẫn còn quyết định cũ

Các tài liệu active vẫn còn G1/G3/G5/G6 mở, Character CRUD tùy chọn, cover AI, page numbering tính bìa, hoặc prompt chỉ sinh summary thay vì full story pages.

---

## 4. Work package 1 — Chuẩn hóa offline/integration test boundary

### 4.1 Đăng ký marker

Sửa `backend/pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
markers = [
    "integration: requires Docker and PostgreSQL Testcontainers",
]
```

### 4.2 Đánh dấu toàn bộ test cần Docker

Các module sau phải dùng `pytestmark = pytest.mark.integration` hoặc đánh marker tương đương cho toàn bộ test cần PostgreSQL:

- `backend/tests/test_migration.py`
- `backend/tests/test_seed.py`
- `backend/tests/test_phase2_integration.py`
- `backend/tests/test_stories_integration.py`

Không dùng `HAS_DOCKER = import succeeded` để tuyên bố Docker khả dụng.

Khi chạy `-m "not integration"`, không fixture Testcontainers nào được khởi tạo.

### 4.3 Tách migration graph test thành test offline

Tạo:

```text
backend/tests/test_migration_graph.py
```

Test dùng Alembic API thay vì import file như Python package:

```python
from alembic.config import Config
from alembic.script import ScriptDirectory

config = Config("alembic.ini")
script = ScriptDirectory.from_config(config)
revision = script.get_revision("002")

assert revision is not None
assert revision.down_revision == "001"
assert script.get_current_head() == "002"
```

Yêu cầu:

- Chạy được khi Docker tắt.
- Không import `alembic.versions.*`.
- Không cần `DATABASE_URL` thật.
- Chứng minh graph chỉ có một head.

Xóa test revision-chain bị lỗi khỏi `test_migration.py` sau khi đã chuyển coverage.

### 4.4 Command chuẩn

Offline:

```bash
uv run pytest -m "not integration" tests/ -q
```

Docker-backed, chạy sau:

```bash
uv run pytest -m integration tests/ -q
```

Walkthrough phải ghi đúng command đã chạy; không được ghi `pytest tests/` nếu thực tế chỉ chạy subset hoặc dùng marker khác.

---

## 5. Work package 2 — Sửa migration 002 tests

### 5.1 Không dùng async session xuyên qua Alembic DDL

Lifecycle test không được request fixture `session`.

Nó bắt buộc phải nhận:

- `postgres_url`
- fixture `run_migrations` bảo đảm database ban đầu ở `head`, hoặc tự chạy `upgrade head` trước khi downgrade

Sau đó tạo sync engine riêng và dùng connection ngắn hạn.

### 5.2 Lifecycle bắt buộc

Trong một test được bọc `try/finally`:

1. Đảm bảo DB bắt đầu ở `head`.
2. `alembic downgrade 001`.
3. Mở transaction ngắn, insert legacy stories với:
   - `target_age = 3` hoặc `5`
   - `target_age = 6` hoặc `7`
   - `target_age = 9` hoặc `10`
   - `target_age = 15`
   - `target_age = NULL`
4. Commit và đóng connection.
5. `alembic upgrade 002`.
6. Mở connection mới, xác minh:
   - Column là `text`.
   - Các nhóm map thành `preschool`, `early_primary`, `late_primary`.
   - Giá trị ngoài range thành `NULL`.
   - Legacy `NULL` vẫn là `NULL`.
7. Commit/rollback và đóng connection trước DDL tiếp theo.
8. Xác minh ba enum hợp lệ insert được.
9. Xác minh giá trị bất kỳ khác bị CHECK constraint từ chối trong transaction riêng; rollback và đóng transaction đó trước mọi Alembic DDL tiếp theo.
10. `alembic downgrade 001`.
11. Xác minh representative mapping về `4`, `7`, `10` và column là integer.
12. Trong `finally`, luôn restore `alembic upgrade head` và dọn test rows bằng connection mới.

Tuyệt đối không giữ transaction/connection mở khi gọi `command.upgrade()` hoặc `command.downgrade()`.

### 5.3 Metadata migration

Sửa `Create Date` đang ghi `2024-03-05` trong migration `002` thành ngày thực tế của Phase 3A (`2026-07-19` hoặc ngày tạo migration đã xác minh).

Không thay đổi `revision = "002"` hoặc `down_revision = "001"`.

---

## 6. Work package 3 — Sửa Story CRUD integration test

### 6.1 Session giống production

Fixture dùng:

```python
async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

Không dùng `AsyncSession(engine)` với mặc định `expire_on_commit=True`, vì service commit nội bộ rồi test tiếp tục đọc ORM object.

### 6.2 Seed đúng schema

Seed tối thiểu phải gồm:

- Hai UUID Admin A và Admin B trong `auth.users`.
- Ít nhất hai backbone với `name_vi`, `name_en`, `prompt_template_en`.
- Ít nhất hai genre với `name_vi`, `name_en`, `prompt_modifier_en`.
- Ít nhất hai art style với `name_vi`, `name_en`, `prompt_modifier_en`.
- Ít nhất ba characters với `name`, `appearance_prompt_en`.

Hai record cho mỗi nhóm config giúp test thật sự đổi FK config và xác minh ID mới đã persist, thay vì PATCH lại cùng một ID.

Không dùng sync fixture gọi `run_until_complete()` để seed cho async test. Dùng `@pytest_asyncio.fixture` và `await` trực tiếp.

### 6.3 CRUD flow bắt buộc

Test PostgreSQL thật phải chứng minh:

1. Dùng ASGI client với auth dependency của Admin A để tạo story có characters `[1, 2]`.
2. Story được persist với `status = draft` và `created_by = admin_a`.
3. Chuyển auth dependency sang Admin B; Admin B list và detail được story của Admin A.
4. Admin B PATCH description, đổi backbone/genre/art-style từ record thứ nhất sang record thứ hai và thay characters thành `[2, 3]`.
5. Query trực tiếp xác minh các config ID mới đã persist và `story_characters` đã được thay hoàn toàn từ `[1, 2]` thành `[2, 3]`.
6. Tạo thêm stories và gán timestamps xác định để kiểm tra đủ hai nhánh sort:
   - `created_at` khác nhau → `created_at DESC`.
   - `created_at` bằng nhau → tie-breaker `id DESC`.
7. Admin B archive story đầu tiên qua API.
8. Query trực tiếp xác minh:
   - Story row vẫn tồn tại.
   - `story_characters` vẫn còn `[2, 3]`.
9. Default list không trả archived story.
10. `include_archived=True` trả story archived.

### 6.4 Failure behavior

Bổ sung focused service tests không cần Docker:

- Invalid FK update không thay đổi ORM state và không gọi commit.
- Flush/commit failure không trả success.
- Bao `flush/commit` bằng `except SQLAlchemyError` cho cả create/update/archive; gọi `await session.rollback()` rồi re-raise.
- Không catch rộng `Exception` chỉ để rollback.
- Create failure không để service tiếp tục add/commit associations như thể thành công.

Mock unit test chứng minh `rollback()` được gọi; tính atomic và không có partial write trên PostgreSQL thật vẫn phải được chứng minh trong integration test.

Không cần xây retry framework hoặc transaction abstraction mới cho Phase 3A.

### 6.5 Concurrency

Giữ quyết định MVP:

```text
Concurrent admin edits: last-write-wins.
No row-level locking in Phase 3A.
```

Không triển khai locking trong Round 3.

---

## 7. Work package 4 — Image fallback thật

Sửa:

```text
frontend/src/features/stories/components/StorySetupForm.tsx
```

Áp dụng cho cả:

- Character thumbnail.
- Art-style sample image.

### Cách đơn giản được khuyến nghị

Tách một thumbnail component nhỏ dùng state `failed`:

```text
src null/rỗng hoặc failed=true  -> render SVG placeholder
src hợp lệ và failed=false     -> render img
img onError                    -> set failed=true
src thay đổi                   -> reset failed=false
```

Có thể reset bằng `useEffect(..., [src])` hoặc remount thumbnail với `key={src}`. Không dùng `display: none` trên cùng DOM node mà không reset state; cũng không đặt placeholder thường trực dưới ảnh vì PNG trong suốt có thể làm lộ placeholder.

Không bắt buộc đổi sang `next/image` trong Round 3.

### Acceptance

- URL null → placeholder visible.
- URL rỗng → placeholder visible.
- URL trả 404/load error → placeholder visible.
- URL hợp lệ → ảnh visible, không đồng thời lộ placeholder.
- Alt text vẫn đúng.

---

## 8. Work package 5 — Đồng bộ tài liệu active

Chỉ sửa tài liệu vận hành hiện tại. Không mass-replace `plan/05-research-notes.md` vì đây là tài liệu nghiên cứu lịch sử.

### 8.1 `plan/HANDOFF.md`

- Số trang:
  - `short`: 4–6 trang nội dung.
  - `medium`: 8–10 trang nội dung.
  - `long`: 12–14 trang nội dung.
  - Hard limit: 16 trang nội dung.
- Bìa code template, không tính là ảnh AI hoặc `story_pages`.
- G1/G3/G5/G6 đã chốt.
- Phase 1 và Phase 2 ghi rõ `code-complete offline`; live checks còn pending nếu chưa chạy.
- Phase 3A chỉ chuyển sang `code-complete offline` sau khi Round 3 được review pass.
- Điền mục “Bước tiếp theo”: review Round 3 → sau đó lập Phase 3B.
- Cập nhật ngày tài liệu.

### 8.2 `plan/00-project-overview.md`

- Character Bank MVP chỉ đọc 7 nhân vật seed.
- Bỏ “CRUD/gen ref tùy G5”.
- Bỏ “AI outline”; dùng “AI sinh title + full story pages trực tiếp”.

- Cập nhật ngày và trạng thái tài liệu; chỉ ghi Phase 3A `code-complete offline` sau khi toàn bộ gate Round 3 xanh.

### 8.3 `plan/01-decisions-log.md`

- Giữ D06 ở trạng thái superseded, nhưng mô tả hiện hành phải trỏ tới cả D25 và D26.
- D25: không outline riêng.
- D26: mapping length và hard limit.
- D27: bìa code template.
- Cập nhật `Ngày cập nhật` thành ngày hiện tại.

### 8.4 `plan/02-technical-design.md`

- Đổi heading chi phí “8 trang + bìa” thành “8 trang nội dung”.
- Không tính bìa vào image API cost.
- Prompt output phải gồm tối thiểu:
  - `title_vi`
  - danh sách pages
  - `page_no`
  - full `text_vi`, không phải `summary_vi`
- Không áp đặt `characters per page`, `scene_hint_en` hoặc field image-pipeline mới trong Round 3. Phase 3B phải chốt riêng field bổ sung, tính transient hay persisted, và mapping vào schema/API nào.
- Không mô tả outline như sản phẩm hoặc bước review riêng.
- Cập nhật ngày và trạng thái tài liệu sau khi Round 3 pass.

### 8.5 `plan/03-user-flows.md`

- Reader public; bỏ `[Login?]` và G1 OPEN.
- Character Bank chỉ read-only seed; bỏ G5 OPEN và các CTA CRUD khỏi MVP flow.
- Story setup dùng nút `Lưu bản nháp`.
- Phase 3B dùng CTA `Sinh nội dung truyện`, không dùng `Tạo outline` hoặc `Tạo bản nháp` lần hai.
- Cover là component riêng.
- Trang nội dung đầu tiên phải là `Trang 1`, không phải `Trang 2`.
- Nhóm tuổi dùng ba enum labels đã chốt.

- Cập nhật ngày và trạng thái tài liệu sau khi Round 3 pass.

### 8.6 `plan/04-implementation-plan.md`

- Phase 1: code-complete offline; live Supabase/R2/Docker checks ghi pending nếu đúng thực tế.
- Phase 2: code-complete offline, config + Character Bank read-only.
- G1/G3/G5/G6 không còn được trình bày là OPEN.
- Phase 3 setup dùng target-age groups đã chốt.
- Phase 3B sinh title + full pages trực tiếp.
- Phase 4 không có AI cover generation task.
- Thay task cover bằng code-template cover ở Reader/Story Card phase phù hợp.
- G2 và G4 vẫn OPEN; không tự chốt trong Round 3.
- Cập nhật ngày tài liệu. Sau khi các gate Round 3 xanh, Phase Map phải ghi rõ: `3A: Code-complete offline — Docker/live pending`.

### 8.7 `README.md`

- Phase 1 và Phase 2 không còn để unchecked nếu đang mô tả trạng thái code-complete offline.
- Phase 2 phải được mô tả là config APIs + Character Bank read-only, không phải “Character/Config CRUD”.
- Phase 3A chỉ ghi `code-complete offline — Docker/live pending` sau khi Round 3 pass.
- Đồng bộ ngày/trạng thái nếu README có metadata tương ứng.

### 8.8 Static stale-reference check

Sau khi sửa, chạy:

```powershell
rg -n -i "OPEN|Gate G[1356]|AI outline|Tạo outline|summary_vi|8 trang \+ bìa|Cover image|CRUD.*G5|tùy Gate G5|Character/Config CRUD|\[ \].*Phase [12]" README.md plan/HANDOFF.md plan/00-project-overview.md plan/01-decisions-log.md plan/02-technical-design.md plan/03-user-flows.md plan/04-implementation-plan.md
```

Mọi hit còn lại phải được đọc thủ công và có lý do hợp lệ. Không coi output rỗng tuyệt đối là mục tiêu nếu từ khóa nằm trong ghi chú superseded có chủ đích.

---

## 9. File scope dự kiến

### Backend

- `backend/pyproject.toml`
- `backend/alembic/versions/002_target_age_groups.py`
- `backend/src/katha/features/stories/service.py` — chỉ nếu cần rollback rõ ràng cho failure path
- `backend/tests/test_migration_graph.py` — new
- `backend/tests/test_migration.py`
- `backend/tests/test_seed.py`
- `backend/tests/test_phase2_integration.py`
- `backend/tests/test_stories_api.py`
- `backend/tests/test_stories_integration.py`
- Có thể thêm `backend/tests/test_stories_service.py` nếu service-failure tests rõ hơn khi tách file.

### Frontend

- `frontend/src/features/stories/components/StorySetupForm.tsx`

### Documentation

- `README.md`
- `plan/HANDOFF.md`
- `plan/00-project-overview.md`
- `plan/01-decisions-log.md`
- `plan/02-technical-design.md`
- `plan/03-user-flows.md`
- `plan/04-implementation-plan.md`
- `PHASE_3A_STORY_SETUP_PLAN.md` — chỉ cập nhật trạng thái cuối sau khi gates pass

Không thay đổi schema business, endpoint contract hoặc Phase 3B code trong Round 3.

---

## 10. Implementation order

1. Chuẩn hóa pytest marker và tách migration graph test offline.
2. Sửa migration lifecycle test để không giữ transaction qua Alembic DDL.
3. Sửa Story CRUD integration fixtures/seed/session/assertions.
4. Bổ sung failure-path tests và rollback nếu cần.
5. Sửa image fallback.
6. Đồng bộ toàn bộ tài liệu active.
7. Chạy offline verification.
8. Chỉ sau khi tất cả offline gates xanh mới cập nhật status Phase 3A và walkthrough.

---

## 11. Verification gates

### 11.1 Backend offline — bắt buộc

```bash
cd backend

uv lock --check
uv run ruff check src/ tests/ alembic/versions/002_target_age_groups.py
uv run ruff format --check src/ tests/ alembic/versions/002_target_age_groups.py
uv run mypy src/
uv run alembic heads
uv run pytest -m "not integration" tests/ -q
uv run pytest -m integration tests/ --collect-only -q
```

Expected:

- Ruff: 0 errors.
- Format: không có file cần format.
- Mypy: 0 issues.
- Alembic: chỉ `002 (head)`.
- Offline pytest: pass toàn bộ, không cố kết nối Docker và không có unknown-marker warning.

- Integration collect-only: collect được toàn bộ deferred tests mà không khởi tạo Docker.

### 11.2 Frontend offline — bắt buộc

```bash
cd frontend

npm run lint
npx tsc --noEmit
npm run build
```

Expected:

- Không có lint error.
- TypeScript clean.
- Production build pass.
- Nếu còn `<img>` warning, walkthrough phải ghi đúng; không báo “0 warnings”.

### 11.3 Docker-deferred — viết đúng nhưng chưa bắt buộc chạy

```bash
cd backend

uv run pytest -m integration tests/ -q
uv run pytest tests/ -q
docker build -t katha-backend .
```

Command có marker là integration subset để chẩn đoán riêng; `pytest tests/` mới là full suite.

Ghi `PENDING — Docker Desktop chưa bật` nếu chưa chạy. Không ghi pass hoặc skipped-by-Docker-detection nếu thực tế chưa xác minh.

### 11.4 Live-deferred

- Supabase migration `001 → 002`.
- Seed config/characters.
- Admin A tạo story.
- Admin B xem và sửa story đó.
- Archive giữ row và associations.
- R2/health không thuộc code fix Round 3 nhưng tiếp tục nằm trong backlog môi trường.

---

## 12. Definition of Done

### Code-complete offline

- [ ] Migration graph test chạy offline và pass.
- [ ] `pytest -m "not integration" tests/` không khởi tạo Docker.
- [ ] Marker integration được đăng ký, không còn `PytestUnknownMarkWarning`.
- [ ] Integration subset collect-only thành công khi Docker tắt.
- [ ] Deferred migration test không giữ transaction qua Alembic DDL.
- [ ] Story integration seed đầy đủ mọi cột `NOT NULL` và auth user FK.
- [ ] Integration session dùng `expire_on_commit=False`.
- [ ] Integration flow cover cross-admin API access, config/character replacement, deterministic stable sort, archive preservation và archived filtering.
- [ ] Invalid update/failure path không commit partial data.
- [ ] Broken image hiển thị placeholder thật.
- [ ] Tài liệu active thống nhất với D22–D29.
- [ ] Backend offline gates pass.
- [ ] Frontend lint/typecheck/build pass.
- [ ] Không có secret thật trong diff.
- [ ] Walkthrough ghi đúng command, count, warning và pending items.

### Pending integration/live

- [ ] Docker-backed pytest pass.
- [ ] Migration lifecycle pass trên PostgreSQL thật.
- [ ] Story CRUD integration pass trên PostgreSQL thật.
- [ ] Docker image build pass.
- [ ] Supabase live smoke pass.

---

## 13. Evidence dev phải bàn giao

- Git status và danh sách file thay đổi.
- Output của toàn bộ backend offline commands.
- Output frontend lint/typecheck/build.
- Output migration graph test.
- Output integration collect-only.
- Số test lấy trực tiếp từ pytest output; không tự cộng tay.
- Không lặp lại claim Round 2 “14 test stories mới/8 test migration mới”; baseline thực tế trước Round 3 là 13/7, còn số cuối lấy từ pytest output.
- Danh sách test/module được marker `integration`.
- Tóm tắt deferred integration fixtures đã sửa:
  - required seed columns
  - auth user
  - `expire_on_commit=False`
  - no open transaction across Alembic DDL
- Kết quả static stale-reference check và giải thích các hit được giữ lại.
- Docker/live checks ghi rõ `PENDING` nếu chưa chạy.
- Không gửi token, database URL, Supabase key hoặc R2 credential trong walkthrough.

---

## 14. Không làm trong Round 3

- Không triển khai OpenAI text generation.
- Không tạo hoặc sửa `story_pages` flow.
- Không triển khai translator/Khmer validator.
- Không triển khai image generation.
- Không thêm background jobs, SSE hoặc WebSocket.
- Không thêm row-level locking.
- Không xây frontend test framework mới chỉ cho image fallback.
- Không deploy và không yêu cầu Docker Desktop để hoàn thành offline gate.

---

## 15. Acceptance verdict sau Round 3

Chỉ chuyển Phase 3A sang:

```text
✅ Code-complete offline
⏳ Docker/live verification pending
```

khi toàn bộ checklist offline ở trên đã pass và một reviewer kiểm tra lại actual diff.

Phase 3B chỉ bắt đầu sau acceptance này.
