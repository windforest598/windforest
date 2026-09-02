// ═══════════════════════════════════════════════════════════════
// PMQD V6.0.7 规则条款单元验证
//
// 目的：逐条验证「SKILL.md 规范条款」是否在分析内核中正确落地。
// 任一条款不符 → 退出码 1（CI 阻断部署）。
// ═══════════════════════════════════════════════════════════════

import {
  PMQD_WEIGHTS, POSITION_CEILING, PE_INTRINSIC, RULES_VERSION,
  scorePMQD, scoreSafetyMargin, scoreHealth8d, kellyV52,
  starRating, downgradeRisk, applyHoldingCoCorrection, catalystCertaintyScore,
} from '../src/pmqd/rules/pmqd-v607.js';
import { assemble } from '../src/pmqd/assembler.js';

let pass = 0;
let fail = 0;
const failures = [];

function check(clause, actual, expected, tolerance = 0) {
  const ok = typeof expected === 'number' && tolerance > 0
    ? Math.abs(actual - expected) <= tolerance
    : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  [OK] ${clause} → ${JSON.stringify(actual)}`); }
  else {
    fail++;
    failures.push(clause);
    console.log(`  [X ] ${clause}\n        实际 ${JSON.stringify(actual)}  期望 ${JSON.stringify(expected)}`);
  }
}

function truthy(clause, cond, detail = '') {
  if (cond) { pass++; console.log(`  [OK] ${clause}${detail ? ' → ' + detail : ''}`); }
  else { fail++; failures.push(clause); console.log(`  [X ] ${clause} ${detail}`); }
}

console.log(`\n规则版本：${RULES_VERSION}\n`);

// ── 条款 1：PMQD 固定权重 P40/M18/Q30/D12 ────────────────────────
console.log('【条款 1】PMQD 四维固定权重');
check('权重常量 = P40/M18/Q30/D12', PMQD_WEIGHTS, { P: 40, M: 18, Q: 30, D: 12 });
const full = scorePMQD({ P: 100, M: 100, Q: 100, D: 100 });
check('四维满分 → 总分 100', full.total, 100);
check('四维满分分项 = 权重本身', full.points, { P: 40, M: 18, Q: 30, D: 12 });
const half = scorePMQD({ P: 50, M: 50, Q: 50, D: 50 });
check('四维各 50 → 总分 50', half.total, 50);
// 关键回归：权重不得随策略浮动
const s1 = scorePMQD({ P: 90, M: 30, Q: 60, D: 80 });
check('P90/M30/Q60/D12 加权 = 36+5.4+18+9.6 = 69', s1.total, 69);

// ── 条款 2：安全边际三问 每问 17 分，上限 50 ──────────────────────
console.log('\n【条款 2】安全边际三问计分');
check('三问全通过 → 50 分（3×17=51 截至 50）', scoreSafetyMargin({ q1: true, q2: true, q3: true }).score, 50);
check('两问通过 → 34 分', scoreSafetyMargin({ q1: true, q2: true, q3: false }).score, 34);
check('一问通过 → 17 分', scoreSafetyMargin({ q1: true, q2: false, q3: false }).score, 17);
check('全不通过 → 0 分', scoreSafetyMargin({}).score, 0);
truthy('存在「否」项 → 触发降档标记', scoreSafetyMargin({ q1: true, q2: true, q3: false }).downgrade === true);

// ── 条款 3：8 维体检 每维 4 分，上限 30 ──────────────────────────
console.log('\n【条款 3】8 维体检计分');
const h8full = scoreHealth8d({ a: 100, b: 100, c: 100, d: 100, e: 100, f: 100, g: 100, h: 100 });
check('8 维满分 → 30 分（8×4=32 截至 30）', h8full.score, 30);
truthy('触发上限截取标记', h8full.capped === true);
const h8mid = scoreHealth8d({ a: 50, b: 50, c: 50, d: 50, e: 50, f: 50, g: 50, h: 50 });
check('8 维各 50 → 16 分', h8mid.score, 16);

// ── 条款 4：凯利公式 V5.2 ───────────────────────────────────────
console.log('\n【条款 4】凯利公式 V5.2');
check('内在值锚 PE = 12.5×', PE_INTRINSIC, 12.5);
const k1 = kellyV52({
  peCurrent: 5, safetyScore: 50, health8dScore: 30, catalystCertainty: 20,
  strategy: 'S1', competence: 1.0,
});
check('PE=5 → 赔率 b=(12.5-5)/5=1.5', k1.b, 1.5);
check('三问50+8维30+催化20 → 胜率 p=1.0', k1.p, 1);
check('p=1 → f*=(1.5×1−0)/1.5=1.0', k1.fStar, 1);
check('半凯利 0.5 × 能力圈 1.0，受 S1 上限 40% 约束 → 0.4', k1.finalPosition, 0.4);
const k2 = kellyV52({ peCurrent: 20, safetyScore: 50, health8dScore: 30, catalystCertainty: 20, strategy: 'S2' });
check('PE=20 > 内在值锚 → 赔率非正 → 仓位 0', k2.finalPosition, 0);
const k3 = kellyV52({ peCurrent: 8, safetyScore: 17, health8dScore: 10, catalystCertainty: 5, strategy: 'S2', competence: 0.6 });
truthy('低胜率 → 经典凯利非正 → 仓位 0', k3.finalPosition === 0, `f*=${k3.fStar}`);
check('PE 缺失 → 赔率不可算，仓位 0', kellyV52({ peCurrent: null, strategy: 'S2' }).finalPosition, 0);

// ── 条款 5：策略仓位上限 S1 40% / S2 30% / S3 15% ────────────────
console.log('\n【条款 5】策略仓位上限');
check('仓位上限常量', POSITION_CEILING, { S1: 0.40, S2: 0.30, S3: 0.15 });
const kS2 = kellyV52({ peCurrent: 4, safetyScore: 50, health8dScore: 30, catalystCertainty: 20, strategy: 'S2', competence: 1.0 });
truthy('策略二满配被截至 30%', kS2.finalPosition <= 0.30 + 1e-9, `${(kS2.finalPosition * 100).toFixed(0)}%`);
const kS3 = kellyV52({ peCurrent: 4, safetyScore: 50, health8dScore: 30, catalystCertainty: 20, strategy: 'S3', competence: 1.0 });
truthy('策略三满配被截至 15%', kS3.finalPosition <= 0.15 + 1e-9, `${(kS3.finalPosition * 100).toFixed(0)}%`);
truthy('能力圈系数强制落在 0.4-1.0', kellyV52({ peCurrent: 5, strategy: 'S1', competence: 5 }).competence === 1.0);

// ── 条款 6：星级分档 ────────────────────────────────────────────
console.log('\n【条款 6】星级分档');
check('95 分 → ★★★★★', starRating(95).stars, '★★★★★');
check('80 分 → ★★★★', starRating(80).stars, '★★★★');
check('65 分 → ★★★（仅观察）', starRating(65).stars, '★★★');
check('55 分 → 不予配置', starRating(55).stars, '—');
check('75 为 ★★★★ 下边界（不四舍上取）', starRating(74).stars, '★★★');

// ── 条款 7：V6.0.7 控股公司结构性修正 ───────────────────────────
console.log('\n【条款 7】V6.0.7 控股公司结构性修正');
const base = { P: 80, M: 20, Q: 40, D: 70 };
const noHc = applyHoldingCoCorrection(base, null);
check('非控股公司 → 不修正', noHc.adjusted, base);
const hcQ = applyHoldingCoCorrection(base, {
  isHoldingCo: true, consolidatedOcfNegative: true, jvDividendCapacity: '合资公司稳定派现',
});
truthy('合并 OCF 为负 + 合资公司有派现能力 → Q 上修（不得计零）', hcQ.adjusted.Q > base.Q, `Q ${base.Q}→${hcQ.adjusted.Q}`);
const hcM = applyHoldingCoCorrection(base, {
  isHoldingCo: true, jvProductCycleConfirmed: true, jvProductCycleName: 'iX3 / Neue Klasse',
});
truthy('合资公司产品周期已确认推进 → M 不得按「催化待定」计零', hcM.adjusted.M >= 60, `M ${base.M}→${hcM.adjusted.M}`);
const hcDiv = applyHoldingCoCorrection(base, { isHoldingCo: true, dividendActuallyPaid: true });
truthy('已实际派息（L1）→ M 分红项设下限', hcDiv.adjusted.M >= 62, `M ${base.M}→${hcDiv.adjusted.M}`);
const hcDivHigh = applyHoldingCoCorrection(base, {
  isHoldingCo: true, dividendActuallyPaid: true, payoutOverReceived: true, payoutPeriodsVerified: 2,
});
truthy('派息>已收分红且连续≥2期 → M 分红项取上限档', hcDivHigh.adjusted.M >= 78, `M ${base.M}→${hcDivHigh.adjusted.M}`);
truthy('全部修正项均带 rule + note 留痕', hcDivHigh.corrections.every((c) => c.rule && c.note));

// ── 条款 8：风险机械降档 ────────────────────────────────────────
console.log('\n【条款 8】风险等级机械降档');
check('中高 → 降一档 → 中', downgradeRisk('中高', 1), '中');
check('高 → 降一档 → 中高', downgradeRisk('高', 1), '中高');
check('低 → 已到底，不再降', downgradeRisk('低', 1), '低');

// ── 条款 9：催化确定性折算 ──────────────────────────────────────
console.log('\n【条款 9】催化确定性（0-20）');
check('M=100 且已核验 → 20 分', catalystCertaintyScore(100, true), 20);
check('M=100 未核验 → 五折 10 分', catalystCertaintyScore(100, false), 10);
check('M=50 未核验 → 5 分（避免中性 50 被当真实催化）', catalystCertaintyScore(50, false), 5);

// ── 条款 10：端到端装配 + 一致性校验 ────────────────────────────
console.log('\n【条款 10】端到端装配一致性');
const e2e = await assemble({
  stock: '01114.HK',
  name: '华晨中国（控股公司修正用例）',
  l1Data: {
    sources: ['披露易 HKEXnews 2026 中期报告'],
    integrityIssues: [{ type: 'historical', desc: '前任管理层被联交所谴责，已全部离任' }],
    balanceSheet: { cash: 700, debt: 0, currentAssets: 720, totalLiabilities: 20, dividendReceivable: 40 },
    qualityScore: 55, discountDepth: 72, moatStrength: 45, userValueScore: 60,
    swingFactor: 'BBA 产品周期与分红节奏', playerCount: 15,
    pmqd: { P: 82, M: 20, Q: 40, D: 74 },
    _verified: { P: true, M: false, Q: true, D: true },
    safetyAnswers: { q1: true, q2: true, q3: false },
    health8d: { 盈利: 45, 负债: 95, 现金流: 40, 分红: 80, 治理: 50, 成长: 40, 估值: 85, 景气: 45 },
    conviction: '中',
    unverifiedAssumptions: ['BBA 下半年批售与折扣走势未定'],
    dividendRiskBase: '中高',
    market: { pe: 6.2, pb: 0.45, price: 4.2 },
    competence: 0.6,
    holdingCo: {
      isHoldingCo: true,
      consolidatedOcfNegative: true,
      jvDividendCapacity: 'BBA 年均 80-100 亿派现能力',
      jvProductCycleConfirmed: true,
      jvProductCycleName: 'iX3 / Neue Klasse',
      dividendActuallyPaid: true,
      payoutOverReceived: true,
      payoutPeriodsVerified: 2,
    },
  },
});
const ps = e2e.modules.find((m) => m.id === 'pmqd_scoring');
const kp = e2e.modules.find((m) => m.id === 'kelly_position');
const cr = e2e.modules.find((m) => m.id === 'cognitive_risk');
truthy('装配成功并归入策略一（历史诚信问题强制降级）', e2e.strategy === 'S1', `策略 ${e2e.strategy}`);
truthy('已应用 V6.0.7 结构性修正', ps.data.correctionApplied === true, `${ps.data.corrections.length} 项`);
truthy('M 维经修正后不再为原始低值', ps.data.raw.M > ps.data.original.M, `M ${ps.data.original.M}→${ps.data.raw.M}`);
truthy('分红风险已机械降档', cr.data.items.some((i) => i.category === '分红政策不确定性' && i.downgraded), JSON.stringify(cr.data.items.find((i) => i.category === '分红政策不确定性')?.level));
truthy('凯利仓位受策略一 40% 上限约束', kp.data.finalPosition <= 0.40 + 1e-9, `${(kp.data.finalPosition * 100).toFixed(1)}%`);
truthy('一致性校验全部通过', e2e.coherence.passed === true,
  e2e.coherence.checks.filter((c) => !c.pass).map((c) => c.name).join(',') || '无失败项');
for (const ck of e2e.coherence.checks) console.log(`        · ${ck.pass ? 'OK' : 'X'} ${ck.name} — ${ck.note}`);

// ── 汇总 ────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
console.log(`PMQD V6.0.7 规则条款验证：通过 ${pass} 项，失败 ${fail} 项`);
if (fail) console.log(`失败条款：\n  - ${failures.join('\n  - ')}`);
console.log(fail === 0 ? '✅ 技能规范已完整落地到分析内核' : '❌ 存在条款未落地，阻断部署');
process.exit(fail === 0 ? 0 : 1);
