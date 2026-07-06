/*
 * loader.js — Đọc & chuẩn hoá dữ liệu từ thư mục export (data-driven)
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 *
 * KHÔNG sao chép dữ liệu. Đọc trực tiếp thư mục người dùng chọn, giữ nguyên
 * cấu trúc gốc: conversations.json, users.json, projects/*.json.
 *
 * Hỗ trợ 2 nguồn qua một lớp "reader" chung:
 *   1) FileSystemDirectoryHandle (File System Access API) — nhớ được thư mục.
 *   2) FileList từ <input webkitdirectory> — bản dự phòng, không nhớ được.
 */
(function () {
  "use strict";
  var C = window.APP_CONFIG;

  /* ----- reader từ FileSystemDirectoryHandle ----- */
  function handleReader(dirHandle) {
    return {
      kind: "handle",
      root: dirHandle.name,
      async readText(path) {
        var parts = path.split("/");
        var h = dirHandle;
        for (var i = 0; i < parts.length - 1; i++) h = await h.getDirectoryHandle(parts[i]);
        var fh = await h.getFileHandle(parts[parts.length - 1]);
        var f = await fh.getFile();
        return f.text();
      },
      async listDir(path) {
        var h = dirHandle;
        if (path) { var ps = path.split("/"); for (var i = 0; i < ps.length; i++) h = await h.getDirectoryHandle(ps[i]); }
        var out = [];
        for await (var entry of h.values()) { if (entry.kind === "file") out.push(entry.name); }
        return out;
      },
      // Duyệt TOÀN BỘ cây thư mục, cộng chính xác kích thước mọi tệp → {bytes, files}
      async totalSize() {
        var bytes = 0, files = 0;
        async function walk(dir) {
          for await (var entry of dir.values()) {
            if (entry.kind === "file") {
              try { var f = await entry.getFile(); bytes += f.size; files++; } catch (e) {}
            } else if (entry.kind === "directory") { await walk(entry); }
          }
        }
        await walk(dirHandle);
        return { bytes: bytes, files: files };
      },
    };
  }

  /* ----- reader từ FileList (webkitdirectory) ----- */
  function fileListReader(fileList) {
    var map = {};
    var root = "";
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      var rel = f.webkitRelativePath || f.name;
      var idx = rel.indexOf("/");
      if (idx >= 0) { root = rel.slice(0, idx); map[rel.slice(idx + 1)] = f; }
      else { map[rel] = f; }
    }
    return {
      kind: "filelist",
      root: root,
      async readText(path) {
        var f = map[path];
        if (!f) throw new Error("Không tìm thấy: " + path);
        return f.text();
      },
      async listDir(path) {
        var pre = path ? path + "/" : "";
        var out = [];
        for (var k in map) {
          if (k.indexOf(pre) === 0) {
            var rest = k.slice(pre.length);
            if (rest && rest.indexOf("/") < 0) out.push(rest);
          }
        }
        return out;
      },
      async totalSize() {
        var bytes = 0, files = 0;
        for (var k in map) { bytes += (map[k].size || 0); files++; }
        return { bytes: bytes, files: files };
      },
    };
  }

  /* ----- chuỗi phẳng để TÌM KIẾM (gồm cả text, suy luận, truy vấn, artifact, câu hỏi) ----- */
  function messagePlain(blocks, fallback) {
    var s = [];
    (blocks || []).forEach(function (b) {
      if (!b || typeof b !== "object") return;
      if (b.type === "text" && b.text) s.push(b.text);
      else if (b.type === "thinking" && b.thinking) s.push(b.thinking);
      else if (b.type === "tool_use") {
        var inp = b.input || {};
        if (b.name === "web_search" && inp.query) s.push(inp.query);
        else if (b.name === "artifacts" && inp.content) s.push(inp.content);
        else if (b.name === "visualize:show_widget" && inp.title) s.push(inp.title);
        else if (b.name === "ask_user_input_v0" && Array.isArray(inp.questions)) {
          inp.questions.forEach(function (q) {
            if (q.question) s.push(q.question);
            (q.options || []).forEach(function (o) { s.push(o); });
          });
        }
      } else if (b.type === "tool_result" && Array.isArray(b.content)) {
        b.content.forEach(function (it) { if (it && it.title) s.push(it.title); });
      }
    });
    var txt = s.join("\n");
    if (!txt.trim() && fallback) txt = fallback;
    return txt.toLowerCase();
  }

  function yieldToUI() { return new Promise(function (r) { setTimeout(r, 0); }); }

  // Chuẩn hoá theo lô, thỉnh thoảng nhường luồng + báo tiến độ (để loading cập nhật khi dữ liệu lớn)
  async function normalizeConversations(raw, onFrac) {
    var arr = Array.isArray(raw) ? raw : [];
    arr = arr.slice().sort(function (a, b) {
      return (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || "");
    });
    var N = arr.length || 1;
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      var msgs = (c.chat_messages || []).map(function (m) {
        var blocks = (Array.isArray(m.content) && m.content.length)
          ? m.content
          : [{ type: "text", text: m.text || "" }];
        return {
          uuid: m.uuid || "",
          sender: m.sender,
          ts: m.created_at || "",
          blocks: blocks,
          plain: messagePlain(blocks, m.text || ""),
        };
      });
      out.push({
        uuid: c.uuid || "",
        name: c.name || "(Không tiêu đề)",
        created: c.created_at || "",
        updated: c.updated_at || "",
        summary: c.summary || "",
        account: (c.account && c.account.uuid) || "",
        messages: msgs,
        raw: c, // giữ NGUYÊN object gốc để hiển thị "Dữ liệu gốc (JSON)" — đảm bảo 100% trường
      });
      if ((i & 63) === 0) { if (onFrac) onFrac(i / N); await yieldToUI(); }
    }
    if (onFrac) onFrac(1);
    return out;
  }

  /* ----- hàm chính: nhận reader, trả về dữ liệu đã chuẩn hoá ----- */
  async function load(reader, onProgress) {
    var p = onProgress || function () {};

    p("Đang mở thư mục dữ liệu…", 0.04);
    var convText;
    try {
      convText = await reader.readText(C.files.conversations);
    } catch (e) {
      throw new Error("Không đọc được '" + C.files.conversations +
        "'. Hãy chắc bạn chọn đúng thư mục đã giải nén từ file export.");
    }

    p("Đang phân tích dữ liệu…", 0.12);
    await yieldToUI();
    var convRaw = JSON.parse(convText);

    var conversations = await normalizeConversations(convRaw, function (f) {
      p("Đang xử lý hội thoại… " + Math.round(f * 100) + "%", 0.15 + f * 0.7);
    });

    p("Đang đọc thông tin tài khoản…", 0.88);
    var users = [];
    try { users = JSON.parse(await reader.readText(C.files.users)) || []; } catch (e) {}

    p("Đang đọc các dự án…", 0.92);
    var projects = [];
    try {
      var names = await reader.listDir(C.files.projectsDir);
      for (var i = 0; i < names.length; i++) {
        if (!/\.json$/i.test(names[i])) continue;
        try {
          var d = JSON.parse(await reader.readText(C.files.projectsDir + "/" + names[i]));
          projects.push(d);
        } catch (e) {}
      }
      projects.sort(function (a, b) {
        return (b.updated_at || "").localeCompare(a.updated_at || "");
      });
    } catch (e) {}

    p("Đang tính dung lượng…", 0.97);
    var size = null;
    try { if (reader.totalSize) size = await reader.totalSize(); } catch (e) {}

    p("Hoàn tất", 1);
    return {
      root: reader.root,
      conversations: conversations,
      users: Array.isArray(users) ? users : [users],
      projects: projects,
      size: size, // { bytes, files } — đo chính xác từ file.size, hoặc null nếu không đo được
    };
  }

  window.Loader = {
    handleReader: handleReader,
    fileListReader: fileListReader,
    load: load,
    _messagePlain: messagePlain,
    _normalizeConversations: normalizeConversations,
  };
})();
