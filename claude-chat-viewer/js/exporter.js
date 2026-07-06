/*
 * exporter.js — Xuất hội thoại / dự án / tài khoản ra file Markdown (.md)
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 *
 * Thuần logic (không đụng DOM trừ download) → kiểm thử được bằng Node.
 * - build(kind, item, opts): dựng chuỗi .md; kind = "conv" | "proj" | "users".
 *   Đi qua blocks THEO ĐÚNG THỨ TỰ GỐC; nội dung chứa ``` được bọc fence dài hơn.
 * - Bảo chứng 100%: bật "rawJson" → nhúng NGUYÊN VĂN object gốc (bọc <details> cho gọn)
 *   → bản xuất không mất một trường nào (lossless, parse lại khớp tuyệt đối).
 * - coverage(kind, item, opts): % dữ liệu gốc có mặt trong bản xuất
 *   (trọng số theo độ dài ký tự — trung thực; bật rawJson = 100%).
 * - download(filename, text): tải file qua Blob + <a download> (không cần server).
 */
(function () {
  "use strict";

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtDate(s) {
    try {
      var d = new Date(s);
      if (isNaN(d)) return String(s || "");
      return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() +
        " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    } catch (e) { return String(s || ""); }
  }

  function slugify(s) {
    s = String(s || "").toLowerCase();
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
    s = s.replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
    return s || "xuat";
  }

  // Bọc code-fence an toàn: nội dung có sẵn ``` thì dùng fence dài hơn
  function fence(content, lang) {
    content = String(content == null ? "" : content);
    var runs = content.match(/`{3,}/g), n = 3;
    if (runs) runs.forEach(function (r) { if (r.length >= n) n = r.length + 1; });
    var f = new Array(n + 1).join("`");
    return f + (lang || "") + "\n" + content + "\n" + f;
  }

  function domainOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  function credit(L) {
    L.push("---");
    L.push("_Xuất bởi [Claude Chat Viewer](https://tools.hieu-icetea.io.vn/claude-chat-viewer/) — by Hiếu iceTea 🍀_");
    L.push("");
  }

  // Khối JSON gốc — bọc <details> để file gọn mắt, mở ra khi cần; nội dung NGUYÊN VĂN 100%
  function rawJsonSection(L, obj, title) {
    L.push("---");
    L.push("");
    L.push("## " + (title || "Dữ liệu gốc (JSON đầy đủ — bảo chứng 100%)"));
    L.push("");
    L.push("<details><summary>Bấm để mở JSON nguyên văn</summary>");
    L.push("");
    L.push(fence(JSON.stringify(obj, null, 2), "json"));
    L.push("");
    L.push("</details>");
    L.push("");
  }

  /* ================= HỘI THOẠI ================= */
  function buildConvMarkdown(conv, o) {
    o = o || {};
    var L = [];
    L.push("# " + (conv.name || "(Không tiêu đề)"));
    L.push("");
    L.push("> Xuất từ **Claude Chat Viewer** — by Hiếu iceTea 🍀");
    if (o.aiHeader) {
      L.push(">");
      L.push("> **Ghi chú cho AI:** File này là bản xuất một hội thoại giữa người dùng và Claude (claude.ai).");
      L.push("> Cấu trúc: \"## Bạn\" = người dùng, \"## Claude\" = trợ lý; khối `<details>` = suy luận nội bộ;");
      L.push("> \"### Artifact/Widget/Công cụ\" = nội dung do công cụ tạo; cuối file có thể kèm JSON gốc đầy đủ.");
      L.push("> Hãy đọc toàn bộ để nắm ngữ cảnh và tiếp tục hỗ trợ người dùng từ điểm dừng cuối.");
    }
    L.push("");
    L.push("- **Mã phiên (UUID):** `" + (conv.uuid || "") + "`");
    L.push("- **Tạo:** " + fmtDate(conv.created) + " · **Cập nhật:** " + fmtDate(conv.updated));
    L.push("- **Số tin nhắn:** " + (conv.messages || []).length);
    if (conv.summary) L.push("- **Tóm tắt:** " + conv.summary);
    if (o.meta) {
      L.push("- **Thời gian gốc (ISO):** tạo `" + (conv.created || "") + "` · cập nhật `" + (conv.updated || "") + "`");
      if (conv.account) L.push("- **Tài khoản (UUID):** `" + conv.account + "`");
    }
    L.push("- **Xuất lúc:** " + fmtDate(new Date().toISOString()));
    L.push("");

    var rawMsgs = (conv.raw && conv.raw.chat_messages) || [];

    (conv.messages || []).forEach(function (m, mi) {
      var rm = rawMsgs[mi] || {};
      L.push("---");
      L.push("");
      L.push("## " + (m.sender === "human" ? "Bạn" : "Claude") + " — " + fmtDate(m.ts));
      if (o.meta) {
        var metaBits = [];
        if (m.uuid) metaBits.push("uuid: `" + m.uuid + "`");
        if (rm.parent_message_uuid) metaBits.push("parent: `" + rm.parent_message_uuid + "`");
        if (m.ts) metaBits.push("ISO: `" + m.ts + "`");
        if (metaBits.length) L.push("<sub>" + metaBits.join(" · ") + "</sub>");
      }
      L.push("");

      // Tệp đính kèm / files ở cấp tin nhắn (nếu có) — nội dung thật của người dùng
      if (o.text) {
        ["attachments", "files"].forEach(function (k) {
          if (rm[k] && rm[k].length) {
            L.push("**" + (k === "attachments" ? "Tệp đính kèm" : "Files") + ":**");
            L.push(fence(JSON.stringify(rm[k], null, 2), "json"));
            L.push("");
          }
        });
      }

      var blocks = m.blocks || [];
      blocks.forEach(function (b, idx) {
        if (!b || typeof b !== "object") return;

        if (b.type === "text") {
          if (o.text && (b.text || "").trim()) {
            L.push(b.text.trim());
            L.push("");
            if (b.citations && b.citations.length) {
              L.push("**Nguồn trích dẫn:**");
              b.citations.forEach(function (ci) {
                var u = (ci.details && ci.details.url) || "";
                if (u) L.push("- <" + u + ">");
              });
              L.push("");
            }
          }
          return;
        }

        if (b.type === "thinking") {
          if (o.thinking) {
            var sums = (b.summaries || []).map(function (s) { return s && s.summary; }).filter(Boolean);
            L.push("<details><summary>Suy luận" + (sums.length ? " (" + sums.length + " bước)" : "") + "</summary>");
            L.push("");
            sums.forEach(function (s) { L.push("- _" + s + "_"); });
            if (sums.length) L.push("");
            L.push((b.thinking || "").trim());
            L.push("");
            L.push("</details>");
            L.push("");
          }
          return;
        }

        if (b.type === "tool_use") {
          var name = b.name || "", inp = b.input || {};
          var res = null, nb = blocks[idx + 1];
          if (nb && nb.type === "tool_result" && (!nb.tool_use_id || !b.id || nb.tool_use_id === b.id)) res = nb;

          if (name === "web_search") {
            if (o.websearch) {
              var items = (res && Array.isArray(res.content)) ? res.content : [];
              // Đồng bộ web UI: thẻ ĐÓNG mặc định, bấm mở (details)
              L.push("<details><summary>Tìm web: \"" + (inp.query || "") + "\" (" + items.length + " kết quả)</summary>");
              L.push("");
              items.forEach(function (it) {
                var md = it.metadata || {}, pcm = it.prompt_context_metadata || {};
                var title = String(it.title || it.url || "nguồn").replace(/[\[\]]/g, " ");
                var line = "- [" + title + "](" + (it.url || "") + ")";
                var extra = [md.site_name || md.site_domain || domainOf(it.url), pcm.age].filter(Boolean).join(" · ");
                if (extra) line += " — " + extra;
                L.push(line);
                // Trích đoạn ĐẦY ĐỦ, gộp thành MỘT đoạn blockquote (giữ nguyên văn bản liền mạch)
                if (it.text) L.push("  > " + String(it.text).trim().replace(/\s*\n\s*/g, " "));
              });
              L.push("");
              L.push("</details>");
              L.push("");
            }
            return;
          }

          if (name === "artifacts") {
            if (o.artifacts) {
              var kind = inp.type || "text/markdown";
              // Đồng bộ web UI: MỞ sẵn nhưng vẫn gập được (details open)
              L.push("<details open><summary>Artifact: " + (inp.title || inp.id || "artifact") + " (" + kind + (inp.command ? " · " + inp.command : "") + ")</summary>");
              L.push("");
              if (/markdown|plain/i.test(kind)) L.push((inp.content || "").trim()); // vốn là markdown → chèn nguyên văn
              else L.push(fence(inp.content || "", /html/i.test(kind) ? "html" : (/svg/i.test(kind) ? "xml" : "")));
              L.push("");
              L.push("</details>");
              L.push("");
            }
            return;
          }

          if (name === "visualize:show_widget") {
            if (o.tools) {
              // Khác web UI có chủ đích: trong .md widget chỉ là code dài → ĐÓNG mặc định
              L.push("<details><summary>Widget: " + (inp.title || "widget") + (b.integration_name ? " (" + b.integration_name + ")" : "") + "</summary>");
              L.push("");
              if (inp.loading_messages && inp.loading_messages.length) {
                L.push("_Thông điệp khi tải: " + inp.loading_messages.join(" · ") + "_");
                L.push("");
              }
              L.push(fence(inp.widget_code || "", "html"));
              L.push("");
              L.push("</details>");
              L.push("");
            }
            return;
          }

          if (name === "ask_user_input_v0") {
            if (o.ask) {
              // Đồng bộ web UI: MỞ sẵn nhưng vẫn gập được
              L.push("<details open><summary>Câu hỏi cho người dùng (" + ((inp.questions || []).length) + " câu)</summary>");
              L.push("");
              (inp.questions || []).forEach(function (q, i) {
                var kindTxt = q.type === "multi_select" ? " _(chọn nhiều)_" : (q.type ? " _(chọn một)_" : "");
                L.push((i + 1) + ". " + (q.question || "") + kindTxt);
                (q.options || []).forEach(function (op) { L.push("   - " + op); });
              });
              L.push("");
              L.push("</details>");
              L.push("");
            }
            return;
          }

          // công cụ khác (read_me…) — đồng bộ web UI: ĐÓNG mặc định
          if (o.tools) {
            L.push("<details><summary>Công cụ: " + name + (b.integration_name ? " (" + b.integration_name + ")" : "") + "</summary>");
            L.push("");
            var hasInp = inp && typeof inp === "object" && Object.keys(inp).length;
            if (hasInp) { L.push("Đầu vào:"); L.push(fence(JSON.stringify(inp, null, 2), "json")); }
            if (res) {
              var rc = res.content;
              var txt = Array.isArray(rc)
                ? rc.map(function (x) { return x && x.text != null ? x.text : JSON.stringify(x); }).join("\n")
                : JSON.stringify(rc);
              L.push("Kết quả:");
              L.push(fence(txt, ""));
            }
            L.push("");
            L.push("</details>");
            L.push("");
          }
          return;
        }
        // tool_result đã được gộp vào tool_use phía trên → bỏ qua
      });
    });

    if (o.rawJson) rawJsonSection(L, conv.raw || conv);
    credit(L);
    return L.join("\n");
  }

  /* ================= DỰ ÁN ================= */
  function buildProjMarkdown(p, o) {
    o = o || {};
    var L = [];
    L.push("# " + (p.name || "(Dự án)") + " — Dự án");
    L.push("");
    L.push("> Xuất từ **Claude Chat Viewer** — by Hiếu iceTea 🍀");
    if (o.aiHeader) {
      L.push(">");
      L.push("> **Ghi chú cho AI:** File này là bản xuất một Dự án (Project) trên claude.ai,");
      L.push("> gồm mô tả và các tài liệu đính kèm. Hãy dùng làm ngữ cảnh nền khi hỗ trợ người dùng.");
    }
    L.push("");
    L.push("- **UUID:** `" + (p.uuid || "") + "`");
    L.push("- **Tạo:** " + fmtDate(p.created_at) + " · **Cập nhật:** " + fmtDate(p.updated_at));
    L.push("- **Người tạo:** " + ((p.creator && p.creator.full_name) || "—"));
    L.push("- **Dự án mẫu:** " + (p.is_starter_project ? "Có" : "Không") + " · **Riêng tư:** " + (p.is_private ? "Có" : "Không"));
    if (o.meta) {
      L.push("- **Thời gian gốc (ISO):** tạo `" + (p.created_at || "") + "` · cập nhật `" + (p.updated_at || "") + "`");
      if (p.creator && p.creator.uuid) L.push("- **Người tạo (UUID):** `" + p.creator.uuid + "`");
    }
    L.push("- **Xuất lúc:** " + fmtDate(new Date().toISOString()));
    L.push("");
    if (o.text) {
      if (p.description) { L.push("## Mô tả"); L.push(""); L.push(p.description); L.push(""); }
      if (p.prompt_template) { L.push("## Prompt mẫu"); L.push(""); L.push(fence(p.prompt_template, "")); L.push(""); }
      (p.docs || []).forEach(function (doc) {
        L.push("## Tài liệu: " + (doc.filename || "tài liệu"));
        if (o.meta) L.push("<sub>uuid: `" + (doc.uuid || "") + "` · tạo: `" + (doc.created_at || "") + "`</sub>");
        else if (doc.created_at) L.push("<sub>tạo: " + fmtDate(doc.created_at) + "</sub>");
        L.push("");
        L.push((doc.content || "").trim()); // tài liệu vốn là văn bản/markdown → nguyên văn
        L.push("");
      });
    }
    if (o.rawJson) rawJsonSection(L, p);
    credit(L);
    return L.join("\n");
  }

  /* ================= TÀI KHOẢN ================= */
  function buildUsersMarkdown(users, o) {
    o = o || {};
    users = Array.isArray(users) ? users : [users];
    var L = [];
    L.push("# Tài khoản Claude");
    L.push("");
    L.push("> Xuất từ **Claude Chat Viewer** — by Hiếu iceTea 🍀");
    L.push("");
    if (o.text) {
      users.forEach(function (u) {
        u = u || {};
        L.push("- **Họ tên:** " + (u.full_name || "—"));
        L.push("- **Email:** " + (u.email_address || "—"));
        L.push("- **Số điện thoại:** " + (u.verified_phone_number || "—"));
        if (o.meta) L.push("- **UUID:** `" + (u.uuid || "") + "`");
        L.push("");
      });
    }
    L.push("- **Xuất lúc:** " + fmtDate(new Date().toISOString()));
    L.push("");
    if (o.rawJson) rawJsonSection(L, users, "Dữ liệu gốc (users.json — bảo chứng 100%)");
    credit(L);
    return L.join("\n");
  }

  /* ================= API chung ================= */
  function build(kind, item, o) {
    if (kind === "proj") return buildProjMarkdown(item, o);
    if (kind === "users") return buildUsersMarkdown(item, o);
    return buildConvMarkdown(item, o);
  }

  function rawOf(kind, item) {
    if (kind === "conv") return item.raw || item;
    return item; // proj/users vốn là object gốc
  }

  function leaves(obj, out) {
    if (obj == null) return out;
    if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) leaves(obj[i], out); return out; }
    if (typeof obj === "object") { for (var k in obj) leaves(obj[k], out); return out; }
    out.push(String(obj));
    return out;
  }
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ""); }

  // % độ phủ: TRỌNG SỐ ĐỘ DÀI ký tự của từng giá trị lá (trung thực với "lượng dữ liệu")
  function coverageParts(kind, item, o) {
    var md = norm(build(kind, item, o));
    var vals = leaves(rawOf(kind, item), []);
    var seen = {}, tot = 0, hit = 0;
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (!v || v === "true" || v === "false" || v === "null") continue;
      if (seen[v]) continue;
      seen[v] = 1;
      var nv = norm(v);
      if (!nv) continue;
      tot += nv.length;
      if (md.indexOf(nv) >= 0) hit += nv.length;
    }
    return { hit: hit, tot: tot };
  }
  function coverage(kind, item, o) {
    if (o && o.rawJson) return 100; // JSON gốc nhúng nguyên văn → lossless
    var p = coverageParts(kind, item, o);
    return p.tot ? Math.round(100 * p.hit / p.tot) : 100;
  }
  // % độ phủ TỔNG HỢP cho nhiều mục (cộng dồn ký tự — không phải trung bình đơn thuần)
  function coverageMany(list, o) {
    if (o && o.rawJson) return 100;
    var hit = 0, tot = 0;
    for (var i = 0; i < list.length; i++) {
      var p = coverageParts(list[i].kind, list[i].item, o);
      hit += p.hit; tot += p.tot;
    }
    return tot ? Math.round(100 * hit / tot) : 100;
  }

  // Mục lục INDEX.md cho gói zip "xuất tất cả" — 3 section đối xứng 2 tab + tài khoản
  function buildIndex(convRows, projRows, accountFile) {
    convRows = convRows || []; projRows = projRows || [];
    var L = [];
    L.push("# Mục lục xuất — Claude Chat Viewer");
    L.push("");
    L.push("> Xuất từ **Claude Chat Viewer** — by Hiếu iceTea 🍀");
    L.push("");
    L.push("- **Xuất lúc:** " + fmtDate(new Date().toISOString()));
    var parts = ["**Hội thoại:** " + convRows.length];
    if (projRows.length) parts.push("**Dự án:** " + projRows.length);
    if (accountFile) parts.push("**Tài khoản:** 1");
    L.push("- " + parts.join(" · "));
    L.push("");
    function cell(name) { return String(name || "(Không tiêu đề)").replace(/\|/g, "\\|"); }
    if (convRows.length) {
      L.push("## Hội thoại (" + convRows.length + ")");
      L.push("");
      L.push("| # | Hội thoại | Cập nhật | Tin nhắn | File |");
      L.push("|---:|---|---|---:|---|");
      convRows.forEach(function (r, i) {
        L.push("| " + (i + 1) + " | " + cell(r.name) + " | " + fmtDate(r.updated) + " | " + r.count +
          " | [" + r.file + "](./" + r.file + ") |");
      });
      L.push("");
    }
    if (projRows.length) {
      L.push("## Dự án (" + projRows.length + ")");
      L.push("");
      L.push("| # | Dự án | Cập nhật | Tài liệu | File |");
      L.push("|---:|---|---|---:|---|");
      projRows.forEach(function (r, i) {
        L.push("| " + (i + 1) + " | " + cell(r.name) + " | " + fmtDate(r.updated) + " | " + r.docs +
          " | [" + r.file + "](./" + r.file + ") |");
      });
      L.push("");
    }
    if (accountFile) {
      L.push("## Tài khoản");
      L.push("");
      L.push("- [" + accountFile + "](./" + accountFile + ")");
      L.push("");
    }
    credit(L);
    return L.join("\n");
  }

  function download(filename, text) {
    var blob = (typeof Blob !== "undefined" && text instanceof Blob)
      ? text
      : new Blob([text], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  // Tên file ƯU TIÊN TIẾNG ANH trong cấu trúc xuất (slug nội dung giữ theo tiêu đề gốc)
  function suggestFilename(kind, item) {
    if (kind === "proj") return "project-" + slugify(item.name) + "_" + String(item.uuid || "").slice(0, 8) + ".md";
    if (kind === "users") return "account.md";
    return slugify(item.name) + "_" + String(item.uuid || "").slice(0, 8) + ".md";
  }

  window.Exporter = {
    build: build,
    coverage: coverage,
    coverageMany: coverageMany,
    buildIndex: buildIndex,
    download: download,
    suggestFilename: suggestFilename,
    _fence: fence, _slugify: slugify,
  };
})();
