// ═══════════════════════════════════════════════
// 风林慧策 API — /api/analysis 路由
// PMQD 分析结果（四维评分 + 凯利 + 安全边际）
// ═══════════════════════════════════════════════
import { Hono } from 'hono';
import { getDB } from '../db/client';
export const analysisRoute = new Hono();
analysisRoute.get('/', async (c) => {
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
        const stock = await db.prepare(`SELECT id, name FROM stocks WHERE full_code = ? OR code = ? LIMIT 1`).bind(fullCode, code).first();
        if (!stock) {
            return c.json({ status: 'error', message: 'Stock not found' }, 404);
        }
        const stockId = stock.id;
        // Check analysis cache
        const row = await db.prepare(`SELECT * FROM analysis_cache WHERE stock_id = ?`).bind(stockId).first();
        if (row) {
            const generatedAt = row.generated_at;
            const ageMs = Date.now() - new Date(generatedAt).getTime();
            const isStale = ageMs > 24 * 60 * 60 * 1000;
            return c.json({
                status: 'ok',
                data: {
                    id: row.id,
                    stock_id: row.stock_id,
                    pmqd_total: row.pmqd_total,
                    pmqd_p_score: row.pmqd_p_score,
                    pmqd_m_score: row.pmqd_m_score,
                    pmqd_q_score: row.pmqd_q_score,
                    pmqd_d_score: row.pmqd_d_score,
                    pmqd_stars: row.pmqd_stars,
                    pmqd_verdict: row.pmqd_verdict,
                    kelly_f: row.kelly_f,
                    kelly_b: row.kelly_b,
                    kelly_p: row.kelly_p,
                    kelly_verdict: row.kelly_verdict,
                    strategy: row.strategy,
                    safety_q1_pass: row.safety_q1_pass,
                    safety_q2_pass: row.safety_q2_pass,
                    safety_q3_pass: row.safety_q3_pass,
                    safety_total: row.safety_total,
                    solvency_score: row.solvency_score,
                    health_check_score: row.health_check_score,
                    report_json: row.report_json,
                    data_freshness: isStale ? 'stale' : row.data_freshness,
                    generated_at: row.generated_at,
                    data_sources: row.data_sources,
                },
            });
        }
        // Not analyzed yet
        return c.json({
            status: 'pending',
            message: '该标的尚未完成分析。请稍后重试，或触发手动分析。',
            estimated_time: '3-5 分钟',
        });
    }
    catch (err) {
        console.error('Analysis error:', err);
        return c.json({ status: 'error', message: 'Failed to fetch analysis' }, 500);
    }
});
//# sourceMappingURL=analysis.js.map