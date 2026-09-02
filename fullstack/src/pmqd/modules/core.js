// Layer: core — the analytical heart. Runs for every non-vetoed strategy.
// Cross-references: financial_penetration flags an implicit-cash candidate that the
// conditional module later consumes; pmqd_scoring writes ctx.results.pmqdTotal used by rating.
//
// V6.0.7：全部评分口径统一改为从 rules/pmqd-v607.js 取用（固定权重 P40/M18/Q30/D12、
// 三问 17 分制、控股公司结构性修正），禁止本文件内硬编码权重。

import {
  scorePMQD, scoreSafetyMargin, applyHoldingCoCorrection, starRating,
} from '../rules/pmqd-v607.js';

export const industryScan = {
  id: 'industry_scan',
  layer: 'core',
  title: { zh: '行业全景扫描', en: 'Industry Holistic Scan (V6.0 NEW)' },
  appliesTo: ['*'],
  compute(ctx) {
    const swing = ctx.l1.swingFactor || '未识别';
    const players = ctx.l1.playerCount || 0;
    const data = { swingFactor: swing, playerCount: players, note: '翻转每块石头，找出行业摆动因子。' };
    ctx.results.industry_scan = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv"><p>行业玩家约 <b>${d.playerCount}</b> 家，关键摆动因子：<b>${d.swingFactor}</b>。</p><p class="wf-muted">${d.note}</p></div>`,
    md: (d) => `**行业全景**：玩家约 ${d.playerCount} 家，摆动因子：${d.swingFactor}。`,
    docx: (d) => `<p><b>行业全景</b>：玩家约 ${d.playerCount} 家，摆动因子：${d.swingFactor}。</p>`,
  },
};

export const userValue = {
  id: 'user_value',
  layer: 'core',
  title: { zh: '用户价值验证', en: 'User Value Verification (V6.0 NEW)' },
  appliesTo: ['*'],
  compute(ctx) {
    const score = ctx.l1.userValueScore ?? 0;
    const data = { score, irreplaceable: score >= 70, note: '不可替代的刚需才是好生意。' };
    ctx.results.user_value = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv"><span class="wf-tag ${d.irreplaceable ? 'wf-ok' : 'wf-warn'}">用户价值 ${d.score}/100 ${d.irreplaceable ? '· 刚需' : '· 非刚需'}</span></div>`,
    md: (d) => `**用户价值**：${d.score}/100（${d.irreplaceable ? '刚需' : '非刚需'}）。`,
    docx: (d) => `<p><b>用户价值</b>：${d.score}/100（${d.irreplaceable ? '刚需' : '非刚需'}）。</p>`,
  },
};

