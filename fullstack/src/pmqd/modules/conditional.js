// Layer: conditional — only assembled when triggered. This is what proves modules stay coherent:
// implicit_cash fires only because financial_penetration set implicitCashCandidate; hold_test is an add-on.

export const implicitCash = {
  id: 'implicit_cash',
  layer: 'conditional',
  title: { zh: '隐含现金资产（规则 5.12）', en: 'Implicit Cash Asset (Rule 5.12)' },
  appliesTo: ['*'],
  // Trigger: only when financial_penetration flagged a dividend-receivable candidate AND
  // the three V6.0 conditions are met (L1 confirmed profit, stable payout habit, high certainty).
  trigger(ctx) {
    const cand = ctx.results.financial_penetration?.implicitCashCandidate;
    const c = ctx.l1.rule512;
    return !!cand && !!c?.l1Confirmed && !!c?.stablePayout && !!c?.highCertainty;
  },
  compute(ctx) {
    const recv = ctx.results.financial_penetration.dividendReceivable;
    const c = ctx.l1.rule512;
    const conservative = recv * (c.conservativePct ?? 0.7);
    const base = recv * (c.basePct ?? 0.9);
    const optimistic = recv * (c.optimisticPct ?? 1.0);
    const data = {
      receivable: recv,
      scenarios: { conservative: Math.round(conservative), base: Math.round(base), optimistic: Math.round(optimistic) },
      uncertainty: '仅作情景估算，不得作固定数字入账',
    };
    ctx.results.implicit_cash = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv wf-cond">
      <span class="wf-tag wf-cond-tag">规则 5.12 · 条件触发</span>
      <p>应收股利 ¥${d.receivable} 亿，满足三条件，按三情景计入隐含现金：</p>
      <div class="wf-scores">
        <span>保守 ${d.scenarios.conservative}</span><span>基准 ${d.scenarios.base}</span><span>乐观 ${d.scenarios.optimistic}</span>
      </div>
      <p class="wf-warn">${d.uncertainty}。</p>
    </div>`,
    md: (d) => `**隐含现金（5.12）**：应收股利 ¥${d.receivable} 亿，三情景（保守/基准/乐观）${d.scenarios.conservative}/${d.scenarios.base}/${d.scenarios.optimistic} 亿。${d.uncertainty}。`,
    docx: (d) => `<p><b>隐含现金（5.12）</b>：应收股利 ¥${d.receivable} 亿，三情景 ${d.scenarios.conservative}/${d.scenarios.base}/${d.scenarios.optimistic} 亿。</p>`,
  },
};

export const holdTest = {
  id: 'hold_test',
  layer: 'conditional',
  title: { zh: '持有附加测试', en: 'Add-on Holding Test (V6.0 NEW)' },
  appliesTo: ['*'],
  trigger: (ctx) => !ctx.veto,
  compute(ctx) {
    const happy = ctx.l1.holdTestHappy ?? false;
    const data = {
      happy,
      flag: happy ? null : '持有信念受时间维度考验（若三问通过仍不全额给长期主义维度分）',
    };
    ctx.results.hold_test = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv wf-cond">
      <span class="wf-tag wf-cond-tag">附加测试 · 条件触发</span>
      <p>${d.happy ? '停牌 5 年仍乐意持有 → 长期主义维度全额。' : '停牌 5 年不愿持有 → ' + d.flag}</p>
    </div>`,
    md: (d) => `**持有附加测试**：${d.happy ? '通过（长期主义全额）。' : d.flag}`,
    docx: (d) => `<p><b>持有附加测试</b>：${d.happy ? '通过。' : d.flag}</p>`,
  },
};
