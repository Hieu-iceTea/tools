// ============================================================================
// TEST TƯƠNG THÍCH MÔI TRƯỜNG — Claude Chat Viewer
// Tác giả: Hiếu iceTea 🍀
// Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
//
// Cách chạy:  node tests/test_env_compat.js <thư-mục-export-đã-giải-nén>
//
// Mô phỏng khác biệt giữa các môi trường triển khai:
//   A. Tài nguyên: đường dẫn TƯƠNG ĐỐI (sống được ở subpath GitHub Pages) + tồn tại
//      đúng CHỮ HOA/THƯỜNG (Pages chạy Linux case-sensitive) + không file "_" (Jekyll).
//   B. Guard API: showDirectoryPicker / CompressionStream / clipboard đều có fallback.
//   C. URL-sync ?c=/?p= trên 3 môi trường: GitHub Pages (https subpath), localhost,
//      và file:// (nơi replaceState NÉM SecurityError — app không được crash).
//   D. Đường nạp dữ liệu FALLBACK webkitdirectory (Firefox/Safari) cho kết quả
//      GIỐNG HỆT đường File System Access API.
// ============================================================================
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const J = path.join(ROOT, "js");

const DATA = process.argv[2];
if (!DATA || !fs.existsSync(path.join(DATA, "conversations.json"))) {
  console.error("Cách dùng:  node tests/test_env_compat.js <thư-mục-export-đã-giải-nén>");
  process.exit(2);
}

let pass = 0, fail = 0;
const check = (id, c, note) => { c ? pass++ : (fail++, console.log("  ✗ FAIL:", id, note || "")); };
const section = t => console.log("\n■ " + t);

/* ================= A. TÀI NGUYÊN TĨNH ================= */
section("A. Tài nguyên tĩnh (subpath Pages, case-sensitive, Jekyll)");
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  // chỉ xét TÀI NGUYÊN nạp vào trang (script src / link href) — không xét <a> điều hướng
  const res = [];
  (html.match(/<script[^>]+src="([^"]+)"/g) || []).forEach(m => res.push(m.match(/src="([^"]+)"/)[1]));
  (html.match(/<link[^>]+href="([^"]+)"/g) || []).forEach(m => res.push(m.match(/href="([^"]+)"/)[1]));
  check("A1. có tài nguyên để kiểm", res.length >= 9, "thấy " + res.length);
  const absolute = res.filter(r => r.startsWith("/") || /^https?:/i.test(r));
  check("A2. KHÔNG tài nguyên đường dẫn tuyệt đối/CDN (sống được ở subpath, offline)",
    absolute.length === 0, absolute.join(", "));
  // tồn tại đúng case trên đĩa (mô phỏng Linux case-sensitive)
  let caseOK = true;
  for (const r of res) {
    const parts = r.split("/");
    let dir = ROOT, ok = true;
    for (const seg of parts) {
      const listing = fs.readdirSync(dir);
      if (!listing.includes(seg)) { ok = false; break; } // .includes = so sánh CASE-SENSITIVE
      dir = path.join(dir, seg);
    }
    if (!ok) { caseOK = false; check("A3-file", false, r); }
  }
  check("A3. mọi tài nguyên tồn tại ĐÚNG chữ hoa/thường", caseOK);
  // Jekyll (GitHub Pages) bỏ qua file/thư mục bắt đầu "_"
  const underscore = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d)) {
      if (e === ".DS_Store") continue;
      if (e.startsWith("_")) underscore.push(path.relative(ROOT, path.join(d, e)));
      const p = path.join(d, e);
      if (fs.statSync(p).isDirectory()) walk(p);
    }
  })(ROOT);
  check("A4. không file/thư mục bắt đầu '_' (Jekyll sẽ ẩn trên Pages)", underscore.length === 0,
    underscore.join(", "));
}

