// V6.0 内核冒烟验证 — 确认移植后的引擎在 Node/Workers 环境可运行且模块自洽
import { assemble } from '../src/pmqd/assembler.js';
import { sampleS1, sampleS2, sampleVeto } from '../src/pmqd/data/samples.js';

const cases = [
  ['S1 烟蒂型', sampleS1],
  ['S2 优质型', sampleS2],
  ['否决型', sampleVeto],
];

let allPass = true;
for (const [label, input] of cases) {
  const contract = await assemble(input);
  const coh = contract.coherence;
  console.log(`\n=== ${label} ===`);
  console.log(`策略: ${contract.strategy ?? '—'} | 评级: ${contract.overallRating} | 确定性: ${contract.meta.determinism}`);
  console.log(`模块数: ${contract.modules.length} | 框架: ${contract.meta.framework}`);
  console.log(`模块清单: ${contract.modules.map((m) => m.id).join(', ')}`);
  for (const ck of coh.checks) {
    console.log(`  ${ck.pass ? '[OK]' : '[X]'} ${ck.name} — ${ck.note}`);
    if (!ck.pass) allPass = false;
  }
}

console.log(`\n${'═'.repeat(50)}`);
console.log(allPass ? '✅ V6.0 内核冒烟通过 — 一致性校验全绿' : '❌ 存在一致性校验失败项');
process.exit(allPass ? 0 : 1);
