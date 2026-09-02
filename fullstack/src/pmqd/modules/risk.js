// Layer: risk — 8-dimension health check + cognitive-risk alert.
// Cognitive risk is V6.0's "biggest risk is not understanding the company" item.
//
// V6.0.7：8 维体检改为规范口径「每维 4 分，上限 30 分」（原实现为 0-100 均分，
// 与凯利胜率 p 的 30 分档位不兼容）；风险预警新增「已派息 → 分红不确定性机械降一档」。

import { scoreHealth8d, downgradeRisk } from '../rules/pmqd-v607.js';

export const healthCheck8d = {
  id: 'health_check_8d',
  layer: 'risk',
  title: { zh: '8 维深度体检', en: '8-Dimension Health Check (V6.0.7)' },
  appliesTo: ['*'],
  compute(ctx) {
    const scored = scoreHealth8d(ctx.l1.health8d, ctx.l1.healthIndeterminate);
    ctx.results.health_check_8d = scored;
    ctx.results.health8dScore = scored.score;   // exposed for kelly_position (0-30)
    return scored;
  },
  render: {
    html: (d) => {
      const rows = d.per.map((x) => `<span>${x.dim} ${x.pts}/4</span>`).join('');
      return `<div class="wf-kv">
        <div class="wf-scores">${rows}</div>
        <p>体检合计 <b class="wf-big">${d.score}/${d.max}</b>（每维 4 分，上限 30）${d.capped ? ' ｜ 已按上限截取' : ''}</p>
        ${d.indeterminate ? '<p class="wf-warn">未接入财报，各维取中性基准（非实测值），得分仅作占位。</p>' : ''}
      </div>`;
    },
    md: (d) => `**8 维体检**：合计 ${d.score}/${d.max}（每维 4 分）—— ${d.per.map((x) => x.dim + ' ' + x.pts).join('、')}。`
      + (d.indeterminate ? ' ⚠️ 未接入财报，取中性基准。' : ''),
    docx: (d) => `<p><b>8 维体检</b>：合计 ${d.score}/${d.max}（每维 4 分，上限 30）。</p>`,
  },
};

export const cognitiveRisk = {
  id: 'cognitive_risk',
  layer: 'risk',
  title: { zh: '认知风险预警', en: 'Cognitive Risk Alert (V6.0 NEW)' },
  appliesTo: ['*'],
  compute(ctx) {
    const conviction = ctx.l1.conviction ?? '中';
    const assumptions = ctx.l1.unverifiedAssumptions || [];

    // 风险清单：默认项 + V6.0.7 机械降档
    const hc = ctx.l1.holdingCo || {};
    const items = [];

    // 分红政策不确定性 —— 已实际派息（L1 证据）则至少降一档
    const divBase = ctx.l1.dividendRiskBase || '中高';
    if (hc.dividendActuallyPaid) {
      const structural = hc.payoutOverReceived && (hc.payoutPeriodsVerified ?? 0) >= 2;
      items.push({
        category: '分红政策不确定性',
        level: structural ? '中' : downgradeRisk(divBase, 1),
        base: divBase,
        downgraded: true,
        signal: structural
          ? `连续 ${hc.payoutPeriodsVerified} 期派息超实收分红 100% → 结构性高分红意愿，风险定为「中」，不得标注「待定」。`
          : '已取得 L1 实际派息证据 → 按 V6.0.7 机械降一档。',
      });
    } else if (ctx.l1.dividendRiskBase) {
      items.push({ category: '分红政策不确定性', level: divBase, base: divBase, downgraded: false, signal: '未取得实际派息 L1 证据，维持原档。' });
    }

    // 认知风险（V6.0 铁律：最大风险是不理解公司）
    items.push({
      category: '认知风险',
      level: conviction === '高' ? '低' : conviction === '中' ? '中' : '高',
      base: null,
      downgraded: false,
      signal: `认知确信度 ${conviction}；未验证假设 ${assumptions.length} 项。`,
    });

    // 数据完备性风险
    if (ctx.l1.balanceSheetMissing) {
      items.push({
        category: '数据完备性',
        level: '高',
        base: null,
        downgraded: false,
        signal: '未接入资产负债表/现金流量表，净现金与 FCF 无法穿透，评分含中性基准占位。',
      });
    }

    const data = { conviction, assumptions, items, note: '最大风险是不理解公司，而非外部环境。' };
    ctx.results.cognitive_risk = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv">
      <span class="wf-tag ${d.conviction === '高' ? 'wf-ok' : 'wf-warn'}">认知确信度：${d.conviction}</span>
      ${d.items.length ? `<table class="wf-risk"><thead><tr><th>风险类别</th><th>等级</th><th>预警信号</th></tr></thead><tbody>${
        d.items.map((i) => `<tr><td>${i.category}</td><td><b>${i.level}</b>${i.downgraded ? `<span class="wf-muted">（原 ${i.base}，V6.0.7 降档）</span>` : ''}</td><td>${i.signal}</td></tr>`).join('')
      }</tbody></table>` : ''}
      ${d.assumptions.length ? '<p class="wf-warn">未验证假设：' + d.assumptions.join('；') + '</p>' : '<p class="wf-muted">无重大未验证假设。</p>'}
      <p class="wf-muted">${d.note}</p>
    </div>`,
    md: (d) => `**认知风险**：确信度 ${d.conviction}。\n\n`
      + (d.items.length ? '| 风险类别 | 等级 | 预警信号 |\n|---|---|---|\n' + d.items.map((i) => `| ${i.category} | ${i.level}${i.downgraded ? `（原 ${i.base}·降档）` : ''} | ${i.signal} |`).join('\n') + '\n' : '')
      + (d.assumptions.length ? `\n未验证假设：${d.assumptions.join('；')}` : ''),
    docx: (d) => `<p><b>认知风险</b>：确信度 ${d.conviction}。共 ${d.items.length} 项风险预警。</p>`,
  },
};
