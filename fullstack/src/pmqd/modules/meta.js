// Layer: meta — report header band. Renders LAST (after all compute) but is registered first,
// so it can pull the resolved strategy + final rating from ctx (the coherence glue).

export const reportHeader = {
  id: 'report_header',
  layer: 'meta',
  title: { zh: '报告头 · 数据来源', en: 'Report Header · Data Sources' },
  appliesTo: ['*'],
  compute(ctx) {
    const data = {
      stock: ctx.meta.stock,
      name: ctx.meta.name,
      analyst: ctx.meta.analyst,
      framework: ctx.meta.framework,
      generatedAt: ctx.meta.generatedAt,
      strategy: ctx.strategy,
      l1Sources: ctx.l1.sources || ['公司 L1 公告（待核验）'],
      determinism: ctx.meta.determinism,
      certification: ctx.certification,
      l1Fetch: ctx.meta.l1Fetch,
    };
    ctx.results.report_header = data;
    return data;
  },
  render: {
    html: (d, ctx) => {
      const rating = ctx.results.rating_conclusion?.rating || (ctx.veto ? '不予评级' : '—');
      const strat = ctx.strategy ? `策略 ${ctx.strategy}` : '待定';
      const certTag = d.certification
        ? `<span class="wf-badge ${d.certification.allL1 ? 'wf-badge-rating' : 'wf-cond-tag'}">L1认证 ${d.certification.allL1 ? '全官方' : '含L2'}</span>`
        : '';
      const detTag = `<span class="wf-badge wf-badge-rating">确定性 ${d.determinism || '标准'}</span>`;
      const fetchBox = d.l1Fetch && d.l1Fetch.status && d.l1Fetch.status !== 'fetched'
        ? `<div class="wf-fetchbox"><b>L1 取数计划（连接器未连接）</b><ul>${d.l1Fetch.fetchPlan.map((p) => `<li>${p}</li>`).join('')}</ul><div class="wf-muted">${d.l1Fetch.error}</div></div>`
        : '';
      return `<div class="wf-band">
        <div><span class="wf-stock">${d.name} (${d.stock})</span></div>
        <div class="wf-band-meta">
          <span class="wf-badge">${strat}</span>
          <span class="wf-badge wf-badge-rating">综合评级 ${rating}</span>
          ${certTag}${detTag}
          <span class="wf-muted">${d.framework} · ${d.analyst}</span>
        </div>
        <div class="wf-muted" style="margin-top:8px">数据来源：${d.l1Sources.join('、')}</div>
        ${fetchBox}
      </div>`;
    },
    md: (d, ctx) => {
      const rating = ctx.results.rating_conclusion?.rating || (ctx.veto ? '不予评级' : '—');
      const strat = ctx.strategy ? `策略 ${ctx.strategy}` : '待定';
      const plan = d.l1Fetch && d.l1Fetch.status && d.l1Fetch.status !== 'fetched'
        ? `\n\n**L1 取数计划（连接器未连接）**\n${d.l1Fetch.fetchPlan.map((p) => `- ${p}`).join('\n')}\n> ${d.l1Fetch.error}`
        : '';
      return `# ${d.name} (${d.stock}) — ${strat} · 综合评级 ${rating}\n\n> ${d.framework} · ${d.analyst} · 数据来源：${d.l1Sources.join('、')} · 确定性：${d.determinism || '标准'}${plan}`;
    },
    docx: (d, ctx) => {
      const rating = ctx.results.rating_conclusion?.rating || (ctx.veto ? '不予评级' : '—');
      const strat = ctx.strategy ? `策略 ${ctx.strategy}` : '待定';
      return `<h1>${d.name} (${d.stock})</h1><p>${strat} · 综合评级 ${rating} · ${d.framework} · ${d.analyst} · 确定性：${d.determinism || '标准'}</p>`;
    },
  },
};
