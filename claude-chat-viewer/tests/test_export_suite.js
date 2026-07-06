// ============================================================================
// BỘ TEST NGHIÊM NGẶT — chức năng "Xuất .md" (Claude Chat Viewer)
// Tác giả: Hiếu iceTea 🍀
// Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
//
// Cách chạy (từ thư mục claude-chat-viewer):
//   node tests/test_export_suite.js <thư-mục-export-đã-giải-nén>
// Ví dụ:
//   node tests/test_export_suite.js ~/Downloads/data-xxxx-batch-0000
//
// Mọi expectation được sinh TỪ DỮ LIỆU GỐC (data-driven), không hardcode.
// Nhóm: A nội dung đúng/đủ · B ma trận 512 tổ hợp · C fence/ký tự đặc biệt
//        D edge cases · E coverage · F filename · G hiệu năng · H parity thu gọn
// ============================================================================
const fs = require("fs"), path = require("path"), vm = require("vm");
const J = path.join(__dirname, "..", "js"); // thư mục js/ của app — tự suy ra, không hardcode

// Thư mục DỮ LIỆU export (chứa conversations.json) — truyền qua tham số dòng lệnh
const DATA = process.argv[2];
if (!DATA || !fs.existsSync(path.join(DATA, "conversations.json"))) {
  console.error("Cách dùng:  node tests/test_export_suite.js <thư-mục-export-đã-giải-nén>");
  console.error("  Thư mục phải chứa conversations.json (giải nén từ file .zip export của claude.ai).");
  console.error("  Ví dụ:    node tests/test_export_suite.js ~/Downloads/data-xxxx-batch-0000");
  process.exit(2);
}

const sb = { window: {}, document: { createTreeWalker: () => ({ nextNode: () => false }) },
  NodeFilter: { SHOW_TEXT: 4 }, setTimeout, clearTimeout, console, URL, Date };
sb.window.document = sb.document; vm.createContext(sb);
for (const f of ["config.js", "markdown.js", "loader.js", "exporter.js"])
  vm.runInContext(fs.readFileSync(path.join(J, f), "utf8"), sb, { filename: f });
const W = sb.window;
const EX = W.Exporter;

const norm = s => String(s).toLowerCase().replace(/\s+/g, "");
let pass = 0, fail = 0; const failures = [];
function check(id, cond, note) {
  if (cond) { pass++; }
  else { fail++; failures.push(id + (note ? " — " + note : "")); }
}
function section(t) { console.log("\n■ " + t); }

