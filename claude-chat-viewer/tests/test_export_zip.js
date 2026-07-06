// ============================================================================
// TEST "XUẤT TẤT CẢ (.zip)" — Claude Chat Viewer
// Tác giả: Hiếu iceTea 🍀
// Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
//
// Cách chạy:  node tests/test_export_zip.js <thư-mục-export-đã-giải-nén>
//
// Kiểm tra: dựng gói zip y như nút "Xuất tất cả" → GIẢI NÉN BẰNG CÔNG CỤ ĐỘC LẬP
// (unzip -t + python zipfile) → so nội dung TỪNG file khớp tuyệt đối bản build;
// INDEX.md đủ mục; nhánh fallback STORE (không CompressionStream) cũng hợp lệ.
// ============================================================================
const fs = require("fs"), path = require("path"), vm = require("vm"), os = require("os");
const { execSync } = require("child_process");
const J = path.join(__dirname, "..", "js");

const DATA = process.argv[2];
if (!DATA || !fs.existsSync(path.join(DATA, "conversations.json"))) {
  console.error("Cách dùng:  node tests/test_export_zip.js <thư-mục-export-đã-giải-nén>");
  process.exit(2);
}

function makeSandbox(withCompression) {
  const sb = { window: {}, document: { createTreeWalker: () => ({ nextNode: () => false }) },
    NodeFilter: { SHOW_TEXT: 4 }, setTimeout, clearTimeout, console, URL, Date,
    TextEncoder, Blob, Response };
  if (withCompression) sb.CompressionStream = CompressionStream;
  sb.window.document = sb.document; vm.createContext(sb);
  for (const f of ["config.js", "markdown.js", "loader.js", "exporter.js", "zip.js"])
    vm.runInContext(fs.readFileSync(path.join(J, f), "utf8"), sb, { filename: f });
  return sb.window;
}

let pass = 0, fail = 0;
const check = (id, c, note) => { c ? pass++ : (fail++, console.log("  ✗ FAIL:", id, note || "")); };

async function buildAllFiles(W, d, opts) {
  // giống hệt logic doExportAll trong ui.js
  const files = [], indexRows = [], projRows = [];
  let accountFile = null;
  for (const cv of d.conversations) {
    const fn = "conversations/" + W.Exporter.suggestFilename("conv", cv);
    files.push({ name: fn, data: W.Exporter.build("conv", cv, opts) });
    indexRows.push({ name: cv.name, file: fn, updated: cv.updated, count: cv.messages.length });
  }
  for (const pj of d.projects) {
    const fnP = "projects/" + W.Exporter.suggestFilename("proj", pj);
    files.push({ name: fnP, data: W.Exporter.build("proj", pj, opts) });
    projRows.push({ name: pj.name || "(Dự án)", file: fnP, updated: pj.updated_at, docs: (pj.docs || []).length });
  }
  accountFile = W.Exporter.suggestFilename("users", d.users);
  files.push({ name: accountFile, data: W.Exporter.build("users", d.users, opts) });
  files.unshift({ name: "INDEX.md", data: W.Exporter.buildIndex(indexRows, projRows, accountFile) });
  return files;
}

async function roundtrip(label, W, files) {
  const blob = await W.Zip.build(files);
  const buf = Buffer.from(await blob.arrayBuffer());
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ccv-zip-"));
  const zipPath = path.join(tmp, "out.zip");
  fs.writeFileSync(zipPath, buf);

  // 1) unzip -t: kiểm tra CRC toàn bộ bằng công cụ hệ thống
  let unzipOK = true;
  try { execSync(`unzip -t "${zipPath}"`, { stdio: "pipe" }); } catch (e) { unzipOK = false; }
  check(`${label}: unzip -t (CRC hợp lệ)`, unzipOK);

  // 2) python zipfile: giải nén rồi so từng file
  const outDir = path.join(tmp, "out");
  execSync(`python3 -c "import zipfile,sys; zipfile.ZipFile('${zipPath}').extractall('${outDir}')"`);
  const extracted = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d)) {
      const fp = path.join(d, e), r = rel ? rel + "/" + e : e;
      if (fs.statSync(fp).isDirectory()) walk(fp, r); else extracted.push(r);
    }
  })(outDir, "");
  check(`${label}: đủ số file (${files.length})`, extracted.length === files.length,
    `giải nén được ${extracted.length}`);
  let allEqual = true;
  for (const f of files) {
    const got = fs.readFileSync(path.join(outDir, f.name), "utf8");
    if (got !== String(f.data)) { allEqual = false; check(`${label}: nội dung ${f.name}`, false); }
  }
  check(`${label}: nội dung TỪNG file khớp tuyệt đối`, allEqual);
  return { size: buf.length };
}

