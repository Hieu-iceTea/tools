/*
 * ui.js — Dựng giao diện & tương tác
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 */
(function () {
  "use strict";
  var C = window.APP_CONFIG, MD = window.Markdown, S = window.Storage;
  var L = C.labels;

  var el = {};
  var data = { conversations: [], projects: [], users: [], root: "" };
  var state = { tab: "conv", filter: "", activeType: null, activeId: null };
  var handlers = {}; // callback ra app.js: onChooseFolder, onChangeFolder, onClearConfig

  function $(id) { return document.getElementById(id); }
  function fmtDate(s) {
    if (!s) return "";
    try {
      var d = new Date(s);
      if (isNaN(d)) return String(s).slice(0, 10);
      return d.toLocaleString(C.dateLocale, { timeZone: C.timeZone, dateStyle: "medium", timeStyle: "short" });
    } catch (e) { return String(s).slice(0, 10); }
  }
  function esc(s) { return MD.escapeHtml(s); }

  /* ---------- màn hình loading ---------- */
  var loadTimer = null, loadStart = 0, lastFrac = 0;
  var ETA_AFTER_MS = 3000; // chỉ hiện thời gian/ước lượng khi tải lâu hơn 3 giây

  function showLoading(msg) {
    hideAll(); el.loading.hidden = false;
    lastFrac = 0; loadStart = Date.now();
    if (el.loadExtra) el.loadExtra.hidden = true;
    if (el.loadBar) { // trở lại thanh chạy vô định
      el.loadBar.classList.remove("determinate");
      el.loadBar.style.width = ""; el.loadBar.style.marginLeft = "";
    }
    setLoading(msg || "Đang tải…");
    if (loadTimer) clearInterval(loadTimer);
    loadTimer = setInterval(tickLoading, 250);
  }

  function tickLoading() {
    var e = Date.now() - loadStart;
    if (e < ETA_AFTER_MS) return;          // chưa quá 3s thì chưa hiện
    if (el.loadExtra) el.loadExtra.hidden = false;
    if (el.loadElapsed) el.loadElapsed.textContent = "Đã " + Math.floor(e / 1000) + " giây";
    if (el.loadEta) {
      if (lastFrac > 0.02 && lastFrac < 1) {
        var remain = Math.max(0, e / lastFrac - e);
        el.loadEta.textContent = "· Còn khoảng ~" + Math.ceil(remain / 1000) + " giây";
      } else {
        el.loadEta.textContent = "";
      }
    }
  }

  function stopLoadingTimer() { if (loadTimer) { clearInterval(loadTimer); loadTimer = null; } }

  // msg: chuỗi trạng thái; frac (tuỳ chọn 0..1): nếu có → thanh tiến độ xác định
  function setLoading(msg, frac) {
    if (el.loadStatus && msg != null) el.loadStatus.textContent = msg;
    if (typeof frac === "number" && el.loadBar) {
      lastFrac = frac;
      el.loadBar.classList.add("determinate");
      el.loadBar.style.width = Math.max(3, Math.round(frac * 100)) + "%";
      tickLoading(); // cập nhật ngay nếu đã quá 3s
    }
  }

  /* ---------- onboarding / reconnect ---------- */
  function showOnboarding(opts) {
    hideAll(); el.onboarding.hidden = false;
    opts = opts || {};
    el.obTitle.textContent = opts.title || ("Chào mừng đến " + C.appName);
    el.obDesc.innerHTML = opts.desc ||
      ("Ứng dụng đọc trực tiếp thư mục dữ liệu bạn đã <b>giải nén từ file export</b> của claude.ai. " +
       "Hãy chọn thư mục đó để bắt đầu.");
    el.btnChoose.textContent = opts.button || L.chooseFolder;
    el.obError.hidden = !opts.error;
    el.obError.textContent = opts.error || "";
  }

  /* ---------- đồng bộ URL (?c=<uuid hội thoại> / ?p=<uuid dự án>) ---------- */
  // Ghi mã mục đang xem lên URL bằng replaceState → KHÔNG thêm lịch sử duyệt web.
  function syncUrl(type, id) {
    try {
      var u = new URL(window.location.href);
      u.searchParams.delete("c"); u.searchParams.delete("p");
      if (type && id) u.searchParams.set(type === "conv" ? "c" : "p", id);
      history.replaceState(null, "", u.toString());
    } catch (e) {}
  }

  // Toast thông báo nhẹ (tự ẩn sau vài giây)
  var toastTimer = null;
  function showToast(msg) {
    var t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.innerHTML = '<span class="toast-ico">' + window.Icons.alert + '</span><span class="toast-msg"></span>';
      document.body.appendChild(t);
    }
    t.querySelector(".toast-msg").textContent = msg;
    t.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 6000);
  }

  // Đọc URL khi mở app → tự mở đúng hội thoại/dự án (phục vụ reload & chia sẻ link).
  // Param lỗi / không tìm thấy → báo thân thiện, XOÁ param khỏi URL, không chọn mục nào.
  function openFromUrl() {
    var c = null, p = null;
    try {
      var u = new URL(window.location.href);
      c = u.searchParams.get("c"); p = u.searchParams.get("p");
    } catch (e) { return; }
    if (!c && !p) return;
    if (c) {
      var conv = data.conversations.filter(function (x) { return x.uuid === c; })[0];
      if (conv) {
        state.tab = "conv"; state.activeType = "conv"; state.activeId = c;
        renderTabs(); renderList(); renderConversation(conv);
        return;
      }
    }
    if (p) {
      var proj = data.projects.filter(function (x) { return x.uuid === p; })[0];
      if (proj) {
        state.tab = "proj"; state.activeType = "proj"; state.activeId = p;
        renderTabs(); renderList(); renderProject(proj);
        return;
      }
    }
    // Có param nhưng không khớp mục nào trong bộ dữ liệu hiện tại
    syncUrl(null, null); // xoá ?c= / ?p= khỏi URL (không thêm lịch sử)
    showToast("Không tìm thấy " + (c ? "hội thoại" : "dự án") +
      " theo liên kết — có thể liên kết cũ hoặc thuộc bộ dữ liệu khác.");
  }

  /* ---------- app ---------- */
  // Chữ ký cuối sidebar: trễ C.creditDelaySec giây sau khi app hiện mới trượt lên
  // (1 lần duy nhất); cấu hình 0 = hiện cố định ngay, không hiệu ứng.
  var creditTimerDone = false;
  function scheduleCredit() {
    if (creditTimerDone) return;
    creditTimerDone = true;
    var sec = C.creditDelaySec;
    if (typeof sec !== "number" || !isFinite(sec) || sec < 0) sec = 3;
    function show() {
      var foot = document.querySelector("#app .side-foot");
      if (!foot) return;
      if (!sec) foot.classList.add("credit-now"); // tắt hoạt ảnh → hiện cố định
      foot.classList.add("credit-in");
    }
    if (sec) setTimeout(show, sec * 1000); else show();
  }
  function showApp() {
    hideAll(); el.app.hidden = false;
    renderList();
    scheduleCredit();
    openFromUrl();
  }
  function hideAll() {
    stopLoadingTimer();
    el.loading.hidden = true; el.onboarding.hidden = true; el.app.hidden = true;
    if (el.settings) el.settings.hidden = true;
  }

  function setData(d) {
    data = d;
    if (el.rootName) {
      el.rootName.innerHTML = window.Icons.folder + "<span>" + esc(d.root || "(thư mục)") + "</span>";
      el.rootName.title = (d.root || "") + (d.size ? "  —  " + formatBytes(d.size.bytes) : "");
    }
    renderTabs(); renderList();
  }

  /* ---------- tabs ---------- */
  function renderTabs() {
    el.tabConv.textContent = L.tabConversations + " (" + data.conversations.length + ")";
    el.tabProj.textContent = L.tabProjects + " (" + data.projects.length + ")";
    el.tabConv.classList.toggle("active", state.tab === "conv");
    el.tabProj.classList.toggle("active", state.tab === "proj");
    el.tabProj.hidden = data.projects.length === 0;
  }

  /* ---------- danh sách ---------- */
  function convMatches(c, f) {
    if (!f) return true;
    if ((c.name || "").toLowerCase().indexOf(f) >= 0) return true;
    return c.messages.some(function (m) { return (m.plain || "").indexOf(f) >= 0; });
  }
  function projMatches(p, f) {
    if (!f) return true;
    if ((p.name || "").toLowerCase().indexOf(f) >= 0) return true;
    if ((p.description || "").toLowerCase().indexOf(f) >= 0) return true;
    return (p.docs || []).some(function (d) {
      return ((d.filename || "") + " " + (d.content || "")).toLowerCase().indexOf(f) >= 0;
    });
  }

  function renderList() {
    var f = state.filter;
    el.list.innerHTML = "";
    var items = [];
    if (state.tab === "conv") {
      data.conversations.forEach(function (c, i) {
        if (!convMatches(c, f)) return;
        items.push({ id: c.uuid || ("c" + i), title: c.name, meta: fmtDate(c.updated) + " · " + c.messages.length + " tin nhắn", obj: c, type: "conv" });
      });
    } else {
      data.projects.forEach(function (p, i) {
        if (!projMatches(p, f)) return;
        items.push({ id: p.uuid || ("p" + i), title: p.name || "(Dự án)", meta: fmtDate(p.updated_at) + " · " + ((p.docs || []).length) + " tài liệu", obj: p, type: "proj" });
      });
    }
    if (!items.length) {
      var d = document.createElement("div");
      d.className = "list-empty";
      d.textContent = f ? "Không có kết quả khớp." : "Trống.";
      el.list.appendChild(d);
      return;
    }
    items.forEach(function (it) {
      var d = document.createElement("div");
      d.className = "item" + (state.activeType === it.type && state.activeId === it.id ? " active" : "");
      d.innerHTML = '<div class="t"></div><div class="m"></div>';
      d.querySelector(".t").textContent = it.title;
      d.querySelector(".m").textContent = it.meta;
      d.onclick = function () {
        state.activeType = it.type; state.activeId = it.id;
        syncUrl(it.type, it.id); // cập nhật ?c=/?p= trên URL (không thêm lịch sử)
        renderList();
        if (it.type === "conv") renderConversation(it.obj);
        else renderProject(it.obj);
      };
      el.list.appendChild(d);
    });
  }

  /* ---------- trạng thái thu gọn thẻ (giữ qua re-render) + tự mở khi tìm kiếm ---------- */
  var cardOpenByKey = {}; // "conv:<uuid>" / "proj:<uuid>" → danh sách chỉ số thẻ đang mở
  var skipNextCapture = false; // đặt khi vừa XOÁ tìm kiếm: đừng chụp DOM đang bị auto-mở

  function setCardOpen(card, open) {
    card.classList.toggle("open", open);
    var h = card.querySelector(".card-head");
    if (h) h.setAttribute("aria-expanded", open ? "true" : "false");
  }
  // Chụp lại thẻ nào đang mở của view hiện tại (gọi TRƯỚC khi xoá DOM để render view mới).
  // Chỉ chụp khi KHÔNG có từ khoá tìm kiếm → trạng thái auto-mở tạm thời không ghi đè baseline.
  function captureCardState() {
    var skip = skipNextCapture; skipNextCapture = false;
    if (skip) return;               // vừa xoá tìm kiếm: DOM còn dính auto-mở, bỏ qua lần chụp này
    if (state.filter) return;       // đang tìm kiếm: trạng thái hiển thị chỉ là tạm
    var key = el.main.getAttribute("data-view-key");
    if (!key) return;
    var arr = [];
    var cards = el.main.querySelectorAll(".card");
    Array.prototype.forEach.call(cards, function (card, i) {
      if (card.classList.contains("open")) arr.push(i);
    });
    cardOpenByKey[key] = arr;
  }
  // Khôi phục trạng thái đã lưu cho view (nếu từng render trước đó)
  function restoreCardState(key) {
    var saved = cardOpenByKey[key];
    if (!saved) return;
    var cards = el.main.querySelectorAll(".card");
    Array.prototype.forEach.call(cards, function (card, i) {
      setCardOpen(card, saved.indexOf(i) >= 0);
    });
  }
  // Nút "Suy luận"/"Nguồn & công cụ" sáng ⇔ TẤT CẢ thẻ nhóm đó đang mở (trung thực với thực tế)
  function updateConvToolButtons() {
    function allOpen(sel) {
      var cs = el.main.querySelectorAll(sel);
      if (!cs.length) return false;
      return Array.prototype.every.call(cs, function (x) { return x.classList.contains("open"); });
    }
    var bT = document.getElementById("tglThink");
    var bO = document.getElementById("tglTool");
    if (bT) bT.classList.toggle("active", allOpen(".card.meta.thinking"));
    if (bO) bO.classList.toggle("active", allOpen(".card.meta.websearch,.card.meta.tool"));
  }

  // Đang có từ khoá tìm kiếm → tự mở các thẻ chứa kết quả khớp (mark) để không bị "tô vàng vô hình"
  function autoOpenMatches() {
    if (!state.filter) return;
    var cards = el.main.querySelectorAll(".card");
    Array.prototype.forEach.call(cards, function (card) {
      var body = card.querySelector(".card-body");
      if (body && body.querySelector("mark")) setCardOpen(card, true);
    });
  }

  /* ---------- nội dung chính ---------- */
  function renderConversation(c) {
    captureCardState(); // lưu trạng thái thẻ của view cũ trước khi xoá
    el.main.innerHTML = "";
    el.main.setAttribute("data-view-key", "conv:" + (c.uuid || ""));
    var tCount = 0, toolCount = 0;
    c.messages.forEach(function (m) {
      var mc = window.Blocks.metaCounts(m.blocks);
      tCount += mc.thinking; toolCount += mc.tools;
    });
    var head = document.createElement("div");
    head.id = "head";
    head.innerHTML = "<div class='head-row'><h2></h2>" +
      '<button id="btnExport" class="chiptog export-btn" title="Xuất hội thoại này ra file Markdown">' +
      window.Icons.download + " Xuất .md</button></div>" +
      "<div class='m'></div><div class='conv-tools'>" +
      (tCount ? '<button id="tglThink" class="chiptog">' + window.Icons.think + ' Suy luận (' + tCount + ")</button>" : "") +
      (toolCount ? '<button id="tglTool" class="chiptog">' + window.Icons.search + ' Nguồn & công cụ (' + toolCount + ")</button>" : "") +
      "</div>";
    el.main.appendChild(head);
    head.querySelector("h2").textContent = c.name;
    var bE = document.getElementById("btnExport");
    if (bE) bE.onclick = function () { openExportModal(c, "conv"); };
    head.querySelector(".m").textContent =
      fmtDate(c.created) + " → " + fmtDate(c.updated) + " · " + c.messages.length + " tin nhắn · " + c.uuid;

    var wrap = document.createElement("div");
    wrap.className = "wrap";
    el.main.appendChild(wrap);
    c.messages.forEach(function (m) {
      var human = m.sender === "human";
      var div = document.createElement("div");
      div.className = "msg " + (human ? "human" : "claude");
      var who = document.createElement("div");
      who.className = "who";
      who.innerHTML = (human ? window.Icons.user : window.Icons.spark) + "<span>" + esc(human ? L.you : L.assistant) + "</span>";
      div.appendChild(who);
      div.appendChild(window.Blocks.renderMessage(m.blocks));
      if (m.ts) {
        var ts = document.createElement("div");
        ts.className = "ts"; ts.textContent = fmtDate(m.ts);
        div.appendChild(ts);
      }
      wrap.appendChild(div);
    });

    function toggleAll(sel) {
      var cs = wrap.querySelectorAll(sel);
      var anyClosed = Array.prototype.some.call(cs, function (x) { return !x.classList.contains("open"); });
      Array.prototype.forEach.call(cs, function (x) { setCardOpen(x, anyClosed); });
      updateConvToolButtons();
    }
    var bT = document.getElementById("tglThink");
    if (bT) bT.onclick = function () { toggleAll(".card.meta.thinking"); };
    var bO = document.getElementById("tglTool");
    if (bO) bO.onclick = function () { toggleAll(".card.meta.websearch,.card.meta.tool"); };
    // Bấm/gõ phím mở-đóng TỪNG thẻ cũng cập nhật trạng thái sáng của 2 nút
    wrap.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest(".card-head")) setTimeout(updateConvToolButtons, 0);
    });
    wrap.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " " || e.key === "Spacebar") &&
          e.target && e.target.closest && e.target.closest(".card-head")) setTimeout(updateConvToolButtons, 0);
    });

    // Dữ liệu gốc đầy đủ của hội thoại (mọi trường kỹ thuật) — bảo chứng 100%
    if (c.raw) wrap.appendChild(window.Blocks.rawJsonCard(c.raw, "Dữ liệu gốc của hội thoại (JSON đầy đủ)"));

    MD.highlight(wrap, state.filter);
    restoreCardState("conv:" + (c.uuid || "")); // giữ mở/đóng như người dùng đã chỉnh
    autoOpenMatches();                           // thẻ chứa kết quả tìm kiếm → tự mở
    updateConvToolButtons();                     // 2 nút sáng đúng thực tế
    MD.enhanceCopy(wrap);
    el.main.scrollTop = 0;
  }

  function renderProject(p) {
    captureCardState();
    var h = '<div id="head"><div class="head-row"><h2></h2>' +
      '<button id="btnExportProj" class="chiptog export-btn" title="Xuất dự án này ra file Markdown">' +
      window.Icons.download + ' Xuất .md</button></div><div class="m"></div></div><div class="wrap"></div>';
    el.main.innerHTML = h;
    el.main.querySelector("h2").textContent = p.name || "(Dự án)";
    var bEP = document.getElementById("btnExportProj");
    if (bEP) bEP.onclick = function () { openExportModal(p, "proj"); };
    el.main.querySelector("#head .m").textContent =
      fmtDate(p.created_at) + " → " + fmtDate(p.updated_at) + " · " + ((p.docs || []).length) + " tài liệu · " + (p.uuid || "");
    var wrap = el.main.querySelector(".wrap");

    // Bảng thông tin dự án (đủ mọi trường có dữ liệu)
    var info = [];
    info.push(["Người tạo", (p.creator && p.creator.full_name) || "—"]);
    info.push(["Dự án mẫu", p.is_starter_project ? "Có" : "Không"]);
    info.push(["Riêng tư", p.is_private ? "Có" : "Không"]);
    if (p.prompt_template) info.push(["Prompt mẫu", p.prompt_template]);
    var meta = document.createElement("div");
    meta.className = "msg claude proj-info";
    var rows = info.map(function (kv) {
      return '<div class="pi-row"><span class="pi-k">' + esc(kv[0]) + '</span><span class="pi-v">' + esc(kv[1]) + "</span></div>";
    }).join("");
    meta.innerHTML = '<div class="who">' + window.Icons.info + '<span>Thông tin dự án</span></div>' + rows;
    wrap.appendChild(meta);

    if (p.description) {
      var desc = document.createElement("div");
      desc.className = "msg claude";
      desc.innerHTML = '<div class="who">' + window.Icons.text + '<span>Mô tả</span></div><div class="body">' + MD.toHtml(p.description) + "</div>";
      wrap.appendChild(desc);
    }
    (p.docs || []).forEach(function (doc) {
      var div = document.createElement("div");
      div.className = "msg claude";
      var sub = doc.created_at ? ' <span class="ts-inline">· ' + esc(fmtDate(doc.created_at)) + "</span>" : "";
      div.innerHTML = '<div class="who">' + window.Icons.doc + '<span>' + esc(doc.filename || "tài liệu") + "</span>" + sub + "</div>" +
        '<div class="body">' + MD.toHtml(doc.content || "") + "</div>";
      wrap.appendChild(div);
    });

    // Dữ liệu gốc đầy đủ của dự án
    wrap.appendChild(window.Blocks.rawJsonCard(p, "Dữ liệu gốc của dự án (JSON đầy đủ)"));

    el.main.setAttribute("data-view-key", "proj:" + (p.uuid || ""));
    MD.highlight(wrap, state.filter);
    restoreCardState("proj:" + (p.uuid || ""));
    autoOpenMatches();
    MD.enhanceCopy(wrap);
    el.main.scrollTop = 0;
  }

  /* ---------- tìm kiếm (dùng chung cho gõ phím & nút xoá) ---------- */
  function applySearch(raw) {
    var next = (raw || "").trim().toLowerCase();
    // Bắt đầu gõ (trống → có chữ): chụp BASELINE ngay lúc DOM chưa bị auto-mở
    if (!state.filter && next) captureCardState();
    // Xoá hết từ khoá: lần render tới sẽ khôi phục baseline, đừng chụp DOM đang auto-mở
    if (state.filter && !next) skipNextCapture = true;
    state.filter = next;
    if (el.qClear) el.qClear.hidden = !(el.q && el.q.value); // nút "x" chỉ hiện khi ô có chữ
    renderList();
    // render lại mục đang mở để cập nhật tô vàng
    if (state.activeType === "conv") {
      var c = data.conversations.filter(function (x) { return (x.uuid || "") === state.activeId; })[0];
      if (c) renderConversation(c);
    } else if (state.activeType === "proj") {
      var p = data.projects.filter(function (x) { return (x.uuid || "") === state.activeId; })[0];
      if (p) renderProject(p);
    }
  }

  /* ---------- modal dùng chung ---------- */
  function openModal(m) { if (m) m.hidden = false; }
  function closeModal(m) { if (m) m.hidden = true; }

  /* ---------- xuất Markdown ---------- */
  var exportConv = null;   // mục đang mở modal xuất (hội thoại / dự án / tài khoản)
  var exportKind = "conv"; // "conv" | "proj" | "users"
  var exportOpts = null;   // lựa chọn checkbox (giữ trong phiên làm việc)
  var covTimer = null;

  function initExportOpts() {
    if (exportOpts) return;
    exportOpts = {};
    (C.exportOptions || []).forEach(function (op) { exportOpts[op.key] = !!op.def; });
    exportOpts.incProj = true;   // chế độ "tất cả": kèm dự án (mặc định bật)
    exportOpts.incUsers = true;  // chế độ "tất cả": kèm tài khoản (mặc định bật)
  }

  // 2 tuỳ chọn riêng của chế độ "xuất tất cả"
  var ALL_EXTRAS = [
    { key: "incProj",  label: "Kèm dự án",     desc: "Thư mục projects/ — mỗi dự án 1 file .md" },
    { key: "incUsers", label: "Kèm tài khoản", desc: "File account.md ở gốc gói zip" },
  ];

  function defaultZipName() {
    var d = new Date();
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    // Mã batch nguồn để phân biệt nhiều bản export: 8-hex đầu trong tên thư mục dữ liệu
    // (data-de04bde3-… → "de04bde3"); thư mục do người dùng tự đặt tên → slug gọn.
    var token = "";
    var root = (data && data.root) || "";
    var m = root.match(/[0-9a-f]{8}/i);
    if (m) token = m[0].toLowerCase();
    else if (root) token = (window.Exporter._slugify(root) || "").slice(0, 24).replace(/-+$/, "");
    return "claude-chat-export_" + (token ? token + "_" : "") +
      d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) +
      "_" + p2(d.getHours()) + p2(d.getMinutes()) + ".zip";
  }

  // Đếm số khối từng loại (hiện cạnh nhãn checkbox; 0 → khoá mục đó)
  function exportCounts(kind, item) {
    if (kind === "all") { // cộng dồn trên TOÀN BỘ hội thoại
      var agg = { aiHeader: 1, text: 0, artifacts: 0, ask: 0, thinking: 0, websearch: 0, tools: 0, meta: 0, rawJson: 1 };
      data.conversations.forEach(function (cv) {
        var n = exportCounts("conv", cv);
        ["text", "artifacts", "ask", "thinking", "websearch", "tools", "meta"].forEach(function (k) { agg[k] += n[k]; });
      });
      agg.incProj = data.projects.length;
      agg.incUsers = (data.users && data.users.length) ? 1 : 0;
      return agg;
    }
    if (kind === "proj") {
      return { aiHeader: 1, text: (item.description ? 1 : 0) + ((item.docs || []).length) + (item.prompt_template ? 1 : 0),
               artifacts: 0, ask: 0, thinking: 0, websearch: 0, tools: 0, meta: 1, rawJson: 1 };
    }
    if (kind === "users") {
      return { aiHeader: 0, text: (item || []).length, artifacts: 0, ask: 0, thinking: 0, websearch: 0, tools: 0, meta: 1, rawJson: 1 };
    }
    var conv = item;
    var n = { aiHeader: 1, text: 0, artifacts: 0, ask: 0, thinking: 0, websearch: 0, tools: 0, meta: conv.messages.length, rawJson: 1 };
    conv.messages.forEach(function (m) {
      (m.blocks || []).forEach(function (b) {
        if (!b) return;
        if (b.type === "text" && (b.text || "").trim()) n.text++;
        else if (b.type === "thinking") n.thinking++;
        else if (b.type === "tool_use") {
          if (b.name === "web_search") n.websearch++;
          else if (b.name === "artifacts") n.artifacts++;
          else if (b.name === "ask_user_input_v0") n.ask++;
          else n.tools++;
        }
      });
    });
    return n;
  }

  function updateCoverage() {
    if (!exportConv && exportKind !== "all") return;
    // debounce nhẹ: hội thoại lớn tính % mất vài chục ms
    if (covTimer) clearTimeout(covTimer);
    covTimer = setTimeout(function () {
      var pct;
      if (exportKind === "all") {
        var list = data.conversations.map(function (cv) { return { kind: "conv", item: cv }; });
        if (exportOpts.incProj) data.projects.forEach(function (pj) { list.push({ kind: "proj", item: pj }); });
        if (exportOpts.incUsers && data.users && data.users.length) list.push({ kind: "users", item: data.users });
        pct = window.Exporter.coverageMany(list, exportOpts);
      } else {
        pct = window.Exporter.coverage(exportKind, exportConv, exportOpts);
      }
      el.exCoverage.textContent = "Độ phủ dữ liệu: " + pct + "%" + (pct === 100 ? " — đầy đủ, không mất gì" : "");
      el.exCovFill.style.width = pct + "%";
    }, 120);
  }

  function renderExportOptions() {
    var counts = exportCounts(exportKind, exportConv);
    el.exOptions.innerHTML = "";
    function addRow(op) {
      var count = counts[op.key];
      var noData = (count === 0);
      var row = document.createElement("label");
      row.className = "opt-row" + (noData ? " disabled" : "");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !noData && !!exportOpts[op.key];
      cb.disabled = noData;
      cb.onchange = function () { exportOpts[op.key] = cb.checked; updateCoverage(); };
      row.appendChild(cb);
      var body = document.createElement("span");
      body.className = "opt-body";
      var showCount = (op.key !== "aiHeader" && op.key !== "rawJson" && op.key !== "meta" && op.key !== "incUsers");
      body.innerHTML = '<span class="opt-l"></span><span class="opt-d"></span>';
      body.querySelector(".opt-l").textContent = op.label + (showCount ? " (" + count + ")" : "");
      body.querySelector(".opt-d").textContent = op.desc || "";
      row.appendChild(body);
      el.exOptions.appendChild(row);
    }
    (C.exportOptions || []).forEach(addRow);
    if (exportKind === "all") ALL_EXTRAS.forEach(addRow); // 2 tick riêng của chế độ tất cả
  }

  function openExportModal(conv, kind) {
    initExportOpts();
    exportConv = conv;
    exportKind = kind || "conv";
    var titles = { conv: "Xuất hội thoại ra Markdown", proj: "Xuất dự án ra Markdown",
                   users: "Xuất tài khoản ra Markdown", all: "Xuất tất cả ra Markdown (.zip)" };
    if (el.exTitle) el.exTitle.textContent = titles[exportKind] || titles.conv;
    if (el.exDownload) el.exDownload.textContent = (exportKind === "all") ? "Tải file .zip" : "Tải file .md";
    renderExportOptions();
    el.exFilename.value = (exportKind === "all")
      ? defaultZipName()
      : window.Exporter.suggestFilename(exportKind, conv);
    updateCoverage();
    openModal(el.exportModal);
  }

  function applyExportPreset(map) {
    (C.exportOptions || []).forEach(function (op) {
      exportOpts[op.key] = !!map[op.key];
    });
    renderExportOptions();
    updateCoverage();
  }

  function doExport() {
    if (exportKind === "all") { doExportAll(); return; }
    if (!exportConv) return;
    var btn = el.exDownload, old = btn.textContent;
    btn.disabled = true; btn.textContent = "Đang xuất…";
    setTimeout(function () { // nhả frame cho UI cập nhật trạng thái nút
      try {
        var md = window.Exporter.build(exportKind, exportConv, exportOpts);
        var fn = (el.exFilename.value || "").trim() || window.Exporter.suggestFilename(exportKind, exportConv);
        if (!/\.md$/i.test(fn)) fn += ".md";
        window.Exporter.download(fn, md);
        var pct = window.Exporter.coverage(exportKind, exportConv, exportOpts);
        showToast("Đã xuất " + fn + " (" + pct + "% dữ liệu)");
        closeModal(el.exportModal);
      } catch (e) {
        showToast("Xuất thất bại: " + (e && e.message ? e.message : e));
      }
      btn.disabled = false; btn.textContent = old;
    }, 30);
  }

  // Xuất TẤT CẢ: build từng .md → INDEX.md → nén zip → tải về (có tiến độ trên nút)
  function doExportAll() {
    var btn = el.exDownload, old = btn.textContent;
    btn.disabled = true;
    (async function () {
      try {
        var files = [], indexRows = [], projRows = [], accountFile = null;
        var convs = data.conversations;
        for (var i = 0; i < convs.length; i++) {
          btn.textContent = "Đang xuất " + (i + 1) + "/" + convs.length + "…";
          await new Promise(function (r) { setTimeout(r, 0); }); // nhả frame cho UI cập nhật
          var cv = convs[i];
          // cấu trúc thư mục TIẾNG ANH theo 2 tab: conversations/ & projects/
          var fn = "conversations/" + window.Exporter.suggestFilename("conv", cv);
          files.push({ name: fn, data: window.Exporter.build("conv", cv, exportOpts) });
          indexRows.push({ name: cv.name, file: fn, updated: cv.updated, count: cv.messages.length });
        }
        if (exportOpts.incProj) data.projects.forEach(function (pj) {
          var fnP = "projects/" + window.Exporter.suggestFilename("proj", pj);
          files.push({ name: fnP, data: window.Exporter.build("proj", pj, exportOpts) });
          projRows.push({ name: pj.name || "(Dự án)", file: fnP, updated: pj.updated_at, docs: (pj.docs || []).length });
        });
        if (exportOpts.incUsers && data.users && data.users.length) {
          accountFile = window.Exporter.suggestFilename("users", data.users);
          files.push({ name: accountFile, data: window.Exporter.build("users", data.users, exportOpts) });
        }
        files.unshift({ name: "INDEX.md", data: window.Exporter.buildIndex(indexRows, projRows, accountFile) });
        btn.textContent = "Đang nén…";
        await new Promise(function (r) { setTimeout(r, 0); });
        var blob = await window.Zip.build(files);
        var fnZip = (el.exFilename.value || "").trim() || defaultZipName();
        if (!/\.zip$/i.test(fnZip)) fnZip += ".zip";
        window.Exporter.download(fnZip, blob);
        showToast("Đã xuất " + files.length + " file vào " + fnZip);
        closeModal(el.exportModal);
      } catch (e) {
        showToast("Xuất thất bại: " + (e && e.message ? e.message : e));
      }
      btn.disabled = false; btn.textContent = old;
    })();
  }

  /* ---------- cài đặt ---------- */
  function formatBytes(n) {
    if (n == null) return "—";
    if (n < 1024) return n + " B";
    var kb = n / 1024;
    if (kb < 1024) return kb.toFixed(1) + " KB";
    var mb = kb / 1024;
    if (mb < 1024) return mb.toFixed(2) + " MB";
    return (mb / 1024).toFixed(2) + " GB";
  }

  function openSettings() {
    el.setRoot.textContent = data.root || "—";
    if (el.setSize) {
      el.setSize.textContent = data.size
        ? formatBytes(data.size.bytes) + "  ·  " + data.size.files + " tệp  (đo chính xác)"
        : "Không đo được trên trình duyệt này";
    }
    var u = (data.users && data.users[0]) || {};
    el.setAccount.textContent = (u.full_name || "—") + (u.email_address ? "  ·  " + u.email_address : "");
    if (el.setPhone) el.setPhone.textContent = u.verified_phone_number || "—";
    el.setCounts.textContent = data.conversations.length + " hội thoại · " + data.projects.length + " dự án";
    if (el.setRawWrap) {
      el.setRawWrap.innerHTML = "";
      el.setRawWrap.appendChild(window.Blocks.rawJsonCard(data.users, "Dữ liệu gốc tài khoản (users.json)"));
      MD.enhanceCopy(el.setRawWrap);
    }
    openModal(el.settings);
  }
  function closeSettings() { closeModal(el.settings); }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
    if (el.themeToggle) el.themeToggle.checked = theme === "dark";
  }

  /* ---------- khởi tạo ---------- */
  function init(cbs) {
    handlers = cbs || {};
    // gom refs
    ["loading", "loadStatus", "loadBar", "loadExtra", "loadElapsed", "loadEta",
     "onboarding", "obTitle", "obDesc", "obError", "btnChoose", "dirInput",
     "app", "side", "rootName", "tabConv", "tabProj", "q", "qClear", "list", "main",
     "btnSettings", "settings", "setRoot", "setSize", "setAccount", "setPhone", "setCounts", "setRawWrap",
     "exportModal", "exTitle", "exOptions", "exCoverage", "exCovFill", "exFilename",
     "exDownload", "exClose", "exPresetFull", "exPresetAI", "btnExportUsers", "btnExportAll",
     "btnChange", "btnClear", "btnCloseSettings", "themeToggle"].forEach(function (k) { el[k] = $(k); });

    // nhãn tĩnh
    $("brand").innerHTML = window.Icons.chat + "<span>" + esc(C.appName) + "</span>";
    el.q.placeholder = L.searchPlaceholder;
    el.btnChange.textContent = L.changeFolder;
    el.btnClear.textContent = L.clearConfig;

    // Bố cục hàng đầu sidebar theo config.headerRows (1 = gộp 1 hàng, 2 = hàng riêng)
    if (el.side) el.side.classList.add(C.headerRows === 2 ? "head2" : "head1");

    // Nút quay lại gallery "Tools" — trỏ theo config.toolsUrl; rỗng thì ẨN
    var toolsUrl = C.toolsUrl || "";
    var backlinks = document.querySelectorAll(".backlink");
    Array.prototype.forEach.call(backlinks, function (a) {
      var host = a.parentNode; // .backlink-bar / .ob-back
      if (!toolsUrl) { if (host) host.style.display = "none"; return; }
      a.href = toolsUrl;
      var base = a.querySelector(".bl-base");
      var extra = a.querySelector(".bl-extra");
      if (base) base.textContent = L.backTools || "Tools";
      if (extra) extra.textContent = " " + (L.backToolsExtra || "by Hiếu iceTea");
      a.title = (L.backTools || "Tools") + " " + (L.backToolsExtra || "by Hiếu iceTea");
    });

    // sự kiện
    el.tabConv.onclick = function () { state.tab = "conv"; renderTabs(); renderList(); };
    el.tabProj.onclick = function () { state.tab = "proj"; renderTabs(); renderList(); };
    el.q.oninput = function () { applySearch(el.q.value); };
    // Nút "x": xoá toàn bộ nội dung tìm kiếm, khôi phục baseline, trả focus về ô nhập
    if (el.qClear) el.qClear.onclick = function () {
      el.q.value = "";
      applySearch("");
      el.q.focus();
    };
    el.btnSettings.onclick = openSettings;
    el.btnCloseSettings.onclick = closeSettings;
    el.settings.onclick = function (e) { if (e.target === el.settings) closeSettings(); };
    if (el.btnExportAll) el.btnExportAll.onclick = function () { openExportModal(null, "all"); };
    if (el.btnExportUsers) el.btnExportUsers.onclick = function () {
      closeSettings();
      openExportModal(data.users, "users"); // xuất users.json → phủ đủ 3 file dữ liệu
    };

    // Modal xuất Markdown
    if (el.exportModal) {
      el.exClose.onclick = function () { closeModal(el.exportModal); };
      el.exportModal.onclick = function (e) { if (e.target === el.exportModal) closeModal(el.exportModal); };
      el.exDownload.onclick = doExport;
      el.exPresetFull.onclick = function () { // bật tất cả (gồm JSON gốc) → 100%
        var all = {};
        (C.exportOptions || []).forEach(function (op) { all[op.key] = true; });
        applyExportPreset(all);
      };
      el.exPresetAI.onclick = function () { // đủ ngữ cảnh cho AI, tiết kiệm dung lượng
        applyExportPreset({ aiHeader: true, text: true, artifacts: true, ask: true, thinking: true });
      };
    }
    // Esc → đóng modal đang mở
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeModal(el.settings); closeModal(el.exportModal); }
    });
    el.btnChange.onclick = function () { closeSettings(); if (handlers.onChangeFolder) handlers.onChangeFolder(); };
    el.btnClear.onclick = function () { if (handlers.onClearConfig) handlers.onClearConfig(); };
    el.btnChoose.onclick = function () { if (handlers.onChooseFolder) handlers.onChooseFolder(); };
    el.dirInput.onchange = function () { if (handlers.onFolderInput) handlers.onFolderInput(el.dirInput.files); };
    if (el.themeToggle) el.themeToggle.onchange = function () {
      var t = el.themeToggle.checked ? "dark" : "light";
      applyTheme(t); S.patchSettings({ theme: t });
    };
  }

  window.UI = {
    init: init, setData: setData, showApp: showApp, showLoading: showLoading,
    setLoading: setLoading, showOnboarding: showOnboarding, openSettings: openSettings,
    applyTheme: applyTheme,
    triggerFileInput: function () { el.dirInput.click(); },
    // Cửa phục vụ KIỂM THỬ TỰ ĐỘNG / debug console — không dùng trong luồng app
    _test: {
      setFilter: function (f) { state.filter = f || ""; },
      flagSkipCapture: function () { skipNextCapture = true; },
      capture: function () { captureCardState(); },
      restore: function (key) { restoreCardState(key); },
      autoOpen: function () { autoOpenMatches(); },
      updateButtons: function () { updateConvToolButtons(); },
      cardOpenByKey: cardOpenByKey,
      defaultZipName: function () { return defaultZipName(); },
    },
  };
})();
