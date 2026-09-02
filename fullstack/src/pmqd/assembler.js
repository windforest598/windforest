// Assembler — the coherence engine. Orchestrates modules in layer order, enforces the veto gate
// and conditional triggers, then runs a final CONSISTENCY PASS that guarantees every module's
// output agrees with every other. This is the direct answer to "modules won't stay coherent".

import { createContext } from './context.js';
import { MODULES } from './registry.js';
import { fetchL1, certifySources } from './data/l1-fetcher.js';
import { PMQD_WEIGHTS, starRating } from './rules/pmqd-v607.js';

function shouldRun(m, ctx) {
  // Downstream analytical modules never run once a veto is raised. The 'meta' header is the
  // report shell and must always render (even a vetoed report shows its header + veto reason).
  if (m.layer !== 'gate' && m.layer !== 'meta' && ctx.veto) return false;
  // Strategy applicability (gate modules use '*' and always run to set the strategy).
  if (m.appliesTo && !m.appliesTo.includes('*') && ctx.strategy && !m.appliesTo.includes(ctx.strategy)) return false;
  if (m.trigger && !m.trigger(ctx)) return false;
  return true;
}

function consistencyPass(ctx) {
  const checks = [];
  // 1) Veto gate must have blocked all downstream modules.
  if (ctx.veto) {
    const leaked = MODULES.filter((m) => m.layer !== 'gate' && m.layer !== 'meta' && ctx.results[m.id])
      .map((m) => m.id);
    checks.push({
      name: '否决闸门隔离',
      pass: leaked.length === 0,
      note: leaked.length ? `泄漏模块：${leaked.join(',')}` : '否决后下游模块均已跳过',
    });
  }
  // 2) PMQD>=80 must force master-case benchmarking.
  if ((ctx.results.pmqdTotal ?? 0) >= 80) {
    checks.push({
      name: '高分强制大师对标',
      pass: !!ctx.results.master_case,
      note: ctx.results.master_case ? '已执行对标' : '缺失大师对标模块',
    });
  }
  // 3) Rating conclusion must reference upstream PMQD total (no orphan rating).
  const rc = ctx.results.rating_conclusion;
  if (rc && !rc.veto) {
    checks.push({
      name: '评级引用上游评分',
      pass: rc.narrative.includes(String(ctx.results.pmqdTotal)),
      note: rc.narrative.includes(String(ctx.results.pmqdTotal)) ? '评级叙述已对齐 PMQD 总分' : '评级与 PMQD 脱节',
    });
  }
  // 4) Implicit cash only present when candidate flagged.
  if (ctx.results.implicit_cash) {
    checks.push({
      name: '隐含现金触发一致',
      pass: !!ctx.results.financial_penetration?.implicitCashCandidate,
      note: '隐含现金模块由财务穿透信号正确触发',
    });
  }
  // 5) L1 certification — every L1 figure must trace to an official source.
  if (ctx.certification) {
    checks.push({
      name: 'L1来源认证',
      pass: ctx.certification.allL1,
      note: ctx.certification.allL1
        ? '全部来源为 L1 官方信源，确定性：标准'
        : `混入 L2 平台来源，确定性降级为「初筛」：${ctx.certification.note}`,
    });
  }
  // 5b) If a live L1 query was requested but the connector is offline, surface it loudly.
  if (ctx.meta.l1Fetch && ctx.meta.l1Fetch.status && ctx.meta.l1Fetch.status !== 'fetched') {
    checks.push({
      name: 'L1取数连接状态',
      pass: false,
      note: `取数规格已路由，但连接器未连接（${ctx.meta.l1Fetch.status}）。报告头将标注取数计划，未含真实数字。`,
    });
  }
  // ── V6.0.7 规范对齐校验（技能规范 ↔ 分析内核 不得漂移）──────────
  const ps = ctx.results.pmqd_scoring;
  if (ps) {
    // 6) 固定权重口径：必须为 P40/M18/Q30/D12，且分项之和等于总分（容许四舍五入 1 分）
    const w = ps.weights || {};
    const weightOk = w.P === PMQD_WEIGHTS.P && w.M === PMQD_WEIGHTS.M
      && w.Q === PMQD_WEIGHTS.Q && w.D === PMQD_WEIGHTS.D;
    const sum = (ps.points?.P ?? 0) + (ps.points?.M ?? 0) + (ps.points?.Q ?? 0) + (ps.points?.D ?? 0);
    const sumOk = Math.abs(sum - ps.total) <= 1;
    checks.push({
      name: 'PMQD权重口径(P40/M18/Q30/D12)',
      pass: weightOk && sumOk,
      note: weightOk && sumOk
        ? `权重与规范一致，分项合计 ${sum.toFixed(1)} ≈ 总分 ${ps.total}`
        : `权重或合计偏离规范：权重${weightOk ? '正确' : `错误(${w.P}/${w.M}/${w.Q}/${w.D})`}，合计 ${sum.toFixed(1)} vs 总分 ${ps.total}`,
    });
    // 7) 星级与 PMQD 总分分档一致（评级模块允许降档，但不得升档）
    const rc2 = ctx.results.rating_conclusion;
    if (rc2 && !rc2.veto) {
      const expected = starRating(ps.total).stars;
      const order = ['—', '★★★', '★★★★', '★★★★★'];
      const notUpgraded = order.indexOf(rc2.rating) <= order.indexOf(expected);
      checks.push({
        name: '星级不得升档',
        pass: notUpgraded,
        note: notUpgraded
          ? `PMQD ${ps.total} 对应 ${expected}，实际 ${rc2.rating}${rc2.rating !== expected ? '（已按规则降档）' : ''}`
          : `实际 ${rc2.rating} 高于总分应得 ${expected}，违反规范`,
      });
    }
    // 8) V6.0.7 结构性修正必须留痕（已兑现利好不得静默计零）
    if (ps.correctionApplied) {
      const allLabeled = (ps.corrections || []).every((c) => c.rule && c.note);
      checks.push({
        name: 'V6.0.7结构性修正留痕',
        pass: allLabeled,
        note: allLabeled
          ? `${ps.corrections.length} 项修正均已标注规则与理由（透明度即安全边际）`
          : '存在未标注理由的修正项，违反透明度铁律',
      });
    }
  }
  // 9) 凯利仓位不得超策略上限（S1 40% / S2 30% / S3 15%）
  const kp = ctx.results.kelly_position;
  if (kp) {
    const within = kp.finalPosition <= kp.ceiling + 1e-9;
    checks.push({
      name: '凯利仓位受策略上限约束',
      pass: within,
      note: within
        ? `建议仓位 ${(kp.finalPosition * 100).toFixed(1)}% ≤ 策略${ctx.strategy}上限 ${(kp.ceiling * 100).toFixed(0)}%`
        : `建议仓位 ${(kp.finalPosition * 100).toFixed(1)}% 超出上限 ${(kp.ceiling * 100).toFixed(0)}%`,
    });
  }
  const failed = checks.filter((c) => !c.pass);
  ctx.coherence = { passed: failed.length === 0, checks };
  return ctx.coherence;
}

