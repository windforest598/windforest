// Layer: decision — Kelly position, master-case benchmarking, and the rating conclusion.
// rating_conclusion is the COHERENCE ANCHOR: it reads every upstream result from ctx and weaves
// them into one narrative, so the report reads as a single piece even though modules are independent.
//
// V6.0.7：
//   · kelly_position 改为规范 V5.2 完整公式（b=(12.5−PE)/PE；p=(三问50+8维30+催化20)/100），
//     并按策略上限（S1 40% / S2 30% / S3 15%）与能力圈系数（0.4-1.0）收口。
//   · rating_conclusion 改为规范星级体系（★★★★★/★★★★/★★★/不予配置），替换原 AAA/AA 字母评级。
//   · master_case ≥80 分强制对标并输出「赢家模式」（V6.0 信息输出升级）。

import { kellyV52, catalystCertaintyScore, starRating } from '../rules/pmqd-v607.js';

// 大师案例库（landmark cases，对齐 SKILL.md 107 案例库的地标条目）
const MASTER_LIBRARY = {
  S1: [
    { name: '桑伯恩地图', pattern: '隐藏资产重估 — 市值低于所持证券组合，资产价值与股价脱钩' },
    { name: '网易 2001', pattern: '困境反转 — 市值 < 净现金买入，主业修复后 100 倍回报' },
    { name: '北方管道', pattern: '隐藏资产 + 股东行动主义 — 主动催化资产价值释放' },
    { name: '邓普斯特农具', pattern: '烟蒂型 — 清算价值保护下限，管理层更换释放价值' },
  ],
  S2: [
    { name: '喜诗糖果', pattern: '品牌护城河 — 可提价而不失份额，轻资本高回报' },
    { name: '可口可乐 1988', pattern: '品牌情感垄断 — 全球分销 + 心智占领，长期复利' },
    { name: '苹果 2016', pattern: '网络效应逆风买入 — 市场错杀生态锁定价值' },
    { name: '贵州茅台', pattern: '品牌垄断 — 供给刚性 + 定价权 + 社交货币属性' },
    { name: 'Costco', pattern: '成本优势 + 会员黏性 — 极致低毛利换规模与复购' },
  ],
  S3: [
    { name: '洛克伍德（存货套利）', pattern: '事件套利 — 公告确定的存货换股，价差锁定' },
    { name: '新奥能源私有化', pattern: '私有化套利 — 对价明确 + 股东会高票通过，年化可测' },
    { name: '德州国家石油套利', pattern: '清算套利 — 分步清算对价，下行有资产底' },
  ],
};

export const kellyPosition = {
  id: 'kelly_position',
  layer: 'decision',
  title: { zh: '凯利公式仓位（V5.2）', en: 'Kelly Formula Position Sizing (V5.2)' },
  appliesTo: ['*'],
  compute(ctx) {
    const mkt = ctx.l1.market || {};
    const pmqd = ctx.results.pmqd_scoring || {};
    const verified = ctx.l1._verified || {};

    // 催化确定性（0-20）：由 M 维子分折算，未核验则五折
    const catalyst = catalystCertaintyScore(pmqd.raw?.M ?? ctx.l1.pmqd?.M ?? 50, !!verified.M);

    const k = kellyV52({
      peCurrent: mkt.pe ?? ctx.l1.peCurrent ?? null,
      safetyScore: ctx.results.safetyScore ?? 0,
      health8dScore: ctx.results.health8dScore ?? 0,
      catalystCertainty: catalyst,
      strategy: ctx.strategy || 'S2',
      competence: ctx.l1.competence ?? ctx.userOverrides?.competence ?? 0.6,
      brandPremium: !!ctx.l1.brandPremium,
    });

    const data = {
      ...k,
      catalystCertainty: catalyst,
      strategy: ctx.strategy,
      pParts: {
        safety: ctx.results.safetyScore ?? 0,
        health: ctx.results.health8dScore ?? 0,
        catalyst,
      },
    };
    ctx.results.kelly_position = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv">
      <p>赔率 b = ${d.b === null ? '不可算' : d.b} ｜ 胜率 p = ${d.p} ｜ 经典凯利 f* = ${d.fStar}</p>
      <p>半凯利 ${(d.halfKelly * 100).toFixed(1)}% × 能力圈系数 ${d.competence}
        → 建议仓位 <b class="wf-big">${(d.finalPosition * 100).toFixed(1)}%</b>
        <span class="wf-muted">（策略${d.strategy}上限 ${(d.ceiling * 100).toFixed(0)}%）</span></p>
      <p class="wf-muted">${d.formula}</p>
      <p class="wf-muted">胜率构成：安全边际三问 ${d.pParts.safety}/50 ＋ 8 维体检 ${d.pParts.health}/30 ＋ 催化确定性 ${d.pParts.catalyst}/20</p>
      ${d.notes.length ? d.notes.map((n) => `<p class="wf-warn">${n}</p>`).join('') : ''}
    </div>`,
    md: (d) => `**凯利仓位 V5.2**：建议 **${(d.finalPosition * 100).toFixed(1)}%**（半凯利 ${(d.halfKelly * 100).toFixed(1)}% × 能力圈 ${d.competence}，策略${d.strategy}上限 ${(d.ceiling * 100).toFixed(0)}%）。\n\n> ${d.formula}`
      + (d.notes.length ? `\n\n> ⚠️ ${d.notes.join(' ')}` : ''),
    docx: (d) => `<p><b>凯利仓位 V5.2</b>：建议 ${(d.finalPosition * 100).toFixed(1)}%（上限 ${(d.ceiling * 100).toFixed(0)}%）。${d.formula}</p>`,
  },
};

export const masterCase = {
  id: 'master_case',
  layer: 'decision',
  title: { zh: '大师案例对标', en: 'Master-Case Benchmarking' },
  appliesTo: ['*'],
  compute(ctx) {
    const total = ctx.results.pmqdTotal ?? 0;
    const forced = total >= 80;
    const picks = MASTER_LIBRARY[ctx.strategy] || MASTER_LIBRARY.S2;
    const winner = picks[0];
    const data = {
      forced,
      total,
      picks,
      winner: winner.name,
      winnerPattern: winner.pattern,
      note: forced
        ? 'PMQD ≥ 80 触发强制对标：必须提取可复用的赢家模式，而非仅找相似。'
        : '常规对标（未达 80 分强制线）。',
    };
    ctx.results.master_case = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv">
      ${d.forced ? '<span class="wf-tag wf-ok">PMQD≥80 强制对标</span>' : '<span class="wf-tag wf-muted">常规对标</span>'}
      <table class="wf-risk"><thead><tr><th>对标案例</th><th>赢家模式</th></tr></thead><tbody>${
        d.picks.map((p) => `<tr><td>${p.name}</td><td>${p.pattern}</td></tr>`).join('')
      }</tbody></table>
      <p>首选赢家模式：<b>${d.winner}</b> — ${d.winnerPattern}</p>
      <p class="wf-muted">${d.note}</p>
    </div>`,
    md: (d) => `**大师对标**${d.forced ? '（PMQD≥80 强制）' : ''}：\n\n| 对标案例 | 赢家模式 |\n|---|---|\n`
      + d.picks.map((p) => `| ${p.name} | ${p.pattern} |`).join('\n')
      + `\n\n首选赢家模式：**${d.winner}** — ${d.winnerPattern}`,
    docx: (d) => `<p><b>大师对标</b>：${d.picks.map((p) => p.name).join('、')}。赢家模式：${d.winnerPattern}</p>`,
  },
};

