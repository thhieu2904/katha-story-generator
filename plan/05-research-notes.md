# Katha — Ghi chú nghiên cứu
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
   
2. **koompi/khmer-spellchecker** — dictionary/Hunspell assets để nghiên cứu
   - GitHub: https://github.com/koompi/khmer-spellchecker
   - Không phải Python package turnkey; runtime, license và corpus acceptance còn deferred P1

3. **khmer-nltk** — bộ công cụ NLP cho tiếng Khmer
   - Bao gồm: tokenizer, POS tagger, và các tiện ích khác

### Lý do quan trọng cho dự án
- BẮT BUỘC phải validate text Khmer sau khi dịch (LLM + Translation API đều có thể sai)
- baseline technical validator = lớp kiểm tra tự động, giảm tải cho reviewer thủ công
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

## 7. Số lượng nhân vật trong truyện tranh thiếu nhi — Research

### Nghiên cứu học thuật

**Về cognitive load và số nhân vật:**
- **Không có "con số ma thuật"** cho số nhân vật tối ưu — nghiên cứu tập trung vào cognitive load management hơn là đếm số nhân vật cụ thể [NIH, Frontiers in Psychology]
- **"Rule of Three"**: Framework phổ biến nhất trong kể chuyện thiếu nhi — 3 nhân vật (hoặc 3 sự kiện/nỗ lực) tạo cấu trúc dễ đoán, nhịp nhàng, hỗ trợ trí nhớ và nhận diện pattern mà không quá tải [Emma Walton Hamilton]
- **Ít nhân vật hơn = hiểu tốt hơn**: Phần lớn truyện thiếu nhi thành công tập trung vào 1 hoặc rất ít nhân vật chính. Cast nhỏ giúp trẻ tập trung vào arc câu chuyện, động cơ nhân vật, phát triển cảm xúc [Penguin UK guidelines]
- **Quá nhiều nhân vật → quá tải**: Nếu giới thiệu nhiều nhân vật cùng lúc, sẽ cạnh tranh tài nguyên chú ý có hạn của trẻ (limited attentional resources), làm giảm comprehension [mtak.hu, Frontiers in Psychology]

**Về character-reader similarity:**
- Trẻ hiểu truyện tốt hơn khi nhận ra mình trong nhân vật (cùng giới, cùng độ tuổi, cùng bối cảnh) [NIH]
- Nhân vật người > nhân vật động vật cho learning outcomes, dù trẻ thường thích nhân vật động vật hơn [OSU study]
- Character literacy (khả năng mô tả sức mạnh, cảm xúc, động lực xã hội của nhân vật) phát triển tốt hơn với cast nhỏ, rõ vai trò [ALA]

**Về thiết kế visual cho trẻ nhỏ:**
- Đầu lớn, mắt lớn, nét tròn → tăng engagement [IJCRT]
- Consistency tên, hình dáng, màu sắc = CỰC KỲ QUAN TRỌNG trong app/series giáo dục [Atlantis Press]
- Mỗi nhân vật cần vai trò riêng biệt, dễ nhận dạng [Penguin UK]

**Về cast composition trong sách đạt giải:**
- Sách đạt giải thường có cast LEAN (gọn) — mỗi nhân vật phải phục vụ cốt truyện, nếu không thì loại [DIYMFA]
- "32-page rule": giới hạn tự nhiên buộc mọi nhân vật phải essential [industry standard]
- Supporting characters phục vụ vai trò cụ thể, hiệu quả — không thêm cho có [ResearchGate analysis]

### Kết luận cho dự án

**Mỗi truyện:**
- **1 nhân vật chính (protagonist)** — trẻ đồng cảm
- **1-2 nhân vật phụ (supporting)** — tạo xung đột/tương tác
- **Tối đa 3 nhân vật/truyện** = sweet spot theo Rule of Three + cognitive load research
- Nếu truyện dài (12-16 trang), có thể 4 nhân vật nhưng không nên quá

**Character bank (tổng kho nhân vật):**
- Cần đủ ĐA DẠNG để cover các biến số nghiên cứu:
  - Giới tính: nam + nữ
  - Độ tuổi: nhỏ (5-7) + lớn hơn (8-10)
  - Vai trò: gia đình (bà/bố/mẹ) + bạn bè + người lớn ngoài gia đình (thầy giáo)
  - Quan hệ: anh/em, bạn bè, thầy/trò, ông bà/cháu

