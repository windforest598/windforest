// L1 Acquisition Layer — the "data IN" half of PMQD.
//
// PMQD 铁律：L1 = 官方文件（年报 / 季报 / 招股书 / 公告），L2 = 平台交叉核验，L3 仅补充，
// L4 排除。本层把"财务报告和官方报告"按市场路由到正确的官方信源 + 适配器，取数后一律
// 经过 certifySources() 认证为 L1，再产出与 samples.js 中 l1Data 同构的契约喂给引擎。
//
// 设计要点：
//  - 离线引擎不伪造数字。连接器未连接时，fetchL1 返回 needs_connector + 精确的调用计划，
//    让用户在会话里照着跑即可获得真实 L1 数据（符合"拒绝模拟/占位数据"原则）。
//  - 每条 L1 数字必须能回溯到官方信源；只要混入一个 L2 平台来源，确定性自动降级为「初筛」。

export const REPORT_TYPE_LABEL = {
  annual: '年报', semi: '半年报', q1: '一季报', q3: '三季报',
  interim: '中报', '10-K': '10-K 年报', '10-Q': '10-Q 季报',
  '20-F': '20-F 年报', '6-K': '6-K 临时报告',
  prospectus: '招股书', announcement: '公告 / 监管函',
};

// 官方信源注册表（来自 references/data_sources.md + financial-report-analysis/data-source-guide.md）
export const L1_SOURCE_REGISTRY = {
  A: {
    label: 'A股',
    market: 'cn',
    officialSources: [
      { id: 'cninfo', name: '巨潮资讯网', url: 'https://www.cninfo.com.cn', covers: ['annual', 'semi', 'q1', 'q3', 'prospectus', 'announcement'] },
      { id: 'sse', name: '上海证券交易所', url: 'https://www.sse.com.cn', covers: ['annual', 'announcement'] },
      { id: 'szse', name: '深圳证券交易所', url: 'https://www.szse.cn', covers: ['annual', 'announcement'] },
    ],
    structuredAdapter: 'tdx',
    pdfAdapter: 'pdf',
  },
  HK: {
    label: '港股',
    market: 'hk',
    officialSources: [
      { id: 'hkexnews', name: '披露易 HKEXnews', url: 'https://www.hkexnews.hk', covers: ['annual', 'interim', 'prospectus', 'announcement'] },
    ],
    structuredAdapter: 'tdx',
    pdfAdapter: 'pdf',
  },
  US: {
    label: '美股',
    market: 'us',
    officialSources: [
      { id: 'sec-edgar', name: 'SEC EDGAR', url: 'https://www.sec.gov/cgi-bin/browse-edgar', covers: ['10-K', '10-Q', '20-F', '6-K', 'prospectus', 'announcement'] },
    ],
    structuredAdapter: 'tdx',
    pdfAdapter: 'pdf',
  },
};

// 把引用的来源逐个分级：L1（官方披露）vs L2（平台）。PMQD 纪律核心。
export function certifySources(sources = []) {
  const l1Names = new Set();
  for (const m of Object.values(L1_SOURCE_REGISTRY))
    for (const s of m.officialSources) l1Names.add(s.name);
  const classified = (sources || []).map((s) => {
    const name = typeof s === 'string' ? s : s.name;
    const isL1 = l1Names.has(name) ||
      /巨潮|披露易|EDGAR|交易所|IR页|investor\.|公司官网|年报|招股书|定期报告|公告/.test(name);
    return { name, tier: isL1 ? 'L1' : 'L2' };
  });
  const l2 = classified.filter((c) => c.tier === 'L2');
  return {
    classified,
    allL1: l2.length === 0,
    determinism: l2.length === 0 ? '标准' : '初筛',
    note: l2.length === 0
      ? '全部来源为 L1 官方信源，可作完整质量评估（含附注时可达「深度」）'
      : `含 ${l2.length} 个 L2 平台来源（${l2.map((c) => c.name).join('、')}），未覆盖附注，确定性降级为「初筛」`,
  };
}

import { tdxAdapter } from './adapters/tdx.js';
import { neodataAdapter } from './adapters/neodata.js';
import { pdfAdapter } from './adapters/pdf.js';
import { buildReportList, buildNoteExtractionPlan } from './report-acquisition.js';

const ADAPTERS = { tdx: tdxAdapter, neodata: neodataAdapter, pdf: pdfAdapter };