export const financialPenetration = {
  id: 'financial_penetration',
  layer: 'core',
  title: { zh: '财务穿透', en: 'Financial Penetration' },
  appliesTo: ['*'],
  compute(ctx) {
    const bs = ctx.l1.balanceSheet || {};
    const cash = bs.cash ?? 0;
    const debt = bs.debt ?? 0;
    const netCash = cash - debt;
    const ncav = (bs.currentAssets ?? 0) - (bs.totalLiabilities ?? 0);
    // Rule 5.12 signal: dividend receivable present -> implicit cash candidate
    const divRecv = bs.dividendReceivable ?? 0;
    const implicitCashCandidate = divRecv > 0;
    const data = { netCash, ncav, implicitCashCandidate, dividendReceivable: divRecv };
    ctx.results.financial_penetration = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv">
      <p>净现金 <b>¥${d.netCash}</b> 亿 ｜ NCAV <b>¥${d.ncav}</b> 亿</p>
      ${d.implicitCashCandidate ? '<p class="wf-warn">检测到应收股利 ¥' + d.dividendReceivable + ' 亿 → 触发「隐含现金资产」模块（规则 5.12）。</p>' : ''}
    </div>`,
    md: (d) => `**财务穿透**：净现金 ¥${d.netCash} 亿，NCAV ¥${d.ncav} 亿。${d.implicitCashCandidate ? ' 应收股利→触发隐含现金模块。' : ''}`,
    docx: (d) => `<p><b>财务穿透</b>：净现金 ¥${d.netCash} 亿，NCAV ¥${d.ncav} 亿。</p>`,
  },
};

export const pmqdScoring = {
  id: 'pmqd_scoring',
  layer: 'core',
  title: { zh: 'PMQD 四维评分', en: 'PMQD Four-Dimension Scoring (V6.0.7)' },
  appliesTo: ['*'],
  compute(ctx) {
    const source = ctx.l1.pmqd || { P: 50, M: 50, Q: 50, D: 50 };

    // V6.0.7 控股公司结构性修正：已兑现利好不得计零（Q 现金流 / M 产品周期 / M 分红）
    const { adjusted, corrections, applied } = applyHoldingCoCorrection(source, ctx.l1.holdingCo);

    // 固定权重加权（P40 / M18 / Q30 / D12），不随策略浮动
    const scored = scorePMQD(adjusted);
    const stars = starRating(scored.total);

    const data = {
      raw: scored.raw,
      original: source,
      points: scored.points,
      weights: scored.weights,
      total: scored.total,
      stars: stars.stars,
      ratingLabel: stars.label,
      positionHint: stars.positionHint,
      strategy: ctx.strategy,
      corrections,
      correctionApplied: applied,
      verified: ctx.l1._verified || null,
    };
    ctx.results.pmqd_scoring = data;
    ctx.results.pmqdTotal = scored.total;      // exposed for rating_conclusion
    ctx.results.pmqdCorrections = corrections; // exposed for risk-notch downgrade
    return data;
  },
  render: {
    html: (d) => {
      const unv = d.verified
        ? Object.entries(d.verified).filter(([, v]) => !v).map(([k]) => k)
        : [];
      return `<div class="wf-kv">
      <div class="wf-scores">
        <span>价格 P ${d.raw.P} → ${d.points.P}/${d.weights.P}</span>
        <span>催化 M ${d.raw.M} → ${d.points.M}/${d.weights.M}</span>
        <span>质量 Q ${d.raw.Q} → ${d.points.Q}/${d.weights.Q}</span>
        <span>认知差 D ${d.raw.D} → ${d.points.D}/${d.weights.D}</span>
      </div>
      <p>固定权重 P40/M18/Q30/D12 加权 → <b class="wf-big">PMQD 总分 ${d.total}</b> <b>${d.stars}</b> ${d.ratingLabel}</p>
      <p class="wf-muted">仓位指引：${d.positionHint}</p>
      ${unv.length ? `<p class="wf-warn">未核验维度：${unv.join('、')}（取中性基准，非实测值）。</p>` : ''}
      ${d.correctionApplied ? d.corrections.map((c) => `<p class="wf-warn">【${c.rule}】${c.dim} ${c.delta > 0 ? '+' : ''}${c.delta}：${c.note}</p>`).join('') : ''}
    </div>`;
    },
    md: (d) => `**PMQD 评分**（固定权重 P40/M18/Q30/D12）：`
      + `P${d.raw.P}→${d.points.P} M${d.raw.M}→${d.points.M} Q${d.raw.Q}→${d.points.Q} D${d.raw.D}→${d.points.D}`
      + ` → 总分 **${d.total}** ${d.stars}（${d.ratingLabel}）`
      + (d.correctionApplied ? `\n\n> V6.0.7 修正：${d.corrections.map((c) => `${c.rule}（${c.dim} ${c.delta > 0 ? '+' : ''}${c.delta}）`).join('；')}` : ''),
    docx: (d) => `<p><b>PMQD 评分</b>：总分 <b>${d.total}</b> ${d.stars}（P${d.points.P}/M${d.points.M}/Q${d.points.Q}/D${d.points.D}，固定权重 40/18/30/12）。</p>`,
  },
};

export const safetyMargin = {
  id: 'safety_margin',
  layer: 'core',
  title: { zh: '安全边际三问', en: 'Safety Margin Three-Question Test' },
  appliesTo: ['*'],
  compute(ctx) {
    // V6.0.7：每问 17 分，上限 50 分（供凯利胜率 p 使用）
    const scored = scoreSafetyMargin(ctx.l1.safetyAnswers, ctx.l1.safetyIndeterminate);
    const data = {
      ...scored,
      marginPct: ctx.l1.marginPct ?? 0,
      questions: [
        '① 行业若不复苏，公司是否也不会破产/退市？',
        '② 股价若再跌 50%，净资产能否支撑市值？',
        '③ 五年累计自由现金流能否覆盖有效市值？',
      ],
    };
    ctx.results.safety_margin = data;
    ctx.results.safetyScore = scored.score;   // exposed for kelly_position
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv">
      <p>三问：①${d.answers.q1 ? '✓' : '✗'} ②${d.answers.q2 ? '✓' : '✗'} ③${d.answers.q3 ? '✓' : '✗'}
        → <b>${d.passed ? '通过' : '未通过'}</b> ｜ 得分 <b class="wf-big">${d.score}/${d.max}</b>（每问 17 分）</p>
      <p class="wf-muted">安全边际 ${d.marginPct}%</p>
      ${d.indeterminate ? '<p class="wf-warn">无净现金/自由现金流支撑，三问保守判为未通过（非实测结论），需补 L1 财报穿透。</p>' : ''}
      ${d.downgrade && !d.indeterminate ? '<p class="wf-warn">存在「否」项 → 触发评级降档。</p>' : ''}
    </div>`,
    md: (d) => `**安全边际三问**：${d.passed ? '通过' : '未通过'}，得分 ${d.score}/${d.max}（每问 17 分）。`
      + (d.indeterminate ? ' ⚠️ 无财报支撑，保守判定，非实测。' : ''),
    docx: (d) => `<p><b>安全边际三问</b>：${d.passed ? '通过' : '未通过'}，得分 ${d.score}/${d.max}。</p>`,
  },
};
