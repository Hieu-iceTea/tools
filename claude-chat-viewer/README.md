# Claude Chat Viewer — trình xem offline

> Tác giả: Hiếu iceTea 🍀
> Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)

Trình xem dữ liệu **export từ claude.ai** ngay trong trình duyệt, hoàn toàn **offline**.
Thiết kế theo hướng **data-driven**: toàn bộ mã nguồn tách khỏi dữ liệu — app đọc **trực tiếp**
thư mục export bạn chọn (giữ nguyên cấu trúc gốc), **không sao chép, không nhúng** dữ liệu vào code.

> **Tài liệu liên quan**
> - [DOCUMENTATION.md](DOCUMENTATION.md) — giải thích đầy đủ mọi chức năng, cách hoạt động & thao tác.
> - [PROMPT-TAO-LAI.md](PROMPT-TAO-LAI.md) — prompt để AI dựng lại web tương tự từ đầu.
> - [tests/README.md](tests/README.md) — 3 bộ test tự động (xuất .md · gói .zip · tương thích môi trường) & cách chạy.

## Tính năng chính

- Xem **toàn bộ** hội thoại & dự án — hiển thị 100% dữ liệu: văn bản, suy luận, tìm web & nguồn,
  artifact, widget, câu hỏi… kèm thẻ **JSON gốc** bảo chứng không mất gì.
- **Tìm kiếm toàn văn** (cả nội dung suy luận/artifact) + tô sáng từ khớp.
- **Xuất .md** từng hội thoại (chọn nhóm dữ liệu, % độ phủ, 2 preset) và
  **Xuất tất cả thành .zip** (`INDEX.md` + `conversations/` + `projects/` + `account.md`).
- **Liên kết sâu** `?c=`/`?p=` — reload hoặc chia sẻ URL là mở đúng hội thoại.
- Chế độ **sáng/tối**; chạy tốt từ `file://`, server local lẫn GitHub Pages.

## Cách dùng

1. Giải nén file `.zip` export tải từ **claude.ai → Settings → Privacy → Export data**.
2. Mở `index.html` bằng **Google Chrome** hoặc **Microsoft Edge** (khuyến nghị).
3. Bấm **"Chọn thư mục dữ liệu"** và chọn **thư mục vừa giải nén**
   (bên trong có `conversations.json`). Cho phép trình duyệt đọc thư mục.
4. Xong. App nhớ thư mục cho những lần sau — mở lên là tự nạp.

## Cấu trúc dự án

```
claude-chat-viewer/
├── index.html          # khung giao diện (chỉ HTML, không chứa dữ liệu)
├── assets/
│   └── og-image/       # ảnh chia sẻ mạng xã hội, 4 phương án PNG + SVG nguồn (xem README.md trong đó)
├── css/
│   └── styles.css      # giao diện + màn hình loading + sáng/tối
├── js/
│   ├── config.js       # ⚙️  CẤU HÌNH — sửa nhãn, tên file dữ liệu, theme… tại đây
│   ├── icons.js        # bộ icon SVG dùng chung (thay emoji, đồng nhất mọi thiết bị)
│   ├── markdown.js     # bộ render Markdown (bảng, code, list…) tự viết, offline
│   ├── blocks.js       # render các khối tin nhắn (suy luận, tìm web, artifact, widget…)
│   ├── storage.js      # lưu cấu hình (localStorage) + ghi nhớ thư mục (IndexedDB)
│   ├── loader.js       # đọc & chuẩn hoá conversations.json / projects / users
│   ├── exporter.js     # dựng file .md khi xuất (hội thoại / dự án / tài khoản / INDEX)
│   ├── zip.js          # đóng gói .zip thuần JS (CRC-32 + DEFLATE, không thư viện ngoài)
│   ├── ui.js           # dựng danh sách, hội thoại, dự án, tìm kiếm, cài đặt, xuất
│   └── app.js          # khởi động & điều phối luồng
└── tests/              # bộ test tự động (xem tests/README.md)
```

Dữ liệu **nằm ở thư mục khác** (thư mục export đã giải nén). App chỉ trỏ tới, không giữ bản sao.

## Cấu hình

- **Sửa nhanh trong giao diện:** nút ⚙︎ (góc trên trái) → đổi thư mục, bật/tắt chế độ tối, xoá cấu hình.
- **Sửa sâu bằng file:** mở `js/config.js` — đổi tên file dữ liệu (nếu Anthropic đổi định dạng),
  nhãn ngôn ngữ, locale ngày giờ, theme mặc định…
- Cấu hình giao diện được lưu ở `localStorage`; **liên kết tới thư mục** được lưu ở `IndexedDB`
  (trình duyệt không cho lưu đường dẫn tuyệt đối vào localStorage vì lý do bảo mật).

## Cấu hình lưu ở đâu?

| Thứ | Nơi lưu | Vì sao |
|---|---|---|
| Đã cấu hình chưa, tên thư mục, theme, tab | `localStorage` (`ccv.settings`) | Nhẹ, đọc nhanh |
| "Tay cầm" thư mục (để tự nạp lại) | `IndexedDB` (`claude-chat-viewer`) | Trình duyệt chỉ cho ghi nhớ quyền thư mục qua IndexedDB |

Muốn quên hết: nút **Xoá cấu hình** trong Cài đặt.

## Tương thích

- **Chrome / Edge** (khuyến nghị): ghi nhớ được thư mục, mở lần sau tự nạp.
- **Firefox / Safari**: vẫn xem được qua chế độ dự phòng (chọn thư mục bằng hộp thoại tải lên),
  nhưng **không ghi nhớ** — mỗi lần mở phải chọn lại thư mục.

## Riêng tư

Mọi xử lý chạy trong trình duyệt trên máy bạn. **Không có** dữ liệu nào được gửi đi đâu.
