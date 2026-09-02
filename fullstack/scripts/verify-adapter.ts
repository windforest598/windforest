// 适配层真实验证：拉取真实行情 → 映射 V6.0 契约 → 跑引擎
import { fetchQuote, buildL1Input, fetch52Week } from '../src/services/pmqd-adapter';
import { assemble } from '../src/pmqd/assembler.js';

const cases = [
  { code: '000333', name: '美的集团', market: 'sz' },
  { code: '300750', name: '宁德时代', market: 'sz' },
  { code: '000651', name: '格力电器', market: 'sz' },
  { code: '002594', name: '比亚迪', market: 'sz' },
  { code: '600519', name: '贵州茅台', market: 'sh' },
  { code: '600690', name: '海尔智家', market: 'sh' },
  { code: '601318', name: '中国平安', market: 'sh' },
  { code: '01114', name: '华晨中国', market: 'hk' },
  { code: '00700', name: '腾讯控股', market: 'hk' },
];

for (const s of cases) {
  const q = await fetchQuote(s);
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`${s.name} (${s.code}.${s.market})`);
  if (!q) { console.log('  ❌ 行情获取失败'); continue; }

  console.log(`  价 ${q.price} ${q.currency} | 涨跌 ${q.changePct}% | PE ${q.pe} | PB ${q.pb} | 市值 ${q.marketCap}亿`);
  console.log(`  52周: ${q.low52} ~ ${q.high52} | 换手 ${q.turnoverRate}% | 数据时间 ${q.asOf}`);

  const wk = await fetch52Week(s);
  if (wk.high !== null) console.log(`  52周(K线实算): ${wk.low} ~ ${wk.high}`);
  const { l1Data, gaps } = buildL1Input(s, q, wk);
  const mk = (l1Data as any).market;
  console.log(`  推导 ROE = PB/PE = ${mk.roe}%  (PB ${q.pb} ÷ PE ${q.pe})`);
  console.log(`  PMQD 四维: P=${l1Data.pmqd.P} M=${l1Data.pmqd.M} Q=${l1Data.pmqd.Q} D=${l1Data.pmqd.D}`);
  console.log(`  已核验: ${JSON.stringify((l1Data as any)._verified)}`);

  const contract = await assemble({
    stock: s.code, name: s.name, l1Data,
  });
  console.log(`  策略 ${contract.strategy} | 评级 ${contract.overallRating} | 模块 ${contract.modules.length} | 确定性 ${contract.meta.determinism}`);
  console.log(`  一致性: ${contract.coherence.passed ? '通过' : '未通过'} (${contract.coherence.checks.length}项)`);
  for (const c of contract.coherence.checks) {
    console.log(`    ${c.pass ? '[OK]' : '[X]'} ${c.name} — ${c.note}`);
  }
  console.log(`  数据缺口 ${gaps.length} 项（首条：${gaps[0]}）`);
}
