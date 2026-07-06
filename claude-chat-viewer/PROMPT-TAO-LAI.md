# Prompt tái tạo — Dựng lại "Claude Chat Viewer" bằng AI

> Tác giả: Hiếu iceTea 🍀
> Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)

File này chứa **prompt dán vào công cụ AI** (Claude Code, Cursor, v.v.) để tạo lại **từ đầu** một web
có **đầy đủ chức năng**. Chi tiết kỹ thuật xem [DOCUMENTATION.md](DOCUMENTATION.md);
hướng dẫn dùng xem [README.md](README.md).

**Định hướng quan trọng:**
- ⭐ **Ưu tiên số 1: CHỨC NĂNG đầy đủ và CHÍNH XÁC 100%** + thao tác sử dụng hợp lý.
- 🎨 **GIAO DIỆN: tự do sáng tạo** — KHÔNG cần giống bản gốc. Công cụ AI được toàn quyền
  thiết kế lại bố cục, màu sắc, kiểu chữ, thành phần… miễn là đáp ứng đủ các **yêu cầu hành vi** bên dưới.

---

## Cách dùng
Dán **toàn bộ khối dưới đây** vào công cụ AI. Nếu công cụ đọc được file, đưa kèm
`DOCUMENTATION.md` để AI bám sát chi tiết dữ liệu & hành vi.

---

## === BẮT ĐẦU PROMPT ===

Bạn là kỹ sư frontend. Hãy xây dựng một **ứng dụng web tĩnh, thuần HTML/CSS/JavaScript** —
trình **xem offline** cho dữ liệu **export từ claude.ai** (Settings → Privacy → Export data; giải nén
ra thư mục chứa `conversations.json`, `users.json`, `projects/`). Giao diện & thông báo bằng **tiếng Việt**.

**Hai nguyên tắc chi phối toàn bộ:**
1. **CHỨC NĂNG phải đầy đủ và chính xác 100%** — đọc đúng, xử lý đúng, hiển thị đủ mọi dữ liệu,
   mọi thao tác hoạt động đúng. Đây là tiêu chí nghiệm thu quan trọng nhất.
2. **GIAO DIỆN được TỰ DO sáng tạo** — bạn tự quyết bố cục, phong cách, màu sắc, thành phần, hoạt ảnh…
   Không cần bắt chước bản gốc. Chỉ cần thoả các **yêu cầu hành vi** (behavior), không ràng buộc hình thức.

---

### A. RÀNG BUỘC KỸ THUẬT (bắt buộc — không được vi phạm)
1. **Chạy được khi mở bằng `file://`** (double-click `index.html`): không cần server, không bước build, không internet.
2. **KHÔNG dùng ES module / `import`** (bị CORS ở `file://`). Dùng `<script>` cổ điển; chia file theo ý bạn.
3. **KHÔNG tải tài nguyên ngoài** (CDN, font, thư viện). Tự viết mọi thứ, kể cả bộ render Markdown.
4. **Data-driven**: tách code khỏi dữ liệu. **Đọc trực tiếp** thư mục export người dùng chọn,
   **giữ nguyên cấu trúc gốc**, **không sao chép/nhúng** dữ liệu vào code.
5. **Riêng tư tuyệt đối**: mọi xử lý cục bộ, không gửi dữ liệu đi bất kỳ đâu.

### B. NẠP DỮ LIỆU (không server)
- Ưu tiên **File System Access API** (`showDirectoryPicker`, Chrome/Edge). Lưu
  `FileSystemDirectoryHandle` vào **IndexedDB** để **ghi nhớ** thư mục giữa các lần mở; lần sau
  `queryPermission`/`requestPermission` để tự nạp hoặc yêu cầu kết nối lại.
- **Dự phòng** `<input type="file" webkitdirectory>` cho trình duyệt không hỗ trợ (chấp nhận không ghi nhớ).
- Nên bọc cả hai sau **một lớp “reader” chung**: `readText(path)`, `listDir(path)`, `totalSize()`.
- Cấu hình nhẹ (đã cấu hình chưa, tên thư mục, theme) lưu **localStorage**.

### C. MÔ HÌNH DỮ LIỆU CẦN ĐỌC (chính xác 100%)
- `conversations.json`: mảng `{uuid,name,summary,created_at,updated_at,account,chat_messages[]}`.
  Mỗi tin nhắn: `sender` (`human`/`assistant`), `created_at`, và **`content[]`** = danh sách **khối
  theo đúng thứ tự**, 4 loại:
  - `thinking`: `thinking` (toàn văn), `summaries[]` (tóm tắt từng bước).
  - `text`: `text` (Markdown), `citations[]` (nguồn trích dẫn).
  - `tool_use`: `name`, `input`, `integration_name`… — xử lý riêng theo `name`:
    `web_search` (`input.query`; kết quả là danh sách nguồn `{title,url,text,metadata{favicon_url,
    site_domain,site_name},prompt_context_metadata{age}}`), `artifacts`
    (`input.{type,title,id,content,command}`), `visualize:show_widget` (`input.{title,widget_code}`),
    `ask_user_input_v0` (`input.questions[]{question,options[],type}`), và fallback cho tên khác.
  - `tool_result`: `content[]`, `is_error` — **đi ngay sau** `tool_use` tương ứng, khớp qua `id`/`tool_use_id`.
