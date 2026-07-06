# Tài liệu chi tiết — Claude Chat Viewer

> Tác giả: Hiếu iceTea 🍀
> Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)

Tài liệu này giải thích **đầy đủ** mọi thành phần, chức năng, cách hoạt động và thao tác
người dùng của ứng dụng. Xem thêm [README.md](README.md) (hướng dẫn nhanh) và
[PROMPT-TAO-LAI.md](PROMPT-TAO-LAI.md) (prompt để AI dựng lại app từ đầu).

---

## 1. Ứng dụng này là gì?

Một trình **xem offline** cho dữ liệu **export từ claude.ai** (Settings → Privacy → Export data).
Chạy hoàn toàn trong trình duyệt, **không server, không build, không internet, không gửi dữ liệu đi đâu**.

Đặc điểm cốt lõi:
- **Data-driven**: toàn bộ mã nguồn tách khỏi dữ liệu. App **đọc trực tiếp** thư mục export
  (giữ nguyên cấu trúc gốc), **không sao chép, không nhúng** dữ liệu vào code.
- **Hiển thị 100% dữ liệu**: mọi trường của mọi file đều lên được giao diện (xem mục 8).

---

## 2. Kiến trúc & bản đồ file

```
claude-chat-viewer/
├── index.html          Khung giao diện (chỉ HTML — không chứa dữ liệu)
├── assets/
│   └── og-image/       Ảnh chia sẻ mạng xã hội — 4 phương án PNG + SVG nguồn (xem README.md trong đó)
├── css/
│   └── styles.css      Toàn bộ giao diện: layout, sáng/tối, loading, thẻ, icon…
├── js/                 Mỗi file gán 1 “namespace” toàn cục (không dùng ES module vì chạy file://)
│   ├── config.js       window.APP_CONFIG — CẤU HÌNH tập trung (nhãn, tên file, theme…)
│   ├── icons.js        window.Icons — bộ icon SVG dùng chung (thay emoji)
│   ├── markdown.js     window.Markdown — render Markdown + tô sáng tìm kiếm + nút sao chép
│   ├── blocks.js       window.Blocks — render mọi loại khối nội dung của 1 tin nhắn
│   ├── storage.js      window.Storage — localStorage (cấu hình) + IndexedDB (ghi nhớ thư mục)
│   ├── loader.js       window.Loader — đọc & chuẩn hoá conversations/projects/users + đo dung lượng
│   ├── exporter.js     window.Exporter — dựng file .md xuất (hội thoại/dự án/tài khoản/INDEX) + % độ phủ
│   ├── zip.js          window.Zip — đóng gói .zip thuần JS (CRC-32 + DEFLATE, fallback STORE)
│   ├── ui.js           window.UI — dựng danh sách, hội thoại, dự án, tìm kiếm, cài đặt, xuất, loading
│   └── app.js          Khởi động & điều phối toàn bộ luồng
└── tests/              Bộ test tự động chạy bằng Node (xem tests/README.md)
```

**Vì sao dùng script cổ điển (không ES module)?** Khi mở bằng `file://`, trình duyệt chặn
`import` giữa các module (CORS). Nên mỗi file tự đăng ký một biến toàn cục (`window.X`) và được nạp
theo thứ tự trong `index.html`: `config → icons → markdown → blocks → storage → loader → exporter → zip → ui → app`.

**Thứ tự phụ thuộc:** `app.js` gọi `UI`, `Loader`, `Storage`; `ui.js` gọi `Blocks`, `Markdown`, `Icons`,
`Exporter`, `Zip`; `blocks.js` gọi `Markdown`, `Icons`; `exporter.js` và `zip.js` độc lập (thuần logic).

---

## 3. Mô hình dữ liệu (cấu trúc file export)

### 3.1. `conversations.json` — mảng các hội thoại
Mỗi hội thoại: `uuid`, `name`, `summary`, `created_at`, `updated_at`, `account`, `chat_messages[]`.

Mỗi **tin nhắn** (`chat_messages[]`): `uuid`, `sender` (`human`/`assistant`), `text`, `created_at`,
`updated_at`, `attachments`, `files`, `parent_message_uuid`, và **`content[]`** — danh sách **khối**
theo đúng thứ tự. Có **4 loại khối**:

| type          | Ý nghĩa | Trường chính |
|---------------|---------|--------------|
| `thinking`    | Suy luận nội bộ của Claude | `thinking` (toàn văn), `summaries[]` (tóm tắt từng bước) |
| `text`        | Văn bản trả lời (Markdown) | `text`, `citations[]` (trích dẫn nguồn) |
| `tool_use`    | Lần gọi công cụ | `name`, `input`, `integration_name`… |
| `tool_result` | Kết quả công cụ (đi ngay sau `tool_use`, khớp qua `id`) | `content[]`, `is_error` |

Các `name` của `tool_use` gặp trong dữ liệu: `web_search` (truy vấn), `artifacts` (tài liệu Claude tạo),
`visualize:show_widget` (widget HTML), `ask_user_input_v0` (câu hỏi + lựa chọn), `visualize:read_me`…

### 3.2. `projects/*.json` — mỗi file một dự án
`uuid`, `name`, `description`, `is_private`, `is_starter_project`, `prompt_template`,
`created_at`, `updated_at`, `creator{uuid,full_name}`, `docs[]{uuid,filename,content,created_at}`.

### 3.3. `users.json` — mảng tài khoản
`uuid`, `full_name`, `email_address`, `verified_phone_number`.

---

## 4. Cách nạp dữ liệu (không có server)

Trình duyệt **không** cho web ở `file://` tự đọc theo đường dẫn tuyệt đối. App dùng 2 cơ chế:

1. **File System Access API** (`window.showDirectoryPicker`) — Chrome/Edge.
   - Người dùng chọn thư mục một lần → nhận `FileSystemDirectoryHandle`.
   - Handle được lưu trong **IndexedDB** (db `claude-chat-viewer`, store `handles`, key `dataDir`)
     để **ghi nhớ** giữa các lần mở. localStorage **không** lưu được handle (chỉ lưu chuỗi).
   - Lần mở sau: lấy handle → `queryPermission`; nếu còn quyền thì **tự nạp**, nếu cần thì hiện
     màn hình “Kết nối lại thư mục” yêu cầu bấm để cấp quyền lại (yêu cầu thao tác người dùng).

2. **Dự phòng** `<input type="file" webkitdirectory>` — Firefox/Safari hoặc khi picker bị chặn.
   - Cho `FileList` (có `webkitRelativePath` + `size`). **Không ghi nhớ** được → mỗi lần mở phải chọn lại.

Cả hai được bọc trong **một “reader” chung** (`handleReader` / `fileListReader`) có cùng API:
`readText(path)`, `listDir(path)`, `totalSize()` → nên phần đọc/chuẩn hoá dùng chung một code path.

**`Loader.load(reader, onProgress)`** trả về:
`{ root, conversations[], users[], projects[], size:{bytes,files} }`.
- Đọc `conversations.json` (bắt buộc) → chuẩn hoá; đọc `users.json`, quét `projects/*.json` (tuỳ chọn).
- Chuẩn hoá **theo lô, nhường luồng** định kỳ (`setTimeout 0`) để giao diện cập nhật khi dữ liệu lớn.
- Mỗi hội thoại chuẩn hoá giữ: `uuid, name, created, updated, summary, account, messages[], raw`.
  Mỗi message: `{ uuid, sender, ts, blocks (khối gốc), plain (chuỗi phẳng để tìm kiếm) }`.
  `raw` = **object gốc nguyên vẹn** (phục vụ hiển thị JSON đầy đủ — bảo chứng 100%).
- `totalSize()` duyệt toàn bộ cây thư mục, cộng `file.size` → **dung lượng chính xác** (không ước lượng).

**Lưu ý:** thay đổi tên file dữ liệu (nếu Anthropic đổi định dạng) chỉ cần sửa `APP_CONFIG.files`.

---

## 5. Các màn hình & luồng hoạt động

`app.js` điều phối theo `boot()`:

1. **Loading** (`#loading`): overlay có logo nhún, 3 chấm nhấp nháy, thanh tiến độ, dòng trạng thái.
   - Nếu tải **> 3 giây**: hiện thêm “**Đã X giây · Còn khoảng ~Y giây**” và thanh chuyển sang %
     xác định. ETA tính theo tốc độ thực: `còn lại = đã_chạy / tỉ_lệ − đã_chạy`.
   - Tải nhanh (< 3s) thì không hiện dòng này (tránh nhấp nháy).
2. **Onboarding** (`#onboarding`): khi chưa cấu hình → nút “Chọn thư mục dữ liệu” + 3 bước +
   mục mở rộng “**Chưa có file export? Cách lấy dữ liệu từ Claude**”. Cũng dùng cho các trạng thái
   “Kết nối lại thư mục”, “Chưa được cấp quyền”, “Không đọc được dữ liệu”, “Đã xoá cấu hình”.
3. **App** (`#app`): giao diện chính 2 cột (sidebar + nội dung).
4. **Settings** (`#settings`): modal cài đặt.
5. **noscript** (`<noscript>`): khi **tắt JavaScript** → hiện thông báo “Cần bật JavaScript”.
6. **Fatal** (`#fatal`): script inline ở `<head>` bắt lỗi `error` toàn cục → hiện “Trình duyệt không
   tương thích” (dành cho trình duyệt quá cũ không hiểu cú pháp). Có guard: nếu app đã chạy thì bỏ qua.

---

## 6. Giao diện & thao tác người dùng

### 6.1. Sidebar (cột trái)
- **Nút "← Tools"** — quay lại gallery “Tools by Hiếu iceTea” (rê chuột: nút nở ra hiện đủ chữ).
  Liên kết đặt ở config `toolsUrl` (mặc định `"../"`; để `""` sẽ **ẩn** nút). Bố cục chọn bằng
  `headerRows`: `1` = gộp cùng hàng tiêu đề (hover → tiêu đề trượt + mờ dần nhường chỗ),
  `2` = nút nằm hàng riêng phía trên tiêu đề.
- **Thương hiệu**: icon chat + “Claude Chat Viewer”.
- **Nút Cài đặt** (bánh răng, góc phải) → mở modal Cài đặt.
- **Tên thư mục** đang mở (icon thư mục + tên); rê chuột hiện tooltip kèm dung lượng.
- **Tabs**: “Hội thoại (N)” / “Dự án (M)” — bấm để chuyển; tab Dự án tự ẩn nếu không có dự án.
- **Ô tìm kiếm**: lọc **theo tiêu đề + toàn bộ nội dung** (gồm cả suy luận, truy vấn tìm kiếm,
  nội dung artifact, câu hỏi) nhờ chuỗi `plain`.
- **Danh sách**: sắp xếp **mới nhất trước**; mỗi mục hiện tiêu đề + ngày + số tin nhắn / số tài liệu.
  Bấm để mở; mục đang chọn được tô nền.
- **Liên kết URL (deep-link)**: mở một hội thoại/dự án → URL tự gắn `?c=<uuid>` / `?p=<uuid>`
  bằng `history.replaceState` (**không** thêm lịch sử duyệt web; trên `file://` API này bị chặn
  → app nuốt lỗi êm). Reload hoặc mở đúng URL → tự mở đúng mục. Param không khớp bộ dữ liệu
  đang mở → toast thân thiện + tự gỡ param, không chọn mục nào.
