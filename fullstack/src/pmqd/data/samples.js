// Three representative samples that exercise the engine's coherence guarantees:
//  - S1 cigar-butt: deep discount, low quality, dividend receivable -> triggers Rule 5.12 implicit cash
//  - S2 quality:     high score -> forces master-case benchmarking, lands AAA
//  - Veto:           current-management integrity issue -> gate blocks all downstream modules

export const sampleS1 = {
  stock: '000001.SZ', name: '示例烟蒂股', strategyPref: null,
  l1Data: {
    sources: ['公司 2025 年报', 'Wind'],
    integrityIssues: [],
    qualityScore: 48, discountDepth: 72, moatStrength: 30,
    userValueScore: 55,
    swingFactor: '行业产能出清', playerCount: 12,
    balanceSheet: { cash: 30, debt: 10, currentAssets: 80, totalLiabilities: 60, dividendReceivable: 8 },
    pmqd: { P: 82, M: 35, Q: 45, D: 60 },
    safetyAnswers: { q1: true, q2: false, q3: true },
    marginPct: 35,
    health8d: { 盈利: 60, 负债: 70, 现金流: 55, 分红: 50, 治理: 45, 成长: 40, 估值: 80, 景气: 55 },
    conviction: '中', unverifiedAssumptions: ['重整后产能利用率'],
    kellyEdge: 0.25, kellyOdds: 2.2, holdTestHappy: false,
    rule512: { l1Confirmed: true, stablePayout: true, highCertainty: true, conservativePct: 0.7, basePct: 0.9, optimisticPct: 1.0 },
  },
};

export const sampleS2 = {
  stock: '000333.SZ', name: '示例优质股', strategyPref: null,
  l1Data: {
    sources: ['公司 2025 年报', '官网公告'],
    integrityIssues: [],
    qualityScore: 88, discountDepth: 30, moatStrength: 80,
    userValueScore: 90,
    swingFactor: '全球化份额提升', playerCount: 8,
    balanceSheet: { cash: 120, debt: 40, currentAssets: 300, totalLiabilities: 200, dividendReceivable: 0 },
    pmqd: { P: 70, M: 88, Q: 90, D: 75 },
    safetyAnswers: { q1: true, q2: true, q3: true },
    marginPct: 40,
    health8d: { 盈利: 90, 负债: 85, 现金流: 88, 分红: 90, 治理: 88, 成长: 82, 估值: 70, 景气: 80 },
    conviction: '高', unverifiedAssumptions: [],
    kellyEdge: 0.35, kellyOdds: 2.5, holdTestHappy: true,
  },
};

export const sampleVeto = {
  stock: '900999.SH', name: '示例否决股', strategyPref: null,
  l1Data: {
    sources: ['公司 2025 年报'],
    integrityIssues: [{ type: 'current', desc: '实控人资金占用未归还' }],
    qualityScore: 60, discountDepth: 40, moatStrength: 50,
    userValueScore: 60,
    swingFactor: '—', playerCount: 5,
    balanceSheet: { cash: 20, debt: 30, currentAssets: 50, totalLiabilities: 60, dividendReceivable: 0 },
    pmqd: { P: 50, M: 50, Q: 50, D: 50 },
    safetyAnswers: { q1: false, q2: false, q3: false },
    marginPct: 10,
    health8d: { 盈利: 40, 负债: 30, 现金流: 35, 分红: 20, 治理: 10, 成长: 40, 估值: 50, 景气: 45 },
    conviction: '低', unverifiedAssumptions: ['管理层整改诚意'],
    kellyEdge: 0.1, kellyOdds: 3, holdTestHappy: false,
  },
};
