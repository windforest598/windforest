// NeoData adapter — 自然语言通用金融数据搜索（neodata-financial-search 技能）。
// 适合"一句话取数"：财报、公告、研报、资金流向。返回结构化数据 + 文档型内容。
// 浏览器版：fetch 接受注入的 fetcher；未注入则按时离线返回提示，由会话内技能取数后回填 l1Data。

export const neodataAdapter = {
  id: 'neodata',
  plan(spec, reg) {
    const q = `${spec.name || spec.stock} ${reg.label} ${spec.reportTypeLabel || '年报'} ${spec.year || ''} 财务报表 营收 净利润 资产负债率 经营现金流`;
    return [
      '调用 neodata-financial-search 技能（自然语言检索）：',
      `  "${q}"`,
      '取回的 L1 官方披露字段回填到 l1Data 契约；平台聚合数据仅作 L2 交叉核验。',
    ];
  },
  async fetch(spec, reg, ctx = {}) {
    if (ctx.fetcher) {
      try {
        const data = await ctx.fetcher({ adapter: 'neodata', spec, reg });
        if (data && data.ok) return data;
      } catch (e) { /* 回退离线提示 */ }
    }
    return {
      ok: false,
      status: 'needs_skill',
      sources: reg.officialSources.map((s) => s.name),
      error: 'neodata-financial-search 为会话内自然语言检索技能，不在离线引擎直接取数；在对话中调用后将结果回填 l1Data。',
    };
  },
};
