// ═══════════════════════════════════════════════════════════════
// 风林慧策 — 官方披露站抓取 Provider（巨潮/沪深 · 免 token）
// 能力：巨潮资讯网（cninfo）公告搜索 → 报告类型分类 → 最近 N 年年报/季报 PDF 清单
//       → PDF 下载 → pdf-text 附注文本抽取（净现金/有息负债等科目关键词定位）。
// 定位：让网页版在"不连 TDX、不配 token"的情况下也能回填官方披露原始信息。
// 铁律：文本抽取只作附注定位与上下文核对，结构化数字仍需 tushare/tdx 或人工核实；
//       扫描件 PDF 如实返回 no_text_layer，绝不伪造数字。
// ═══════════════════════════════════════════════════════════════

import { extractPdfText, findNoteKeywords } from './pdf-text';

const CNINFO_QUERY = 'https://www.cninfo.com.cn/new/hisAnnouncement/query';
const CNINFO_STATIC = 'https://static.cninfo.com.cn';

// 巨潮 category 常量（深沪两市口径）
const CNINFO_CATEGORY: Record<string, string> = {
  annual: 'category_ndbg_szsh',   // 年度报告
  semi: 'category_bndbg_szsh',    // 半年度报告
  q1: 'category_yjdbg_szsh',      // 一季度报告
  q3: 'category_sjdbg_szsh',      // 三季度报告
};

export interface CninfoAnnouncement {
  title: string;
  date: string;          // YYYY-MM-DD
  pdfUrl: string;        // 完整 static.cninfo.com.cn 地址
  type?: string;         // annual/semi/q1/q3/other
  year?: number;
}

// 从公告标题识别报告类型与年份（排除摘要/英文/取消等干扰项）
export function classifyReportTitle(title: string): { type: string; year?: number; skip: boolean } {
  const t = title.replace(/\s+/g, '');
  if (/摘要|英文|已取消|更正|补充|独立董事|监事会|审计报告|内部控制|社会责任|ESG|关于召开|公告编号/.test(t)) return { type: 'other', skip: true };
  const yearMatch = /(20\d{2})年/.exec(t);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
  if (/年度报告/.test(t)) return { type: 'annual', year, skip: false };
  if (/半年度报告|中期报告/.test(t)) return { type: 'semi', year, skip: false };
  if (/第一季度报告|一季度报告/.test(t)) return { type: 'q1', year, skip: false };
  if (/第三季度报告|三季度报告/.test(t)) return { type: 'q3', year, skip: false };
  return { type: 'other', skip: true };
}

