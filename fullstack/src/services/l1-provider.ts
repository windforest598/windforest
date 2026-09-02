// ═══════════════════════════════════════════════
// 风林慧策 — L1 财报数据 Provider（Workers 端真实取数）
// 由 /api/l1 路由调用，把官方 L1 财报映射为 l1Data 契约回填前端。
// PMQD 铁律：L1 = 官方文件；本服务取数后由前端 certifySources 认证确定性。
// ═══════════════════════════════════════════════

// 上游 Provider 通过 wrangler.toml [vars] 配置：
//   L1_PROVIDER = "cninfo"    → 官方披露站抓取（巨潮/沪深公告搜索 + 年报 PDF + 附注文本），免 token
//   L1_PROVIDER = "tushare"   → A 股结构化三表 + 行情
//   L1_PROVIDER_TOKEN = "你的 tushare token"
// 未配置时 /api/l1 返回 provider_unconfigured（前端如实显示，绝不伪造）。

import { getL1FromCninfo } from './l1-cninfo-provider';

export interface L1ProviderResult {
  ok: boolean;
  status?: string;
  message?: string;
  l1Data?: Record<string, unknown>;
  sources?: string[];
}

// Tushare 通用查询（POST https://api.tushare.pro）
async function tushareQuery(apiName: string, token: string, params: Record<string, unknown>, fields: string[]): Promise<Record<string, any>[] | null> {
  try {
    const r = await fetch('https://api.tushare.pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_name: apiName, token, params, fields }),
    });
    if (!r.ok) {
      console.warn(`[tushare] ${apiName} HTTP ${r.status}`);
      return null;
    }
    const j = await r.json() as any;
    if (j.code !== 0 || !j.data || !j.data.items || !j.data.items.length) return null;
    const flds: string[] = j.data.fields;
    return j.data.items.map((row: any[]) => {
      const o: Record<string, any> = {};
      flds.forEach((f, i) => (o[f] = row[i]));
      return o;
    });
  } catch (e) {
    console.error(`[tushare] ${apiName} error`, e);
    return null;
  }
}

// 把 Tushare 三表 + 行情映射为 l1Data 契约（货币单位：元）。
async function getL1FromTushare(
  code: string, market: string, reportTypes: string[], token: string
): Promise<L1ProviderResult> {
  // 仅 A 股用 tushare（港股/美股走其他 provider，此处未配置则返回 unconfigured）
  if (market !== 'A') {
    return { ok: false, status: 'provider_market', message: `tushare 仅支持 A 股；${market} 市场需配置对应 L1_PROVIDER` };
  }
  try {
    const tsCode = code.length === 6 ? `${code}.${/^(60|68|90|9)/.test(code) ? 'SH' : 'SZ'}` : code;

    // 行情（latest trade date）
    const daily = await tushareQuery('daily_basic', token, { ts_code: tsCode, fields: 'trade_date,close,total_mv,dv_ttm,pe_ttm,pb' }, ['trade_date', 'close', 'total_mv', 'dv_ttm', 'pe_ttm', 'pb']);
    const quote = daily && daily[0];
    const mv = quote ? Number(quote.total_mv) * 1000 : 0; // 千元 → 元

    // 利润表（最新一期）
    const income = await tushareQuery('income', token, { ts_code: tsCode, fields: 'ann_date,end_date,revenue,n_income' }, ['ann_date', 'end_date', 'revenue', 'n_income']);
    const inc = income && income[0];
    const revenue = inc ? Number(inc.revenue) * 1000 : 0; // 千元 → 元
    const netProfit = inc ? Number(inc.n_income) * 1000 : 0;

    // 资产负债表
    const bs = await tushareQuery('balancesheet', token, { ts_code: tsCode, fields: 'ann_date,end_date,total_assets,total_liab,money_cap' }, ['ann_date', 'end_date', 'total_assets', 'total_liab', 'money_cap']);
    const b = bs && bs[0];
    const totalAssets = b ? Number(b.total_assets) * 1000 : 0;
    const totalLiab = b ? Number(b.total_liab) * 1000 : 0;
    const moneyCap = b ? Number(b.money_cap) * 1000 : 0;

    // 现金流量表
    const cf = await tushareQuery('cashflow', token, { ts_code: tsCode, fields: 'ann_date,end_date,n_cashflow_act' }, ['ann_date', 'end_date', 'n_cashflow_act']);
    const ocf = cf && cf[0] ? Number(cf[0].n_cashflow_act) * 1000 : 0;

    // 财务指标
    const fin = await tushareQuery('fina_indicator', token, { ts_code: tsCode, fields: 'ann_date,end_date,roe,grossprofit_margin,debt_to_assets' }, ['ann_date', 'end_date', 'roe', 'grossprofit_margin', 'debt_to_assets']);
    const f = fin && fin[0];
    const roe = f ? Number(f.roe) : 0;
    const grossMargin = f ? Number(f.grossprofit_margin) : 0;
    const debtRatio = f ? Number(f.debt_to_assets) : 0;

    // 净现金（保守口径）：货币资金 − 总负债
    const netCash = moneyCap - totalLiab;

    const l1Data: Record<string, number | string> = {
      marketCap: mv,
      price: quote ? Number(quote.close) : 0,
      netCash,
      dividendYield: quote ? Number(quote.dv_ttm) : 0,
      revenue,
      netProfit,
      netAssets: totalAssets - totalLiab,
      totalLiabilities: totalLiab,
      operatingCashFlow: ocf,
      grossMargin,
      roe,
      debtRatio,
      currency: 'CNY',
      reportDate: (inc && inc.end_date) || '',
      reportType: reportTypes.join(',') || 'annual',
      source: 'tushare',
    };

    return { ok: true, l1Data, sources: ['巨潮资讯网'] };
  } catch (e) {
    console.error('[tushare] map error', e);
    return { ok: false, status: 'provider_error', message: `tushare 映射异常：${e instanceof Error ? e.message : e}` };
  }
}

// 入口：根据 env 配置选择 provider。
//   cninfo —— 官方披露站抓取（巨潮/沪深公告搜索 + 年报 PDF 下载 + 附注文本抽取），免 token。
//   tushare —— A 股结构化三表 + 行情（需 L1_PROVIDER_TOKEN）。
export async function getL1(
  code: string, market: string, reportTypes: string[], env: Record<string, string | undefined>,
  opts: { years?: number; notes?: boolean } = {}
): Promise<L1ProviderResult> {
  const provider = (env.L1_PROVIDER || '').toLowerCase();
  const token = env.L1_PROVIDER_TOKEN || '';

  if (!provider) {
    return {
      ok: false,
      status: 'provider_unconfigured',
      message: '未配置 L1_PROVIDER。可选：cninfo（官方披露站抓取，免 token）/ tushare（A股三表+行情，需 token）。在 wrangler.toml [vars] 配置后启用真实 L1 取数（当前为离线计划模式）。',
    };
  }
  if (provider === 'cninfo') {
    return getL1FromCninfo(code, market, reportTypes, { years: opts.years, notes: opts.notes });
  }
  if (provider === 'tushare') {
    if (!token) {
      return { ok: false, status: 'provider_unconfigured', message: 'tushare provider 需要 L1_PROVIDER_TOKEN（tushare.pro 注册获取）' };
    }
    return getL1FromTushare(code, market, reportTypes, token);
  }
  return { ok: false, status: 'unknown_provider', message: `未支持的 L1_PROVIDER：${provider}（支持 cninfo / tushare）` };
}
