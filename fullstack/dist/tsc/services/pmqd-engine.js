// ═══════════════════════════════════════════════
// 风林慧策 — PMQD V5.9 轻量评分引擎
// 在 Workers 环境中运行的简化版，完整版在 GitHub Actions
// ═══════════════════════════════════════════════
/**
 * P — Price Safety Margin (0-40)
 * Based on: PE relative to intrinsic, dividend yield, payback period
 */
function computeP(input) {
    let score = 0;
    // PE valuation (max 20)
    // intrinsic PE = 12.5x for Strategy 2 boundary
    if (input.eff_pe <= 0) {
        score += 0;
    }
    else if (input.eff_pe <= 8) {
        score += 20;
    }
    else if (input.eff_pe <= 10) {
        score += 16;
    }
    else if (input.eff_pe <= 12) {
        score += 12;
    }
    else if (input.eff_pe <= 15) {
        score += 8;
    }
    else if (input.eff_pe <= 20) {
        score += 4;
    }
    else {
        score += 0;
    }
    // Dividend yield bonus (max 10)
    if (input.div_yield_ttm >= 5)
        score += 10;
    else if (input.div_yield_ttm >= 4)
        score += 8;
    else if (input.div_yield_ttm >= 3)
        score += 6;
    else if (input.div_yield_ttm >= 2)
        score += 4;
    else if (input.div_yield_ttm >= 1)
        score += 2;
    // PB discount (max 10)
    if (input.pb <= 0.7)
        score += 10;
    else if (input.pb <= 1.0)
        score += 8;
    else if (input.pb <= 1.5)
        score += 6;
    else if (input.pb <= 2.0)
        score += 4;
    else if (input.pb <= 3.0)
        score += 2;
    return Math.min(score, 40);
}
/**
 * M — Moat / Catalyst (0-18)
 */
function computeM(input) {
    let score = 0;
    // Industry catalyst (max 9)
    if (input.catalyst_strength >= 80)
        score += 9;
    else if (input.catalyst_strength >= 60)
        score += 7;
    else if (input.catalyst_strength >= 40)
        score += 5;
    else if (input.catalyst_strength >= 20)
        score += 3;
    else
        score += 1;
    // Management quality (max 9)
    if (input.management_quality >= 80)
        score += 9;
    else if (input.management_quality >= 60)
        score += 7;
    else if (input.management_quality >= 40)
        score += 5;
    else if (input.management_quality >= 20)
        score += 3;
    else
        score += 1;
    return Math.min(score, 18);
}
/**
 * Q — Quality (0-30)
 */
function computeQ(input) {
    let score = 0;
    // ROE (max 15)
    if (input.roe >= 25)
        score += 15;
    else if (input.roe >= 20)
        score += 12;
    else if (input.roe >= 15)
        score += 10;
    else if (input.roe >= 10)
        score += 7;
    else if (input.roe >= 5)
        score += 4;
    else
        score += 0;
    // FCF / Net Profit (max 10)
    const fcfRatio = input.net_profit > 0 ? input.fcf / input.net_profit : 0;
    if (fcfRatio >= 1.0)
        score += 10;
    else if (fcfRatio >= 0.8)
        score += 8;
    else if (fcfRatio >= 0.5)
        score += 5;
    else if (fcfRatio >= 0.3)
        score += 3;
    else
        score += 0;
    // Moat depth (max 5)
    if (input.moat_depth >= 80)
        score += 5;
    else if (input.moat_depth >= 60)
        score += 4;
    else if (input.moat_depth >= 40)
        score += 3;
    else if (input.moat_depth >= 20)
        score += 2;
    else
        score += 1;
    return Math.min(score, 30);
}
/**
 * D — Discount / Mispricing (0-12)
 */
function computeD(input) {
    let score = 0;
    // Market sentiment contrarian indicator (max 6)
    if (input.market_sentiment <= 20)
        score += 6; // Very bearish = opportunity
    else if (input.market_sentiment <= 40)
        score += 5;
    else if (input.market_sentiment <= 60)
        score += 3;
    else if (input.market_sentiment <= 80)
        score += 1;
    else
        score += 0; // Euphoric = no discount
    // Net cash discount (max 6)
    const netCashRatio = input.market_cap > 0 ? input.net_cash / input.market_cap : 0;
    if (netCashRatio >= 0.3)
        score += 6;
    else if (netCashRatio >= 0.2)
        score += 5;
    else if (netCashRatio >= 0.1)
        score += 3;
    else if (netCashRatio >= 0.05)
        score += 2;
    else if (netCashRatio > 0)
        score += 1;
    return Math.min(score, 12);
}
/**
 * Kelly Criterion V5.2
 * b = (PE_intrinsic - PE_current) / PE_current
 * p = (safety_score + health_score + confidence) / 100
 */
