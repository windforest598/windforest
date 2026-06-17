// ═══════════════════════════════════════════════
// 风林慧策 API — /api/report 路由
// 完整分析报告（15模块 JSON）
// ═══════════════════════════════════════════════
import { Hono } from 'hono';
import { getDB } from '../db/client';
export const reportRoute = new Hono();
reportRoute.get('/', async (c) => {
    const code = c.req.query('code');
    const market = c.req.query('market') || 'sz';
    if (!code) {
        return c.json({ status: 'error', message: 'Missing code parameter' }, 400);
    }
    try {
        const db = getDB(c);
        const fullCode = market === 'us' ? `us${code}` :
            market === 'hk' ? `hk${code}` :
                `${market}${code}`;
        // Fetch stock
        const stockRow = await db.prepare(`SELECT * FROM stocks WHERE full_code = ? OR code = ? LIMIT 1`).bind(fullCode, code).first();
        if (!stockRow) {
            return c.json({ status: 'error', message: 'Stock not found' }, 404);
        }
        const stockId = stockRow.id;
        // Fetch analysis
        const analysisRow = await db.prepare(`SELECT * FROM analysis_cache WHERE stock_id = ?`).bind(stockId).first();
        if (!analysisRow) {
            return c.json({
                status: 'pending',
                message: '该标的尚未完成深度分析，请稍后重试',
            });
        }
        // Fetch market data
        const marketRow = await db.prepare(`SELECT * FROM market_data WHERE stock_id = ?`).bind(stockId).first();
        // Fetch financial data
        const financialRow = await db.prepare(`SELECT * FROM financial_data WHERE stock_id = ? ORDER BY fiscal_year DESC LIMIT 1`).bind(stockId).first();
        // Parse report JSON
        let modules = [];
        try {
            const reportJson = analysisRow.report_json;
            if (reportJson) {
                const parsed = JSON.parse(reportJson);
                modules = parsed.modules || [];
            }
        }
        catch {
            modules = [];
        }
        return c.json({
            status: 'ok',
            data: {
                stock: {
                    id: stockRow.id,
                    code: stockRow.code,
                    full_code: stockRow.full_code,
                    market: stockRow.market,
                    market_type: stockRow.market_type,
                    name: stockRow.name,
                    sector: stockRow.sector,
                    pinyin: stockRow.pinyin,
                    is_tracked: stockRow.is_tracked,
                    created_at: stockRow.created_at,
                },
                market_data: marketRow ? {
                    price: marketRow.price,
                    change_pct: marketRow.change_pct,
                    pe_ttm: marketRow.pe_ttm,
                    pb: marketRow.pb,
                    market_cap: marketRow.market_cap,
                } : null,
                financial: financialRow ? financialRow : null,
                analysis: {
                    pmqd_total: analysisRow.pmqd_total,
                    pmqd_p_score: analysisRow.pmqd_p_score,
                    pmqd_m_score: analysisRow.pmqd_m_score,
                    pmqd_q_score: analysisRow.pmqd_q_score,
                    pmqd_d_score: analysisRow.pmqd_d_score,
                    pmqd_stars: analysisRow.pmqd_stars,
                    pmqd_verdict: analysisRow.pmqd_verdict,
                    kelly_f: analysisRow.kelly_f,
                    strategy: analysisRow.strategy,
                    safety_total: analysisRow.safety_total,
                    solvency_score: analysisRow.solvency_score,
                    health_check_score: analysisRow.health_check_score,
                    data_freshness: analysisRow.data_freshness,
                    generated_at: analysisRow.generated_at,
                },
                modules,
            },
        });
    }
    catch (err) {
        console.error('Report error:', err);
        return c.json({ status: 'error', message: 'Failed to fetch report' }, 500);
    }
});
//# sourceMappingURL=report.js.map