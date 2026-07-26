# Katha — Ghi chú nghiên cứu

> ⚠️ **Bản cũ** — Đây là bản ghi chú nghiên cứu ban đầu. Bản research chính thức và cập nhật nhất: xem `plan/05-research-notes.md`.

> Ngày: 2026-07-03
> Mục đích: Tổng hợp research cho dự án tạo truyện tranh AI đa ngôn ngữ

---

## 1. Độ dài truyện tranh thiếu nhi — Chuẩn ngành

### Nội dung
- Chuẩn in ấn: 32 trang (do gấp giấy theo tay sách 8/16 trang)
- Trong 32 trang: ~24-28 trang nội dung thực (trừ bìa, trang title, copyright)
- Phân loại theo độ tuổi (chuẩn ngành xuất bản):

| Độ tuổi | Loại sách | Số trang | Số từ |
|---------|-----------|----------|-------|
| 0-3 tuổi | Board Book | 12-24 trang | 0-200 từ |
| 3-7 tuổi | Picture Book | 32 trang | 500-800 từ |
| 5-9 tuổi | Early Reader | 32-64 trang | 1,500-5,000 từ |

- Xu hướng hiện tại: thị trường ưa chuộng truyện ngắn hơn, nhiều editor thích dưới 500-600 từ
- Truyện giáo dục có thể linh hoạt hơn: 1,000-3,000 từ, lên đến 96 trang
- Cấu trúc phổ biến: Problem → 3 lần thử → Resolution (Rule of Three)

### Lý do quan trọng cho dự án
- Mình không in giấy → không bị ràng buộc 32 trang
- Nhưng vẫn nên theo chuẩn word count theo độ tuổi vì nó dựa trên khả năng tập trung của trẻ
- AI drift (nhân vật bị thay đổi) tăng theo số trang → nên giới hạn hợp lý

### Nguồn tham khảo
- Children's Publishing Academy: https://childrenspublishingacademy.com (cấu trúc 32 trang, front/back matter)
- Emma Walton Hamilton: https://emmawaltonhamilton.com (phân loại theo độ tuổi)
- Penguin UK: https://penguin.co.uk (hướng dẫn viết truyện tranh thiếu nhi)
- Hillshire Media: https://hillshiremedia.co (word count theo loại sách)
- Journey to Kidlit: https://journeytokidlit.com (board book vs picture book)

---

## 2. Character Consistency trong AI Image Generation

### Nội dung
- Cả Gemini và OpenAI đều hỗ trợ ảnh reference nhưng bản chất là "stateless" → nhân vật có thể "drift" qua nhiều lần gen
- Gemini (Nano Banana 2 / gemini-3.1-flash-image): hỗ trợ tối đa 14 ảnh reference cùng lúc
- OpenAI (GPT Image 2): hỗ trợ reference nhưng hoạt động tốt nhất khi giữ trong cùng 1 conversation thread

### Best practices (áp dụng cho cả 2 model)
1. Tạo "Character Sheet" (ảnh nhân vật nhiều góc, nền trắng) → dùng làm reference xuyên suốt
2. Giữ trong cùng 1 thread/session khi có thể
3. Luôn lặp lại mô tả ngoại hình nhân vật trong MỌI prompt ảnh (visual anchors)
4. Dùng cùng art style description trong mọi prompt
5. Nếu nhân vật drift → quay lại Master Character image và re-generate

### Kiến trúc pipeline được khuyến nghị (Plan-then-Execute)
1. Phase 1: Character Bible (tài liệu mô tả chính xác ngoại hình)
2. Phase 2: Narrative Structure (outline page-by-page)
3. Phase 3: Visual Generation với Reference-First approach

### Lý do quan trọng cho dự án
- Character consistency là USP chính → phải làm đúng từ đầu
- Cần lưu appearance_prompt_en cố định cho mỗi nhân vật
- Cần sinh Character Sheet trước khi bắt đầu tạo truyện
- Style guide chung (art style) phải được cố định cho toàn dự án

### Nguồn tham khảo
- MindStudio AI: https://mindstudio.ai (Gemini conversational editing, reference approach)
- NeoLemon: https://neolemon.com (reference-first approach cho children's books)
- ConsistentCharacterAI: https://consistentcharacterai.com (base image on white background)
- CladeGrove: https://cladegrove.com (face drift analysis, stateless model limitations)
- PageWriterStudio: https://pagewriterstudio.com (Character Bible methodology)
- Kibbi AI: https://kibbi.ai (visual anchors in prompts)

---

## 3. So sánh giá API — Gemini vs OpenAI (tháng 7/2026)

### 3a. Giá sinh ảnh

