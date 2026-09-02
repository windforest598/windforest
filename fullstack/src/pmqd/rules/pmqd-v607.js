// ═══════════════════════════════════════════════════════════════
// 风林慧策 · PMQD V6.0.7 规范化规则内核
//
// 本文件是 SKILL.md（wind-forest-value-investing-analysis）规则条款的
// 唯一可执行实现。所有模块只允许通过本文件取用评分口径，禁止各自硬编码，
// 以保证「技能规范 ↔ 分析内核」逐条对齐、不再漂移。
//
// 对齐条款：
//   · PMQD 固定权重  P40 / M18 / Q30 / D12 = 100
//   · 安全边际三问    每问 17 分，上限 50
//   · 8 维体检        每维 4 分，上限 30
//   · 凯利 V5.2       b=(PE_intrinsic−PE_current)/PE_current，PE_intrinsic=12.5×
//   · 星级与仓位      90+★★★★★ / 75+★★★★ / 60+★★★ / <60 不配置
//   · 仓位上限        策略一 40% · 策略二 30% · 策略三 15%
//   · V6.0.7 控股公司修正（Q 现金流结构性修正 + M 产品周期/分红兜底 + 风险降档）
// ═══════════════════════════════════════════════════════════════

export const RULES_VERSION = 'PMQD V6.0.7';

// ── 1. PMQD 四维固定权重（铁律：不随策略浮动）────────────────────
export const PMQD_WEIGHTS = Object.freeze({ P: 40, M: 18, Q: 30, D: 12 });

// ── 2. 策略仓位上限 ──────────────────────────────────────────────
export const POSITION_CEILING = Object.freeze({ S1: 0.40, S2: 0.30, S3: 0.15 });

// ── 3. 凯利公式常量（V5.2）──────────────────────────────────────
export const PE_INTRINSIC = 12.5;          // 1 / 8% ≈ 12.5×
export const PE_INTRINSIC_BRAND_CAP = 16.5; // 品牌溢价上限

// ── 4. 星级分档 ──────────────────────────────────────────────────
const STAR_BANDS = [
  { min: 90, stars: '★★★★★', label: '信念级重仓', positionHint: '半凯利（S1≤40% / S2≤30%）' },
  { min: 75, stars: '★★★★', label: '优质配置', positionHint: '半凯利，≤20%' },
  { min: 60, stars: '★★★', label: '仅观察', positionHint: '≤5%' },
  { min: 0, stars: '—', label: '不予配置 / 排除', positionHint: '0%' },
];

export function starRating(total) {
  const band = STAR_BANDS.find((b) => total >= b.min) || STAR_BANDS[STAR_BANDS.length - 1];
  return { stars: band.stars, label: band.label, positionHint: band.positionHint, band: band.min };
}

// ── 5. 风险等级降档（V6.0.7：已派息 → 分红不确定性机械降一档）────
const RISK_LADDER = ['低', '中低', '中', '中高', '高'];

export function downgradeRisk(level, notches = 1) {
  const i = RISK_LADDER.indexOf(level);
  if (i < 0) return level;
  return RISK_LADDER[Math.max(0, i - notches)];
}

// ── 6. 工具函数 ──────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * V6.0.7 控股公司结构性修正
 *
 * 适用：标的核心价值为被动少数股权（如 25% 合资公司），母公司并表。
 * 问题：此类标的合并报表经营现金流常为负（分红收付时点错配），
 *       若按常规口径 Q 现金流项直接给 0，将系统性低估；
 *       同理合资公司已确认在推进的产品周期若按「催化待定」给 0，也属已兑现利好被计零。
 *
 * @param {object} raw   原始 PMQD 子分（0-100 口径）
 * @param {object} hc    控股公司特征信号
 * @returns {{ adjusted: object, corrections: Array, applied: boolean }}
 */