export async function assemble(input) {
  // L1 acquisition: if the caller passed a fetch spec (live retrieval), pull real L1 data.
  // Otherwise use the directly-provided l1Data (manual samples / pasted figures).
  let l1Data = input.l1Data;
  let certification = input.certification || null;
  let l1Fetch = null;
  if (input.l1Query) {
    l1Fetch = await fetchL1(input.l1Query);
    if (l1Fetch.ok) {
      l1Data = l1Fetch.l1Data;
      certification = l1Fetch.certification;
    } else {
      // Connector offline: attach the plan; if a manual l1Data fallback was provided,
      // certify it so the report stays self-consistent (the live-connector check still flags offline).
      l1Fetch.statusNote = l1Fetch.error;
      if (input.l1Data?.sources) certification = certifySources(input.l1Data.sources);
    }
  }
  const ctx = createContext({ ...input, l1Data, certification, l1Fetch });
  const contract = { meta: ctx.meta, modules: [] };

  for (const m of MODULES) {
    if (!shouldRun(m, ctx)) continue;
    const data = m.compute(ctx);
    contract.modules.push({ id: m.id, layer: m.layer, title: m.title, data, render: m.render });
  }

  const coherence = consistencyPass(ctx);
  contract.coherence = coherence;
  contract.strategy = ctx.strategy;
  contract.veto = ctx.veto;
  contract.overallRating = ctx.results.rating_conclusion?.rating || (ctx.veto ? '不予评级' : '—');
  return contract;
}

// Render the unified contract into one of three formats. All three read the SAME contract,
// so HTML / DOCX / MD can never drift apart.
export function renderReport(contract, format = 'html', ctx) {
  if (format === 'md') return renderMD(contract);
  if (format === 'docx') return renderDOCX(contract);
  return renderHTML(contract, ctx);
}

