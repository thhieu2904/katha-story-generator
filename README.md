<div align="center">
  <h1>📖 Katha — កថា</h1>
  
  <p><strong>Nền tảng AI tạo truyện tranh song ngữ (Khmer - Việt) dành riêng cho trẻ em</strong></p>
  
  <p>
    <em>Mỗi đứa trẻ đều xứng đáng được lớn lên với những câu chuyện thần tiên mang đậm bản sắc văn hóa của riêng mình. Katha ra đời với sứ mệnh biến trí tưởng tượng của các em thành những trang sách đầy màu sắc chỉ trong vài phút.</em>
  </p>
</div>

---

## 🌟 Vì sao Katha ra đời?

Việc tìm kiếm những cuốn truyện tranh song ngữ **Khmer - Việt** chất lượng cao, hình ảnh đẹp mắt và nội dung phù hợp cho trẻ em là một thử thách lớn đối với nhiều phụ huynh và giáo viên. 

**Katha (កថា)** ra đời để giải quyết vấn đề đó. Bằng cách ứng dụng trí tuệ nhân tạo (AI) tiên tiến nhất, Katha giúp bất kỳ ai cũng có thể trở thành một "tác giả truyện tranh", tạo ra những tác phẩm nghệ thuật tuyệt đẹp, mang tính giáo dục cao và quan trọng nhất: **Gắn kết ngôn ngữ, bảo tồn văn hóa.**

---

## ✨ Trải nghiệm Phép màu cùng Katha

Katha không chỉ là một công cụ, mà là một xưởng phim hoạt hình thu nhỏ ngay trên màn hình của bạn:

- 🎭 **Sáng tạo không giới hạn**: Bạn chỉ cần đưa ra một ý tưởng nhỏ (ví dụ: *Một chú thỏ muốn học bơi*), AI của Katha sẽ dệt nên một cốt truyện hoàn chỉnh, giàu cảm xúc và bài học nhân văn.
- 🎨 **Minh họa chuẩn Studio**: Không còn những hình ảnh chắp vá lộn xộn. Katha hiểu và giữ được sự nhất quán của bối cảnh, nhân vật từ trang đầu tiên đến trang cuối cùng.
- 🌐 **Cầu nối Song ngữ**: Mỗi trang truyện đều được trình bày song song hai ngôn ngữ Khmer và Tiếng Việt. Trẻ em có thể vừa giải trí, vừa học ngôn ngữ một cách tự nhiên nhất.
- 🛡️ **An toàn tuyệt đối**: Nội dung được sinh ra luôn được kiểm soát để đảm bảo 100% phù hợp và an toàn cho tâm hồn trẻ thơ.

---

## 🎯 Katha dành cho ai?

- 👨‍👩‍👧 **Phụ huynh**: Tự tay tạo ra những câu chuyện ru bé ngủ mỗi tối với nhân vật chính có thể lấy cảm hứng từ chính các con của mình.
- 👩‍🏫 **Giáo viên & Trường học**: Nhanh chóng tạo ra các học liệu trực quan, sinh động phục vụ cho các bài giảng song ngữ trên lớp.
- 🧒 **Trẻ em**: Khơi dậy niềm đam mê đọc sách, phát triển trí tưởng tượng và tình yêu với tiếng mẹ đẻ.

---

## 🛠 Dành cho Nhà phát triển (For Developers)

Katha là một dự án được xây dựng bằng những công nghệ hiện đại nhất (**Next.js, FastAPI, PostgreSQL, OpenAI**). Nếu bạn là lập trình viên và muốn chung tay phát triển hoặc cài đặt phiên bản Katha của riêng mình, hãy xem phần dưới đây:

<details>
<summary><strong>🚀 Bấm vào đây để xem hướng dẫn cài đặt kỹ thuật</strong></summary>

### 1. Chuẩn bị
- Python 3.11+, Node.js 20+, Docker
- [uv](https://docs.astral.sh/uv/) (Trình quản lý thư viện Python cực nhanh)

### 2. Khởi chạy Backend (FastAPI)
```bash
cd backend
uv sync                                          # Cài đặt thư viện
cp .env.example .env                             # Cập nhật cấu hình (DB, OpenAI, R2...)
uv run alembic upgrade head                      # Cập nhật Database
uv run python -m katha.features.config_data.seed # Nạp dữ liệu mẫu ban đầu
uv run uvicorn katha.main:app --reload           # Chạy server ở localhost:8000
```

### 3. Khởi chạy Frontend (Next.js)
```bash
cd frontend
npm install                       # Cài đặt thư viện
cp .env.local.example .env.local  # Cập nhật cấu hình
npm run dev                       # Chạy giao diện ở localhost:3000
```
</details>

---
<div align="center">
  <p><strong>Cùng Katha, chúng ta kiến tạo tương lai qua từng trang sách! 🌈</strong></p>
  <p><em>Phát triển với ❤️</em></p>
</div>
