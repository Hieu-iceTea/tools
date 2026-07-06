/*
 * icons.js — Bộ icon SVG dùng chung (line-icon, đồng nhất mọi thiết bị)
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 *
 * Dùng SVG thay cho emoji/ký hiệu văn bản (💬 📂 ⚙︎ …) vì emoji hiển thị
 * khác nhau trên mỗi thiết bị/hệ điều hành. Icon dùng currentColor để ăn theo màu chữ.
 */
(function () {
  "use strict";
  var OPEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var FILL = '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">';
  var END = "</svg>";
  function ln(p) { return OPEN + p + END; }
  function fl(p) { return FILL + p + END; }

  window.Icons = {
    chat: ln('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    folder: ln('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    gear: ln('<path d="M10.1 3.9 10.5 1.5 13.5 1.5 13.9 3.9 16.4 5.0 18.4 3.5 20.5 5.6 19.0 7.6 20.1 10.1 22.5 10.5 22.5 13.5 20.1 13.9 19.0 16.4 20.5 18.4 18.4 20.5 16.4 19.0 13.9 20.1 13.5 22.5 10.5 22.5 10.1 20.1 7.6 19.0 5.6 20.5 3.5 18.4 5.0 16.4 3.9 13.9 1.5 13.5 1.5 10.5 3.9 10.1 5.0 7.6 3.5 5.6 5.6 3.5 7.6 5.0Z"/><circle cx="12" cy="12" r="3.1"/>'),
    think: ln('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.1 14c.2-1 .7-1.8 1.4-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.2 1.5 1.4 2.5"/>'),
    search: ln('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>'),
    doc: ln('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>'),
    chart: ln('<path d="M3 3v18h18"/><rect x="7" y="9" width="3" height="9" rx="1"/><rect x="12" y="5" width="3" height="13" rx="1"/><rect x="17" y="12" width="3" height="6" rx="1"/>'),
    help: ln('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
    wrench: ln('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    code: ln('<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>'),
    info: ln('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
    text: ln('<path d="M17 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M17 18H3"/>'),
    user: ln('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    spark: fl('<path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2z"/>'),
    chevron: ln('<path d="m9 18 6-6-6-6"/>'),
    arrowLeft: ln('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'),
    download: ln('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
    alert: ln('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
    ban: ln('<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>'),
  };
})();
