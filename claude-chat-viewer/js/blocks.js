/*
 * blocks.js — Render đầy đủ & chính xác mọi loại khối nội dung của 1 tin nhắn
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 *
 * Các loại khối (giữ NGUYÊN thứ tự gốc trong message.content):
 *   - thinking     : suy luận của Claude (thu gọn, mở rộng được)
 *   - text         : văn bản (Markdown) + trích dẫn nguồn (citations)
 *   - tool_use     : gọi công cụ
 *       • web_search           → truy vấn tìm kiếm
 *       • artifacts            → tài liệu do Claude tạo (markdown / html / svg)
 *       • visualize:show_widget→ widget HTML tương tác
 *       • ask_user_input_v0    → câu hỏi + các lựa chọn
 *       • (khác)               → hiện tên + input JSON
 *   - tool_result  : kết quả công cụ
 *       • web_search           → danh sách nguồn (favicon, tiêu đề, domain, trích đoạn)
 *       • (khác)               → nội dung/không đáng kể → xác nhận gọn
 *
 * tool_use và tool_result đi liền nhau (khớp id) → gộp thành 1 thẻ.
 * Xuất: window.Blocks.renderMessage(blocks) → DocumentFragment
 *       window.Blocks.metaCounts(blocks)     → { thinking, tools }
 */
