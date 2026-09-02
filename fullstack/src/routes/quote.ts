// ═══════════════════════════════════════════════
// 风林慧策 API — /api/quote 路由
// 实时行情数据
//
// 支持两种调用形态：
//   1. GET /api/quote?code=000333&market=sz      （网页版历史形态）
//   2. GET /api/quote/sz000333                    （小程序形态，market 前缀内联）
//
// 数据源优先级：D1 缓存（<15min）→ 腾讯财经实时行情（真实、免 token）
//   Yahoo Finance v8/v10 自 2025 起全面限流作废，已从兜底链路移除。
// ═══════════════════════════════════════════════

import { Hono } from 'hono';
import { getDB } from '../db/client';
import type { QuoteResponse } from '../types';

export const quoteRoute = new Hono();

const TC_URL = 'https://qt.gtimg.cn/q=';

/** 把 sz000333 / hk00700 / usAAPL 拆成 { code, market } */
function splitSymbol(symbol: string): { code: string; market: string } | null {
  const s = String(symbol || '').trim();
  const m = s.match(/^(sh|sz|bj|hk|us)(.+)$/i);
  if (m) return { market: m[1].toLowerCase(), code: m[2].toUpperCase() };
  // 无前缀：按代码规则推断
  if (/^\d{6}$/.test(s)) return { market: s.startsWith('6') ? 'sh' : 'sz', code: s };
  if (/^\d{4,5}$/.test(s)) return { market: 'hk', code: s.padStart(5, '0') };
  if (/^[A-Za-z.]{1,6}$/.test(s)) return { market: 'us', code: s.toUpperCase() };
  return null;
}

function tcSymbol(code: string, market: string): string {
  if (market === 'hk') return `hk${String(code).padStart(5, '0')}`;
  if (market === 'us') return `us${code.toUpperCase()}`;
  return `${market}${code}`;
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 拉取腾讯实时行情并映射为 QuoteResponse（真实数据，无占位符） */
async function fetchTencentQuote(code: string, market: string): Promise<QuoteResponse | null> {
  try {
    const resp = await fetch(TC_URL + tcSymbol(code, market), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WindForestBot/1.0)' },
      cf: { cacheTtl: 60, cacheEverything: true },
    } as RequestInit);
    if (!resp.ok) return null;

    const text = await resp.text();
    const m = text.match(/v_\w+="([^"]+)"/);
    if (!m || !m[1]) return null;

    const f = m[1].split('~');
    const price = num(f[3]);
    if (price === null) return null;

    const isHK = market === 'hk';
    // 港股段位：48=52周最高 49=52周最低；A 股该段位为量比/换手，需留空由 K 线补
    const high52 = isHK ? num(f[48]) : null;
    const low52 = isHK ? num(f[49]) : null;

    const raw = f[30] || '';
    const asOf = raw.length >= 14
      ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`
      : new Date().toISOString();

    return {
      price,
      change_pct: num(f[32]) ?? 0,
      pe_ttm: num(f[39]),
      pb: isHK ? null : num(f[46]),
      market_cap: num(f[45]),
      div_yield_ttm: null,          // 腾讯行情不提供，留空由 L1 财报回填
      high_52w: high52,
      low_52w: low52,
      volume: num(f[36]),
      turnover: num(f[38]),
      updated_at: asOf,
      source: '腾讯财经行情 qt.gtimg.cn',
    } as QuoteResponse;
  } catch {
    return null;
  }
}

/** D1 缓存命中（15 分钟内视为新鲜） */
async function fromCache(c: any, code: string, market: string): Promise<QuoteResponse | null> {
  try {
    const db = getDB(c);
    const fullCode = tcSymbol(code, market);
    const stock = await db.prepare(
      `SELECT id FROM stocks WHERE full_code = ? OR code = ? LIMIT 1`
    ).bind(fullCode, code).first();
    if (!stock) return null;

    const row = await db.prepare(
      `SELECT * FROM market_data WHERE stock_id = ?`
    ).bind(stock.id as number).first();
    if (!row) return null;

    const updatedAt = row.updated_at as string;
    const ageMs = Date.now() - new Date(updatedAt).getTime();
    if (ageMs >= 15 * 60 * 1000) return null;

    return {
      price: row.price as number,
      change_pct: row.change_pct as number,
      pe_ttm: row.pe_ttm as number,
      pb: row.pb as number,
      market_cap: row.market_cap as number,
      div_yield_ttm: row.div_yield_ttm as number,
      high_52w: row.high_52w as number,
      low_52w: row.low_52w as number,
      volume: row.volume as number,
      turnover: row.turnover as number,
      updated_at: updatedAt,
      source: 'D1 缓存',
    } as QuoteResponse;
  } catch {
    return null;
  }
}

async function handle(c: any, code: string, market: string) {
  if (!code) {
    return c.json({ status: 'error', message: 'Missing code parameter' }, 400);
  }
  try {
    const cached = await fromCache(c, code, market);
    if (cached) return c.json(cached);

    const live = await fetchTencentQuote(code, market);
    if (live) return c.json(live);

    return c.json({
      status: 'error',
      message: 'Quote unavailable — 上游行情源无返回，未使用任何模拟数据兜底',
      code, market,
    }, 503);
  } catch (err) {
    console.error('Quote error:', err);
    return c.json({ status: 'error', message: 'Failed to fetch quote' }, 500);
  }
}

// 形态 1：查询参数
quoteRoute.get('/', async (c) => {
  const code = c.req.query('code') || '';
  const market = (c.req.query('market') || 'sz').toLowerCase();
  return handle(c, code, market === 'a' ? (code.startsWith('6') ? 'sh' : 'sz') : market);
});

// 形态 2：路径参数（小程序 /api/quote/sz000333）
quoteRoute.get('/:symbol', async (c) => {
  const parsed = splitSymbol(c.req.param('symbol'));
  if (!parsed) {
    return c.json({ status: 'error', message: 'Invalid symbol，形如 sz000333 / hk00700 / usAAPL' }, 400);
  }
  return handle(c, parsed.code, parsed.market);
});
