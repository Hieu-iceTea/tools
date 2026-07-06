/*
 * zip.js — Tạo file .zip thuần JavaScript (KHÔNG thư viện ngoài)
 * Tác giả: Hiếu iceTea 🍀
 * Hỗ trợ bởi: Claude (Claude Code, model Claude Opus 4.8)
 *
 * - Nén DEFLATE qua CompressionStream('deflate-raw') — API có sẵn của trình duyệt
 *   (Chrome/Edge/Firefox mới). Không hỗ trợ → fallback STORE (không nén, zip vẫn hợp lệ).
 * - CRC-32 tự cài (bảng tra chuẩn). Tên file bật cờ UTF-8 (bit 11) → tiếng Việt không lỗi.
 * - Không ZIP64: đủ dùng cho < 4GB và < 65.000 file (có kiểm tra chặn).
 */
(function () {
  "use strict";

  /* ---- CRC-32 (bảng tra chuẩn IEEE) ---- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function toU8(data) {
    if (data instanceof Uint8Array) return data;
    return new TextEncoder().encode(String(data == null ? "" : data));
  }

  // Giờ/ngày định dạng DOS (zip yêu cầu)
  function dosDateTime(d) {
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
    var date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time: time, date: date };
  }

  var canDeflate = typeof CompressionStream === "function";
  async function deflateRaw(u8) {
    var cs = new CompressionStream("deflate-raw");
    var stream = new Blob([u8]).stream().pipeThrough(cs);
    var buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  function writeU16(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF); }
  function writeU32(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); }

  /*
   * build(files, onProgress?) → Blob "application/zip"
   *   files: [{ name: "ten-file.md", data: string | Uint8Array }]
   *   onProgress(i, total, name): gọi sau khi đóng gói xong từng file
   */
  async function build(files, onProgress) {
    if (files.length > 65000) throw new Error("Quá nhiều file cho định dạng zip thường (>65.000).");
    var dt = dosDateTime(new Date());
    var chunks = [];   // dữ liệu zip theo thứ tự
    var central = [];  // byte của central directory
    var offset = 0;

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var nameU8 = new TextEncoder().encode(f.name);
      var raw = toU8(f.data);
      var crc = crc32(raw);
      var method = 0, packed = raw; // mặc định STORE
      if (canDeflate) {
        try {
          var d = await deflateRaw(raw);
          if (d.length < raw.length) { method = 8; packed = d; } // chỉ nén khi thật sự nhỏ hơn
        } catch (e) { /* giữ STORE */ }
      }

      // Local File Header
      var h = [];
      writeU32(h, 0x04034b50); writeU16(h, 20); writeU16(h, 0x0800); // version 2.0 + cờ UTF-8
      writeU16(h, method); writeU16(h, dt.time); writeU16(h, dt.date);
      writeU32(h, crc); writeU32(h, packed.length); writeU32(h, raw.length);
      writeU16(h, nameU8.length); writeU16(h, 0);
      chunks.push(new Uint8Array(h), nameU8, packed);

      // Central directory entry
      writeU32(central, 0x02014b50); writeU16(central, 20); writeU16(central, 20); writeU16(central, 0x0800);
      writeU16(central, method); writeU16(central, dt.time); writeU16(central, dt.date);
      writeU32(central, crc); writeU32(central, packed.length); writeU32(central, raw.length);
      writeU16(central, nameU8.length); writeU16(central, 0); writeU16(central, 0);
      writeU16(central, 0); writeU16(central, 0); writeU32(central, 0);
      writeU32(central, offset);
      for (var b = 0; b < nameU8.length; b++) central.push(nameU8[b]);

      offset += h.length + nameU8.length + packed.length;
      if (onProgress) onProgress(i + 1, files.length, f.name);
    }

    // End Of Central Directory
    var centralU8 = new Uint8Array(central);
    var end = [];
    writeU32(end, 0x06054b50); writeU16(end, 0); writeU16(end, 0);
    writeU16(end, files.length); writeU16(end, files.length);
    writeU32(end, centralU8.length); writeU32(end, offset);
    writeU16(end, 0);
    chunks.push(centralU8, new Uint8Array(end));
    return new Blob(chunks, { type: "application/zip" });
  }

  window.Zip = { build: build, _crc32: crc32, _canDeflate: canDeflate };
})();
