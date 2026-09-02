// ═══════════════════════════════════════════════════════════════
// 轻量 PDF 文本抽取器（Cloudflare Workers · 零依赖）
// 能力：传统 xref 表解析 → 对象流定位 → FlateDecode 解压（DecompressionStream）
//       → 提取 BT..ET 中 Tj/TJ 文本操作符（含转义与十六进制 <...>）→ 附注关键词定位。
// 边界（诚实标注，PMQD 纪律）：
//   - 仅处理"内嵌文本型"PDF；扫描件（无文本层）返回 no_text_layer，须 OCR/桌面端。
//   - 字体子集化/自定义编码可能乱码；抽取结果只作"附注定位与上下文核对"，
//     不替代 financial-report-analysis 的附注级精读与数字核实。
// ═══════════════════════════════════════════════════════════════

export interface NoteHit {
  keyword: string;
  count: number;
  context: string;
}

export interface PdfTextResult {
  ok: boolean;
  text: string;
  chars: number;
  notes?: NoteHit[];
  error?: string;
}

// 逐字节 latin1 视图（0-255 与字节 1:1 映射，保证偏移一致）
function toLatin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  }
  return s;
}

function findFrom(s: string, needle: string, from = 0): number {
  return s.indexOf(needle, from);
}

// FlateDecode（zlib/RFC1950）解压：DecompressionStream('deflate') 对应 zlib 封装
async function inflate(bytes: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return toLatin1(new Uint8Array(buf));
}

function unescapePdfString(raw: string): string {
  const esc: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
  return raw
    .replace(/\\([nrtbf()\\])/g, (_, c: string) => esc[c] || c)
    .replace(/\\\d{1,3}/g, (m) => String.fromCharCode(parseInt(m.slice(1), 8)))
    .replace(/\\\r?\n/g, '');
}

// 从流内容提取 Tj / TJ 文本（含字面量与十六进制）
function extractTextOps(streamText: string): string {
  const out: string[] = [];
  const re = /(\((?:[^()\\]|\\.)*\)|\[(?:[^\[\]\\]|\\.)*\]|<[0-9A-Fa-f\s]+>)\s*(Tj|TJ)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(streamText)) !== null) {
    const token = m[1];
    const op = m[2];
    if (op === 'Tj') {
      if (token.startsWith('<')) {
        const hex = token.slice(1, -1).replace(/\s+/g, '');
        let s = '';
        for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
        out.push(s);
      } else if (token.startsWith('(')) {
        out.push(unescapePdfString(token.slice(1, -1)));
      }
    } else if (op === 'TJ') {
      const items = token.match(/\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f\s]+>|[-+]?\d+(?:\.\d+)?/g) || [];
      let s = '';
      for (const it of items) {
        if (it.startsWith('(')) s += unescapePdfString(it.slice(1, -1));
        else if (it.startsWith('<')) {
          const hex = it.slice(1, -1).replace(/\s+/g, '');
          for (let i = 0; i + 1 < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
        }
      }
      out.push(s);
    }
  }
  return out.join('');
}