(function () {
  "use strict";
  var MD = window.Markdown;

  function elt(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function esc(s) { return MD.escapeHtml(s == null ? "" : String(s)); }
  function prettyJSON(v) { try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); } }
  function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

  /* thẻ có thể thu gọn/mở rộng — hỗ trợ cả bàn phím (Tab + Enter/Space) */
  function collapsible(kindClass, icon, titleHTML, open) {
    var card = elt("div", "card " + kindClass + (open ? " open" : ""));
    var head = elt("div", "card-head");
    head.setAttribute("role", "button");
    head.setAttribute("tabindex", "0");
    head.setAttribute("aria-expanded", open ? "true" : "false");
    head.innerHTML = '<span class="chev">' + window.Icons.chevron + '</span><span class="card-ico">' + icon + "</span>" +
      '<span class="card-title">' + titleHTML + "</span>";
    var body = elt("div", "card-body");
    function toggle() {
      var isOpen = card.classList.toggle("open");
      head.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
    head.addEventListener("click", toggle);
    head.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); toggle(); }
    });
    card.appendChild(head); card.appendChild(body);
    return { card: card, body: body };
  }

  /* iframe cách ly cho artifact HTML/SVG & widget */
  function embedFrame(html, title) {
    var wrap = elt("div", "embed-wrap");
    var bar = elt("div", "embed-bar");
    bar.innerHTML = '<span>' + esc(title || "Nội dung nhúng") + "</span>";
    var openBtn = elt("button", "btn small ghost", "Mở trong tab mới");
    openBtn.addEventListener("click", function () {
      var w = window.open("", "_blank");
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    });
    bar.appendChild(openBtn);
    var f = document.createElement("iframe");
    f.className = "embed";
    // Dữ liệu của chính người dùng (kho lưu trữ cá nhân) → cho phép chạy script để hiện đúng widget.
    f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups");
    f.setAttribute("loading", "lazy");
    f.srcdoc = html;
    f.addEventListener("load", function () {
      try {
        var d = f.contentDocument;
        if (d && d.body) f.style.height = Math.min(1400, Math.max(120, d.body.scrollHeight + 24)) + "px";
      } catch (e) {}
    });
    wrap.appendChild(bar); wrap.appendChild(f);
    return wrap;
  }

  /* ---------- các khối ---------- */

  function renderThinking(b) {
    var sums = (b.summaries || []).map(function (s) { return s && s.summary; }).filter(Boolean);
    var head = "Suy luận" + (sums.length > 1 ? " · " + sums.length + " bước" : "") +
      (sums[0] ? " · <span class='card-sub'>" + esc(sums[0]) + "</span>" : "");
    var c = collapsible("meta thinking", window.Icons.think, head, false);
    if (sums.length) {
      c.body.appendChild(elt("div", "sub-h", "Các bước tóm tắt"));
      var ul = elt("ul", "think-sums");
      sums.forEach(function (s) { ul.appendChild(elt("li", null, s)); });
      c.body.appendChild(ul);
      c.body.appendChild(elt("div", "sub-h", "Suy luận đầy đủ"));
    }
    var body = elt("div", "body think-body");
    body.innerHTML = MD.toHtml(b.thinking || "");
    if (b.truncated || b.cut_off) body.appendChild(elt("div", "note", "… (đã cắt bớt trong bản export)"));
    c.body.appendChild(body);
    return c.card;
  }

  function citationsEl(cits) {
    var box = elt("div", "citations");
    box.appendChild(elt("div", "cit-h", "Nguồn trích dẫn"));
    var ol = elt("ol");
    cits.forEach(function (ci) {
      var url = (ci.details && ci.details.url) || ci.url || "";
      var li = elt("li");
      if (url) {
        var a = elt("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = domainOf(url) || url;
        li.appendChild(a);
      } else li.textContent = "(trích dẫn)";
      ol.appendChild(li);
    });
    box.appendChild(ol);
    return box;
  }

  function renderText(b) {
    var wrap = elt("div", "text-block");
    var body = elt("div", "body");
    body.innerHTML = MD.toHtml(b.text || "");
    wrap.appendChild(body);
    if (b.citations && b.citations.length) wrap.appendChild(citationsEl(b.citations));
    return wrap;
  }

  function renderWebSearch(use, result) {
    var q = (use.input && use.input.query) || "(không rõ truy vấn)";
    var items = (result && Array.isArray(result.content)) ? result.content : [];
    var c = collapsible("meta websearch", window.Icons.search, "Tìm web: <b>" + esc(q) + "</b> " +
      '<span class="card-sub">' + items.length + " kết quả</span>", false);
    if (result && result.is_error) c.card.classList.add("is-error");
    items.forEach(function (it) {
      var row = elt("div", "src");
      var md = it.metadata || {};
      var pcm = it.prompt_context_metadata || {};
      var fav = md.favicon_url || "";
      var dom = md.site_domain || domainOf(it.url);
      var head = elt("div", "src-head");
      if (fav) { var img = elt("img", "favicon"); img.src = fav; img.alt = ""; img.loading = "lazy"; head.appendChild(img); }
      var a = elt("a", "src-title"); a.href = it.url || "#"; a.target = "_blank"; a.rel = "noopener";
      a.textContent = it.title || it.url || "(nguồn)";
      head.appendChild(a);
      row.appendChild(head);
      var metaLine = [md.site_name, dom, pcm.age].filter(Boolean).join(" · ");
      row.appendChild(elt("div", "src-dom", metaLine));
      if (it.text) row.appendChild(elt("div", "src-snippet", String(it.text))); // ĐẦY ĐỦ, không cắt
      c.body.appendChild(row);
    });
    if (!items.length) c.body.appendChild(elt("div", "note", "(Không có nội dung kết quả trong bản export)"));
    return c.card;
  }

  function renderArtifact(use) {
    var inp = use.input || {};
    var kind = inp.type || "text/markdown";
    var title = inp.title || inp.id || "Artifact";
    var subBits = [kind, inp.command, inp.language].filter(Boolean).join(" · ");
    var c = collapsible("feature artifact", window.Icons.doc, "Artifact: <b>" + esc(title) + "</b> " +
      '<span class="card-sub">' + esc(subBits) + "</span>", true);
    var content = inp.content || "";
    if (/html/i.test(kind)) {
      c.body.appendChild(embedFrame(content, title));
    } else if (/svg/i.test(kind)) {
      var sv = elt("div", "svg-embed"); sv.innerHTML = content; c.body.appendChild(sv);
    } else {
      var body = elt("div", "body"); body.innerHTML = MD.toHtml(content); c.body.appendChild(body);
    }
    return c.card;
  }

  function renderWidget(use) {
    var inp = use.input || {};
    var title = inp.title || "Widget";
    var c = collapsible("feature widget", window.Icons.chart, "Widget: <b>" + esc(title) + "</b>", true);
    if (inp.loading_messages && inp.loading_messages.length)
      c.body.appendChild(elt("div", "note", "Thông điệp khi tải: " + inp.loading_messages.join(" · ")));
    if (inp.widget_code) c.body.appendChild(embedFrame(inp.widget_code, title));
    else c.body.appendChild(elt("div", "note", "(Không có mã widget trong bản export)"));
    return c.card;
  }

  function renderAsk(use) {
    var inp = use.input || {};
    var qs = inp.questions || [];
    var c = collapsible("feature ask", window.Icons.help, "Câu hỏi cho người dùng " +
      '<span class="card-sub">' + qs.length + " câu</span>", true);
    qs.forEach(function (q, i) {
      var block = elt("div", "ask-q");
      var qt = elt("div", "ask-qt", (i + 1) + ". " + (q.question || ""));
      if (q.type) qt.appendChild(elt("span", "qtype", q.type === "multi_select" ? " (chọn nhiều)" : " (chọn một)"));
      block.appendChild(qt);
      var opts = elt("div", "ask-opts");
      (q.options || []).forEach(function (o) { opts.appendChild(elt("span", "chip", o)); });
      block.appendChild(opts);
      c.body.appendChild(block);
    });
    return c.card;
  }

  function renderGenericTool(use, result) {
    var integ = use.integration_name ? ' <span class="card-sub">· ' + esc(use.integration_name) + "</span>" : "";
    var c = collapsible("meta tool", window.Icons.wrench, "Công cụ: <b>" + esc(use.name || "?") + "</b>" + integ, false);
    if (use.input !== undefined) {
      c.body.appendChild(elt("div", "sub-h", "Đầu vào"));
      var pre1 = elt("pre", "json"); pre1.textContent = prettyJSON(use.input); c.body.appendChild(pre1);
    }
    if (result) {
      c.body.appendChild(elt("div", "sub-h", "Kết quả" + (result.is_error ? " (lỗi)" : "")));
      var rc = result.content;
      var txt = Array.isArray(rc)
        ? rc.map(function (x) { return x && x.text != null ? x.text : prettyJSON(x); }).join("\n")
        : prettyJSON(rc);
      var pre2 = elt("pre", "json"); pre2.textContent = txt; c.body.appendChild(pre2);
    }
    return c.card;
  }

  /* Thẻ "Dữ liệu gốc (JSON)" — chứa NGUYÊN VĂN object gốc, đảm bảo 100% trường có mặt trên giao diện */
  function rawJsonCard(obj, title) {
    var c = collapsible("meta raw", window.Icons.code, title || "Dữ liệu gốc (JSON đầy đủ)", false);
    var pre = elt("pre", "json"); pre.textContent = prettyJSON(obj);
    c.body.appendChild(pre);
    return c.card;
  }

  /* kết quả "OK" đơn giản của artifacts/visualize → xác nhận gọn */
  function trivialResult(result) {
    if (!result) return true;
    var rc = result.content;
    if (Array.isArray(rc) && rc.length === 1 && rc[0] && typeof rc[0].text === "string" && rc[0].text.length <= 3)
      return true;
    return false;
  }

  function renderToolPair(use, result) {
    var frag = document.createDocumentFragment();
    var name = use.name || "";
    if (name === "web_search") { frag.appendChild(renderWebSearch(use, result)); return frag; }
    if (name === "artifacts") {
      frag.appendChild(renderArtifact(use));
      if (!trivialResult(result)) frag.appendChild(renderGenericTool({ name: name + " (kết quả)", input: undefined }, result));
      return frag;
    }
    if (name === "visualize:show_widget") { frag.appendChild(renderWidget(use)); return frag; }
    if (name === "ask_user_input_v0") { frag.appendChild(renderAsk(use)); return frag; }
    // read_me và mọi tool khác
    frag.appendChild(renderGenericTool(use, result));
    return frag;
  }

  /* ---------- render cả 1 message ---------- */
  function renderMessage(blocks) {
    var frag = document.createDocumentFragment();
    var arr = blocks || [];
    for (var i = 0; i < arr.length; i++) {
      var b = arr[i];
      if (!b || typeof b !== "object") continue;
      if (b.type === "thinking") { frag.appendChild(renderThinking(b)); continue; }
      if (b.type === "text") {
        if ((b.text || "").trim()) frag.appendChild(renderText(b));
        continue;
      }
      if (b.type === "tool_use") {
        var next = arr[i + 1];
        var res = (next && next.type === "tool_result" &&
          (!next.tool_use_id || !b.id || next.tool_use_id === b.id)) ? next : null;
        frag.appendChild(renderToolPair(b, res));
        if (res) i++; // đã tiêu thụ tool_result kế tiếp
        continue;
      }
      if (b.type === "tool_result") { // tool_result mồ côi (hiếm)
        frag.appendChild(renderGenericTool({ name: b.name || "kết quả", input: undefined }, b));
        continue;
      }
      // loại chưa biết → hiện JSON để không mất dữ liệu
      var pre = elt("pre", "json"); pre.textContent = prettyJSON(b); frag.appendChild(pre);
    }
    return frag;
  }

  function metaCounts(blocks) {
    var t = 0, tools = 0;
    (blocks || []).forEach(function (b) {
      if (!b) return;
      if (b.type === "thinking") t++;
      else if (b.type === "tool_use" && (b.name === "web_search" || b.name === "visualize:read_me" ||
        (b.name !== "artifacts" && b.name !== "visualize:show_widget" && b.name !== "ask_user_input_v0"))) tools++;
    });
    return { thinking: t, tools: tools };
  }

  window.Blocks = { renderMessage: renderMessage, metaCounts: metaCounts, rawJsonCard: rawJsonCard };
})();
