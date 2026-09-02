// PDF adapter — 原始年报/招股书 PDF 取数，复用捆绑的 financial-report-analysis 脚本。
// 任何市场的附注深挖都必须回原始文件，接口数据无法替代。连接器未连时返回取数 SOP。
// 增强：支持多年度报告清单（spec.reportList / spec.historyYears）+ 附注级穿透提取指引。

import { buildNoteExtractionPlan } from '../report-acquisition.js';

export const pdfAdapter = {
  id: 'pdf',
  plan(spec, reg) {
    const src = reg.officialSources[0];
    const lines = [];

    // ① 多年度报告清单（最近 N 年年报 + 最新季报/半年报）
    const list = spec.reportList || null;
    if (list && list.reports && list.reports.length) {
      lines.push(`1. 从 ${src.name} (${src.url}) 下载以下 ${list.reports.length} 份官方报告原文 PDF：`);
      list.reports.forEach((r, i) => {
        lines.push(`   ${i + 1}.1 ${r.label}（${r.officialSource || src.name}）—— 用途：${r.purpose || '分析'}`);
      });
    } else {
      const n = spec.historyYears || 5;
      lines.push(`1. 从 ${src.name} (${src.url}) 下载最近 ${n} 年年度报告 + 最新季报/半年报原文 PDF（${spec.reportTypeLabel || '年报'}为主）`);
    }
    lines.push(
      '2. 对每份 PDF 运行 financial-report-analysis/scripts/pdf_index.py 建目录页索引（前 5 页）',
      '3. 运行 financial-report-analysis/scripts/extract.py 按页码精准提取三表 + 附注',
      '4. 量纲校准：按常识锚点反推单位，统一折算为亿元（外币标注原币种）',
    );

    // ② 附注级穿透提取指引（净现金/有息负债等科目 → 附注定位 + 提取要点）
    const notePlan = spec.notePlan || buildNoteExtractionPlan(spec.market, list ? list.latestAnnual : spec.year);
    if (notePlan && notePlan.notes && notePlan.notes.length) {
      lines.push(`5. 附注级穿透（${notePlan.year || '最新年报'}）——以下科目必须回原始报告附注逐项核实：`);
      notePlan.notes.forEach((n, i) => {
        lines.push(`   ${i + 1}.5 【${n.id}】${n.目标} → ${n.附注定位}：${n.提取要点}（${n.铁律}）`);
      });
      lines.push(`   ※ ${notePlan.note}`);
    }
    return lines;
  },
  async fetch(spec, reg) {
    return {
      ok: false,
      status: 'needs_pdf',
      sources: reg.officialSources.map((s) => s.name),
      error: '原始年报 PDF 取数需在会话中运行 pdf_index.py / extract.py，不在离线引擎直接取数。',
    };
  },
};