- **Chữ ký**: “Thực hiện bởi **Hiếu iceTea** 🍀” (tên là link tới https://hieu-icetea.io.vn, mở tab mới).
  Hiệu ứng xuất hiện: lúc mới vào **ẩn hẳn** (không chiếm chỗ); sau **`creditDelaySec` giây**
  (config, mặc định 3) kể từ khi sidebar hiện, trượt lên từ dưới + mở rộng dần diện tích
  (tôn trọng `prefers-reduced-motion`). Đặt `creditDelaySec: 0` → hiện cố định ngay, không hiệu ứng.

### 6.2. Xem hội thoại (cột phải)
Tiêu đề + (ngày tạo → cập nhật · số tin nhắn · uuid) + 2 nút bật/tắt nhanh:
- **Suy luận (N)**: mở/đóng tất cả thẻ suy luận.
- **Nguồn & công cụ (M)**: mở/đóng tất cả thẻ tìm web + công cụ.

Mỗi tin nhắn là một “bong bóng” (👤 Bạn / ✦ Claude), bên trong render **từng khối theo đúng thứ tự gốc**:

| Khối | Hiển thị | Mặc định |
|------|----------|----------|
| `thinking` | Thẻ “Suy luận” thu gọn: danh sách các bước tóm tắt + toàn văn suy luận (Markdown) | **thu gọn** |
| `text` | Văn bản Markdown; nếu có `citations` → liệt kê “Nguồn trích dẫn” (link) | hiện |
| `web_search` (+kết quả) | Thẻ “Tìm web: <truy vấn>” + danh sách nguồn (favicon, tiêu đề-link, site_name·domain·độ mới, trích đoạn **đầy đủ**) | **thu gọn** |
| `artifacts` | Thẻ “Artifact”: markdown → render Markdown; html → iframe cách ly; svg → nhúng | mở |
| `visualize:show_widget` | Thẻ “Widget”: chạy mã HTML trong **iframe cách ly** (auto co giãn chiều cao) + nút “Mở trong tab mới” | mở |
| `ask_user_input_v0` | Thẻ “Câu hỏi cho người dùng”: từng câu + các lựa chọn (chip) + kiểu chọn một/nhiều | mở |
| công cụ khác (`read_me`…) | Thẻ “Công cụ: <tên>” + JSON đầu vào/kết quả | **thu gọn** |
| **Dữ liệu gốc** | Cuối mỗi hội thoại: thẻ “Dữ liệu gốc (JSON đầy đủ)” chứa object gốc nguyên vẹn | **thu gọn** |

Thao tác trong khối:
- **Bấm tiêu đề thẻ** để thu gọn/mở rộng (mũi tên xoay).
- **Nút sao chép** ở góc mọi khối code (`<pre>`, gồm cả JSON) — hiện khi rê chuột, bấm để chép,
  đổi thành dấu ✓ khi thành công (có dự phòng `execCommand` nếu `navigator.clipboard` bị chặn).
- **Tìm kiếm tô vàng**: từ khớp được tô ngay trong nội dung đã render (đi qua text-node nên không phá HTML).

### 6.3. Xem dự án
Bảng “Thông tin dự án” (người tạo, dự án mẫu, riêng tư, prompt mẫu) → Mô tả (Markdown) →
từng tài liệu (tên + ngày + nội dung Markdown) → thẻ “Dữ liệu gốc (JSON đầy đủ)”.

### 6.4. Xuất hội thoại ra Markdown (nút "Xuất .md")
Nút ở **góc phải header** mỗi hội thoại (luôn hiện với mọi hội thoại). Mở modal chọn
**9 nhóm dữ liệu** (mở đầu hướng dẫn AI, văn bản, artifact, câu hỏi, suy luận, tìm web & nguồn,
widget/công cụ, metadata, JSON gốc) — danh sách cấu hình ở `APP_CONFIG.exportOptions`.
Hai preset một-chạm: **"Lưu trữ đầy đủ (100%)"** (bật tất cả, kèm JSON gốc → lossless) và
**"Gọn cho AI"** (đủ ngữ cảnh để AI tiếp tục hội thoại, tiết kiệm token). Modal hiển thị
**% độ phủ dữ liệu** theo trọng số độ dài ký tự (trung thực — chỉ bật JSON gốc mới đạt 100%).
Xuất bằng JS thuần: `Blob` + `<a download>`, tức thì, không cần server. Logic ở `js/exporter.js`
(`buildMarkdown` / `coverage` / `download`) — thuần logic, kiểm thử được bằng Node.
Nội dung chứa ``` được bọc bằng fence dài hơn để không vỡ Markdown.

**Xuất TẤT CẢ (.zip):** nút icon download ở cuối hàng tabs → cùng modal ở "chế độ tất cả":
9 checkbox áp cho mọi hội thoại (số đếm là tổng cộng), thêm 2 tick "Kèm dự án"/"Kèm tài khoản"
(mặc định bật), % độ phủ tổng hợp. Gói zip tổ chức THEO 2 TAB, tên tiếng Anh:
`INDEX.md` + `account.md` ở gốc, `conversations/<slug>_<uuid8>.md`, `projects/project-<slug>_<uuid8>.md`. Nén DEFLATE qua `CompressionStream` (API trình duyệt, không thư viện ngoài;
fallback STORE), CRC-32 tự cài, tên file cờ UTF-8 — module `js/zip.js`. Tiến độ hiện trên nút
("Đang xuất 7/13…" → "Đang nén…") + toast khi xong.

### 6.5. Modal Cài đặt (nút bánh răng)
- **Thư mục dữ liệu**: tên thư mục (ghi rõ trình duyệt không cung cấp đường dẫn tuyệt đối vì bảo mật).
- **Tổng dung lượng**: “X MB · N tệp (đo chính xác)”.
- **Tài khoản** + **Số điện thoại** (từ `users.json`).
- **Nội dung**: tổng số hội thoại · dự án.
- **Giao diện**: công tắc **Chế độ tối** (lưu localStorage, áp ngay).
- **Đổi thư mục** / **Xoá cấu hình** (xoá handle + localStorage) / **Đóng**.
- Thẻ “Dữ liệu gốc tài khoản (users.json)”.

---

## 7. Bộ render Markdown (tự viết, offline)

`Markdown.toHtml(src)` hỗ trợ: tiêu đề `#`, **đậm**/*nghiêng*/~~gạch~~, `code` inline, khối ```code```,
**bảng**, danh sách (bullet/đánh số), **blockquote** (`>` — đã xử lý cả sau khi escape thành `&gt;`),
đường kẻ `---`, link `[text](url)`. Khối code dùng ký tự Private-Use làm mốc để tách an toàn.
`Markdown.highlight(root, filter)` tô vàng; `Markdown.enhanceCopy(root)` gắn nút sao chép cho mọi `<pre>`.

---

## 8. Bảo chứng “hiển thị 100% dữ liệu”

- **Lớp thân thiện**: mọi nội dung ý nghĩa (văn bản, suy luận, nguồn, artifact, widget, câu hỏi,
  thông tin dự án, tài khoản) được render đẹp, **không cắt bớt** (ví dụ trích đoạn web_search hiện đầy đủ).
- **Lớp bảo chứng**: mỗi hội thoại/dự án/tài khoản có thẻ **“Dữ liệu gốc (JSON đầy đủ)”** = `JSON.stringify`
  của object gốc → chứa **mọi trường** (kể cả uuid, timestamp, signature, id kỹ thuật…).
  Vì đây là bản tuần tự hoá **không mất mát** (parse lại khớp tuyệt đối object gốc) nên **tổng độ phủ = 100%**.

---

## 9. Icon, giao diện, tương thích

- **Icon**: dùng **SVG** (`window.Icons`, kiểu line-icon `currentColor`) thay emoji, để đồng nhất trên
  mọi thiết bị/hệ điều hành. `.ic { overflow: visible }` để nét không bị cắt ở mép viewBox. Giữ 🍀 ở chữ ký.
- **Sáng/tối**: qua biến CSS `:root` và `[data-theme="dark"]`.
- **Riêng tư**: 100% xử lý cục bộ, không gọi mạng (trừ favicon nguồn web_search — ảnh ngoài, có thể tắt).
- **Tương thích**: Chrome/Edge (ghi nhớ thư mục) tốt nhất; Firefox/Safari xem được nhưng phải chọn lại
  thư mục mỗi lần mở.

---

## 10. Tuỳ chỉnh nhanh (`js/config.js`)

Tất cả nhãn, tên file dữ liệu, `dateLocale`, `theme` mặc định, `autoReconnect`, và **nhãn giao diện**
(`labels`) đều nằm trong `APP_CONFIG`. Sửa ở đây là đổi được ngôn ngữ/hành vi mà không đụng logic.
Các khóa giao diện khác: `toolsUrl` (liên kết nút "← Tools"; `""` = ẩn nút), `headerRows`
(`1` = gộp nút quay lại cùng hàng tiêu đề, `2` = tách 2 hàng), `creditDelaySec` (số giây trễ
hiệu ứng chữ ký cuối sidebar; `0` = hiện cố định ngay, không hiệu ứng).