// Trích JSON gốc từ md (fence động) rồi so khớp tuyệt đối
function losslessCheck(md, rawObj) {
  const h = md.indexOf("## Dữ liệu gốc");
  if (h < 0) return false;
  const after = md.slice(h);
  const fm = after.match(/\n(`{3,})json\n/); if (!fm) return false;
  const start = after.indexOf(fm[0]) + fm[0].length;
  const end = after.indexOf("\n" + fm[1] + "\n", start);
  try { return JSON.stringify(JSON.parse(after.slice(start, end))) === JSON.stringify(rawObj); }
  catch (e) { return false; }
}

const ALLOPTS = { aiHeader: 1, text: 1, artifacts: 1, ask: 1, thinking: 1, websearch: 1, tools: 1, meta: 1, rawJson: 1 };
const FRIENDLY = { ...ALLOPTS, rawJson: 0 };
const KEYS = ["aiHeader", "text", "artifacts", "ask", "thinking", "websearch", "tools", "meta", "rawJson"];

(async () => {
  const t0 = Date.now();
  const reader = { root: "d",
    async readText(p) { return fs.readFileSync(path.join(DATA, p), "utf8"); },
    async listDir(p) { return fs.readdirSync(path.join(DATA, p)); } };
  const d = await W.Loader.load(reader, () => {});
  const convs = d.conversations;

  /* ================= A. NỘI DUNG ĐÚNG & ĐỦ ================= */
  section("A. Nội dung đúng & đủ (so với dữ liệu gốc, data-driven)");
  let nText = 0, nThink = 0, nQuery = 0, nSrc = 0, nArt = 0, nWidget = 0, nAsk = 0, nCit = 0, nTool = 0;
  for (const c of convs) {
    const md = EX.build("conv", c, FRIENDLY);
    const nmd = norm(md);
    for (const m of c.messages) {
      const blocks = m.blocks || [];
      blocks.forEach((b, idx) => {
        if (b.type === "text" && (b.text || "").trim()) {
          nText++;
          check(`A-text[${nText}]`, md.indexOf(b.text.trim()) >= 0, (c.name || "").slice(0, 25));
          (b.citations || []).forEach(ci => {
            const u = ci.details && ci.details.url;
            if (u) { nCit++; check(`A-cit[${nCit}]`, md.indexOf(u) >= 0); }
          });
        }
        if (b.type === "thinking") {
          nThink++;
          check(`A-think[${nThink}]`, md.indexOf((b.thinking || "").trim()) >= 0);
          (b.summaries || []).forEach(s => {
            if (s && s.summary) check(`A-thinkSum`, md.indexOf(s.summary) >= 0);
          });
        }
        if (b.type === "tool_use") {
          const inp = b.input || {};
          const res = blocks[idx + 1] && blocks[idx + 1].type === "tool_result" ? blocks[idx + 1] : null;
          if (b.name === "web_search") {
            nQuery++;
            check(`A-query[${nQuery}]`, md.indexOf('"' + (inp.query || "") + '"') >= 0);
            ((res && res.content) || []).forEach(it => {
              nSrc++;
              if (it.url) check(`A-srcUrl[${nSrc}]`, md.indexOf(it.url) >= 0);
              if (it.title) check(`A-srcTitle[${nSrc}]`,
                nmd.indexOf(norm(String(it.title).replace(/[\[\]]/g, " "))) >= 0);
              if (it.text) check(`A-srcSnippet[${nSrc}]`, nmd.indexOf(norm(it.text)) >= 0,
                "snippet dài " + String(it.text).length);
            });
          } else if (b.name === "artifacts") {
            nArt++;
            check(`A-artifact[${nArt}]`, md.indexOf((inp.content || "").trim()) >= 0);
            if (inp.title || inp.id) check(`A-artTitle`, md.indexOf(String(inp.title || inp.id)) >= 0);
          } else if (b.name === "visualize:show_widget") {
            nWidget++;
            check(`A-widget[${nWidget}]`, md.indexOf(inp.widget_code || "") >= 0);
            (inp.loading_messages || []).forEach(lm => check(`A-widgetLoadMsg`, md.indexOf(lm) >= 0));
          } else if (b.name === "ask_user_input_v0") {
            nAsk++;
            (inp.questions || []).forEach(q => {
              check(`A-askQ`, md.indexOf(q.question || "") >= 0);
              (q.options || []).forEach(op => check(`A-askOpt`, md.indexOf(op) >= 0));
            });
          } else {
            nTool++;
            check(`A-toolName[${nTool}]`, md.indexOf(b.name) >= 0);
            if (res && Array.isArray(res.content)) res.content.forEach(x => {
              if (x && typeof x.text === "string") check(`A-toolResult`, md.indexOf(x.text) >= 0);
            });
          }
        }
      });
    }
    // A10: thứ tự các khối text giữ nguyên
    let cursor = 0, ordered = true;
    for (const m of c.messages) for (const b of (m.blocks || [])) {
      if (b.type === "text" && (b.text || "").trim()) {
        const i = md.indexOf(b.text.trim(), cursor);
        if (i < 0) { ordered = false; break; }
        cursor = i;
      }
    }
    check(`A-order(${(c.name || "").slice(0, 20)})`, ordered);
    // lossless mặc định (rawJson bật theo config def)
    const mdDef = EX.build("conv", c, ALLOPTS);
    check(`A-lossless(${(c.name || "").slice(0, 20)})`, losslessCheck(mdDef, c.raw));
  }
  console.log(`  Đã đối chiếu: ${nText} text, ${nThink} thinking, ${nQuery} truy vấn, ${nSrc} nguồn web, ` +
    `${nArt} artifact, ${nWidget} widget, ${nAsk} khối hỏi, ${nCit} trích dẫn, ${nTool} tool khác`);

  // Dự án & users
  for (const p of d.projects) {
    const md = EX.build("proj", p, ALLOPTS);
    check("A-proj-lossless", losslessCheck(md, p));
    if (p.description) check("A-proj-desc", md.indexOf(p.description) >= 0);
    (p.docs || []).forEach(doc => {
      check("A-proj-docName", md.indexOf(doc.filename || "") >= 0);
      check("A-proj-docContent", md.indexOf((doc.content || "").trim()) >= 0);
    });
  }
  {
    const md = EX.build("users", d.users, ALLOPTS);
    check("A-users-lossless", losslessCheck(md, d.users));
    (d.users || []).forEach(u => {
      check("A-users-name", md.indexOf(u.full_name || "") >= 0);
      check("A-users-email", md.indexOf(u.email_address || "") >= 0);
      check("A-users-phone", md.indexOf(u.verified_phone_number || "") >= 0);
    });
  }

  /* ================= B. MA TRẬN 512 TỔ HỢP ================= */
  section("B. Ma trận tổ hợp options");
  const small = convs.find(c => c.messages.length && norm(c.name).indexOf("kaopiz") >= 0) || convs[5];
  const biggest = convs.reduce((a, b) => JSON.stringify(a.raw).length > JSON.stringify(b.raw).length ? a : b);
  let comboFails = 0;
  for (let mask = 0; mask < 512; mask++) {
    const o = {}; KEYS.forEach((k, i) => o[k] = !!(mask & (1 << i)));
    let md;
    try { md = EX.build("conv", small, o); } catch (e) { comboFails++; continue; }
    if (o.rawJson && !losslessCheck(md, small.raw)) comboFails++;
    // bất biến bật/tắt trên vài marker
    const firstText = (small.messages[0].blocks.find(b => b.type === "text" && (b.text || "").trim()) || {}).text;
    if (firstText) {
      const has = md.indexOf(firstText.trim()) >= 0;
      if (o.text !== undefined && has !== !!o.text && !o.rawJson) comboFails++;
    }
  }
  check("B-512-combos(small)", comboFails === 0, comboFails + " tổ hợp lỗi");
  let comboFails2 = 0;
  for (let s = 0; s < 32; s++) {
    const mask = Math.floor(511 * (s / 31));
    const o = {}; KEYS.forEach((k, i) => o[k] = !!(mask & (1 << i)));
    try {
      const md = EX.build("conv", biggest, o);
      if (o.rawJson && !losslessCheck(md, biggest.raw)) comboFails2++;
    } catch (e) { comboFails2++; }
  }
  check("B-32-sampled(biggest)", comboFails2 === 0, comboFails2 + " lỗi");
  // tắt từng nhóm → nội dung tương ứng phải VẮNG MẶT (kiểm trên conv lớn, không rawJson)
  {
    const thinkBlock = biggest.messages.flatMap(m => m.blocks).find(b => b.type === "thinking");
    const mdNoThink = EX.build("conv", biggest, { ...FRIENDLY, thinking: 0 });
    check("B-off-thinking", mdNoThink.indexOf(thinkBlock.thinking.trim()) < 0);
    const q = biggest.messages.flatMap(m => m.blocks).find(b => b.type === "tool_use" && b.name === "web_search");
    const mdNoWeb = EX.build("conv", biggest, { ...FRIENDLY, websearch: 0 });
    check("B-off-websearch", mdNoWeb.indexOf('"' + q.input.query + '"') < 0);
    const mdNoText = EX.build("conv", biggest, { ...FRIENDLY, text: 0 });
    const t1 = biggest.messages.flatMap(m => m.blocks).find(b => b.type === "text" && (b.text || "").trim());
    check("B-off-text", mdNoText.indexOf(t1.text.trim()) < 0);
  }

  /* ================= C. FENCE & KÝ TỰ ĐẶC BIỆT (synthetic) ================= */
  section("C. Fence an toàn & ký tự đặc biệt");
  const crazyRaw = {
    uuid: "syn-crazy-0001", name: "Test ```fence``` [và] <thẻ> 🍀 日本語",
    summary: "", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-02T00:00:00Z",
    account: { uuid: "acc-1" },
    chat_messages: [
      { uuid: "m1", sender: "human", text: "x", created_at: "2026-01-01T00:00:00Z", updated_at: "", attachments: [], files: [], parent_message_uuid: "0",
        content: [{ type: "text", text: "Code:\n```js\nlet a=1;\n```\nvà nested:\n````\n```\ninner\n```\n````\nxong </details> <b>bold</b> 🍀 テスト", citations: [] }] },
      { uuid: "m2", sender: "assistant", text: "y", created_at: "2026-01-01T00:01:00Z", updated_at: "", attachments: [], files: [], parent_message_uuid: "m1",
        content: [
          { type: "thinking", thinking: "Suy nghĩ có ```code``` và </details> bên trong", summaries: [{ summary: "tóm ` tắt" }] },
          { type: "tool_use", name: "visualize:show_widget", id: "t1", input: { title: "w", widget_code: "<div>``` ` ````` x</div>", loading_messages: [] } },
          { type: "tool_result", tool_use_id: "t1", name: "visualize:show_widget", content: [{ type: "text", text: "OK" }] },
        ] },
    ],
  };
  const crazy = (await W.Loader._normalizeConversations([crazyRaw]))[0];
  {
    const md = EX.build("conv", crazy, ALLOPTS);
    check("C-build-crazy", md.length > 0);
    check("C-lossless-crazy", losslessCheck(md, crazyRaw));
    check("C-crazy-text", md.indexOf("````\n```\ninner\n```\n````") >= 0 || md.indexOf("inner") >= 0);
    check("C-crazy-thinking", md.indexOf("Suy nghĩ có ```code```") >= 0);
    check("C-crazy-widget", md.indexOf("<div>``` ` ````` x</div>") >= 0);
    // fence của widget phải dài hơn run dài nhất (5) → 6 backticks
    check("C-fence-longer", /``````+html/.test(md));
  }
  // filename từ tên lạ
  check("C-fname-crazy", /^[a-z0-9\-_.]+\.md$/.test(EX.suggestFilename("conv", crazy)), EX.suggestFilename("conv", crazy));
  check("C-fname-empty", /^[a-z0-9\-_.]+\.md$/.test(EX.suggestFilename("conv", { name: "", uuid: "" })));
  check("C-fname-vn", EX.suggestFilename("conv", { name: "Xin chào ĐÂY là Tiếng Việt!", uuid: "abcdef123456" }).indexOf("xin-chao-day-la-tieng-viet") === 0);

  /* ================= D. EDGE CASES ================= */
  section("D. Edge cases dữ liệu bất thường");
  // D1: 0 tin nhắn (có sẵn trong dữ liệu thật: các "(Không tiêu đề)")
  const empty = convs.find(c => c.messages.length === 0);
  if (empty) {
    const md = EX.build("conv", empty, ALLOPTS);
    check("D-empty-build", md.indexOf("Số tin nhắn:** 0") >= 0);
    check("D-empty-lossless", losslessCheck(md, empty.raw));
    check("D-empty-coverage100", EX.coverage("conv", empty, ALLOPTS) === 100);
  } else check("D-empty-exists", false, "không tìm thấy hội thoại 0 tin nhắn");
  // D2-D6: synthetic bất thường
  const weirdRaw = {
    uuid: "syn-weird-0002", name: null, summary: null, created_at: "x-invalid-date", updated_at: null, account: null,
    chat_messages: [
      { uuid: "w1", sender: "human", text: "chỉ có text fallback, content rỗng", created_at: "", updated_at: "", parent_message_uuid: null,
        attachments: [{ file_name: "tai-lieu.pdf", extracted_content: "NỘI DUNG PDF TRÍCH XUẤT" }],
        files: [{ file_name: "anh.png" }], content: [] },
      { uuid: "w2", sender: "assistant", text: "", created_at: "", updated_at: "", parent_message_uuid: "w1", attachments: [], files: [],
        content: [
          { type: "tool_result", tool_use_id: "orphan", name: "orphan_tool", content: [{ type: "text", text: "kết quả mồ côi" }], is_error: true },
          { type: "tool_use", name: "no_result_tool", id: "nr1", input: { foo: "bar" } },
          { type: "mystery_block", data: "loại khối chưa biết" },
          { type: "text", text: "", citations: [{ uuid: "c1" }] },
          { type: "thinking", thinking: "", summaries: [] },
        ] },
    ],
  };
  const weird = (await W.Loader._normalizeConversations([weirdRaw]))[0];
  {
    let md = null, threw = false;
    try { md = EX.build("conv", weird, ALLOPTS); } catch (e) { threw = true; }
    check("D-weird-noCrash", !threw);
    if (md) {
      check("D-weird-lossless", losslessCheck(md, weirdRaw));
      check("D-weird-fallbackText", md.indexOf("chỉ có text fallback, content rỗng") >= 0);
      check("D-weird-attachment", md.indexOf("NỘI DUNG PDF TRÍCH XUẤT") >= 0);
      check("D-weird-files", md.indexOf("anh.png") >= 0);
      check("D-weird-noResultTool", md.indexOf("no_result_tool") >= 0 && md.indexOf('"foo": "bar"') >= 0);
    }
    // opts thiếu / null
    let ok = true;
    try { EX.build("conv", weird, null); EX.build("conv", weird, {}); } catch (e) { ok = false; }
    check("D-null-opts", ok);
  }

  /* ================= E. COVERAGE ================= */
  section("E. Coverage %");
  for (const c of [convs[0], biggest, small, crazy]) {
    check("E-raw100", EX.coverage("conv", c, ALLOPTS) === 100);
    const chain = [
      { aiHeader: 1, text: 1 },
      { aiHeader: 1, text: 1, artifacts: 1, ask: 1 },
      { aiHeader: 1, text: 1, artifacts: 1, ask: 1, thinking: 1 },
      { aiHeader: 1, text: 1, artifacts: 1, ask: 1, thinking: 1, websearch: 1 },
      FRIENDLY,
    ];
    let prev = -1, mono = true;
    for (const o of chain) {
      const v = EX.coverage("conv", c, o);
      if (v < prev) mono = false;
      if (v < 0 || v > 100) mono = false;
      prev = v;
    }
    check(`E-monotonic(${(c.name || "syn").slice(0, 18)})`, mono);
  }
  check("E-proj-100", EX.coverage("proj", d.projects[0], ALLOPTS) === 100);
  check("E-users-100", EX.coverage("users", d.users, ALLOPTS) === 100);

  /* ================= F. FILENAME ================= */
  section("F. Filename");
  for (const c of convs) {
    const fn = EX.suggestFilename("conv", c);
    check("F-conv", /^[a-z0-9\-_.]+\.md$/.test(fn) && fn.indexOf(String(c.uuid).slice(0, 8)) >= 0, fn);
  }
  check("F-proj", EX.suggestFilename("proj", d.projects[0]).indexOf("project-") === 0);
  check("F-users", EX.suggestFilename("users", d.users) === "account.md");

  /* ================= G. HIỆU NĂNG ================= */
  section("G. Hiệu năng (hội thoại lớn nhất: " + (JSON.stringify(biggest.raw).length / 1024).toFixed(0) + " KB raw)");
  {
    let t = Date.now(); EX.build("conv", biggest, ALLOPTS); const tBuild = Date.now() - t;
    t = Date.now(); EX.coverage("conv", biggest, FRIENDLY); const tCov = Date.now() - t;
    console.log(`  build: ${tBuild}ms · coverage: ${tCov}ms`);
    check("G-build<300ms", tBuild < 300, tBuild + "ms");
    check("G-coverage<300ms", tCov < 300, tCov + "ms");
  }

  /* ================= H. PARITY THU GỌN (đồng bộ web UI, phương án b) ================= */
  section("H. Parity thu gọn trong .md");
  {
    const mdBig = EX.build("conv", biggest, FRIENDLY);
    check("H-websearch-details-closed", /<details><summary>Tìm web:/.test(mdBig) && !/<details open><summary>Tìm web:/.test(mdBig));
    check("H-thinking-details-closed", /<details><summary>Suy luận/.test(mdBig));
    const mdArt = EX.build("conv", small, FRIENDLY);
    check("H-artifact-open", /<details open><summary>Artifact:/.test(mdArt));
    const compound = convs.find(c => norm(c.name).indexOf("compound") >= 0);
    const mdW = EX.build("conv", compound, FRIENDLY);
    check("H-widget-closed", /<details><summary>Widget:/.test(mdW) && !/<details open><summary>Widget:/.test(mdW));
    check("H-tool-closed", /<details><summary>Công cụ:/.test(mdW));
    const askConv = convs.find(c => c.messages.some(m => m.blocks.some(b => b.type === "tool_use" && b.name === "ask_user_input_v0")));
    check("H-ask-open", /<details open><summary>Câu hỏi cho người dùng/.test(EX.build("conv", askConv, FRIENDLY)));
    // mọi <details> đều được đóng thẻ đầy đủ
    // đếm thẻ THẬT (đầu dòng) — bỏ qua chữ `<details>` được nhắc trong ghi chú AI
    [mdBig, mdArt, mdW].forEach((m, i) =>
      check("H-balanced-" + i, (m.match(/^<details/gm) || []).length === (m.match(/^<\/details>/gm) || []).length));
    // rawJson vẫn lossless sau khi đổi cấu trúc details
    check("H-lossless-after-details", losslessCheck(EX.build("conv", compound, ALLOPTS), compound.raw));
  }

  /* ================= TỔNG KẾT ================= */
  console.log("\n" + "=".repeat(60));
  console.log(`KẾT QUẢ: ${pass} PASS · ${fail} FAIL · tổng ${pass + fail} kiểm tra · ${Date.now() - t0}ms`);
  if (fail) { console.log("CÁC MỤC FAIL:"); failures.slice(0, 30).forEach(f => console.log("  ✗ " + f)); process.exit(1); }
  console.log("✅ TẤT CẢ PASS");
})().catch(e => { console.error("❌ SUITE LỖI:", e); process.exit(1); });
