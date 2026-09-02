// ═══════════════════════════════════════════════
// 风林慧策 — 真实行情数据源 + V6.0 契约适配层
//
// 数据源：腾讯财经行情接口 (qt.gtimg.cn) — 真实、免费、免 token
//   （Yahoo Finance v8/v10 接口自 2025 起全面限流，已作废，勿再用）
//
// 铁律：可核验字段用真实数据/恒等式推导；不可核验字段一律进入
//       unverifiedAssumptions 公示，绝不静默编造数字。
// ═══════════════════════════════════════════════

const TC_URL = 'http://qt.gtimg.cn/q=';

// 腾讯行情字段索引（A股/港股/美股段位不同，按市场取用）
const A = {
  NAME: 1, PRICE: 3, PREV_CLOSE: 4, OPEN: 5,
  TIME: 30, CHANGE: 31, CHANGE_PCT: 32, HIGH: 33, LOW: 34,
  VOLUME: 36, AMOUNT: 37, TURNOVER: 38, PE_TTM: 39,
  AMPLITUDE: 43, FLOAT_MC: 44, TOTAL_MC: 45, PB: 46, VOL_RATIO: 49,
};
const HK = {
  NAME: 1, PRICE: 3, PREV_CLOSE: 4, OPEN: 5,
  TIME: 30, CHANGE: 31, CHANGE_PCT: 32, HIGH: 33, LOW: 34,
  VOLUME: 36, AMOUNT: 37, TURNOVER: 38, PE_TTM: 39,
  AMPLITUDE: 43, FLOAT_MC: 44, TOTAL_MC: 45, HIGH52: 48, LOW52: 49,
};

export interface Quote {
  price: number;
  prevClose: number;
  changePct: number;
  pe: number | null;
  pb: number | null;
  marketCap: number | null;   // 亿元（人民币 or 港元，按市场）
  turnoverRate: number | null;
  amplitude: number | null;
  high52: number | null;
  low52: number | null;
  currency: string;
  asOf: string;
}

export interface StockRef {
  code: string;
  name: string;
  market: string;   // sh | sz | bj | hk | us
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 腾讯行情 symbol 前缀 */
function tcSymbol(stock: StockRef): string {
  const c = stock.code;
  if (stock.market === 'hk') return `hk${String(c).padStart(5, '0')}`;
  if (stock.market === 'us') return `us${c.toUpperCase()}`;
  return `${stock.market}${c}`;   // sh/sz/bj
}

/** 拉取真实行情（腾讯） */
export async function fetchQuote(stock: StockRef): Promise<Quote | null> {
  try {
    const resp = await fetch(TC_URL + tcSymbol(stock), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WindForestBot/1.0)' },
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    return parseQuote(text, stock);
  } catch {
    return null;
  }
}

/** 解析腾讯行情返回体 */
export function parseQuote(text: string, stock: StockRef): Quote | null {
  const m = text.match(/v_\w+="([^"]+)"/);
  if (!m || !m[1]) return null;
  const f = m[1].split('~');
  if (f.length < 40) return null;

  const isHK = stock.market === 'hk';
  const isUS = stock.market === 'us';
  const I = isHK || isUS ? HK : A;

  const price = num(f[I.PRICE]);
  if (price === null || price <= 0) return null;

  // 港股/美股段位缺 PB；A股段位缺 52 周高低
  const pb = isHK || isUS ? null : num(f[A.PB]);
  const mc = num(f[I.TOTAL_MC] ?? '') ?? num(f[I.FLOAT_MC] ?? '');

  return {
    price,
    prevClose: num(f[I.PREV_CLOSE]) ?? price,
    changePct: num(f[I.CHANGE_PCT]) ?? 0,
    pe: num(f[I.PE_TTM]),
    pb,
    marketCap: mc,
    turnoverRate: num(f[I.TURNOVER]),
    amplitude: num(f[I.AMPLITUDE]),
    high52: isHK || isUS ? num(f[HK.HIGH52]) : null,
    low52: isHK || isUS ? num(f[HK.LOW52]) : null,
    currency: stock.market === 'hk' ? 'HKD' : stock.market === 'us' ? 'USD' : 'CNY',
    asOf: f[I.TIME] || new Date().toISOString(),
  };
}