// 巨潮公告搜索（POST hisAnnouncement/query）
export async function searchAnnouncements(
  code: string,
  market: string,
  opts: { searchkey?: string; category?: string; pageSize?: number; pageNum?: number } = {}
): Promise<CninfoAnnouncement[]> {
  const column = market === 'A' ? (code.startsWith('6') ? 'sse' : 'szse') : 'szse';
  const body = new URLSearchParams({
    pageNum: String(opts.pageNum || 1),
    pageSize: String(opts.pageSize || 30),
    column,
    tabName: 'fulltext',
    plate: '',
    stock: code,
    searchkey: opts.searchkey || '',
    secid: '',
    category: opts.category || '',
    trade: '',
    seDate: '',
    sortName: '',
    sortType: '',
    isHLtitle: 'true',
  });
  const r = await fetch(CNINFO_QUERY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (WindForest-L1/1.0)' },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`cninfo query HTTP ${r.status}`);
  const j = (await r.json()) as { announcements?: Array<{ announcementTitle: string; announcementTime: number; adjunctUrl: string }> };
  return (j.announcements || []).map((a) => ({
    title: a.announcementTitle || '',
    date: new Date(a.announcementTime).toISOString().slice(0, 10),
    pdfUrl: `${CNINFO_STATIC}/${a.adjunctUrl}`,
  }));
}

// 最近 N 年（默认 5，最大 10）年报 + 最新季报/半年报 PDF 清单
export async function getReportPdfs(
  code: string,
  market: string,
  opts: { years?: number; reportTypes?: string[] } = {}
): Promise<{ reports: CninfoAnnouncement[]; error?: string }> {
  const n = Math.min(Math.max(opts.years || 5, 1), 10);
  const reportTypes = (opts.reportTypes && opts.reportTypes.length ? opts.reportTypes : ['annual', 'q1', 'semi', 'q3']);
  const want = new Set(reportTypes);
  const found: CninfoAnnouncement[] = [];

  // 逐类搜索（年报+季报/半年报），一次 30 条覆盖近年
  for (const t of want) {
    try {
      const cat = CNINFO_CATEGORY[t];
      const list = await searchAnnouncements(code, market, { category: cat, pageSize: 30 });
      for (const a of list) {
        const cls = classifyReportTitle(a.title);
        if (cls.skip || cls.type !== t) continue;
        const ann: CninfoAnnouncement = { ...a, type: t, year: cls.year };
        if (!found.some((f) => f.pdfUrl === ann.pdfUrl)) found.push(ann);
      }
    } catch (e) {
      return { reports: [], error: `公告搜索失败(${t}): ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  // 按年份筛选：最近 N 个年度报告 + 最新一期季报/半年报
  const annuals = found.filter((f) => f.type === 'annual' && f.year)
    .sort((a, b) => (b.year || 0) - (a.year || 0));
  const picked = annuals.slice(0, n);
  const latestNonAnnual = found.filter((f) => f.type !== 'annual')
    .sort((a, b) => (b.date < a.date ? -1 : 1))[0];
  if (latestNonAnnual) picked.push(latestNonAnnual);

  return { reports: picked.sort((a, b) => (b.year || 0) - (a.year || 0) || (b.date < a.date ? -1 : 1)) };
}

// 默认附注关键词（与技能 report-acquisition.js 的 14 条穿透清单对齐）
export const DEFAULT_NOTE_KEYWORDS = [
  '货币资金', '受限', '交易性金融资产', '其他流动资产', '一年内到期的非流动资产',
  '应收款项融资', '短期借款', '长期借款', '应付债券', '租赁负债',
  '其他权益工具', '应收股利', '关联方', '或有事项', '对外担保',
];

// 下载 PDF 并抽取附注文本（取最新年报；可选指定年份）
export async function downloadAndExtract(
  pdfUrl: string,
  noteKeywords: string[] = DEFAULT_NOTE_KEYWORDS
): Promise<{ text: string; chars: number; notes: ReturnType<typeof findNoteKeywords>; error?: string }> {
  const r = await fetch(pdfUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (WindForest-L1/1.0)' } });
  if (!r.ok) return { text: '', chars: 0, notes: [], error: `PDF 下载失败 HTTP ${r.status}` };
  const buf = new Uint8Array(await r.arrayBuffer());
  const res = await extractPdfText(buf);
  const notes = res.ok ? findNoteKeywords(res.text, noteKeywords) : [];
  return { text: res.text, chars: res.chars, notes, error: res.error };
}

// 主入口（provider 契约，供 /api/l1 调用）
export async function getL1FromCninfo(
  code: string,
  market: string,
  reportTypes: string[],
  opts: { years?: number; notes?: boolean; noteKeywords?: string[] } = {}
): Promise<{ ok: boolean; status: string; message?: string; l1Data?: Record<string, unknown>; reports?: CninfoAnnouncement[]; notes?: unknown[] }> {
  try {
    const { reports, error } = await getReportPdfs(code, market, { years: opts.years || 5, reportTypes });
    if (error) return { ok: false, status: 'provider_error', message: error };

    const latestAnnual = reports.find((r) => r.type === 'annual');
    const noteKeywords = opts.noteKeywords || DEFAULT_NOTE_KEYWORDS;
    let notes: unknown[] = [];

    if (opts.notes !== false && latestAnnual) {
      const ex = await downloadAndExtract(latestAnnual.pdfUrl, noteKeywords);
      if (ex.error && !ex.notes.length) {
        return {
          ok: false, status: 'pdf_no_text_layer',
          message: `已下载 ${latestAnnual.title}，但${ex.error}。结构化数字请用 tushare/tdx 或桌面端解析。`,
          reports,
        };
      }
      notes = ex.notes.filter((x) => x.count > 0);
    }

    // 诚实契约：cninfo 提供"官方报告清单 + 附注文本定位"，不伪造结构化 l1Data
    const l1Data: Record<string, unknown> = {
      source: 'cninfo',
      reportList: reports.map((r) => ({ title: r.title, date: r.date, pdfUrl: r.pdfUrl, type: r.type })),
      noteHits: notes,
      note: 'cninfo 官方披露站抓取：报告清单来自巨潮公告搜索，附注文本来自年报 PDF 内嵌文本抽取；结构化数字（市值/三表）请用 tushare/tdx 适配器或人工核实。',
    };

    return { ok: true, status: 'fetched', l1Data, reports, notes };
  } catch (e) {
    return { ok: false, status: 'provider_error', message: `cninfo 抓取异常：${e instanceof Error ? e.message : String(e)}` };
  }
}
