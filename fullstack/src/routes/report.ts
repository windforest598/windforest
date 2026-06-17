// ═══════════════════════════════════════════════
// 风林慧策 API — /api/report 路由
// 完整分析报告（15模块 JSON）
// ═══════════════════════════════════════════════

import { Hono } from 'hono';
import { getDB } from '../db/client';
import type { ReportResponse } from '../types';

export const reportRoute = new Hono();

reportRoute.get('/', async (c) => {
  const code = c.req.query('code');
  const market = c.req.query('market') || 'sz';

  if (!code) {
    return c.json({ status: 'error', message: 'Missing code parameter' } as ReportResponse, 400);
  }

  try {
    const db = getDB(c);

    const fullCode = market === 'us' ? `us${code}` :
                      market === 'hk' ? `hk${code}` :
                      `${market}${code}`;

    // Fetch stock
    const stockRow = await db.prepare(
      `SELECT * FROM stocks WHERE full_code = ? OR code = ? LIMIT 1`
    ).bind(fullCode, code).first();
    if (!stockRow) {
      return c.json({ status: 'error', message: 'Stock not found' } as ReportResponse, 404);
    }

    const stockId = stockRow.id as number;

    // Fetch analysis
    const analysisRow = await db.prepare(
      `SELECT * FROM analysis_cache WHERE stock_id = ?`
    ).bind(stockId).first();
    if (!analysisRow) {
      return c.json({
        status: 'pending',
        message: '该标的尚未完成深度分析，请稍后重试',
      } satisfies ReportResponse);
    }

    // Fetch market data
    const marketRow = await db.prepare(
      `SELECT * FROM market_data WHERE stock_id = ?`
    ).bind(stockId).first();

    // Fetch financial data
    const financialRow = await db.prepare(
      `SELECT * FROM financial_data WHERE stock_id = ? ORDER BY fiscal_year DESC LIMIT 1`
    ).bind(stockId).first();

    // Parse report JSON
    let modules = [];
    try {
      const reportJson = analysisRow.report_json as string;
      if (reportJson) {
        const parsed = JSON.parse(reportJson);
        modules = parsed.modules || [];
      }
    } catch {
      modules = [];
    }

    return c.json({
      status: 'ok',
      data: {
        stock: {
          id: stockRow.id as number,
          code: stockRow.code as string,
          full_code: stockRow.full_code as string,
          market: stockRow.market as any,
          market_type: stockRow.market_type as any,
          name: stockRow.name as string,
          sector: stockRow.sector as string | null,
          pinyin: stockRow.pinyin as string | null,
          is_tracked: stockRow.is_tracked as number,
          created_at: stockRow.created_at as string,
        },
        market_data: marketRow ? {
          price: marketRow.price,
          change_pct: marketRow.change_pct,
          pe_ttm: marketRow.pe_ttm,
          pb: marketRow.pb,
          market_cap: marketRow.market_cap,
        } as any : null,
        financial: financialRow ? financialRow as any : null,
        analysis: {
          pmqd_total: analysisRow.pmqd_total as number,
          pmqd_p_score: analysisRow.pmqd_p_score as number,
          pmqd_m_score: analysisRow.pmqd_m_score as number,
          pmqd_q_score: analysisRow.pmqd_q_score as number,
          pmqd_d_score: analysisRow.pmqd_d_score as number,
          pmqd_stars: analysisRow.pmqd_stars as string,
          pmqd_verdict: analysisRow.pmqd_verdict as string,
          kelly_f: analysisRow.kelly_f as number,
          strategy: analysisRow.strategy as string,
          safety_total: analysisRow.safety_total as number,
          solvency_score: analysisRow.solvency_score as number,
          health_check_score: analysisRow.health_check_score as number,
          data_freshness: analysisRow.data_freshness as string,
          generated_at: analysisRow.generated_at as string,
        } as any,
        modules,
      },
    } satisfies ReportResponse);
  } catch (err) {
    console.error('Report error:', err);
    return c.json({ status: 'error', message: 'Failed to fetch report' } as ReportResponse, 500);
  }
});