- `projects/*.json`: `{uuid,name,description,is_private,is_starter_project,prompt_template,
  created_at,updated_at,creator{full_name},docs[]{filename,content,created_at}}`.
- `users.json`: mảng `{uuid,full_name,email_address,verified_phone_number}`.

### D. CHỨC NĂNG BẮT BUỘC (đầy đủ 100% — mô tả HÀNH VI, không ràng buộc hình thức)

**Luồng khởi động:**
- Chưa cấu hình → màn hình chọn thư mục, kèm hướng dẫn **cách export từ Claude**
  (Settings → Privacy → Export data → nhận `.zip` qua email → giải nén).
- Đã cấu hình & còn quyền → **tự nạp**; nếu mất quyền → cho “kết nối lại”.
- **Màn hình chờ (loading)**: có tiến trình; nếu tải **> 3 giây** thì hiện **thời gian đã chạy + ước lượng
  còn lại** (tính theo tiến độ thực). Khi xử lý dữ liệu lớn phải **nhường luồng** để UI không đơ.
- **Tắt JavaScript** → thông báo rõ ràng (dùng `<noscript>`).
- **Trình duyệt quá cũ / lỗi khởi động** → bắt lỗi và hiện thông báo thay vì trang trắng.

**Duyệt & tìm kiếm:**
- Liệt kê **hội thoại** và **dự án** (hai nhóm riêng), **sắp xếp mới nhất trước**.
- **Tìm kiếm** lọc theo tiêu đề **và toàn bộ nội dung** — gồm cả suy luận, truy vấn tìm kiếm,
  nội dung artifact, câu hỏi. Từ khớp được **tô sáng** trong nội dung đang xem.
- **Liên kết sâu qua URL**: mở một hội thoại/dự án → ghi mã vào URL (`?c=<uuid>` / `?p=<uuid>`)
  bằng `history.replaceState` — **không** thêm lịch sử duyệt web; bọc try/catch vì trên `file://`
  API này ném lỗi bảo mật. Reload hoặc mở đúng URL → tự mở đúng mục. Param không khớp dữ liệu
  → thông báo (toast) thân thiện, tự gỡ param khỏi URL và không chọn mục nào.

**Hiển thị hội thoại — render MỌI loại khối theo đúng thứ tự gốc, KHÔNG cắt bớt:**
- `thinking`: xem được toàn văn + các bước tóm tắt (nên cho thu gọn để đỡ rối).
- `text`: render Markdown + liệt kê nguồn trích dẫn (link).
- `web_search`: hiện truy vấn + danh sách nguồn (favicon, tiêu đề-link, domain, độ mới,
  **trích đoạn đầy đủ — không cắt**).
- `artifacts`: markdown → render Markdown; html → chạy trong **iframe cách ly**; svg → nhúng.
- `visualize:show_widget`: chạy `widget_code` trong **iframe sandbox** (nên tự co giãn chiều cao) +
  cho “mở trong tab mới”.
- `ask_user_input_v0`: hiện câu hỏi + các lựa chọn + kiểu chọn một/nhiều.
- công cụ khác: hiện tên + JSON đầu vào/kết quả.
- Phân biệt rõ tin của **người dùng** và của **Claude**.

**Bảo chứng 100% dữ liệu (bắt buộc):**
- Ngoài lớp hiển thị thân thiện, mỗi hội thoại/dự án/tài khoản phải có lối xem **“Dữ liệu gốc (JSON đầy đủ)”**
  = `JSON.stringify` object gốc → chứa **mọi trường** (kể cả uuid/timestamp/signature/id kỹ thuật).
  Đây là bản tuần tự hoá **không mất mát** → đảm bảo không sót bất kỳ dữ liệu nào.

**Hiển thị dự án:** thông tin dự án (người tạo, dự án mẫu, riêng tư, prompt mẫu) + mô tả (Markdown) +
từng tài liệu (tên, ngày, nội dung Markdown) + dữ liệu gốc.

**Cài đặt:** tên thư mục (nêu rõ trình duyệt không cung cấp đường dẫn tuyệt đối vì bảo mật),
**tổng dung lượng đo CHÍNH XÁC** (cộng `file.size` toàn bộ tệp — nếu không đo được thì nói rõ, không bịa),
tài khoản + SĐT, tổng số hội thoại/dự án, **chế độ sáng/tối**, **đổi thư mục**, **xoá cấu hình**,
và JSON gốc `users.json`.