// 主入口：从 PDF 字节抽取内嵌文本
export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextResult> {
  try {
    const raw = toLatin1(bytes);
    const end = findFrom(raw, '%%EOF');
    const startxrefAt = findFrom(raw, 'startxref', Math.max(0, (end > 0 ? end - 2048 : 0)));
    if (startxrefAt < 0) return { ok: false, text: '', chars: 0, error: 'no_startxref: 非标准 PDF' };

    const numMatch = /startxref\s+(\d+)/.exec(raw.slice(startxrefAt, startxrefAt + 64));
    if (!numMatch) return { ok: false, text: '', chars: 0, error: 'bad_startxref' };
    const xrefAt = parseInt(numMatch[1], 10);

    // 跳过 xref stream（/Type /XRef 对象流），只处理传统 xref 表
    const xrefHeader = raw.slice(xrefAt, xrefAt + 32);
    if (xrefHeader.includes('/XRef')) {
      return { ok: false, text: '', chars: 0, error: 'xref_stream_unsupported: 请用桌面端 financial-report-analysis 深度解析' };
    }

    // 解析传统 xref 子表：xref\n<first> <count>\n<10位偏移> <gen> <n|f>...
    const tableMatch = /xref[\s\S]{0,20000}?trailer/.exec(raw.slice(xrefAt, xrefAt + 40000));
    const tableText = tableMatch ? tableMatch[0] : raw.slice(xrefAt, Math.min(xrefAt + 40000, raw.length));
    const entries: number[] = [];
    const entryRe = /^\s*(\d{10})\s+(\d{5})\s+([nf])/gm;
    let em: RegExpExecArray | null;
    while ((em = entryRe.exec(tableText)) !== null) {
      if (em[3] === 'n') entries.push(parseInt(em[1], 10));
    }

    const chunks: string[] = [];
    const cmapTexts: string[] = [];
    for (const off of entries) {
      const head = raw.slice(off, off + 64);
      const om = /^\s*\d+\s+\d+\s+obj/.exec(head);
      if (!om) continue;
      const objEnd = findFrom(raw, 'endobj', off);
      const objText = objEnd > 0 ? raw.slice(off, objEnd) : raw.slice(off, off + 200000);
      const streamAt = findFrom(objText, 'stream');
      if (streamAt < 0) continue;
      let streamStart = streamAt + 6;
      if (objText.charCodeAt(streamStart) === 13) streamStart++; // \r\n
      if (objText.charCodeAt(streamStart) === 10) streamStart++;
      const endstreamAt = findFrom(objText, 'endstream');
      if (endstreamAt < 0) continue;
      // endstream 前的换行（\r\n 或 \n）是流终止标记，不属于数据
      let streamEnd = off + endstreamAt;
      if (streamEnd > off + streamStart && bytes[streamEnd - 1] === 10) streamEnd--;
      if (streamEnd > off + streamStart && bytes[streamEnd - 1] === 13) streamEnd--;
      const streamBytes = bytes.slice(off + streamStart, streamEnd);

      let decoded = '';
      if (/\/Filter\s*\/FlateDecode/.test(objText.slice(0, streamAt))) {
        try { decoded = await inflate(streamBytes); } catch { continue; }
      } else {
        decoded = toLatin1(streamBytes);
      }
      if (/beginbf(char|range)/.test(decoded)) cmapTexts.push(decoded);
      const frag = extractTextOps(decoded);
      if (frag) chunks.push(frag);
    }

    // 中文 CID 字体：用 ToUnicode CMap 翻译（无映射则保留原始字节）
    let text = chunks.join('\n');
    if (cmapTexts.length) {
      const map = new Map<number, string>();
      for (const ct of cmapTexts) for (const [k, v] of parseToUnicodeMap(ct)) map.set(k, v);
      const t = translateCidText(text, map);
      if (t.translated) text = t.text;
    }

    if (!text.trim()) return { ok: true, text: '', chars: 0, error: 'no_text_layer: 扫描件 PDF，须 OCR 或桌面端 extract.py' };
    return { ok: true, text, chars: text.length };
  } catch (e) {
    return { ok: false, text: '', chars: 0, error: `pdf_text_error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// 附注关键词定位：统计命中数 + 首次命中上下文（用于净现金/有息负债等科目核对）
export function findNoteKeywords(text: string, keywords: string[]): NoteHit[] {
  return keywords.map((kw) => {
    let count = 0;
    let idx = -1;
    let from = 0;
    let first = -1;
    while ((idx = text.indexOf(kw, from)) >= 0) {
      if (first < 0) first = idx;
      count++;
      from = idx + kw.length;
    }
    const start = Math.max(0, first - 30);
    const context = first >= 0 ? text.slice(start, first + kw.length + 40).replace(/\s+/g, ' ') : '';
    return { keyword: kw, count, context };
  });
}

// ── 中文支持：ToUnicode CMap（CID 字体 → Unicode）──────────────────
function utf16beToStr(hex: string): string {
  let s = '';
  for (let i = 0; i + 3 < hex.length + 1; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    if (!Number.isNaN(code) && code > 0) s += String.fromCodePoint(code);
  }
  return s;
}

function parseToUnicodeMap(cmapText: string): Map<number, string> {
  const map = new Map<number, string>();
  const pair = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let m: RegExpExecArray | null;
  while ((m = bfcharRe.exec(cmapText)) !== null) {
    let p: RegExpExecArray | null;
    while ((p = pair.exec(m[1])) !== null) map.set(parseInt(p[1], 16), utf16beToStr(p[2]));
  }
  const rangeRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrangeRe.exec(cmapText)) !== null) {
    let r: RegExpExecArray | null;
    while ((r = rangeRe.exec(m[1])) !== null) {
      const lo = parseInt(r[1], 16), hi = parseInt(r[2], 16);
      let dst = parseInt(r[3], 16);
      for (let c = lo; c <= hi; c++) { map.set(c, String.fromCodePoint(dst)); dst++; }
    }
  }
  return map;
}

// 若文本为 2 字节 CID 序列（非 ASCII 居多），用映射表翻译为 Unicode
function translateCidText(text: string, map: Map<number, string>): { text: string; translated: boolean } {
  if (!map.size || !text) return { text, translated: false };
  let nonAscii = 0;
  for (const ch of text) { const c = ch.charCodeAt(0); if (c < 0x20 || c > 0x7e) nonAscii++; }
  if (nonAscii < text.length / 2) return { text, translated: false };
  const buf = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) buf[i] = text.charCodeAt(i) & 0xff;
  let out = '';
  let hit = 0;
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const cid = (buf[i] << 8) | buf[i + 1];
    const u = map.get(cid);
    if (u) { out += u; hit++; } else out += '\uFFFD';
  }
  return { text: out, translated: hit > 0 };
}
