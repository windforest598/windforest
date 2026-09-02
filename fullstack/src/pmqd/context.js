// Shared analysis context — the single source of truth that keeps every module coherent.
// Modules never render in isolation: they read prior results from ctx.results and write
// their own output back into it, so downstream modules always reference upstream findings.

import { certifySources } from './data/l1-fetcher.js';
import { RULES_VERSION } from './rules/pmqd-v607.js';

export function createContext(input) {
  const now = new Date().toISOString();
  // L1 certification (from fetchL1) drives the report's determinism grade.
  const cert = input.certification || null;
  const determinism = cert ? cert.determinism : (input.l1Data?.sources ? certifySources(input.l1Data.sources).determinism : '标准');
  return {
    meta: {
      stock: input.stock,
      name: input.name || input.stock,
      analyst: 'PALA (老帕) · 风林慧策',
      framework: 'PMQD V6.0.7',
      engine: 'windforest-report-engine 1.2.0',
      rulesVersion: RULES_VERSION,
      generatedAt: now,
      determinism,
      l1Fetch: input.l1Fetch || null,
    },
    // L1 verified financials + qualitative hints (the assembler's raw input)
    l1: input.l1Data || {},
    // L1 source certification result (all L1 => '标准', mixed L2 => '初筛')
    certification: cert,
    // resolved strategy (set by strategy_classification module, null until then)
    strategy: input.strategyPref || null,
    strategyPref: input.strategyPref || null,
    // moduleId -> structured output (every module writes here)
    results: {},
    // veto gate: { module, reason } — when set, downstream modules are skipped
    veto: null,
    // soft coherence warnings collected during assembly
    flags: [],
    // consistency check results, populated by the final pass
    coherence: { passed: true, checks: [] },
    userOverrides: input.userOverrides || {},
  };
}

export function setVeto(ctx, moduleId, reason) {
  ctx.veto = { module: moduleId, reason };
  ctx.flags.push({ level: 'veto', module: moduleId, msg: reason });
}

export function addFlag(ctx, level, moduleId, msg) {
  ctx.flags.push({ level, module: moduleId, msg });
}