**Bộ render Markdown tự viết** (đủ dùng cho nội dung chat): tiêu đề, đậm/nghiêng/gạch, code inline +
khối code, **bảng**, danh sách, **blockquote**, đường kẻ, link. Kèm: **nút sao chép** ở mọi khối code
(dùng `navigator.clipboard`, có dự phòng `execCommand`) và **tô sáng tìm kiếm** không phá vỡ HTML.

**Xuất hội thoại ra file `.md`** (từng hội thoại riêng lẻ, nút luôn hiện ở header hội thoại):
- Modal chọn **nhóm dữ liệu** xuất (mở đầu hướng dẫn AI, văn bản+trích dẫn, artifact, câu hỏi,
  suy luận, tìm web & nguồn, widget/công cụ, metadata, JSON gốc) — danh sách data-driven trong config.
- 2 preset: **"Lưu trữ đầy đủ (100%)"** (bật hết, kèm JSON gốc → lossless) và **"Gọn cho AI"**
  (đủ ngữ cảnh cho AI tiếp tục hội thoại, tiết kiệm token).
- Hiển thị **% độ phủ dữ liệu** trung thực (trọng số theo độ dài ký tự; chỉ kèm JSON gốc mới là 100%).
- Chuyển đổi đi qua blocks THEO THỨ TỰ GỐC: "## Bạn/Claude", suy luận trong `<details>`,
  artifact markdown chèn nguyên văn, html/svg/widget/JSON bọc code-fence (nội dung chứa ``` thì
  dùng fence dài hơn). Xuất bằng JS thuần: `Blob` + `<a download>` — không server, không AI.

**Xuất TẤT CẢ hội thoại thành gói `.zip`** (nút riêng, tái dùng modal ở "chế độ tất cả"):
cấu trúc thư mục TIẾNG ANH theo 2 tab: `conversations/` + `projects/` (prefix `project-`),
`INDEX.md` mục lục + `account.md` ở gốc; tuỳ chọn kèm dự án/tài khoản; ZIP **tự cài đặt
thuần JS** (CRC-32 + DEFLATE qua `CompressionStream`, fallback STORE khi không hỗ trợ — tuyệt đối
không thư viện ngoài); tiến độ hiển thị khi xử lý nhiều file; kiểm chứng bằng cách giải nén
với công cụ độc lập và so nội dung từng file khớp tuyệt đối.

### E. GIAO DIỆN & TRẢI NGHIỆM — TỰ DO SÁNG TẠO 🎨
- Bạn **được khuyến khích** thiết kế giao diện **mới, đẹp, hiện đại** theo phong cách riêng: bố cục
  (sidebar, top-bar, dạng khác…), bảng màu, kiểu chữ, khoảng cách, hoạt ảnh, cách trình bày khối…
- Chỉ cần **đáp ứng các yêu cầu hành vi** ở mục D và **dễ dùng, dễ đọc lại lịch sử** hội thoại.
- **Khuyến nghị** (không bắt buộc): dùng **icon SVG** thay emoji cho icon giao diện để đồng nhất giữa
  thiết bị (emoji hiển thị khác nhau tuỳ hệ điều hành); hỗ trợ **responsive**.
- **Giữ chữ ký tác giả**: hiển thị tinh tế “Hiếu iceTea 🍀”, trong đó **Hiếu iceTea** là link tới
  `https://hieu-icetea.io.vn` (mở tab mới). Vị trí/kiểu do bạn quyết. Gợi ý (không bắt buộc):
  bản gốc ẩn chữ ký lúc đầu, 3 giây sau khi danh sách hiện mới trượt lên từ dưới & mở rộng dần.

### F. TIÊU CHUẨN NGHIỆM THU & TỰ KIỂM
- **Chức năng đủ & đúng 100%**: đọc đúng mọi file; render mọi loại khối không lỗi, không cắt nội dung;
  mọi thao tác (chọn/đổi/xoá thư mục, tìm kiếm, thu gọn/mở, sao chép, sáng/tối, xem JSON gốc) hoạt động.
- Kiểm cú pháp mọi file JS (`node --check`).
- Tự viết kịch bản kiểm thử (DOM giả lập hoặc dữ liệu mẫu): render toàn bộ tin nhắn không lỗi; **chứng minh
  thẻ “Dữ liệu gốc” parse lại KHỚP object gốc** (không mất mát) → độ phủ dữ liệu = 100%; đo dung lượng
  khớp thực tế.
- Chạy offline; mở `file://` không lỗi; tắt JavaScript có thông báo.

Hãy tạo toàn bộ file, **thoải mái sáng tạo giao diện**, giải thích ngắn gọn từng phần, và **tự kiểm
chức năng** trước khi bàn giao.

## === KẾT THÚC PROMPT ===
