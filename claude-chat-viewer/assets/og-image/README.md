# assets/og-image/ — Ảnh chia sẻ mạng xã hội

> Tác giả: Hiếu iceTea 🍀
> Hỗ trợ bởi: Claude (Claude Code, model Claude Fable 5)

Ảnh hiển thị khi chia sẻ link lên Facebook / Messenger / Zalo / Microsoft Teams
(các nền tảng đều đọc thẻ Open Graph `og:image` trong `index.html`). Kích thước chuẩn **1200×630** (tỉ lệ 1.91:1).

Mỗi phương án gồm 1 cặp cùng tên: `.svg` (nguồn, sửa được) + `.png` (bản xuất, dùng thật):

| Phương án | File | Ghi chú |
|---|---|---|
| **A — Kem tối giản** | `og-a-cream.svg/.png` | **ĐANG DÙNG** — `og:image` trong `index.html` trỏ tới PNG này |
| B — Cam đất đậm | `og-b-terracotta.svg/.png` | Nổi bật nhất trên feed |
| C — Nền tối glow ấm | `og-c-dark.svg/.png` | Phong cách hiện đại/dev |
| D — Mockup giao diện | `og-d-mockup.svg/.png` | Thấy ngay hình dáng app |

Bảng màu theo đúng thương hiệu của app: nền kem `#faf9f5` + cam đất `#c96442` (xem `css/styles.css`).

## Đổi ảnh chính

Sửa 2 thẻ trong `index.html` (`og:image` và `twitter:image`) trỏ sang PNG của phương án muốn dùng, ví dụ:

```
https://tools.hieu-icetea.io.vn/claude-chat-viewer/assets/og-image/og-c-dark.png
```

Sau khi deploy, vào [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
bấm **Scrape Again** để làm mới cache preview (dùng chung cho cả Messenger; Zalo/Teams tự hết cache sau vài ngày).

## Tái xuất PNG từ SVG (khi sửa nguồn)

Không cần cài gì thêm — dùng Chrome headless có sẵn trên máy (macOS), đứng tại thư mục này:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1200,630 \
  --screenshot=og-a-cream.png "file://$(pwd)/og-a-cream.svg"
```