/* ================= B. GUARD API (đọc mã nguồn) ================= */
section("B. Guard API có fallback");
{
  const app = fs.readFileSync(path.join(J, "app.js"), "utf8");
  const zip = fs.readFileSync(path.join(J, "zip.js"), "utf8");
  const md = fs.readFileSync(path.join(J, "markdown.js"), "utf8");
  const ui = fs.readFileSync(path.join(J, "ui.js"), "utf8");
  check("B1. showDirectoryPicker được dò bằng typeof (không gọi bừa)",
    app.indexOf('typeof window.showDirectoryPicker === "function"') >= 0);
  check("B2. có nhánh fallback webkitdirectory (triggerFileInput)",
    app.indexOf("triggerFileInput") >= 0);
  check("B3. CompressionStream dò bằng typeof + fallback STORE",
    zip.indexOf('typeof CompressionStream === "function"') >= 0);
  check("B4. clipboard có dự phòng execCommand", md.indexOf("execCommand") >= 0);
  check("B5. syncUrl bọc try/catch (file:// ném SecurityError)",
    /function syncUrl[\s\S]{0,200}try \{/.test(ui));
}

/* ================= HARNESS UI (DOM giả lập tối thiểu) ================= */
function mk(tag) {
  const n = { tagName: tag, id: "", _cls: new Set(), attrs: {}, children: [], _t: "", _h: "",
    hidden: false, value: "", placeholder: "", title: "", checked: false, style: {},
    classList: { add(c) { n._cls.add(c); }, remove(c) { n._cls.delete(c); },
      toggle(c, f) { if (f === undefined) f = !n._cls.has(c); f ? n._cls.add(c) : n._cls.delete(c); return f; },
      contains(c) { return n._cls.has(c); } },
    set className(v) { n._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get className() { return [...n._cls].join(" "); },
    set textContent(v) { n._t = String(v); }, get textContent() { return n._t; },
    set innerHTML(v) { n._h = String(v); }, get innerHTML() { return n._h; },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return k in n.attrs ? n.attrs[k] : null; },
    appendChild(c) { if (c && c.tagName === "#fragment") { c.children.forEach(x => n.children.push(x)); } else n.children.push(c); return c; },
    addEventListener() {}, click() {},
    querySelector() { return mk("q"); }, querySelectorAll() { return []; } };
  return n;
}
function makeEnv(href, replaceStateImpl) {
  const ids = {};
  ["loading","loadStatus","loadBar","loadExtra","loadElapsed","loadEta","onboarding","obTitle","obDesc","obError",
   "btnChoose","dirInput","app","side","rootName","tabConv","tabProj","q","qClear","list","main",
   "btnSettings","settings","setRoot","setSize","setAccount","setPhone","setCounts","setRawWrap",
   "exportModal","exTitle","exOptions","exCoverage","exCovFill","exFilename","exDownload","exClose",
   "exPresetFull","exPresetAI","btnExportUsers","btnExportAll","btnCloseSettings","btnChange","btnClear",
   "themeToggle","brand"].forEach(i => { ids[i] = mk("div"); ids[i].id = i; });
  let toastEl = null, msgNode = mk("span");
  const sideFoot = mk("div"); // chữ ký cuối sidebar (hiệu ứng trượt lên sau 3s)
  const replaceCalls = [];
  const document = {
    getElementById(id) { if (id === "toast") return toastEl; return ids[id] || null; },
    createElement(t) { const n = mk(t); n.querySelector = sel => (sel === ".toast-msg" ? msgNode : mk("q")); return n; },
    createDocumentFragment: () => mk("#fragment"),
    createTreeWalker: () => ({ nextNode: () => false }),
    documentElement: { setAttribute() {} },
    body: { appendChild(n) { if (String(n._h).indexOf("toast-msg") >= 0) toastEl = n; return n; } },
    querySelector(sel) { return sel === "#app .side-foot" ? sideFoot : null; },
    querySelectorAll() { return []; }, addEventListener() {}, readyState: "complete",
  };
  const history = { replaceState: replaceStateImpl || function (s, t, url) { replaceCalls.push(url); } };
  const window = { document, location: { href: href }, history, open() {} };
  const sb = { window, document, history, location: window.location, URL, NodeFilter: { SHOW_TEXT: 4 },
    setTimeout: f => (f(), 0), clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    navigator: {}, console, Date, TextEncoder, Blob, Response };
  vm.createContext(sb);
  for (const f of ["config.js", "icons.js", "markdown.js", "blocks.js", "storage.js", "loader.js", "exporter.js", "zip.js", "ui.js"])
    vm.runInContext(fs.readFileSync(path.join(J, f), "utf8"), sb, { filename: f });
  return { W: sb.window, ids, sideFoot, replaceCalls, getToast: () => toastEl && msgNode.textContent };
}

(async () => {
  // nạp dữ liệu thật một lần (reader đĩa)
  const diskReader = { root: path.basename(DATA),
    async readText(p) { return fs.readFileSync(path.join(DATA, p), "utf8"); },
    async listDir(p) { return fs.readdirSync(path.join(DATA, p)).filter(x => x !== ".DS_Store"); } };

  /* ================= C. URL-SYNC THEO 3 MÔI TRƯỜNG ================= */
  section("C. URL ?c=/?p= trên GitHub Pages / localhost / file://");
  const someUuid = (() => {
    const d = JSON.parse(fs.readFileSync(path.join(DATA, "conversations.json"), "utf8"));
    d.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return d[0].uuid;
  })();

  const ENVS = [
    { name: "GitHub Pages (subpath)", href: "https://tools.hieu-icetea.io.vn/claude-chat-viewer/", throws: false },
    { name: "localhost", href: "http://localhost:3000/claude-chat-viewer/", throws: false },
    { name: "file://", href: "file:///Users/x/tools/claude-chat-viewer/index.html", throws: true },
  ];
  for (const env of ENVS) {
    // ---- param HỢP LỆ: mở đúng hội thoại, không đụng replaceState ----
    {
      const impl = env.throws ? function () { throw new Error("SecurityError (mô phỏng file://)"); } : undefined;
      const E = makeEnv(env.href + "?c=" + someUuid, impl);
      const d = await E.W.Loader.load(diskReader, () => {});
      E.W.UI.init({});
      E.W.UI.setData(d);
      let crashed = false;
      try { E.W.UI.showApp(); } catch (e) { crashed = true; }
      check(`C[${env.name}] param hợp lệ: không crash`, !crashed);
      check(`C[${env.name}] mở đúng hội thoại`, E.ids.main.getAttribute("data-view-key") === "conv:" + someUuid);
      check(`C[${env.name}] không có toast lỗi`, !E.getToast());
      // hiệu ứng chữ ký: sau timer (shim setTimeout chạy đồng bộ) side-foot phải có .credit-in
      check(`C[${env.name}] chữ ký sidebar nhận class credit-in sau timer`,
        E.sideFoot.classList.contains("credit-in"));
    }
    // ---- param SAI: toast + gỡ param (hoặc nuốt lỗi êm trên file://) ----
    {
      const calls = [];
      const impl = env.throws
        ? function () { throw new Error("SecurityError (mô phỏng file://)"); }
        : function (s, t, url) { calls.push(url); };
      const E = makeEnv(env.href + "?c=khong-ton-tai-999", impl);
      const d = await E.W.Loader.load(diskReader, () => {});
      E.W.UI.init({});
      E.W.UI.setData(d);
      let crashed = false;
      try { E.W.UI.showApp(); } catch (e) { crashed = true; }
      check(`C[${env.name}] param sai: không crash (kể cả replaceState ném lỗi)`, !crashed);
      check(`C[${env.name}] param sai: có toast thân thiện`,
        String(E.getToast() || "").indexOf("Không tìm thấy") >= 0);
      if (!env.throws) {
        const last = calls[calls.length - 1] || "";
        check(`C[${env.name}] gỡ param nhưng GIỮ NGUYÊN subpath`,
          last.indexOf(env.href) === 0 && last.indexOf("c=") < 0, last);
      }
    }
  }

  // ---- cấu hình creditDelaySec (hiệu ứng chữ ký sidebar) ----
  {
    const E0 = makeEnv("http://localhost:3000/claude-chat-viewer/");
    const d0 = await E0.W.Loader.load(diskReader, () => {});
    E0.W.APP_CONFIG.creditDelaySec = 0; // 0 = hiện ngay, không hoạt ảnh
    E0.W.UI.init({}); E0.W.UI.setData(d0); E0.W.UI.showApp();
    check("C[config] creditDelaySec=0 → chữ ký hiện ngay (credit-in)",
      E0.sideFoot.classList.contains("credit-in"));
    check("C[config] creditDelaySec=0 → tắt hoạt ảnh (credit-now)",
      E0.sideFoot.classList.contains("credit-now"));

    const E1 = makeEnv("http://localhost:3000/claude-chat-viewer/");
    const d1 = await E1.W.Loader.load(diskReader, () => {});
    E1.W.APP_CONFIG.creditDelaySec = "sai kiểu"; // giá trị hỏng → về mặc định 3s, không crash
    E1.W.UI.init({}); E1.W.UI.setData(d1);
    let crashedBad = false;
    try { E1.W.UI.showApp(); } catch (e) { crashedBad = true; }
    check("C[config] creditDelaySec sai kiểu → không crash, về mặc định trễ (có hoạt ảnh)",
      !crashedBad && E1.sideFoot.classList.contains("credit-in") &&
      !E1.sideFoot.classList.contains("credit-now"));
  }

  /* ================= D. FALLBACK webkitdirectory (Firefox/Safari) ================= */
  section("D. Đường nạp fallback FileList (webkitdirectory) ≡ đường FSA");
  {
    // dựng FileList giả từ đĩa thật: {webkitRelativePath, size, text()}
    const rootName = path.basename(DATA);
    const fileList = [];
    (function walk(d, rel) {
      for (const e of fs.readdirSync(d)) {
        if (e === ".DS_Store") continue;
        const p = path.join(d, e), r = rel + "/" + e;
        if (fs.statSync(p).isDirectory()) walk(p, r);
        else fileList.push({ webkitRelativePath: r, name: e, size: fs.statSync(p).size,
          text: async () => fs.readFileSync(p, "utf8") });
      }
    })(DATA, rootName);

    const E = makeEnv("http://localhost/x/", undefined);
    const reader = E.W.Loader.fileListReader(fileList);
    check("D1. root đúng tên thư mục", reader.root === rootName);
    const dFall = await E.W.Loader.load(reader, () => {});
    const dFSA = await E.W.Loader.load(diskReader, () => {});
    check("D2. số hội thoại khớp", dFall.conversations.length === dFSA.conversations.length);
    check("D3. số dự án + users khớp",
      dFall.projects.length === dFSA.projects.length && dFall.users.length === dFSA.users.length);
    check("D4. raw hội thoại đầu khớp TUYỆT ĐỐI",
      JSON.stringify(dFall.conversations[0].raw) === JSON.stringify(dFSA.conversations[0].raw));
    const diskBytes = fileList.reduce((s, f) => s + f.size, 0);
    check("D5. totalSize đo đúng qua FileList", dFall.size && dFall.size.bytes === diskBytes,
      dFall.size && dFall.size.bytes);
    // xuất .md từ dữ liệu nạp kiểu fallback phải y hệt
    const DEFOPTS = {}; E.W.APP_CONFIG.exportOptions.forEach(o => DEFOPTS[o.key] = !!o.def);
    // cùng phút nên "Xuất lúc" trùng; nếu lệch phút hiếm gặp → bỏ dòng đó khi so
    const strip = s => String(s).replace(/- \*\*Xuất lúc:\*\* .*/g, "");
    const md1 = strip(E.W.Exporter.build("conv", dFall.conversations[0], DEFOPTS));
    const md2 = strip(E.W.Exporter.build("conv", dFSA.conversations[0], DEFOPTS));
    check("D6. file .md xuất từ 2 đường nạp GIỐNG HỆT nhau", md1 === md2);
  }

  /* ================= E. TÊN ZIP THEO THƯ MỤC NGUỒN ================= */
  section("E. Tên zip mặc định gắn mã batch nguồn");
  {
    const cases = [
      { root: "data-de04bde3-a16b-4f7a-844d-8a6cff00c12e-1783327971-fd1ca537-batch-0000",
        expect: /^claude-chat-export_de04bde3_\d{4}-\d{2}-\d{2}_\d{4}\.zip$/ },
      { root: "Claude Backup Tháng 7", expect: /^claude-chat-export_claude-backup-thang-7_\d{4}-/ },
      { root: "", expect: /^claude-chat-export_\d{4}-\d{2}-\d{2}_\d{4}\.zip$/ },
    ];
    for (const c of cases) {
      const E = makeEnv("http://localhost/x/", undefined);
      E.W.UI.init({});
      E.W.UI.setData({ root: c.root, conversations: [], projects: [], users: [], size: null });
      const name = E.W.UI._test.defaultZipName();
      check(`E. root="${c.root.slice(0, 28)}…" → ${name}`, c.expect.test(name), name);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`KẾT QUẢ MÔI TRƯỜNG: ${pass} PASS · ${fail} FAIL`);
  if (fail) process.exit(1);
  console.log("✅ TẤT CẢ PASS");
})().catch(e => { console.error("❌ SUITE LỖI:", e); process.exit(1); });