function computeKelly(input, pScore, qScore) {
    const PE_INTRINSIC = 12.5;
    // b = potential return ratio
    const b = input.eff_pe > 0 ? Math.max((PE_INTRINSIC - input.eff_pe) / input.eff_pe, 0) : 0;
    // p = estimated win probability
    // Base confidence from safety + quality scores
    const baseConfidence = Math.min(((pScore / 40) * 0.4 + (qScore / 30) * 0.4 + 0.3), 0.85);
    const p = baseConfidence;
    const q = 1 - p;
    // f* = (b*p - q) / b
    const kellyF = b > 0 ? Math.max((b * p - q) / b, 0) : 0;
    let verdict;
    if (kellyF >= 0.3)
        verdict = '重仓·高置信度';
    else if (kellyF >= 0.15)
        verdict = '适度仓位·半凯利';
    else if (kellyF >= 0.05)
        verdict = '小仓位·观察仓';
    else if (kellyF > 0.001)
        verdict = '微量观察';
    else
        verdict = '估值偏高·暂不建仓';
    return { kelly_f: kellyF, kelly_b: b, kelly_p: p, verdict };
}
/**
 * Safety margin 3 questions
 */
function computeSafety(input) {
    // Q1: Won't go bankrupt? Net cash > 0
    const q1 = input.net_cash > 0;
    // Q2: If price drops 50%, still safe? Market cap * 50% <= net assets
    const q2 = input.market_cap * 0.5 <= input.net_assets;
    // Q3: 5 years of FCF covers effective market cap?
    const q3 = input.fcf * 5 >= (input.market_cap - input.net_cash);
    return { q1, q2, q3, total: [q1, q2, q3].filter(Boolean).length };
}
/**
 * Classify strategy
 */
function classifyStrategy(input) {
    if (input.roe >= 15 && input.eff_pe > 0 && input.eff_pe < 12) {
        return { strategy: 'strategy-2', label: '策略二·深度价值' };
    }
    else if (input.roe >= 15 && input.eff_pe >= 12) {
        return { strategy: 'strategy-2-boundary', label: '策略二边界·价值观察' };
    }
    else if (input.pb <= 0.7) {
        return { strategy: 'strategy-1', label: '策略一·烟蒂股' };
    }
    else if (input.roe >= 10) {
        return { strategy: 'observation', label: '观察级·等待击球区' };
    }
    return { strategy: 'pass', label: '暂不符合买入标准' };
}
/**
 * Main PMQD V5.9 computation engine
 */
export function computePMQD(input) {
    const pScore = computeP(input);
    const mScore = computeM(input);
    const qScore = computeQ(input);
    const dScore = computeD(input);
    const total = pScore + mScore + qScore + dScore;
    // Stars
    let stars;
    if (total >= 80)
        stars = '★★★★★';
    else if (total >= 65)
        stars = '★★★★☆';
    else if (total >= 50)
        stars = '★★★☆☆';
    else if (total >= 35)
        stars = '★★☆☆☆';
    else
        stars = '★☆☆☆☆';
    // Verdict
    let verdict;
    if (total >= 80)
        verdict = '买入级·高置信度';
    else if (total >= 65)
        verdict = '配置级·重点关注';
    else if (total >= 50)
        verdict = '观察级·策略二边界';
    else if (total >= 35)
        verdict = '观望级·条件不足';
    else
        verdict = '回避级·暂不建议';
    const kelly = computeKelly(input, pScore, qScore);
    const safety = computeSafety(input);
    const strategy = classifyStrategy(input);
    return {
        pmqd_total: total,
        pmqd_P: { score: pScore, max: 40, label: '价格安全' },
        pmqd_M: { score: mScore, max: 18, label: '行业催化' },
        pmqd_Q: { score: qScore, max: 30, label: '硬质量' },
        pmqd_D: { score: dScore, max: 12, label: '认知差' },
        stars,
        verdict,
        kelly_f: kelly.kelly_f,
        kelly_b: kelly.kelly_b,
        kelly_p: kelly.kelly_p,
        kelly_verdict: kelly.verdict,
        safety,
        strategy: strategy.strategy,
        strategy_label: strategy.label,
    };
}
//# sourceMappingURL=pmqd-engine.js.map