function renderMD(contract) {
  return contract.modules
    .map((mod) => `## ${mod.title.zh}\n\n${mod.render.md(mod.data, refCtx(contract))}`)
    .join('\n\n')
    + `\n\n---\n\n**一致性校验**：${contract.coherence.passed ? '通过' : '未通过'}（${contract.coherence.checks.length} 项）`;
}

function renderDOCX(contract) {
  return contract.modules
    .map((mod) => mod.render.docx(mod.data, refCtx(contract)))
    .join('\n')
    + `<p><b>一致性校验</b>：${contract.coherence.passed ? '通过' : '未通过'}（${contract.coherence.checks.length} 项）</p>`;
}

function renderHTML(contract, ctx) {
  const c = refCtx(contract);
  const sections = contract.modules
    .map((mod) => `<section class="wf-mod wf-layer-${mod.layer}">
      <h2>${mod.title.zh} <span class="wf-en">${mod.title.en}</span></h2>
      ${mod.render.html(mod.data, c)}
    </section>`)
    .join('\n');
  const coh = contract.coherence.checks
    .map((ck) => `<li class="${ck.pass ? 'wf-ok' : 'wf-bad'}">${ck.name}：${ck.pass ? '通过' : '未通过'} — ${ck.note}</li>`)
    .join('');
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<style>
body{font-family:-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;max-width:820px;margin:24px auto;padding:0 20px;color:#1a2330;background:#fff}
.wf-band{background:#eaf2fb;border:1px solid #b5d4f4;border-radius:12px;padding:16px 20px;margin-bottom:20px}
.wf-stock{font-size:20px;font-weight:600;color:#0c447c}
.wf-band-meta{margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.wf-badge{background:#0c447c;color:#fff;border-radius:999px;padding:3px 12px;font-size:12px}
.wf-badge-rating{background:#3b6d11}
.wf-muted{color:#5f5e5a;font-size:13px}
.wf-mod{border:1px solid #e3e6ea;border-radius:12px;padding:14px 18px;margin-bottom:14px}
.wf-layer-gate{border-left:4px solid #e24b4a}
.wf-layer-core{border-left:4px solid #185fa5}
.wf-layer-risk{border-left:4px solid #ba7517}
.wf-layer-decision{border-left:4px solid #639922}
.wf-layer-conditional{border-left:4px solid #7f77dd;background:#faf8ff}
.wf-layer-meta{border-left:4px solid #888780}
.wf-mod h2{font-size:15px;margin:0 0 8px;color:#042c53}
.wf-en{font-size:12px;color:#888780;font-weight:400}
.wf-kv p{margin:6px 0;font-size:14px;line-height:1.6}
.wf-tag{display:inline-block;border-radius:6px;padding:2px 10px;font-size:12px;margin:2px 4px 2px 0}
.wf-ok{background:#eaf3de;color:#27500a}
.wf-bad{background:#fcebeb;color:#791f1f}
.wf-warn{background:#faefda;color:#633806}
.wf-cond-tag{background:#eeedfe;color:#3c3489}
.wf-fetchbox{margin-top:12px;background:#fff7e6;border:1px dashed #e0a94a;border-radius:10px;padding:10px 14px;font-size:13px}
.wf-fetchbox ul{margin:6px 0;padding-left:18px}
.wf-scores{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}
.wf-scores span{background:#f1efe8;border-radius:6px;padding:3px 10px;font-size:12px}
.wf-big{font-size:16px;color:#0c447c}
.wf-danger{color:#791f1f}
.wf-coh{background:#f6f8fa;border:1px solid #e3e6ea;border-radius:12px;padding:12px 18px;margin-top:8px}
.wf-coh h2{font-size:14px;color:#042c53;margin:0 0 6px}
.wf-coh ul{margin:0;padding-left:18px;font-size:13px}
.wf-risk{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px}
.wf-risk th,.wf-risk td{border:1px solid #e3e6ea;padding:6px 9px;text-align:left;vertical-align:top}
.wf-risk th{background:#f6f8fa;color:#042c53;font-weight:600}
</style></head><body>
${contract.modules.find((m) => m.id === 'report_header') ? contract.modules.find((m) => m.id === 'report_header').render.html(contract.modules.find((m) => m.id === 'report_header').data, c) : ''}
${sections}
<section class="wf-coh"><h2>一致性校验（Coherence Pass）</h2><ul>${coh}</ul></section>
</body></html>`;
}

// Build a minimal ctx-like object so module.render can read ctx.results (e.g. header pulls rating).
function refCtx(contract) {
  const results = {};
  for (const m of contract.modules) results[m.id] = m.data;
  return { results, strategy: contract.strategy, veto: contract.veto };
}