### Nguồn tham khảo
- NIH/PubMed: Character-reader similarity in children's stories (https://pubmed.ncbi.nlm.nih.gov)
- OSU (Ohio State University): Human vs animal characters in preschool comprehension
- Frontiers in Psychology: Cognitive load in children's picture book processing
- Emma Walton Hamilton: "Rule of Three" in children's storytelling (emmawaltonhamilton.com)
- Penguin UK: Guidelines for picture book character design (penguin.co.uk)
- IJCRT: Character design aesthetics for preschoolers (ijcrt.org)
- Atlantis Press: Visual consistency in educational apps
- ALA (American Library Association): Character literacy frameworks (ala.org)
- DIYMFA: Cast size in award-winning picture books (diymfa.com)
- WMich (Western Michigan University): Visual complexity for young readers (wmich.edu)

---

## 8. AI Image Generation — Character Consistency Research

### Vấn đề cốt lõi
- Diffusion models (DALL-E, Stable Diffusion, Imagen) sinh ảnh từ random noise KHÔNG CÓ MEMORY giữa các lần gen [lovart.ai, fiddl.art]
- "Identity drift": dù prompt giống nhau, thay đổi nhỏ trong seed/lighting/framing → thay đổi lớn trong facial features, tỷ lệ cơ thể, quần áo [OpenAI community, chilledsites.com]
- Đây là thách thức chính của TOÀN BỘ ngành AI storybook, không riêng Katha

### Các phương pháp giữ consistency (theo research)

| Phương pháp | Mô tả | Hiệu quả | Phù hợp Katha? |
|-------------|-------|-----------|----------------|
| **Master Reference Sheet** | Tạo ảnh reference nhiều góc, nền trắng, dùng làm anchor | ⭐⭐⭐ | ✅ Có — dùng trong character bank |
| **Detailed Text Prompt (Visual Anchor)** | Mô tả chi tiết ngoại hình trong MỌI prompt | ⭐⭐⭐ | ✅ Có — appearance_prompt_en |
| **LoRA Fine-tuning** | Train model nhỏ trên 5-10 ảnh nhân vật | ⭐⭐⭐⭐⭐ | ❌ Quá phức tạp cho MVP |
| **IP-Adapter** | Inject features từ ảnh reference vào attention mechanism | ⭐⭐⭐⭐ | ❓ Phụ thuộc model chọn |
| **Seed Management** | Dùng lại seed từ ảnh thành công | ⭐⭐ | ⚠️ Không ổn định lắm |
| **Character Reference (cref)** | Upload ảnh để anchor identity (Midjourney, một số platform) | ⭐⭐⭐⭐ | ❓ Phụ thuộc model chọn |
| **Same Conversation Thread** | Dùng chung context window (ChatGPT) | ⭐⭐⭐ | ✅ Có thể dùng với OpenAI |

### Giới hạn số nhân vật cho consistency

Từ research, giới hạn thực tế:
- **1 nhân vật/scene**: Consistency TỐT NHẤT — model chỉ cần focus 1 identity
- **2 nhân vật/scene**: Consistency GIẢM ĐÁNG KỂ — model phải phân biệt 2 identity trong 1 ảnh, dễ lẫn features
- **3+ nhân vật/scene**: Consistency KÉM — thường cần manual fix hoặc LoRA
- **Kết luận**: Tối đa 2-3 nhân vật/SCENE (không phải /truyện), mỗi scene nên ít nhân vật nhất có thể

### Workflow khuyến nghị (cho Katha, không dùng LoRA)

```
1. Tạo Master Reference Sheet mỗi nhân vật (4 góc, nền trắng)
2. Lưu ref images vào character bank
3. Mỗi image prompt = art_style + visual_anchor_text + scene + ref_images
4. Ưu tiên: mỗi trang chỉ 1-2 nhân vật (chủ đích giảm nhân vật/scene)
5. Review: admin kiểm tra consistency, gen lại trang lỗi
```

### Nguồn tham khảo
- lovart.ai: Character consistency strategies for AI art
- fiddl.art: Diffusion model limitations and identity drift
- OpenAI: DALL-E 3 character consistency discussion (community.openai.com)
- chilledsites.com: Character DNA approach
- runwayml.com: Reference image mapping
- cobaltexplorer.com: LoRA training for character consistency
- aistorybook.app: AI storybook character reference features
- arxiv.org: Research papers on consistent character generation

---

## 9. Chi phí API — Nghiên cứu giá (07/2026)

### 9.1 OpenAI — Bảng giá chính thức

**GPT Image 2 (tạo ảnh):**

| Loại token | Giá / 1M tokens |
|------------|-----------------|
| Text input | $5.00 |
| Image input (ref ảnh) | $8.00 |
| Image input (cached) | $2.00 |
| **Image output** | **$30.00** |

**Text models:**

