// PDF adapter — 原始年报/招股书 PDF 取数，复用捆绑的 financial-report-analysis 脚本。
// 任何市场的附注深挖都必须回原始文件，接口数据无法替代。浏览器版：fetch 接受注入的 fetcher；
// 未注入则按时离线返回取数 SOP。

export const pdfAdapter = {
  id: 'pdf',
  plan(spec, reg) {
    const src = reg.officialSources[0];
    return [
      `1. 从 ${src.name} (${src.url}) 下载 ${spec.reportTypeLabel || '年报'} 原文 PDF`,
      '2. 运行 financial-report-analysis/scripts/pdf_index.py 建目录页索引（前 5 页）',
      '3. 运行 financial-report-analysis/scripts/extract.py 按页码精准提取三表 + 附注',
      '4. 量纲校准：按常识锚点反推单位，统一折算为亿元（外币标注原币种）',
    ];
  },
  async fetch(spec, reg, ctx = {}) {
    if (ctx.fetcher) {
      try {
        const data = await ctx.fetcher({ adapter: 'pdf', spec, reg });
        if (data && data.ok) return data;
      } catch (e) { /* 回退离线 SOP */ }
    }
    return {
      ok: false,
      status: 'needs_pdf',
      sources: reg.officialSources.map((s) => s.name),
      error: '原始年报 PDF 取数需在会话中运行 pdf_index.py / extract.py，不在离线引擎直接取数。',
    };
  },
};