| Model | Giá / ảnh | Ghi chú |
|-------|-----------|---------|
| **Gemini — Imagen 4 Fast** | $0.02 | Nhanh, chất lượng draft |
| **Gemini — Imagen 4 Standard** | $0.04 | Cân bằng |
| **Gemini — Imagen 4 Ultra** | $0.06 | Chất lượng cao nhất |
| **Gemini — Nano Banana 2 (512px)** | ~$0.045 | Native Gemini image gen |
| **Gemini — Nano Banana 2 (1024px)** | ~$0.067 | |
| **Gemini — Nano Banana 2 (2048px)** | ~$0.101 | |
| **OpenAI — GPT Image 1 Mini** | $0.005-$0.05 | Budget, high-volume |
| **OpenAI — GPT Image 1.5** | $0.01-$0.20 | Theo tier chất lượng |
| **OpenAI — GPT Image 2 (1K)** | ~$0.03 | Flagship |
| **OpenAI — GPT Image 2 (2K)** | ~$0.05 | |
| **OpenAI — GPT Image 2 (4K)** | ~$0.06 | |

**Kết luận giá ảnh**: Gần như ngang nhau ở tier tương đương. OpenAI có mini rẻ hơn ($0.005) nhưng chất lượng thấp hơn. Ở tier chuẩn cả hai đều ~$0.03-0.04/ảnh.

### 3b. Giá sinh text (per 1M tokens)

| Model | Input | Cached Input | Output |
|-------|-------|-------------|--------|
| **Gemini 2.5 Flash** | ~$0.15 | ~$0.04 | ~$0.60 |
| **OpenAI gpt-5.4-nano** | $0.20 | $0.02 | $1.25 |
| **OpenAI gpt-5.4-mini** | $0.75 | $0.075 | $4.50 |
| **OpenAI gpt-5-mini** | $0.25 | $0.025 | $2.00 |
| **OpenAI gpt-5-nano** | $0.05 | $0.005 | $0.40 |

**Kết luận giá text**: OpenAI gpt-5-nano ($0.05 input) rẻ nhất. Gemini Flash cạnh tranh. Cả hai đều rất rẻ cho use case này (~$0.01/truyện phần text).

### 3c. Character Consistency (yếu tố kỹ thuật, không phải giá)

| Tiêu chí | Gemini | OpenAI |
|----------|--------|--------|
| Số ảnh reference tối đa | Lên đến 14 | Ít hơn, tốt nhất trong cùng thread |
| Cơ chế | Upload reference + edit prompt | Conversation context + reference |
| Điểm mạnh | Iterative editing, multi-ref | Photorealism, prompt following |
| Drift risk | Có, cần re-anchor | Có, cần re-supply reference |

**Kết luận**: Khi trả phí, GIÁ không phải yếu tố phân biệt. Yếu tố phân biệt là workflow consistency và khả năng multi-reference. Cần test thực tế cả 2 trước khi chốt.

### Nguồn tham khảo
- OpenAI Pricing: https://openai.com/api/pricing/
- Google Cloud AI Pricing: https://cloud.google.com/vertex-ai/generative-ai/pricing
- CostGoat: https://costgoat.com (so sánh giá OpenAI image models)
- LaoZhang AI Blog: https://laozhang.ai (phân tích giá Gemini vs OpenAI)
- AI Pricing Guru: https://aipricing.guru (bảng so sánh cross-platform)
- MagicHour: https://magichour.ai (Imagen 4 pricing breakdown)

---

## 4. Khmer NLP — Công cụ xử lý ngôn ngữ Khmer

### Nội dung
- Khmer là ngôn ngữ "low-resource" — ít data training, model AI hay sai
- Đặc điểm: KHÔNG CÓ dấu cách giữa các từ → cần tokenizer riêng
- Benchmark SEA-Vision: model tốt nhất (Gemini 2.5 Pro) vẫn lỗi ~33% trên text Khmer

### Công cụ mã nguồn mở
1. **khmercut** — tách từ Khmer (word segmentation)
   - GitHub: https://github.com/seanghay/khmercut
   - Chức năng: tách chuỗi Khmer liền thành các từ riêng biệt
   
2. **koompi/khmer-spellchecker** — kiểm tra chính tả
   - GitHub: https://github.com/koompi
   - Dựa trên từ điển Chuon Nath (từ điển chuẩn tiếng Khmer)

3. **khmer-nltk** — bộ công cụ NLP cho tiếng Khmer
   - Bao gồm: tokenizer, POS tagger, và các tiện ích khác

### Lý do quan trọng cho dự án
- BẮT BUỘC phải validate text Khmer sau khi dịch (LLM + Translation API đều có thể sai)
- khmercut + spellchecker = lớp kiểm tra tự động, giảm tải cho reviewer thủ công
- Font hiển thị: phải dùng Noto Sans Khmer hoặc Kantumruy Pro + line-height nới rộng

### Nguồn tham khảo
- GitHub seanghay/khmercut: https://github.com/seanghay/khmercut
- Digital in Asia: https://digitalinasia.com (SEA-Vision benchmark)
- Google Fonts: https://fonts.google.com/specimen/Noto+Sans+Khmer

---

## 5. Story Generation Pipeline — Kiến trúc tạo truyện bằng AI