| Model | Input / 1M | Output / 1M | Cached Input |
|-------|-----------|-------------|-------------|
| gpt-4o-mini | $0.15 | $0.60 | $0.075 |
| gpt-5.4-nano | $0.20 | $1.25 | $0.02 |
| gpt-5.4-mini | $0.75 | $4.50 | $0.075 |
| gpt-5.4 | $2.50 | $15.00 | $0.25 |
| gpt-5.5 | $5.00 | $30.00 | $0.50 |

### 9.2 Ước tính chi phí 1 ảnh truyện

```
Text input:   ~300 tokens  × $5/1M   = $0.0015
Image input:  ~1500 tokens × $8/1M   = $0.012
Image output: ~4000 tokens × $30/1M  = $0.12
─────────────────────────────────────────────
Tổng 1 ảnh: ~$0.13
```

### 9.3 Ước tính chi phí 1 truyện (8 trang + bìa)

```
Ảnh (gpt-image-2):  9 ảnh × $0.13   = $1.17  (96%)
Text (gpt-4o-mini):  sinh + dịch + edit = $0.02 (4%)
─────────────────────────────────────────────
Tổng / truyện: ~$1.20
```

### 9.4 Batch API — Đã nghiên cứu, KHÔNG dùng

- Batch API giảm 50% giá → $0.065/ảnh thay vì $0.13/ảnh
- Cách dùng: gửi JSONL chứa nhiều request → chờ tối đa 24h (thực tế 5-30 phút)
- **Lý do không dùng**: UX kém (admin phải đợi, không có progress bar real-time)
- **Nếu cần tiết kiệm sau này**: có thể thêm option "Sinh ảnh tiết kiệm" cho batch processing

### 9.5 Budget dự án — 500K VND (~$19.6)

```
Phase 0.5 + Phase 1 (test + 7 nhân vật ref):  ~$2.50
10 truyện NCKH (9 ảnh/truyện):                ~$13.00
Gen lại ảnh lỗi (~15 ảnh):                     ~$2.00
Text gen toàn bộ (gpt-4o-mini hoặc Gemini):    ~$0.50
Buffer:                                         ~$1.60
─────────────────────────────────────────────
Tổng ước: ~$19.6 → VỪA ĐỦ (sát)

Nếu budget 1M VND (~$39.2) → THOẢI MÁI (dư ~$20 buffer)
```

### 9.6 So sánh Gemini vs OpenAI — Text gen

> ⚠️ **Đính chính**: Ban đầu nhầm Gemini rẻ hơn. Thực tế OpenAI gpt-4o-mini RẺ HƠN.

| | Gemini 2.5 Flash | OpenAI gpt-4o-mini | Chênh lệch |
|---|---|---|---|
| Input / 1M tokens | **$0.30** | **$0.15** | OpenAI rẻ hơn 2x |
| Output / 1M tokens | **$2.50** | **$0.60** | OpenAI rẻ hơn 4x |
| Tiếng Việt | Tốt | Tốt | — |
| Tiếng Khmer | Tốt | Tốt | — |

### 9.7 So sánh Gemini vs OpenAI — Image gen

| | Gemini 3.1 Flash Image | Gemini 3 Pro Image | OpenAI GPT Image 2 |
|---|---|---|---|
| Giá / ảnh | ~$0.067 | ~$0.134 | ~$0.13 |
| Chất lượng (test thực tế) | Cartoon, tự thêm text | Tốt hơn Flash | ⭐ Tốt nhất |
| Prompt adherence | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### 9.8 So sánh 3 combo cho 1 truyện (8 trang + bìa)

```
COMBO A: All OpenAI ← KHUYẾN NGHỊ
  Ảnh: gpt-image-2      → 9 × $0.13  = $1.17
  Text: gpt-4o-mini      →             $0.02
  Tổng: ~$1.19 / truyện
  Ưu điểm: 1 provider, 1 billing, ảnh đẹp nhất, text rẻ nhất

COMBO B: Gemini text + OpenAI image
  Ảnh: gpt-image-2      → 9 × $0.13  = $1.17
  Text: Gemini 2.5 Flash →             $0.06  ← ĐẮT HƠN gpt-4o-mini
  Tổng: ~$1.23 / truyện
  Nhược: đắt hơn combo A, cần 2 API key

COMBO C: All Gemini (rẻ nhất nhưng ảnh kém)
  Ảnh: Gemini 3.1 Flash  → 9 × $0.067 = $0.60
  Text: Gemini 2.5 Flash →              $0.06
  Tổng: ~$0.66 / truyện
  Nhược: ảnh cartoon, tự thêm chi tiết, không phù hợp NCKH
```

### 9.9 Budget 500K VND với Combo A (All OpenAI)

