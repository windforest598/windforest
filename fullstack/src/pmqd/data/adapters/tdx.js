// TDX adapter — 通达信连接器（tdx_api_data / tdx_security_deep_info / tdx_lookup_stock）。
// A/H/US 结构化三表的主取数通道。量纲与路由规则以 financial-report-analysis/data-source-guide.md 为准。
//
// 连接器未连接时，fetch() 返回 needs_connector 与精确调用计划（不伪造数字）。

export const tdxAdapter = {
  id: 'tdx',
  plan(spec, reg) {
    const code = spec.stock;
    let lines;
    if (spec.market === 'US') {
      lines = [
        `tdx_security_deep_info query="查询 ${spec.name || code} 美股利润表与财务摘要" entity_type="美股代码"`,
        '  → 命中 f9_us_income_statement / f9_us_financial_summary（48 列比率画像）',
        "筛选 报告类型='年报' 取年报行；Non-GAAP 调节表须回 10-K 原文",
      ];
    } else if (spec.market === 'HK') {
      lines = [
        `tdx_api_data entry="TdxSharePCCW.skef10_hk_cwfx" fixedTag="1" code="${code}"  # 损益表`,
        `tdx_api_data entry="TdxSharePCCW.skef10_hk_cwfx" fixedTag="2" code="${code}"  # 资产负债表`,
        `tdx_api_data entry="TdxSharePCCW.skef10_hk_cwfx" fixedTag="3" code="${code}"  # 现金流量表`,
        '⚠ 港股仅 15 字段、无毛利率；必须回 HKEX 披露易取原始年报 PDF 取附注',
      ];
    } else {
      lines = [
        `tdx_api_data entry="TdxShareCW.ph_agf10_cw_lyb" fixedTag="00101" code="${code}"  # 利润表`,
        `tdx_api_data entry="TdxShareCW.ph_agf10_cw_zcfzb" code="${code}"  # 资产负债表（不传 fixedTag）`,
        `tdx_api_data entry="TdxShareCW.ph_agf10_cw_xjllb" fixedTag="00101" code="${code}"  # 现金流量表`,
        '⚠ 量纲陷阱：A股返回「元」(无单位标识)，须按常识锚点反推 ÷1e8 折算为亿元',
      ];
    }
    // 多年度：按 reportList 逐年循环取三表（趋势/附注一致性必需）
    const list = spec.reportList;
    if (list && list.annualReports && list.annualReports.length) {
      const years = list.annualReports.map((r) => r.year);
      lines.push(`→ 多年度：按 reportList 逐年调用上述接口（${years.join(' / ')}），每年一组三表；${list.latestPeriod ? `最新 ${list.latestPeriod.label} 单独取一组` : ''}`);
      lines.push('→ 穿透类科目（受限资金/理财底层/有息负债结构/永续债）接口给不了，必须回原始年报 PDF 附注（用 pdf 适配器）');
    }
    return lines;
  },
  async fetch(spec, reg) {
    return {
      ok: false,
      status: 'needs_connector',
      sources: reg.officialSources.map((s) => s.name),
      error: '通达信连接器未连接。连接 tdx-connector 后引擎将自动调用上方工具取真实 L1 三表数据。',
    };
  },
};
