# Kiểm thử tự động — Claude Chat Viewer

> Tác giả: Hiếu iceTea 🍀
> Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)

Thư mục này chứa bộ test tự động cho chức năng **"Xuất .md"** — bảo đảm file xuất ra
**đầy đủ, chính xác, không mất dữ liệu** so với dữ liệu gốc.

---

## Chạy test như thế nào?

**Yêu cầu:** máy có [Node.js](https://nodejs.org) (bản 14 trở lên — kiểm tra bằng `node -v`).

**Lệnh** (đứng ở thư mục `claude-chat-viewer/`):

```bash
node tests/test_export_suite.js <thư-mục-export-đã-giải-nén>
```

Trong đó `<thư-mục-export-đã-giải-nén>` là thư mục dữ liệu tải từ claude.ai
(Settings → Privacy → Export data, giải nén ra — bên trong có `conversations.json`). Ví dụ:

```bash
node tests/test_export_suite.js ~/Downloads/data-xxxx-batch-0000
```

> Vì sao phải truyền đường dẫn? App theo kiến trúc **data-driven** — dữ liệu cá nhân
> không nằm trong repo. Test chạy trên chính bộ dữ liệu thật của bạn.

## Kết quả mong đợi

Chạy xong trong ~0,3 giây, dòng cuối phải là:

```
KẾT QUẢ: 998 PASS · 0 FAIL · tổng 998 kiểm tra · ...ms
✅ TẤT CẢ PASS
```

(Số lượng kiểm tra thay đổi theo độ lớn bộ dữ liệu của bạn — quan trọng là **0 FAIL**.)

Nếu có FAIL: danh sách mục lỗi in ngay bên dưới (mã dạng `A-text[5]`, `H-widget-closed`…),
tiền tố chữ cái cho biết nhóm lỗi (xem bảng dưới) — sửa code rồi chạy lại đến khi sạch.
Lệnh thoát với mã ≠ 0 khi fail, nên dùng được trong CI/script.

**Bộ test thứ hai — "Xuất tất cả (.zip)":**

```bash
node tests/test_export_zip.js <thư-mục-export-đã-giải-nén>
```

Dựng gói zip y như nút "Xuất tất cả" (cấu trúc `conversations/` + `projects/` + `INDEX.md`
+ `account.md`) rồi **giải nén bằng công cụ độc lập**
(`unzip -t` + `python zipfile`), so nội dung **từng file khớp tuyệt đối**; kiểm INDEX.md
đủ mục, tên file duy nhất, và cả nhánh fallback STORE (trình duyệt không có CompressionStream).
Yêu cầu thêm: máy có `unzip` và `python3` (macOS có sẵn).

**Bộ test thứ ba — tương thích môi trường:**

```bash
node tests/test_env_compat.js <thư-mục-export-đã-giải-nén>
```

Mô phỏng khác biệt giữa các nơi chạy: **GitHub Pages** (subpath, case-sensitive, Jekyll),
**server local**, **mở file:// trực tiếp** (nơi `history.replaceState` bị chặn — app phải
nuốt lỗi êm), và **đường nạp fallback webkitdirectory** của Firefox/Safari (kết quả phải
giống hệt đường File System Access API).

## Bộ test kiểm tra những gì?

| Nhóm | Nội dung kiểm tra |
|---|---|
| **A. Nội dung đúng & đủ** | Từng khối văn bản / suy luận / truy vấn tìm web / nguồn (title, url, trích đoạn) / artifact / widget / câu hỏi / trích dẫn / công cụ — phải xuất hiện **NGUYÊN VĂN** trong file .md; **thứ tự khối giữ nguyên**; JSON gốc nhúng trong file **parse lại khớp tuyệt đối** (lossless) cho mọi hội thoại + dự án + tài khoản. Mọi expectation sinh từ dữ liệu gốc, không hardcode. |
| **B. Ma trận tổ hợp** | Toàn bộ **512 tổ hợp** (2⁹) checkbox tuỳ chọn xuất: không lỗi; bật thì nội dung có mặt, tắt thì vắng mặt. |
| **C. Fence & ký tự đặc biệt** | Nội dung chứa ` ``` `/` ```` ` lồng nhau, `</details>`, HTML, emoji, tiếng Nhật → Markdown không vỡ, dữ liệu không mất; tên file luôn hợp lệ. |
| **D. Edge cases** | Hội thoại 0 tin nhắn, khối rỗng/thiếu trường, tool_result mồ côi, loại khối lạ, tệp đính kèm, options null → không crash. |
| **E. Coverage %** | Bật "Dữ liệu gốc JSON" → luôn 100%; bật thêm nhóm → % không giảm; luôn trong [0,100]. |
| **F. Filename** | Tên file gợi ý: slug + 8 ký tự uuid + `.md`, không ký tự cấm. |
| **G. Hiệu năng** | Hội thoại lớn nhất: build < 300ms, tính coverage < 300ms. |
| **H. Parity thu gọn** | Trạng thái `<details>` trong .md khớp giao diện web: Suy luận/Tìm web/Công cụ/JSON gốc **đóng**; Artifact/Câu hỏi **mở**; Widget đóng (chủ đích); thẻ đóng/mở cân bằng. |

## Khi nào nên chạy?

- **Trước mỗi lần commit / deploy** có đụng tới `js/exporter.js`, `js/loader.js`, hoặc `js/config.js` (phần `exportOptions`).
- Sau khi cập nhật theo **định dạng export mới** của Anthropic (nếu họ đổi cấu trúc file).
- Khi nghi ngờ file xuất thiếu nội dung — test sẽ chỉ đích danh khối nào thiếu.

## Giới hạn cần biết

- Suite chạy bằng Node (không có trình duyệt) → **không phủ** phần tương tác UI
  (bấm nút tải file, modal, phím tắt). Các phần đó kiểm tay theo [DOCUMENTATION.md](../DOCUMENTATION.md).
- Kết quả phụ thuộc bộ dữ liệu đầu vào — dữ liệu càng đa dạng, độ phủ test càng cao.
