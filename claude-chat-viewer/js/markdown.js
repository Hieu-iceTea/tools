/*
 * markdown.js — Bộ render Markdown tối giản, chạy offline (không thư viện ngoài)
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 *
 * Hỗ trợ: tiêu đề, đậm/nghiêng/gạch, code inline & khối code, bảng,
 * danh sách (bullet/đánh số), trích dẫn, đường kẻ ngang, link.
 * Xuất ra namespace toàn cục: window.Markdown
 */
(function () {
  "use strict";
  var SENT = "\uE000"; // ký tự Private-Use làm mốc thay khối code (không trùng nội dung)

  function esc(s) {
    return (s || "").replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
  function reEsc(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, function (m, c) { return "<code>" + c + "</code>"; })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function splitRow(l) {
    return l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|")
      .map(function (c) { return c.trim(); });
  }
  function isSep(l) {
    return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(l) && l.indexOf("-") >= 0;
  }

  function toHtml(src) {
    src = (src || "").replace(/\r\n/g, "\n");
    var codes = [];
    src = src.replace(/```[^\n]*\n([\s\S]*?)```/g, function (m, c) {
      codes.push(c.replace(/\n$/, ""));
      return SENT + "C" + (codes.length - 1) + SENT;
    });
    src = esc(src);
    var L = src.split("\n");
    var out = "";
    var i = 0;
    var codeRe = new RegExp("^" + SENT + "C(\\d+)" + SENT + "$");

    function isPara(l) {
      return !/^\s*$/.test(l) && !/^#{1,6}\s/.test(l) && !/^\s*[-*+]\s+/.test(l) &&
        !/^\s*\d+\.\s+/.test(l) && !/^\s*(?:>|&gt;)\s?/.test(l) && !codeRe.test(l) &&
        !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l) &&
        !(l.indexOf("|") >= 0 && L[i + 1] !== undefined && isSep(L[i + 1]));
    }

    while (i < L.length) {
      var l = L[i];
      var cm = l.match(codeRe);
      if (cm) { out += "<pre><code>" + esc(codes[+cm[1]]) + "</code></pre>"; i++; continue; }
      if (/^\s*$/.test(l)) { i++; continue; }
      var h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) { var n = h[1].length; out += "<h" + n + ">" + inline(h[2]) + "</h" + n + ">"; i++; continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { out += "<hr>"; i++; continue; }
      if (l.indexOf("|") >= 0 && L[i + 1] !== undefined && isSep(L[i + 1])) {
        var hd = splitRow(l); i += 2; var rows = [];
        while (i < L.length && L[i].indexOf("|") >= 0 && !/^\s*$/.test(L[i])) { rows.push(splitRow(L[i])); i++; }
        out += '<div class="tablewrap"><table><thead><tr>' +
          hd.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") +
          "</tr></thead><tbody>" +
          rows.map(function (r) {
            return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
          }).join("") + "</tbody></table></div>";
        continue;
      }
      if (/^\s*(?:>|&gt;)\s?/.test(l)) {
        var bq = [];
        while (i < L.length && /^\s*(?:>|&gt;)\s?/.test(L[i])) { bq.push(L[i].replace(/^\s*(?:>|&gt;)\s?/, "")); i++; }
        out += "<blockquote>" + inline(bq.join("<br>")) + "</blockquote>"; continue;
      }
      if (/^\s*[-*+]\s+/.test(l)) {
        var ul = [];
        while (i < L.length && /^\s*[-*+]\s+/.test(L[i])) { ul.push("<li>" + inline(L[i].replace(/^\s*[-*+]\s+/, "")) + "</li>"); i++; }
        out += "<ul>" + ul.join("") + "</ul>"; continue;
      }
      if (/^\s*\d+\.\s+/.test(l)) {
        var ol = [];
        while (i < L.length && /^\s*\d+\.\s+/.test(L[i])) { ol.push("<li>" + inline(L[i].replace(/^\s*\d+\.\s+/, "")) + "</li>"); i++; }
        out += "<ol>" + ol.join("") + "</ol>"; continue;
      }
      var p = [];
      while (i < L.length && isPara(L[i])) { p.push(L[i]); i++; }
      out += "<p>" + inline(p.join("<br>")) + "</p>";
    }
    return out;
  }

  // Tô vàng từ khớp SAU khi đã render (đi qua text-node để không phá vỡ thẻ HTML)
  function highlight(root, filter) {
    if (!filter) return;
    var rx = new RegExp(reEsc(filter), "ig");
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var p = node.parentNode;
      if (!p || p.nodeName === "MARK" || p.nodeName === "SCRIPT" || p.nodeName === "STYLE") return;
      var t = node.nodeValue;
      rx.lastIndex = 0;
      if (!rx.test(t)) return;
      rx.lastIndex = 0;
      var span = document.createElement("span");
      span.innerHTML = esc(t).replace(rx, "<mark>$&</mark>");
      p.replaceChild(span, node);
    });
  }

  /* ---------- Nút sao chép cho khối code ---------- */
  var ICON_COPY = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.top = "-9999px"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("execCommand"));
      } catch (e) { reject(e); }
    });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }
  function flash(btn, ok) {
    btn.innerHTML = ok ? ICON_OK : ICON_COPY;
    btn.classList.toggle("ok", !!ok);
    btn.classList.toggle("fail", !ok);
    setTimeout(function () {
      btn.innerHTML = ICON_COPY;
      btn.classList.remove("ok"); btn.classList.remove("fail");
    }, 1300);
  }

  // Gắn nút sao chép vào mọi <pre> trong root (idempotent — gọi lại không nhân đôi)
  function enhanceCopy(root) {
    if (!root || !root.querySelectorAll) return;
    var pres = root.querySelectorAll("pre");
    Array.prototype.forEach.call(pres, function (pre) {
      if (pre.getAttribute("data-copy")) return;
      pre.setAttribute("data-copy", "1");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.title = "Sao chép"; btn.setAttribute("aria-label", "Sao chép");
      btn.innerHTML = ICON_COPY;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var code = pre.querySelector("code");
        var text = (code ? code.textContent : pre.textContent) || "";
        copyText(text).then(function () { flash(btn, true); }, function () { flash(btn, false); });
      });
      pre.appendChild(btn);
    });
  }

  window.Markdown = {
    toHtml: toHtml, highlight: highlight, escapeHtml: esc,
    enhanceCopy: enhanceCopy, copyText: copyText,
  };
})();