// 由 apiBase 构造默认 fetcher：调 Cloudflare Workers `/api/l1` 真实取数回填 l1Data（Node 18+ 全局 fetch）。
function buildApiFetcher(apiBase, method = 'GET') {
  const base = String(apiBase || '').replace(/\/+$/, '');
  return async ({ adapter, spec, reg }) => {
    try {
      const url = new URL(`${base}/l1`);
      url.searchParams.set('code', spec.stock);
      url.searchParams.set('market', spec.market);
      url.searchParams.set('adapter', adapter);
      if (spec.reportTypes && spec.reportTypes.length) url.searchParams.set('reportTypes', spec.reportTypes.join(','));
      if (spec.year) url.searchParams.set('year', spec.year);
      const r = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
      if (!r.ok) {
        let msg = r.statusText;
        try { const b = await r.json(); if (b && (b.message || b.error)) msg = b.message || b.error; } catch {}
        return { ok: false, status: 'provider_error', error: `后端返回 ${r.status}：${msg}` };
      }
      const body = await r.json();
      if (!body || body.ok === false || (!body.l1Data && body.ok !== true)) {
        return { ok: false, status: body?.status || 'provider_error', error: body?.message || body?.error || '后端未返回 l1Data' };
      }
      return { ok: true, l1Data: body.l1Data, sources: body.sources || reg.officialSources.map((s) => s.name) };
    } catch (e) {
      return { ok: false, status: 'fetch_failed', error: `调用 ${base}/l1 失败：${e.message || e}` };
    }
  };
}

// 解析取数函数优先级：显式 fetcher > apiBase 构造。
export function resolveL1Fetcher(opts = {}) {
  if (opts.fetcher) return opts.fetcher;
  if (opts.apiBase) return buildApiFetcher(opts.apiBase, opts.method || 'GET');
  return null;
}

// 主入口：给定取数规格，路由到适配器，认证来源，产出引擎可用的 l1Data 契约。
// spec: { stock, name?, market: 'A'|'HK'|'US', reportTypes: [...], year?, historyYears?=5, years?, adapter?: 'tdx'|'neodata'|'pdf' }
//   - historyYears / years: 历史年报回溯年数（默认 5，最大 10）；years 也可传显式年份数组。
// opts: { adapters?, fetcher?, apiBase?, method?, nYears? }
//   - apiBase: Cloudflare Workers API 前缀（如 "https://api.windforest.cn/api"），fetcher 自动追加 "/l1" 真实取数
//     （与浏览器版 buildApiFetcher 同源契约）。apiBase 注入后自动取真实 L1。
// 返回恒定附带 reportList（最近 N 年年报+最新季报/半年报清单）与 notePlan（附注级穿透清单）。
export async function fetchL1(spec, opts = {}) {
  // 多年度报告清单 + 附注级穿透计划：无论成败都随结果返回（报告头/取数 SOP/透明度面板使用）
  const reportList = buildReportList(spec, opts);
  const notePlan = buildNoteExtractionPlan(spec.market || 'A', reportList.latestAnnual);

  const reg = L1_SOURCE_REGISTRY[spec.market];
  if (!reg) return { ok: false, status: 'unknown_market', error: `未支持市场：${spec.market}`, reportList, notePlan };

  const chosen = spec.adapter || reg.structuredAdapter;
  const adapter = (opts.adapters && opts.adapters[chosen]) || ADAPTERS[chosen];
  if (!adapter) return { ok: false, status: 'no_adapter', error: `无适配器：${chosen}`, reportList, notePlan };

  const label = (spec.reportTypes || []).map((t) => REPORT_TYPE_LABEL[t] || t).join(' / ');
  const enriched = { ...spec, reportTypeLabel: label, reportList, notePlan };

  const plan = adapter.plan(enriched, reg);

  // 注入 apiBase/fetcher 时直接取真实 L1（同源契约：与浏览器版一致）。
  const fetcher = resolveL1Fetcher(opts);
  if (fetcher) {
    const remote = await fetcher({ adapter: chosen, spec: enriched, reg });
    if (remote && remote.ok) {
      const certification = certifySources(remote.sources);
      return { ok: true, status: 'fetched', l1Data: remote.l1Data, sources: remote.sources, certification, officialSources: reg.officialSources, fetchPlan: plan, reportList, notePlan };
    }
  }

  const res = await adapter.fetch(enriched, reg);

  if (!res.ok) {
    return {
      ok: false,
      status: res.status || 'needs_connector',
      fetchPlan: plan,
      officialSources: reg.officialSources,
      error: res.error,
      reportList,
      notePlan,
    };
  }

  const certification = certifySources(res.sources);
  return {
    ok: true,
    status: 'fetched',
    l1Data: res.l1Data,
    sources: res.sources,
    certification,
    officialSources: reg.officialSources,
    fetchPlan: plan,
    reportList,
    notePlan,
  };
}