// 腾讯日 K 线（前复权）—— 用于计算真实 52 周高低（行情接口段位不含该字段）
const KLINE_URL = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get';

/** 从 250 根前复权日 K 线求真实 52 周高低 */
export async function fetch52Week(stock: StockRef): Promise<{ high: number | null; low: number | null }> {
  try {
    const sym = tcSymbol(stock);
    const resp = await fetch(`${KLINE_URL}?param=${sym},day,,,250,qfq`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WindForestBot/1.0)' },
    });
    const j: any = await resp.json();
    const arr = j?.data?.[sym]?.qfqday || j?.data?.[sym]?.day;
    if (!Array.isArray(arr) || arr.length === 0) return { high: null, low: null };
    let hi = -Infinity;
    let lo = Infinity;
    for (const k of arr) {
      const h = Number(k[3]);
      const l = Number(k[4]);
      if (Number.isFinite(h)) hi = Math.max(hi, h);
      if (Number.isFinite(l)) lo = Math.min(lo, l);
    }
    return {
      high: hi === -Infinity ? null : Math.round(hi * 100) / 100,
      low: lo === Infinity ? null : Math.round(lo * 100) / 100,
    };
  } catch {
    return { high: null, low: null };
  }
}

// ── PMQD 四维：全部基于可核验字段推导 ──────────────────

/** P — 价格安全边际：真实 PE/PB 相对内在值(12.5x / 1.0 PB)的折价 */
function scoreP(pe: number | null, pb: number | null): { score: number; verified: boolean } {
  if (pe === null || pe <= 0) return { score: 50, verified: false };
  let s: number;
  if (pe <= 8) s = 92;
  else if (pe <= 10) s = 84;
  else if (pe <= 12.5) s = 74;
  else if (pe <= 15) s = 60;
  else if (pe <= 20) s = 45;
  else if (pe <= 25) s = 32;
  else if (pe <= 35) s = 20;
  else s = 10;
  // PB 折价修正（A股可得）
  if (pb !== null && pb > 0) {
    if (pb <= 0.7) s += 6;
    else if (pb <= 1.0) s += 4;
    else if (pb <= 1.5) s += 2;
    else if (pb >= 5) s -= 5;
  }
  return { score: Math.max(0, Math.min(100, Math.round(s))), verified: true };
}

/** Q — 质量：ROE = PB / PE（会计恒等式，非估算）。缺失 PB 则不可核验 */
function scoreQ(pe: number | null, pb: number | null): { score: number; roe: number | null; verified: boolean } {
  if (pe === null || pe <= 0 || pb === null || pb <= 0) {
    return { score: 50, roe: null, verified: false };
  }
  const roe = (pb / pe) * 100;   // ROE = (市值/净资产) ÷ (市值/净利润) = 净利润/净资产
  let s: number;
  if (roe >= 25) s = 88;
  else if (roe >= 20) s = 80;
  else if (roe >= 15) s = 72;
  else if (roe >= 10) s = 60;
  else if (roe >= 5) s = 46;
  else s = 32;
  return { score: s, roe: Math.round(roe * 10) / 10, verified: true };
}

/** D — 认知差：52 周价格位置（越低＝市场越冷＝认知差越大） */
function scoreD(price: number, high52: number | null, low52: number | null): { score: number; verified: boolean } {
  if (high52 === null || low52 === null || high52 <= low52) {
    return { score: 50, verified: false };
  }
  const pos = (price - low52) / (high52 - low52);
  let s: number;
  if (pos <= 0.2) s = 78;
  else if (pos <= 0.4) s = 64;
  else if (pos <= 0.6) s = 50;
  else if (pos <= 0.8) s = 36;
  else s = 24;
  return { score: s, verified: true };
}