### Nội dung
- Best practice: "Plan-then-Execute" — tách cấu trúc ra khỏi nội dung
- Bước 1: Character Bible (tài liệu mô tả nhân vật)
- Bước 2: Narrative Structure (outline page-by-page dựa trên backbone)
- Bước 3: Visual Generation (reference-first approach)

### Prompt structure cho outline
```
"Act as an expert children's book author. Create a [N]-page outline 
for a [Age Group] audience. The story must follow a [Structure]. 
For each page, provide:
1) Short text (max [X] words)
2) Detailed illustration prompt including: [Character Name] with 
   [Physical Description], [Setting], [Action], [Art Style]"
```

### Prompt structure cho ảnh nhất quán
```
"[Art Style]. A [Character Description] [Action]. [Context/Setting]. 
Highly consistent, [Character Name] wearing [Specific Outfit]. 
[Rendering style], soft lighting, warm colors."
```

### Lý do quan trọng cho dự án
- Tách outline (bước kiểm soát) khỏi generation (bước tự động)
- Giáo viên chỉ cần review/edit outline → giảm workload
- Mọi prompt ảnh phải chứa MÔ TẢ NHÂN VẬT ĐẦY ĐỦ, không phụ thuộc "memory" của AI

### Nguồn tham khảo
- Substack (Plan-then-Execute architecture): https://substack.com
- MindStudio AI: https://mindstudio.ai (reference management pipeline)
- PageWriter Studio: https://pagewriterstudio.com (Character Bible method)
- Kibbi AI: https://kibbi.ai (structured prompts for children's books)
- NeoLemon: https://neolemon.com (consistent illustration prompts)
- Reddit r/ChatGPT: https://reddit.com (community tips on maintaining consistency)

---

## 6. Naming Research — Gốc từ "Katha"

### Nội dung
- **Katha** (កថា / कथा): gốc Pali/Sanskrit, nghĩa "câu chuyện, lời kể"
- Tồn tại trong nhiều ngôn ngữ Đông Nam Á và Nam Á:
  - Khmer: កថា (katha)
  - Thai: กถา (katha)  
  - Hindi: कथा (katha)
  - Sinhala, Lao: cognates tương tự
- Ngắn, dễ nhớ, brandable
- Mở rộng tự nhiên: Katha Studio, Katha Reader, Katha Learn

### Lý do chọn cho dự án
- Có gốc rễ văn hóa đúng với ngôn ngữ đang làm (Khmer)
- Đủ trung tính để mở rộng ra ngôn ngữ/tính năng khác
- Ghi điểm học thuật khi trình bày trước hội đồng NCKH
- Cần xác nhận cách đọc/viết với người bản ngữ Khmer trước khi chốt chính thức

---

## 7. Định hướng trang truyện — Landscape vs Portrait (Digital)

### Nội dung
- **Landscape (ngang)** được ưa chuộng hơn cho truyện tranh thiếu nhi digital vì:
  - Mô phỏng trải nghiệm đọc sách giấy truyền thống (picture book giấy phần lớn là landscape)
  - Phù hợp với cách người dùng cầm tablet khi xem media/content tương tác
  - Không gian ngang rộng → phù hợp cho minh họa panoramic, bối cảnh rộng
  - Tốt cho "reading together" — bố mẹ và trẻ cùng nhìn thoải mái
- **Portrait (đứng)** chỉ tốt hơn khi:
  - Minh họa thiên về chiều cao (cây cao, tháp, vực sâu)
  - Đọc 1 tay trên điện thoại (nhưng target là tablet/desktop nên ít liên quan)
- **Fixed-layout** là chuẩn cho picture book digital (khóa vị trí text + ảnh, không cho reflow)
- **KHÔNG dùng PDF** cho digital reading → dùng web render hoặc EPUB3 fixed-layout

### Kết luận cho dự án
- Chọn **landscape** — phù hợp nhất cho truyện minh họa thiếu nhi trên web/tablet
- Mỗi trang = 1 ảnh ngang (16:9 hoặc 3:2) + text bên dưới hoặc overlay
- Khi xem trên mobile → yêu cầu xoay ngang hoặc auto-rotate
- Dùng fixed-layout (không responsive text reflow) — text cỡ lớn, legible by default

### Nguồn tham khảo
- BookBeam: https://bookbeam.io (landscape vs portrait cho ebook)
- WhimsyStudios: https://whimsystudios.net (fixed-layout cho picture book)
- BookPrintingChina: https://bookprintingchina.com (landscape cho "reading together")
- DougBrownDesign: https://dougbrowndesign.com (landscape cho media consumption)
- SCBWI KiteTales: https://scbwikitetales.com (artwork evaluation, orientation choice)
- UnrulyGuides: https://unrulyguides.com (fixed-layout vs reflowable)
- AccessiblePublishing.ca: https://accessiblepublishing.ca (EPUB3 fixed-layout recommendation)

---

*File này được tạo tự động từ quá trình nghiên cứu. Cần verify lại từng nguồn trước khi trích dẫn trong báo cáo NCKH.*
