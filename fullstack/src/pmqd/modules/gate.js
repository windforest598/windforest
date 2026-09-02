// Layer: gate — integrity review (veto) runs first, then strategy classification.
// These two set the state every downstream module depends on (ctx.veto, ctx.strategy).

import { setVeto } from '../context.js';

export const integrityReview = {
  id: 'integrity_review',
  layer: 'gate',
  title: { zh: '诚信审查（一票否决）', en: 'Integrity Review (Veto Gate)' },
  appliesTo: ['*'],
  compute(ctx) {
    const issues = ctx.l1.integrityIssues || [];
    const current = issues.filter((i) => i.type === 'current');
    const historical = issues.filter((i) => i.type === 'historical');
    const passed = current.length === 0;
    if (!passed) {
      setVeto(ctx, 'integrity_review', `现任管理层诚信问题：${current.map((i) => i.desc).join('；')}`);
    }
    // V6.0 rule: historical ex-management issue does NOT veto, but forces Strategy 1.
    if (historical.length > 0) ctx.forceStrategy1 = true;
    const data = {
      passed,
      current,
      historical,
      forcedStrategy1: historical.length > 0,
      vetoReason: ctx.veto?.reason || null,
    };
    ctx.results.integrity_review = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv">
      <span class="wf-tag ${d.passed ? 'wf-ok' : 'wf-bad'}">${d.passed ? '审查通过' : '一票否决'}</span>
      ${d.forcedStrategy1 ? '<span class="wf-tag wf-warn">历史问题→强制策略一</span>' : ''}
      ${d.current.length ? `<p class="wf-danger">现任问题：${d.current.map((i) => i.desc).join('；')}</p>` : '<p class="wf-muted">无现任管理层诚信问题。</p>'}
      ${d.historical.length ? `<p class="wf-muted">历史问题（不否决，降级策略一）：${d.historical.map((i) => i.desc).join('；')}</p>` : ''}
    </div>`,
    md: (d) => `**诚信审查**：${d.passed ? '通过' : '一票否决'}。${d.forcedStrategy1 ? '历史问题→强制策略一。' : ''}${d.current.length ? ' 现任问题：' + d.current.map((i) => i.desc).join('；') : ''}`,
    docx: (d) => `<p><b>诚信审查</b>：${d.passed ? '通过' : '一票否决'}。${d.forcedStrategy1 ? '历史问题→强制策略一。' : ''}</p>`,
  },
};

export const strategyClassification = {
  id: 'strategy_classification',
  layer: 'gate',
  title: { zh: '策略归属判定', en: 'Strategy Classification' },
  appliesTo: ['*'],
  compute(ctx) {
    // A vetoed report is not rated, so strategy classification is skipped.
    if (ctx.veto) {
      const d = { strategy: null, rationale: '已触发一票否决，跳过策略归属', vetoed: true };
      ctx.results.strategy_classification = d;
      return d;
    }
    let strategy;
    let rationale;
    if (ctx.forceStrategy1) {
      strategy = 'S1';
      rationale = '历史管理层诚信问题，强制归入策略一（烟蒂/深度价值）。';
    } else {
      const q = ctx.l1.qualityScore ?? 50;
      const disc = ctx.l1.discountDepth ?? 50;
      const moat = ctx.l1.moatStrength ?? 50;
      if (disc >= 60 && q < 55) {
        strategy = 'S1';
        rationale = `深度折价(${disc})且质量一般(${q})，归入策略一（烟蒂型）。`;
      } else if (moat >= 65 && q >= 70) {
        strategy = 'S2';
        rationale = `强护城河(${moat})且高质量(${q})，归入策略二（优质成长/品牌）。`;
      } else {
        strategy = 'S3';
        rationale = '特殊情景（套利/重组/困境），归入策略三。';
      }
    }
    ctx.strategy = strategy;
    const data = { strategy, rationale, hints: { quality: ctx.l1.qualityScore, discount: ctx.l1.discountDepth, moat: ctx.l1.moatStrength } };
    ctx.results.strategy_classification = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv">
      <span class="wf-badge">策略 ${d.strategy}</span>
      <p class="wf-muted">${d.rationale}</p>
    </div>`,
    md: (d) => `**策略归属**：策略 ${d.strategy} — ${d.rationale}`,
    docx: (d) => `<p><b>策略归属</b>：策略 ${d.strategy} — ${d.rationale}</p>`,
  },
};