export function applyHoldingCoCorrection(raw, hc) {
  const corrections = [];
  const adjusted = { ...raw };
  if (!hc || !hc.isHoldingCo) return { adjusted, corrections, applied: false };

  // (a) Q 现金流结构性修正 —— 以合资公司分红能力作为资产底线质量代理
  if (hc.consolidatedOcfNegative && hc.jvDividendCapacity) {
    const delta = clamp(Number(hc.qCorrection ?? 8), 0, 12);
    adjusted.Q = clamp(adjusted.Q + delta, 0, 100);
    corrections.push({
      dim: 'Q',
      delta: +delta,
      rule: 'V6.0.7 控股公司现金流结构性修正',
      note: `合并口径经营现金流为负源于分红收付时点错配，非经营恶化；`
        + `改以合资公司分红能力（${hc.jvDividendCapacity}）作资产底线质量代理，+${delta} 结构性修正。`,
    });
  }

  // (b) M 产品周期 —— 已确认且在推进的产品周期计入「重组/资产优化」，不得计零
  if (hc.jvProductCycleConfirmed) {
    const floor = Number(hc.mProductCycleFloor ?? 60);
    if (adjusted.M < floor) {
      corrections.push({
        dim: 'M',
        delta: +r1(floor - adjusted.M),
        rule: 'V6.0.7 控股公司产品周期计分',
        note: `合资公司产品周期（${hc.jvProductCycleName || '在推进产品周期'}）已确认并在推进，`
          + `按「计划确定+推进中」计入重组/资产优化项，M 不得按「催化待定」计零。`,
      });
      adjusted.M = floor;
    }
  }

  // (c) M 分红兜底 —— 实际已派息（L1 证据）则设下限；派息率 >100% 已收分红则取上限
  if (hc.dividendActuallyPaid) {
    const isStructuralHigh = hc.payoutOverReceived && (hc.payoutPeriodsVerified ?? 0) >= 2;
    const floor = isStructuralHigh
      ? Number(hc.mDividendUpperFloor ?? 78)   // 上限档：结构性高分红意愿
      : Number(hc.mDividendFloor ?? 62);       // 下限档：已派息但不稳定，取上沿
    if (adjusted.M < floor) {
      corrections.push({
        dim: 'M',
        delta: +r1(floor - adjusted.M),
        rule: isStructuralHigh
          ? 'V6.0.7 分红结构性高意愿（派息>已收分红，≥2 期核验）'
          : 'V6.0.7 已实际派息兜底（L1 证据）',
        note: isStructuralHigh
          ? `中期派息额连续 ${hc.payoutPeriodsVerified} 期超过自合资公司实收分红 100%，`
            + `属结构性高分红意愿硬证据，分红项取上限档；样板免责声明不可推翻已兑现派息率。`
          : `已取得 L1 实际派息证据，分红项不得低于「有分红但不稳定」上沿。`,
      });
      adjusted.M = floor;
    }
  }

  return { adjusted, corrections, applied: corrections.length > 0 };
}

/**
 * PMQD 总分 —— 固定权重加权（P40/M18/Q30/D12）
 * @param {object} raw 四维子分（0-100 口径）
 */
export function scorePMQD(raw) {
  const s = { P: raw.P ?? 50, M: raw.M ?? 50, Q: raw.Q ?? 50, D: raw.D ?? 50 };
  const points = {
    P: r1((s.P / 100) * PMQD_WEIGHTS.P),
    M: r1((s.M / 100) * PMQD_WEIGHTS.M),
    Q: r1((s.Q / 100) * PMQD_WEIGHTS.Q),
    D: r1((s.D / 100) * PMQD_WEIGHTS.D),
  };
  const total = Math.round(points.P + points.M + points.Q + points.D);
  return { raw: s, points, weights: PMQD_WEIGHTS, total };
}

/**
 * 安全边际三问 —— 每问 17 分，上限 50
 */
export function scoreSafetyMargin(answers, indeterminate = false) {
  const a = { q1: !!answers?.q1, q2: !!answers?.q2, q3: !!answers?.q3 };
  const yes = [a.q1, a.q2, a.q3].filter(Boolean).length;
  const score = Math.min(50, yes * 17);
  return {
    answers: a,
    yesCount: yes,
    score,
    max: 50,
    passed: yes === 3,
    indeterminate: !!indeterminate,
    // 任一问 No → 评级降档或排除
    downgrade: yes < 3,
  };
}

/**
 * 8 维体检 —— 每维 4 分，上限 30
 * 入参 dims 为 0-100 口径（内核适配层给的是 0-100），按比例折算为 0-4 分/维。
 */