/** M — 催化：需行业事件/景气判断，行情接口无法核验 → 恒定标记为未核验 */
const M_UNVERIFIED = 50;

/**
 * 真实行情 → V6.0 引擎 l1Data 契约
 * 返回 l1Data（供 assemble）与 gaps（数据缺口，供前端公示）
 */
export function buildL1Input(stock: StockRef, q: Quote, wk?: { high: number | null; low: number | null }) {
  const gaps: string[] = [];

  // 52 周高低：优先行情接口段位，缺失时用 250 根前复权日 K 线实算
  const high52 = q.high52 ?? wk?.high ?? null;
  const low52 = q.low52 ?? wk?.low ?? null;

  const P = scoreP(q.pe, q.pb);
  const Q = scoreQ(q.pe, q.pb);
  const D = scoreD(q.price, high52, low52);

  if (!P.verified) gaps.push('P（价格安全边际）：未取得有效 PE，取中性基准');
  if (!Q.verified) gaps.push('Q（资产质量）：PB 缺失，ROE 无法推导，取中性基准');
  if (!D.verified) gaps.push('D（认知差）：52 周高低缺失，取中性基准');

  // 财务穿透数据行情源不提供 —— 一律列入缺口，绝不伪造
  gaps.push('净现金 / 有息负债：未接入资产负债表，需 L1 财报穿透');
  gaps.push('经营现金流 / 自由现金流：未接入现金流量表');
  gaps.push('股息率(TTM)：行情源未提供，需官方分红公告核验');
  gaps.push('M（催化）：行业事件与景气判断需人工/研报核验，取中性基准');
  gaps.push('护城河：以 ROE 推导的质量分作保守代理，待人工核验');
  gaps.push('8 维体检：未接入财报，各维取中性基准 50（非实测值）');
  gaps.push('安全边际三问：无净现金/FCF 支撑，保守判为未通过（非实测）');

  const l1Data = {
    sources: [`腾讯财经行情接口 qt.gtimg.cn（${q.asOf}）`],
    integrityIssues: [],          // 无官方诚信数据源，不推定
    balanceSheet: {},             // 未接入财报，留空由前端显示"—"
    balanceSheetMissing: true,
    qualityScore: Q.score,
    discountDepth: D.score,
    // 护城河无法从行情接口直接核验，用"ROE 推导的质量分"作保守代理（避免恒定 50 卡死策略二门槛）
    moatStrength: Q.score,
    userValueScore: 0,            // 未核验 → 触发"用户价值未验证"标注
    swingFactor: '未识别（需行业全景扫描）',
    playerCount: 0,
    pmqd: { P: P.score, M: M_UNVERIFIED, Q: Q.score, D: D.score },
    _verified: { P: P.verified, M: false, Q: Q.verified, D: D.verified },
    safetyAnswers: { q1: false, q2: false, q3: false },  // 无净现金/FCF 无法判定
    safetyIndeterminate: true,
    marginPct: 0,
    // 8 维体检无财报支撑：填中性 50，避免空对象被算成 0 分（0 分＝虚假的"极差"）
    health8d: { 盈利: 50, 负债: 50, 现金流: 50, 分红: 50, 治理: 50, 成长: 50, 估值: 50, 景气: 50 },
    healthIndeterminate: true,
    conviction: '低',             // 数据不全 → 认知确信度低（触发 V6.0 认知风险扣分）
    unverifiedAssumptions: gaps,
    holdTestHappy: false,
    // 真实估值面数据（供报告 KPI 展示，全部来自行情接口）
    market: {
      price: q.price,
      prevClose: q.prevClose,
      changePct: q.changePct,
      pe: q.pe,
      pb: q.pb,
      marketCap: q.marketCap,
      roe: Q.roe,
      turnoverRate: q.turnoverRate,
      amplitude: q.amplitude,
      high52,
      low52,
      currency: q.currency,
      asOf: q.asOf,
    },
    _dataGaps: gaps,
  };

  return { l1Data, gaps };
}
