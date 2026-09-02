// Report Acquisition — 财报/官方公报获取器（浏览器版，与 Node 版 report-acquisition.js 完全同源）
// 目标：一次取数拿到「最近 N 年年报 + 最新季报/半年报」的完整官方报告清单，
//       并把净现金/有息负债/永续债/应收股利等穿透科目映射到「附注披露」提取要点。
// 铁律：L1 = 官方文件。穿透类科目必须回原始报告附注，接口数据只能给"科目行"。
// 被 l1-fetcher.js 与 l1-transparency.html 复用。

export const REPORT_TYPE_LABEL = {
  annual: '年度报告', semi: '半年报', q1: '一季报', q3: '三季报',
  interim: '中期报告', '10-K': '10-K 年报', '10-Q': '10-Q 季报',
  '20-F': '20-F 年报', '6-K': '6-K 临时报告',
  prospectus: '招股书', announcement: '公告 / 监管函',
};

// 各市场法定披露窗口（5月1日起上年度年报+Q1齐，9月1日起半年报齐，11月1日起Q3齐）
const DISCLOSURE_WINDOW = {
  A:  { annual: { m: 5, d: 1 }, q1: { m: 5, d: 1 }, semi: { m: 9, d: 1 }, q3: { m: 11, d: 1 } },
  HK: { annual: { m: 5, d: 1 }, q1: null,            semi: { m: 9, d: 1 }, q3: null },
  US: { annual: { m: 3, d: 1 }, q1: { m: 5, d: 1 },  semi: { m: 8, d: 15 }, q3: { m: 11, d: 1 } },
};

function periodLabel(market, type, year) {
  const t = type === '10-K' || type === '20-F' ? 'annual' : type === '10-Q' ? 'q1' : type;
  return `${year}年${REPORT_TYPE_LABEL[t] || t}`;
}

// 判定最新可得报告期
export function latestReportPeriod(market = 'A', now = new Date()) {
  const w = DISCLOSURE_WINDOW[market] || DISCLOSURE_WINDOW.A;
  const y = now.getFullYear();
  const mo = now.getMonth() + 1;
  const day = now.getDate();
  const after = (win) => !!win && (mo > win.m || (mo === win.m && day >= win.d));

  const annualYears = [];
  let latestAnnual = y - 1;
  if (after(w.annual)) annualYears.push(latestAnnual);
  else { latestAnnual = y - 2; if (after(w.annual)) annualYears.push(latestAnnual); }

  let latest = null;
  if (market === 'US') {
    if (after(w.q3) || after(w.semi) || after(w.q1)) latest = { type: '10-Q', year: y, label: periodLabel(market, '10-Q', y) };
  } else {
    if (after(w.q3)) latest = { type: 'q3', year: y, label: periodLabel(market, 'q3', y) };
    else if (after(w.semi)) latest = { type: 'semi', year: y, label: periodLabel(market, 'semi', y) };
    else if (after(w.q1)) latest = { type: 'q1', year: y, label: periodLabel(market, 'q1', y) };
  }

  return {
    latest, latestAnnual, annualYears,
    available: { annual: annualYears.length > 0, latest: !!latest },
    note: annualYears.length
      ? `已披露年度报告至 ${latestAnnual} 年${latest ? `；最新 ${latest.label} 可用` : ''}`
      : `当前尚未进入年报披露窗口，最新可得为 ${latest ? latest.label : '暂无'}`,
  };
}

// 最近 N 年（默认 5，最大 10）年报 + 最新季报/半年报 完整清单
export function buildReportList(spec = {}, opts = {}) {
  const market = spec.market || 'A';
  const n = Math.min(Math.max(opts.nYears || spec.historyYears || 5, 1), 10);
  const period = latestReportPeriod(market, opts.asOf || new Date());

  const years = [];
  for (let i = 0; i < n; i++) { const yr = period.latestAnnual - i; if (yr >= 2000) years.push(yr); }

  const annualReports = years.map((yr) => ({
    type: 'annual', year: yr,
    label: `${yr}年${REPORT_TYPE_LABEL.annual}（${periodLabel(market, 'annual', yr)}）`,
    officialSource: officialSourceName(market),
    purpose: yr === period.latestAnnual ? '最新年报 · 主分析基准' : '历史回溯 · ROE/现金流趋势与附注一致性',
  }));

  const latest = period.latest
    ? [{ type: period.latest.type, year: period.latest.year, label: period.latest.label, officialSource: officialSourceName(market), purpose: '最新季度/半年报 · 验证逆风/顺风是否延续' }]
    : [];

  return { market, nYears: n, latestAnnual: period.latestAnnual, annualReports, latestPeriod: period.latest, reports: [...annualReports, ...latest], note: period.note };
}

