// ═══════════════════════════════════════════════
// 风林慧策 API — /api/l1 路由（公开）
// 静态站一键回填真实 L1 财报数据：按市场路由到 provider，返回 l1Data 契约。
// 参数：code / market / reportTypes / year / years(1-10, cninfo 回溯年数) / notes(false 跳过附注抽取)
// provider：cninfo（官方披露站抓取·免token）| tushare（A股三表+行情·需token）
// 契约与 deploy/l1/l1-fetcher.js 的 buildApiFetcher 完全对齐。
// ═══════════════════════════════════════════════

import { Hono } from 'hono';
import { getL1 } from '../services/l1-provider';

export const l1Route = new Hono();

// 由股票代码推断市场（与浏览器版 classifyMarket 同源）
function classifyMarket(code: string): string {
  const c = (code || '').toUpperCase();
  if (/^\d{6}(\.(SH|SZ|SS|BJ))?$/.test(c) || /^(SH|SZ|SS|BJ)\d{6}$/.test(c)) return 'A';
  if (/^\d{4,5}(\.HK)?$/.test(c) || /^HK\d{4,5}$/.test(c)) return 'HK';
  if (/^[A-Z]{1,5}(\.[A-Z]{1,4})?$/.test(c)) return 'US';
  return 'A';
}

// 官方信源（L1）注册表 — 仅取来源名供前端 certifySources 认证
const L1_OFFICIAL_SOURCES: Record<string, string[]> = {
  A: ['巨潮资讯网', '上海证券交易所', '深圳证券交易所'],
  HK: ['披露易 HKEXnews'],
  US: ['SEC EDGAR'],
};

l1Route.get('/', async (c) => {
  const code = c.req.query('code');
  const marketParam = (c.req.query('market') || '').toUpperCase();
  const reportTypes = (c.req.query('reportTypes') || 'annual').split(',').filter(Boolean);
  const year = c.req.query('year') || '';
  // cninfo provider 专用：回溯年数（默认 5，最大 10）+ 是否抽取附注文本（默认 true）
  const yearsParam = c.req.query('years') || '5';
  const years = Math.min(Math.max(parseInt(yearsParam, 10) || 5, 1), 10);
  const notes = c.req.query('notes') !== 'false';

  if (!code) {
    return c.json({ ok: false, status: 'missing_code', message: '缺少 code 参数' }, 400);
  }

  const market = L1_OFFICIAL_SOURCES[marketParam] ? marketParam : classifyMarket(code);
  const env = c.env as Record<string, string | undefined>;

  try {
    const res = await getL1(code, market, reportTypes, env, { years, notes });

    if (!res.ok) {
      // 未配置/不支持：返回结构化状态，前端如实显示取数路径，绝不伪造数字
      return c.json({
        ok: false,
        status: res.status || 'provider_error',
        message: res.message,
        officialSources: L1_OFFICIAL_SOURCES[market],
        fetchPlan: [`配置 L1_PROVIDER 后调用 ${market} 官方信源取真实 L1`],
      }, res.status === 'provider_unconfigured' ? 200 : 502);
    }

    return c.json({
      ok: true,
      l1Data: res.l1Data,
      sources: res.sources || L1_OFFICIAL_SOURCES[market],
      officialSources: L1_OFFICIAL_SOURCES[market],
      market,
      year,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[l1] route error', err);
    return c.json({ ok: false, status: 'error', message: 'L1 取数失败' }, 500);
  }
});