(async () => {
  const t0 = Date.now();
  const reader = { root: "d",
    async readText(p) { return fs.readFileSync(path.join(DATA, p), "utf8"); },
    async listDir(p) { return fs.readdirSync(path.join(DATA, p)); } };

  // ===== nhánh DEFLATE (CompressionStream) =====
  const W1 = makeSandbox(true);
  check("zip: hỗ trợ deflate", W1.Zip._canDeflate === true);
  const d1 = await W1.Loader.load(reader, () => {});
  const DEF = {}; W1.APP_CONFIG.exportOptions.forEach(o => DEF[o.key] = !!o.def);
  const ALL = { aiHeader: 1, text: 1, artifacts: 1, ask: 1, thinking: 1, websearch: 1, tools: 1, meta: 1, rawJson: 1 };

  const filesDef = await buildAllFiles(W1, d1, DEF);
  const r1 = await roundtrip("deflate+DEF", W1, filesDef);
  const filesAll = await buildAllFiles(W1, d1, ALL);
  const r2 = await roundtrip("deflate+ALL(100%)", W1, filesAll);
  console.log(`  (kích thước zip: DEF ${(r1.size / 1024).toFixed(0)}KB · ALL ${(r2.size / 1024).toFixed(0)}KB)`);

  // Cấu trúc thư mục tiếng Anh theo 2 tab
  check("Cấu trúc: mọi hội thoại nằm trong conversations/",
    filesDef.filter(f => f.name.startsWith("conversations/")).length === d1.conversations.length);
  check("Cấu trúc: dự án nằm trong projects/ với prefix project-",
    filesDef.filter(f => f.name.startsWith("projects/project-")).length === d1.projects.length);
  check("Cấu trúc: tài khoản là account.md ở gốc",
    filesDef.some(f => f.name === "account.md"));
  check("Cấu trúc: INDEX.md ở gốc", filesDef.some(f => f.name === "INDEX.md"));

  // INDEX.md đủ mục
  const idx = String(filesDef[0].data);
  let idxOK = true;
  for (const cv of d1.conversations) {
    const fn = "conversations/" + W1.Exporter.suggestFilename("conv", cv);
    if (idx.indexOf(fn) < 0) idxOK = false;
  }
  check("INDEX.md: liệt kê đủ mọi hội thoại (tên file)", idxOK);
  check("INDEX.md: có BẢNG hội thoại", idx.indexOf("| # | Hội thoại |") >= 0 && idx.indexOf("## Hội thoại (") >= 0);
  check("INDEX.md: có BẢNG dự án (tên · cập nhật · số tài liệu)",
    idx.indexOf("| # | Dự án | Cập nhật | Tài liệu | File |") >= 0 && idx.indexOf("## Dự án (") >= 0);
  check("INDEX.md: bảng dự án đủ mọi dự án",
    d1.projects.every(pj => idx.indexOf("projects/" + W1.Exporter.suggestFilename("proj", pj)) >= 0));
  check("INDEX.md: có mục tài khoản trỏ account.md",
    idx.indexOf("## Tài khoản") >= 0 && idx.indexOf("(./account.md)") >= 0);

  // Tên file trong zip là duy nhất (kể cả hội thoại trùng tên)
  const nameSet = new Set(filesDef.map(f => f.name));
  check("Tên file trong zip duy nhất", nameSet.size === filesDef.length);

  // coverageMany: rawJson → 100
  const list = d1.conversations.map(cv => ({ kind: "conv", item: cv }));
  check("coverageMany: rawJson → 100%", W1.Exporter.coverageMany(list, ALL) === 100);
  const cm = W1.Exporter.coverageMany(list, DEF);
  check("coverageMany: DEF trong [0,100]", cm >= 0 && cm <= 100, cm + "%");

  // ===== nhánh FALLBACK STORE (không CompressionStream) =====
  const W2 = makeSandbox(false);
  check("zip fallback: không deflate", W2.Zip._canDeflate === false);
  const d2 = await W2.Loader.load(reader, () => {});
  const filesStore = await buildAllFiles(W2, d2, DEF);
  const r3 = await roundtrip("STORE-fallback", W2, filesStore);
  console.log(`  (kích thước zip STORE: ${(r3.size / 1024).toFixed(0)}KB — to hơn deflate là đúng)`);

  console.log("\n" + "=".repeat(60));
  console.log(`KẾT QUẢ ZIP: ${pass} PASS · ${fail} FAIL · ${Date.now() - t0}ms`);
  if (fail) process.exit(1);
  console.log("✅ TẤT CẢ PASS");
})().catch(e => { console.error("❌ SUITE LỖI:", e); process.exit(1); });
