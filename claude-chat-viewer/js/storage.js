/*
 * storage.js — Lưu cấu hình & ghi nhớ thư mục dữ liệu
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 *
 * - Cấu hình người dùng (đã chọn thư mục chưa, tên thư mục, theme, mục xem gần nhất)
 *   → lưu trong localStorage (key: "ccv.settings").
 * - "Tay cầm" thư mục (FileSystemDirectoryHandle) KHÔNG thể để trong localStorage,
 *   nên được lưu trong IndexedDB. Đây là cách trình duyệt cho phép ghi nhớ quyền
 *   truy cập một thư mục local giữa các lần mở.
 */
(function () {
  "use strict";

  var LS_KEY = "ccv.settings";
  var DB_NAME = "claude-chat-viewer";
  var STORE = "handles";
  var HANDLE_KEY = "dataDir";

  /* ---------- localStorage: cấu hình ---------- */
  function loadSettings() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveSettings(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj || {})); } catch (e) {}
  }
  function patchSettings(patch) {
    var s = loadSettings();
    for (var k in patch) s[k] = patch[k];
    saveSettings(s);
    return s;
  }
  function clearSettings() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  /* ---------- IndexedDB: tay cầm thư mục ---------- */
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("no-indexeddb")); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbPut(key, val) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(val, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function idbGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var r = tx.objectStore(STORE).get(key);
        r.onsuccess = function () { resolve(r.result || null); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function idbDel(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function saveDirHandle(handle) { return idbPut(HANDLE_KEY, handle); }
  function getDirHandle() { return idbGet(HANDLE_KEY).catch(function () { return null; }); }
  function clearDirHandle() { return idbDel(HANDLE_KEY).catch(function () {}); }

  window.Storage = {
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    patchSettings: patchSettings,
    clearSettings: clearSettings,
    saveDirHandle: saveDirHandle,
    getDirHandle: getDirHandle,
    clearDirHandle: clearDirHandle,
  };
})();