// 附注级穿透清单：净现金/有息负债等科目 → 附注披露提取要点
export function buildNoteExtractionPlan(market = 'A', year) {
  const notes = [
    { id: '货币资金', 目标: '受限部分', 附注定位: '货币资金附注', 提取要点: '区分库存现金/银行存款/其他货币资金；单独列出受限资金（保证金、冻结、托管、境外受限）；受限部分从类现金中剔除', 铁律: '铁律一' },
    { id: '交易性金融资产', 目标: '底层构成（债权 vs 权益）', 附注定位: '交易性金融资产附注', 提取要点: '拆分理财/基金/股票/衍生品；仅计入债权类与保本型，权益类剔除；公允价值计量层级', 铁律: '铁律一' },
    { id: '其他流动资产', 目标: '货币性投资 vs 待抵扣税额', 附注定位: '其他流动资产附注明细', 提取要点: '仅计入货币性投资产品（结构性存款/理财），排除待抵扣进项税、预付款等非货币项', 铁律: '铁律一' },
    { id: '一年内到期非流动资产', 目标: '定期存款/理财明细', 附注定位: '一年内到期的非流动资产附注', 提取要点: '确认底层为定期存款/大额存单/保本理财；非货币部分剔除', 铁律: '铁律一' },
    { id: '其他非流动资产', 目标: '货币基金/保本理财部分', 附注定位: '其他非流动资产 + 其他非流动金融资产附注', 提取要点: '仅计入货币基金与保本型理财产品；权益类剔除', 铁律: '铁律一' },
    { id: '应收款项融资', 目标: '银票背书可贴现', 附注定位: '应收款项融资附注', 提取要点: '确认银行承兑汇票；背书转让后可即时变现部分计入', 铁律: '铁律一' },
    { id: '短期借款', 目标: '银行/非银、担保方式', 附注定位: '短期借款附注', 提取要点: '拆信用/抵押/质押/保证借款；非银借款单列；识别"明股实债"通道', 铁律: '铁律二' },
    { id: '长期借款+应付债券', 目标: '利率、到期结构', 附注定位: '长期借款附注 + 应付债券附注', 提取要点: '记录借款利率区间、到期年份；应付债券拆面值/利息调整；识别可转债', 铁律: '铁律二' },
    { id: '一年内到期非流动负债', 目标: '有息部分', 附注定位: '一年内到期的非流动负债附注', 提取要点: '拆分一年内到期的长期借款/应付债券/租赁负债（有息）与合同负债（无息）；仅计有息部分', 铁律: '铁律二' },
    { id: '租赁负债', 目标: '余额与期限', 附注定位: '租赁负债附注', 提取要点: '确认使用权资产对应租赁负债余额', 铁律: '铁律二' },
    { id: '其他权益工具', 目标: '永续债余额', 附注定位: '其他权益工具附注', 提取要点: '确认永续债/优先股余额；从真实归母净资产剔除；核验利率跳升条款（明股实债）', 铁律: '铁律三' },
    { id: '应收股利/其他应收款', 目标: '规则5.12 隐含现金', 附注定位: '应收股利/其他应收款附注', 提取要点: '确认已公告、高确定性但未到账的分红；按保守/基准/乐观三情景标注', 铁律: '规则5.12' },
    { id: '关联方往来', 目标: 'NCI 穿透/联营利润真实性', 附注定位: '关联方关系及交易附注', 提取要点: '核对联营/合营名单与持股；母公司并表时用 NCI + PPA×(1-t) 还原真实权益法收益；确认分红到账', 铁律: 'Special Technique' },
    { id: '或有负债与承诺', 目标: '表外负债', 附注定位: '或有事项 + 承诺事项附注', 提取要点: '对外担保、未决诉讼、回购承诺、资本开支承诺——识别表外负债隐性侵蚀', 铁律: '铁律二（最宽口径）' },
  ];
  if (market === 'US') {
    const us = {
      货币资金: 'Cash & Cash Equivalents note', 交易性金融资产: 'Short-term investments note', 其他流动资产: 'Other current assets note',
      一年内到期非流动资产: 'Current maturities note', 其他非流动资产: 'Other non-current assets note', 应收款项融资: 'Receivables note',
      短期借款: 'Short-term debt note', 长期借款: 'Long-term debt note', 应付债券: 'Bonds payable note',
      一年内到期非流动负债: 'Current portion of LT debt note', 租赁负债: 'Lease liabilities note', 其他权益工具: 'Mezzanine equity note',
      应收股利: 'Dividends receivable note', 关联方往来: 'Related-party transactions note', 或有负债与承诺: 'Contingencies & commitments note',
    };
    notes.forEach((n) => { if (us[n.id]) n.附注定位 = us[n.id]; });
  }
  return { market, year: year || '最新年报', notes, note: '穿透类科目必须回原始报告附注逐项核实；附注未披露明细时按保守口径（仅货币资金+交易性金融资产）处理并标注。' };
}

function officialSourceName(market) {
  const map = { A: '巨潮资讯网 / 沪深交易所', HK: '披露易 HKEXnews', US: 'SEC EDGAR' };
  return map[market] || map.A;
}
