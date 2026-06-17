// ═══════════════════════════════════════════════
// 风林慧策 API — /api/search 路由
// 模糊搜索股票（代码/名称/拼音/行业）
// ═══════════════════════════════════════════════

import { Hono } from 'hono';
import { getDB } from '../db/client';
import type { StockSearchResult, SearchResponse } from '../types';

export const searchRoute = new Hono();

searchRoute.get('/', async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q || q.length < 1) {
    return c.json({ results: [], count: 0 } satisfies SearchResponse);
  }

  try {
    const db = getDB(c);

    // 精确代码匹配优先
    const exactMatch = await db.prepare(
      `SELECT code, full_code, market, market_type, name, sector
       FROM stocks
       WHERE code = ? OR full_code = ?
       LIMIT 5`
    ).bind(q, q).all();

    if (exactMatch.results.length > 0) {
      return c.json({
        results: exactMatch.results.map(row => ({
          code: row.code as string,
          full_code: row.full_code as string,
          market: row.market as string,
          market_type: row.market_type as string,
          name: row.name as string,
          sector: row.sector as string | null,
        })) as StockSearchResult[],
        count: exactMatch.results.length,
      } satisfies SearchResponse);
    }

    // 模糊搜索
    const likePattern = `%${q}%`;
    const fuzzyMatch = await db.prepare(
      `SELECT code, full_code, market, market_type, name, sector
       FROM stocks
       WHERE name LIKE ?1
          OR code LIKE ?1
          OR pinyin LIKE ?1
          OR sector LIKE ?1
       ORDER BY
         CASE WHEN name = ?2 THEN 0
              WHEN name LIKE ?3 THEN 1
              WHEN code LIKE ?3 THEN 2
              ELSE 3 END,
         is_tracked DESC
       LIMIT 20`
    ).bind(likePattern, q, q + '%').all();

    return c.json({
      results: fuzzyMatch.results.map(row => ({
        code: row.code as string,
        full_code: row.full_code as string,
        market: row.market as string,
        market_type: row.market_type as string,
        name: row.name as string,
        sector: row.sector as string | null,
      })) as StockSearchResult[],
      count: fuzzyMatch.results.length,
    } satisfies SearchResponse);
  } catch (err) {
    console.error('Search error:', err);
    return c.json({
      results: [],
      count: 0,
    } satisfies SearchResponse, 500);
  }
});
