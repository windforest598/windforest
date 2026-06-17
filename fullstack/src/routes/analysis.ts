// ═══════════════════════════════════════════════
// 风林慧策 API — /api/analysis 路由
// PMQD 分析结果（四维评分 + 凯利 + 安全边际）
// ═══════════════════════════════════════════════

import { Hono } from 'hono';
import { getDB } from '../db/client';
import type { AnalysisResponse } from '../types';

export const analysisRoute = new Hono();

analysisRoute.get('/', async (c) => {
  const code = c.req.query('code');
  const market = c.req.query('market') || 'sz';

  if (!code) {
    return c.json({ status: 'error', message: 'Missing code parameter' } as AnalysisResponse, 400);
  }

  try {
    const db = getDB(c);

    const fullCode = market === 'us' ? `us${code}` :
                      market === 'hk' ? `hk${code}` :
                      `${market}${code}`;

    const stock = await db.prepare(
      `SELECT id, name FROM stocks WHERE full_code = ? OR code = ? LIMIT 1`
    ).bind(fullCode, code).first();

    if (!stock) {
      return c.json({ status: 'error', message: 'Stock not found' } as AnalysisResponse, 404);
    }

    const stockId = stock.id as number;

    // Check analysis cache
    const row = await db.prepare(
      `SELECT * FROM analysis_cache WHERE stock_id = ?`
    ).bind(stockId).first();

    if (row) {
      const generatedAt = row.generated_at as string;
      const ageMs = Date.now() - new Date(generatedAt).getTime();
      const isStale = ageMs > 24 * 60 * 60 * 1000;

      return c.json({
        status: 'ok',
        data: {
          id: row.id as number,
          stock_id: row.stock_id as number,
          pmqd_total: row.pmqd_total as number,
          pmqd_p_score: row.pmqd_p_score as number,
          pmqd_m_score: row.pmqd_m_score as number,
          pmqd_q_score: row.pmqd_q_score as number,
          pmqd_d_score: row.pmqd_d_score as number,
          pmqd_stars: row.pmqd_stars as string,
          pmqd_verdict: row.pmqd_verdict as string,
          kelly_f: row.kelly_f as number,
          kelly_b: row.kelly_b as number,
          kelly_p: row.kelly_p as number,
          kelly_verdict: row.kelly_verdict as string,
          strategy: row.strategy as string,
          safety_q1_pass: row.safety_q1_pass as number,
          safety_q2_pass: row.safety_q2_pass as number,
          safety_q3_pass: row.safety_q3_pass as number,
          safety_total: row.safety_total as number,
          solvency_score: row.solvency_score as number,
          health_check_score: row.health_check_score as number,
          report_json: row.report_json as string,
          data_freshness: isStale ? 'stale' : (row.data_freshness as string),
          generated_at: row.generated_at as string,
          data_sources: row.data_sources as string,
        },
      } satisfies AnalysisResponse);
    }

    // Not analyzed yet
    return c.json({
      status: 'pending',
      message: '该标的尚未完成分析。请稍后重试，或触发手动分析。',
      estimated_time: '3-5 分钟',
    } satisfies AnalysisResponse);
  } catch (err) {
    console.error('Analysis error:', err);
    return c.json({ status: 'error', message: 'Failed to fetch analysis' } as AnalysisResponse, 500);
  }
});
