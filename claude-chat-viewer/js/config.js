/*
 * config.js — Cấu hình ứng dụng (data-driven)
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 *
 * Đây là NƠI DUY NHẤT để chỉnh cấu hình. App đọc mọi nhãn/tuỳ chọn từ đây.
 * Có thể sửa trực tiếp file này, HOẶC đổi trong giao diện (nút Cài đặt) —
 * thay đổi trong giao diện được lưu vào localStorage và GHI ĐÈ các giá trị dưới.
 */
window.APP_CONFIG = {
  // Tên hiển thị của ứng dụng
  appName: "Claude Chat Viewer",

  // Liên kết quay lại bộ sưu tập công cụ (gallery "Hiếu iceTea Tools").
  // "../" khi đặt trong gallery → về trang danh sách tools. Để "" (rỗng) sẽ ẨN nút này.
  toolsUrl: "../",

  // Bố cục hàng đầu sidebar (nút quay lại "← Tools" + tiêu đề + nút cài đặt):
  //   1 = GỘP 1 HÀNG: hover nút quay lại → nó nở ra, tiêu đề trượt + mờ dần nhường chỗ.
  //   2 = TÁCH 2 HÀNG: nút quay lại nằm hàng riêng phía trên tiêu đề (không hiệu ứng trượt).
  headerRows: 1,

  // Chữ ký "Thực hiện bởi…" cuối sidebar — thời gian trễ xuất hiện (GIÂY):
  //   3 = ẩn lúc đầu, sau 3 giây trượt lên từ dưới & mở rộng dần (đổi số giây tuỳ ý).
  //   0 = hiện cố định ngay từ đầu, KHÔNG hiệu ứng trễ.
  creditDelaySec: 3,

  /*
   * Cấu trúc thư mục dữ liệu (GIỮ NGUYÊN như khi giải nén file export của claude.ai).
   * App KHÔNG sao chép dữ liệu — nó đọc trực tiếp từ thư mục bạn chọn.
   * Nếu Anthropic đổi tên file trong tương lai, chỉ cần sửa các dòng dưới.
   */
  files: {
    conversations: "conversations.json", // bắt buộc
    users: "users.json",                 // tuỳ chọn — thông tin tài khoản
    projectsDir: "projects",             // tuỳ chọn — thư mục chứa các project *.json
  },

  /*
   * Đường dẫn thư mục dữ liệu:
   * Vì lý do bảo mật, TRÌNH DUYỆT KHÔNG cho web ở dạng file:// tự đọc theo đường dẫn tuyệt đối.
   * Bạn phải CHỌN thư mục một lần qua hộp thoại; sau đó app ghi nhớ (xem README).
   * Trường dưới chỉ để GỢI Ý tên thư mục cho bạn dễ nhận ra khi chọn.
   */
  dataFolderHint: "data-...-batch-0000  (thư mục đã giải nén từ file .zip export)",

  // Ngôn ngữ định dạng ngày giờ
  dateLocale: "vi-VN",
  timeZone: undefined, // ví dụ "Asia/Ho_Chi_Minh"; để undefined = theo máy

  // Giao diện
  theme: "light",          // "light" | "dark"
  autoReconnect: true,     // tự nạp lại thư mục đã chọn lần trước (nếu còn quyền)

  /*
   * Xuất hội thoại ra Markdown (nút "Xuất .md" trên header hội thoại).
   * Mỗi mục = 1 checkbox trong modal; def = trạng thái tick mặc định.
   * Thêm/bớt nhóm dữ liệu chỉ cần sửa danh sách này.
   */
  exportOptions: [
    { key: "aiHeader",  label: "Mở đầu hướng dẫn AI",     desc: "Ghi chú đầu file giúp AI hiểu cấu trúc để tiếp tục hội thoại", def: true },
    { key: "text",      label: "Văn bản hội thoại",        desc: "Nội dung trao đổi chính + trích dẫn nguồn", def: true },
    { key: "artifacts", label: "Artifact",                 desc: "Tài liệu Claude tạo (markdown / html / svg)", def: true },
    { key: "ask",       label: "Câu hỏi lựa chọn",         desc: "Câu hỏi Claude đặt kèm các phương án trả lời", def: true },
    { key: "thinking",  label: "Suy luận (thinking)",      desc: "Toàn văn suy luận nội bộ + tóm tắt từng bước", def: false },
    { key: "websearch", label: "Tìm web & nguồn",          desc: "Truy vấn + danh sách nguồn, trích đoạn đầy đủ", def: false },
    { key: "tools",     label: "Widget & công cụ khác",    desc: "Mã widget, JSON đầu vào/kết quả công cụ", def: false },
    { key: "meta",      label: "Metadata tin nhắn",        desc: "uuid của từng tin nhắn", def: false },
    { key: "rawJson",   label: "Dữ liệu gốc JSON",         desc: "Nguyên văn 100% — bảo chứng không mất gì (bọc gọn trong <details>)", def: false },
  ],

  // Nhãn giao diện (đổi ngôn ngữ tại đây nếu muốn)
  labels: {
    tabConversations: "Hội thoại",
    tabProjects: "Dự án",
    searchPlaceholder: "Tìm trong tiêu đề & nội dung…",
    emptyMain: "← Chọn một mục để xem",
    you: "Bạn",
    assistant: "Claude",
    settings: "Cài đặt",
    chooseFolder: "Chọn thư mục dữ liệu",
    changeFolder: "Đổi thư mục",
    clearConfig: "Xoá cấu hình",
    reconnect: "Kết nối lại thư mục",
    backTools: "Tools",              // nhãn nút quay lại gallery
    backToolsExtra: "by Hiếu iceTea", // phần hiện thêm khi rê chuột
  },
};
