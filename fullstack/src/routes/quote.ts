// ═══════════════════════════════════════════════
// 风林慧策 API — /api/quote 路由
// 实时行情数据
// ═══════════════════════════════════════════════

import { Hono } from 'hono';
import { getDB } from '../db/client';
import type { QuoteResponse } from '../types';
import { getYahooFinanceQuote } from '../services/yahoo-finance';

export const quoteRoute = new Hono();

quoteRoute.get('/', async (c) => {
  const code = c.req.query('code');
  const market = c.req.query('market') || 'sz';

  if (!code) {
    return c.json({ status: 'error', message: 'Missing code parameter' }, 400);
  }

  try {
    const db = getDB(c);

    // Look up stock
    const fullCode = market === 'us' ? `us${code}` :
                      market === 'hk' ? `hk${code}` :
                      `${market}${code}`;

    const stock = await db.prepare(
      `SELECT id, name, market_type FROM stocks WHERE full_code = ? OR code = ? LIMIT 1`
    ).bind(fullCode, code).first();

    if (!stock) {
      return c.json({ status: 'error', message: 'Stock not found' }, 404);
    }

    const stockId = stock.id as number;

    // Try cached market data
    const row = await db.prepare(
      `SELECT * FROM market_data WHERE stock_id = ?`
    ).bind(stockId).first();

    if (row) {
      const updatedAt = row.updated_at as string;
      const ageMs = Date.now() - new Date(updatedAt).getTime();
      const isFresh = ageMs < 15 * 60 * 1000; // 15 min

      if (isFresh) {
        return c.json({
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
        } satisfies QuoteResponse);
      }
    }

    // Fallback: try Yahoo Finance for real-time data
    const yfData = await getYahooFinanceQuote(code, market);
    if (yfData) {
      return c.json(yfData);
    }

    // If nothing available
    return c.json({ status: 'error', message: 'Data not available' }, 503);
  } catch (err) {
    console.error('Quote error:', err);
    return c.json({ status: 'error', message: 'Failed to fetch quote' }, 500);
  }
});