export function scoreHealth8d(dims, indeterminate = false) {
  const entries = Object.entries(dims || {});
  const per = entries.map(([k, v]) => {
    const v100 = clamp(Number(v) || 0, 0, 100);
    return { dim: k, raw: v100, pts: r1((v100 / 100) * 4) };
  });
  const rawSum = per.reduce((acc, d) => acc + d.pts, 0);
  const score = r1(Math.min(30, rawSum));   // 8×4=32，规范上限 30
  return {
    per,
    dims: dims || {},
    score,
    max: 30,
    capped: rawSum > 30,
    avg: entries.length ? Math.round(per.reduce((a, d) => a + d.raw, 0) / entries.length) : 0,
    indeterminate: !!indeterminate,
  };
}

/**
 * 凯利公式 V5.2
 *
 *   b = (PE_intrinsic − PE_current) / PE_current
 *   p = [三问(50) + 8维(30折算) + 催化确定性(20)] / 100
 *   f* = (b·p − q) / b，  q = 1 − p
 *   半凯利 = f* ÷ 2 ，最终 = 半凯利 × 能力圈系数，并受策略上限约束
 */
export function kellyV52({
  peCurrent,
  safetyScore = 0,
  health8dScore = 0,
  catalystCertainty = 0,
  strategy = 'S2',
  competence = 0.6,
  brandPremium = false,
}) {
  const peIntrinsic = brandPremium ? PE_INTRINSIC_BRAND_CAP : PE_INTRINSIC;
  const notes = [];

  // 赔率 b
  let b = null;
  if (peCurrent && peCurrent > 0) {
    b = r2((peIntrinsic - peCurrent) / peCurrent);
  } else {
    notes.push('当前 PE 不可用（缺失或为负）→ 赔率 b 无法计算，仓位判为 0，待补 L1 财报。');
  }

  // 胜率 p（三问 50 + 8维 30 + 催化 20）
  const catalyst = clamp(Number(catalystCertainty) || 0, 0, 20);
  const pRaw = (clamp(safetyScore, 0, 50) + clamp(health8dScore, 0, 30) + catalyst) / 100;
  const p = clamp(r2(pRaw), 0, 1);
  const pLose = r2(1 - p);

  const ceiling = POSITION_CEILING[strategy] ?? POSITION_CEILING.S2;
  const comp = clamp(Number(competence) || 0.6, 0.4, 1.0);

  if (b === null || b <= 0) {
    if (b !== null && b <= 0) notes.push(`当前 PE ${peCurrent}× 已高于内在值锚 ${peIntrinsic}× → 赔率非正，不予配置。`);
    return {
      peIntrinsic, peCurrent: peCurrent ?? null, b, p, pLose,
      fStar: 0, halfKelly: 0, competence: comp, ceiling,
      finalPosition: 0, notes,
      formula: `b=(${peIntrinsic}−PE)/PE ｜ p=(三问${safetyScore}+8维${health8dScore}+催化${catalyst})/100`,
    };
  }

  const fStar = r2((b * p - pLose) / b);
  const half = r2(Math.max(0, fStar) / 2);
  const final = r2(clamp(half * comp, 0, ceiling));

  if (fStar <= 0) notes.push('经典凯利为非正 → 数学上不具备下注优势，建议 0 仓位。');
  if (half * comp > ceiling) notes.push(`半凯利×能力圈 ${(half * comp * 100).toFixed(1)}% 超策略${strategy}上限，已截至 ${(ceiling * 100).toFixed(0)}%。`);

  return {
    peIntrinsic, peCurrent, b, p, pLose,
    fStar, halfKelly: half, competence: comp, ceiling,
    finalPosition: final, notes,
    formula: `b=(${peIntrinsic}−${peCurrent})/${peCurrent}=${b} ｜ p=(${safetyScore}+${health8dScore}+${catalyst})/100=${p} ｜ f*=(b·p−q)/b=${fStar} ｜ 半凯利 ${half} × 能力圈 ${comp} → ${(final * 100).toFixed(1)}%`,
  };
}

/**
 * 催化确定性得分（0-20）—— 供凯利胜率 p 使用。
 * 以 M 维子分（0-100）折算，并在未核验时保守打折。
 */
export function catalystCertaintyScore(mSubscore, verified) {
  const base = (clamp(Number(mSubscore) || 0, 0, 100) / 100) * 20;
  return r1(verified ? base : base * 0.5);   // 未核验 → 五折，避免中性 50 被当成真实催化
}
