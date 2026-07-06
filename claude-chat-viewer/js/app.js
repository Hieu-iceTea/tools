/*
 * app.js — Khởi động & điều phối
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 *
 * Luồng:
 *   1) Áp theme, gắn sự kiện giao diện.
 *   2) Nếu đã từng chọn thư mục (có quyền) → tự nạp lại.
 *   3) Nếu chưa → màn hình chọn thư mục. Sau khi chọn: kiểm tra, lưu, hiển thị loading, đọc, render.
 */
(function () {
  "use strict";
  var C = window.APP_CONFIG, S = window.Storage, Loader = window.Loader, UI = window.UI;
  var L = C.labels;

  var reconnectHandle = null; // handle đang chờ cấp lại quyền (chế độ "kết nối lại")
  var hasFSA = typeof window.showDirectoryPicker === "function";

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function ensurePerm(handle, request) {
    var opts = { mode: "read" };
    try {
      if ((await handle.queryPermission(opts)) === "granted") return true;
      if (request && (await handle.requestPermission(opts)) === "granted") return true;
    } catch (e) {}
    return false;
  }

  async function loadWithReader(reader, persistHandle) {
    UI.showLoading("Đang mở thư mục dữ liệu…");
    await delay(180); // cho hiệu ứng loading kịp hiện
    try {
      var d = await Loader.load(reader, UI.setLoading);
      if (persistHandle) {
        try { await S.saveDirHandle(persistHandle); } catch (e) {}
        S.patchSettings({ configured: true, folderName: persistHandle.name, fallback: false });
      }
      await delay(150);
      UI.setData(d);
      UI.showApp();
    } catch (e) {
      UI.showOnboarding({
        title: "Không đọc được dữ liệu",
        desc: "Hãy chọn đúng thư mục đã <b>giải nén</b> từ file export (bên trong có <code>" +
          C.files.conversations + "</code>).",
        error: e && e.message ? e.message : String(e),
        button: L.chooseFolder,
      });
    }
  }

  /* ---------- callbacks từ UI ---------- */
  async function onChooseFolder() {
    // chế độ kết nối lại: xin cấp quyền cho handle cũ
    if (reconnectHandle) {
      var h = reconnectHandle; reconnectHandle = null;
      if (await ensurePerm(h, true)) return loadWithReader(Loader.handleReader(h), h);
      return UI.showOnboarding({
        title: "Chưa được cấp quyền",
        desc: "Trình duyệt chưa cho phép đọc thư mục. Hãy chọn lại thư mục dữ liệu.",
        button: L.chooseFolder,
      });
    }
    // chọn thư mục mới
    if (hasFSA) {
      var handle;
      try {
        handle = await window.showDirectoryPicker({ mode: "read", id: "ccv-data" });
      } catch (e) {
        if (e && e.name === "AbortError") return; // người dùng huỷ
        return UI.triggerFileInput(); // môi trường chặn picker → dùng bản dự phòng
      }
      if (await ensurePerm(handle, true)) return loadWithReader(Loader.handleReader(handle), handle);
      return UI.showOnboarding({ title: "Chưa được cấp quyền", desc: "Hãy thử chọn lại và bấm 'Cho phép'.", button: L.chooseFolder });
    }
    // không có File System Access API → input webkitdirectory
    UI.triggerFileInput();
  }

  function onChangeFolder() { reconnectHandle = null; onChooseFolder(); }

  function onFolderInput(files) {
    if (!files || !files.length) return;
    var reader = Loader.fileListReader(files);
    S.patchSettings({ configured: true, folderName: reader.root, fallback: true });
    loadWithReader(reader, null);
  }

  async function onClearConfig() {
    try { await S.clearDirHandle(); } catch (e) {}
    S.clearSettings();
    reconnectHandle = null;
    UI.applyTheme(C.theme);
    UI.showOnboarding({
      title: "Đã xoá cấu hình",
      desc: "Chọn lại thư mục dữ liệu để tiếp tục.",
      button: L.chooseFolder,
    });
  }

  /* ---------- khởi động ---------- */
  async function boot() {
    var settings = S.loadSettings();
    UI.applyTheme(settings.theme || C.theme);
    UI.init({
      onChooseFolder: onChooseFolder,
      onChangeFolder: onChangeFolder,
      onClearConfig: onClearConfig,
      onFolderInput: onFolderInput,
    });

    // thử tự nạp lại thư mục đã chọn
    if (hasFSA && C.autoReconnect) {
      var handle = null;
      try { handle = await S.getDirHandle(); } catch (e) {}
      if (handle) {
        if (await ensurePerm(handle, false)) {
          return loadWithReader(Loader.handleReader(handle), handle);
        }
        // còn nhớ thư mục nhưng cần bấm để cấp lại quyền
        reconnectHandle = handle;
        return UI.showOnboarding({
          title: "Kết nối lại thư mục",
          desc: "Lần trước bạn đã chọn <b>" + escapeHtml(handle.name) + "</b>. " +
            "Trình duyệt cần bạn xác nhận lại quyền đọc thư mục này.",
          button: L.reconnect,
        });
      }
    }

    // lần đầu / chưa cấu hình
    UI.showOnboarding({
      error: hasFSA ? "" :
        "Trình duyệt này không hỗ trợ ghi nhớ thư mục (File System Access API). " +
        "Bạn vẫn xem được nhưng sẽ phải chọn lại thư mục mỗi lần mở — khuyến nghị dùng Chrome hoặc Edge.",
      button: L.chooseFolder,
    });
  }

  function escapeHtml(s) { return window.Markdown.escapeHtml(s); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