```
500K VND ≈ $19.6

Phase 0.5 + Phase 1 (test + 7 nhân vật ref):  ~$2.50
10 truyện NCKH (9 ảnh/truyện × $0.13):        ~$11.70
Text gen toàn bộ (gpt-4o-mini):                ~$0.20
Gen lại ảnh lỗi (~15 ảnh):                     ~$1.95
Buffer:                                         ~$3.25
─────────────────────────────────────────────
Tổng ước: ~$19.6 → VỪA ĐỦ
Số truyện tối đa (không buffer): ~16 truyện
```

### Nguồn tham khảo
- OpenAI API Pricing: https://openai.com/api/pricing/
- Google AI Pricing: https://ai.google.dev/pricing
- OpenAI Batch API docs: https://platform.openai.com/docs/guides/batch
- costgoat.com: GPT Image 2 & Gemini 2.5 Flash cost analysis
- finout.io: OpenAI token pricing breakdown
- laozhang.ai: Gemini 3 Pro Image pricing analysis

---

## 10. Model Selection — Kết quả test thực tế (07/2026)

### 10.1 Test đã thực hiện

**Prompt**: Character turnaround sheet (4 views, full body, white background)
**Nhân vật test**: Srey (bé gái Khmer 7 tuổi), Dara (bé trai Khmer 10 tuổi)
**Cùng prompt, 2 model:**

### 10.2 Kết quả so sánh

| Tiêu chí | OpenAI (GPT Image 2) | Gemini (3.1 Pro Preview) |
|----------|---------------------|------------------------|
| Prompt adherence | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Tự thêm chi tiết ngoài prompt | ❌ Không | ✅ Có (thêm labels, đổi tên) |
| Chi tiết văn hóa Khmer | Hoa văn sampot chi tiết | Sampot đơn giản |
| Style output | Semi-realistic (picture book) | Cartoon/flat |
| Consistency 4 góc | Rất tốt | Tốt |
| Phù hợp truyện thiếu nhi | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

### 10.3 Vấn đề cụ thể của Gemini

- **Tự đổi tên nhân vật**: Prompt ghi "Srey" → Gemini output "SOPHEA"
- **Tự thêm text labels**: "FRONT VIEW", "3/4 VIEW", "SIDE VIEW", "BACK VIEW"
- **Style không kiểm soát**: Luôn ra cartoon dù prompt ghi "clean illustration"
- Pattern lặp lại ở cả 2 nhân vật test → systematic, không phải random

### 10.4 Quyết định chốt — All OpenAI

> Lý do chọn All OpenAI: rẻ hơn cho text (gpt-4o-mini < Gemini 2.5 Flash), 
> ảnh tốt nhất (GPT Image 2), 1 provider = 1 API key = đơn giản.

| Mục đích | Model | Giá | Lý do |
|----------|-------|-----|-------|
| **Sinh ảnh truyện** | gpt-image-2 | ~$0.13/ảnh | Prompt adherence tốt nhất, chi tiết văn hóa |
| **Sinh text truyện** | gpt-4o-mini | ~$0.002/call | Rẻ hơn Gemini 4x output, đủ chất lượng |
| **Dịch VN→KM** | gpt-4o-mini | ~$0.002/call | Cùng model, cần test chất lượng Khmer |
| **Agent điều phối** | gpt-4o-mini | ~$0.001/call | Chỉ cần logic đơn giản |

### 10.5 Models có sẵn trên account OpenAI (checked 07/2026)

**Image gen:**
- `gpt-image-2` ← dùng cái này
- `gpt-image-1.5` (retire 12/2026)
- `gpt-image-1`, `gpt-image-1-mini`

**Text gen (nếu all OpenAI):**
- `gpt-4o-mini` ← rẻ nhất, đủ cho text gen + agent
- `gpt-4o` — trung bình
- `gpt-5.4-nano` — rẻ, mới
- Dòng gpt-5.x — overkill cho Katha

---

*File này được tạo tự động từ quá trình nghiên cứu. Cần verify lại từng nguồn trước khi trích dẫn trong báo cáo NCKH.*


---

## 11. Phase 3C Khmer dependency spike (2026-07-20)

- `khmercut==0.1.0`: là segmenter, không phải spellchecker; smoke build trên Windows/Python 3.11 gặp lỗi encoding metadata nên không pin.
- KOOMPI Khmer spellchecker: nguồn dictionary/Hunspell assets, chưa phải Python runtime adapter sẵn dùng và còn cần review engine/license/corpus.
- `khmerthings`: candidate Python 3.11 ít dependency nhưng đang Alpha/0.x; chưa có corpus + native review đủ để đưa vào P0.
- Quyết định P0: baseline-only, kiểm tra NFC, U+FFFD/control, Khmer-script presence, length và Unicode code-point offsets; warning-only, không auto-correct, không tuyên bố kiểm tra grammar/spelling.
- Advanced segmentation/dictionary adapter và corpus 30–50 mẫu được deferred P1.