export const ratingConclusion = {
  id: 'rating_conclusion',
  layer: 'decision',
  title: { zh: '评级结论', en: 'Rating Conclusion' },
  appliesTo: ['*'],
  compute(ctx) {
    if (ctx.veto) {
      const data = {
        rating: '不予评级', stars: '—', veto: true, total: null,
        narrative: `因「${ctx.veto.reason}」触发一票否决，不予评级。`,
      };
      ctx.results.rating_conclusion = data;
      return data;
    }

    const total = ctx.results.pmqdTotal ?? 0;
    const sm = ctx.results.safety_margin || {};
    const h8 = ctx.results.health_check_8d || {};
    const kelly = ctx.results.kelly_position || {};
    const conviction = ctx.results.cognitive_risk?.conviction;

    // 星级直接由 PMQD 总分决定（规范口径，不再叠加自定义调整分）
    const band = starRating(total);
    let rating = band.stars;
    let label = band.label;
    const downgrades = [];

    // 规范：安全边际任一「否」→ 评级降档
    if (sm.downgrade) {
      downgrades.push(sm.indeterminate
        ? '安全边际三问无财报支撑（保守判未通过）→ 降档'
        : '安全边际三问存在「否」项 → 降档');
    }
    if (conviction === '低') downgrades.push('认知确信度低 → 降档（V6.0 认知风险铁律）');

    // 仓位提示随评级同步收口（降档后不得仍给出可配置区间）
    let positionHint = band.positionHint;
    if (downgrades.length && band.band >= 60) {
      const idx = ['★★★★★', '★★★★', '★★★'].indexOf(rating);
      if (idx >= 0) {
        const next = ['★★★★', '★★★', '—'][idx];
        rating = next;
        if (next === '—') {
          label = '不予配置（降档后）';
          positionHint = '0%';
        } else {
          const nb = starRating(next === '★★★★' ? 75 : 60);
          label = nb.label;
          positionHint = nb.positionHint;
        }
      }
    }

    const implicit = ctx.results.implicit_cash ? '（含隐含现金资产重估）' : '';
    const corr = (ctx.results.pmqdCorrections || []).length
      ? `已应用 V6.0.7 结构性修正 ${ctx.results.pmqdCorrections.length} 项。`
      : '';

    const narrative =
      `策略${ctx.strategy}标的，PMQD 总分 ${total} → ${rating}（${label}）。`
      + `安全边际三问 ${sm.score ?? 0}/50，8 维体检 ${h8.score ?? 0}/30，`
      + `凯利建议仓位 ${((kelly.finalPosition ?? 0) * 100).toFixed(1)}%${implicit}。`
      + (corr ? ` ${corr}` : '')
      + (downgrades.length ? ` 降档原因：${downgrades.join('；')}。` : '')
      + (conviction === '低' ? ' 注意：认知确信度低，需先补研究再决策。' : '');

    const data = {
      rating, stars: rating, label, total,
      strat: ctx.strategy,
      downgrades,
      positionHint,
      finalPosition: kelly.finalPosition ?? 0,
      narrative,
    };
    ctx.results.rating_conclusion = data;
    return data;
  },
  render: {
    html: (d) => `<div class="wf-kv">
      <span class="wf-badge wf-badge-rating">${d.rating} ${d.label}</span>
      ${d.total !== null ? `<span class="wf-badge">PMQD ${d.total}</span>` : ''}
      <p>${d.narrative}</p>
      ${d.downgrades && d.downgrades.length ? `<p class="wf-warn">降档：${d.downgrades.join('；')}</p>` : ''}
    </div>`,
    md: (d) => `**评级结论**：${d.rating}（${d.label}）— ${d.narrative}`,
    docx: (d) => `<p><b>评级结论</b>：${d.rating}（${d.label}）。${d.narrative}</p>`,
  },
};
