// ═══════════════════════════════════════════════
// 风林慧策 — V6.0 报告生成器
// 真实行情（腾讯） → PMQD V6.0 引擎 → deploy/data/reports/<code>.json
//
// 运行: npx tsx scripts/generate-v6-reports.ts
// 产物直接由 GitHub Pages 分发，前端 report.html 读取渲染
// ═══════════════════════════════════════════════

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchQuote, fetch52Week, buildL1Input } from '../src/services/pmqd-adapter';
import { assemble } from '../src/pmqd/assembler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STOCKS = [
  { code: '000333', name: '美的集团', market: 'sz' },
  { code: '000651', name: '格力电器', market: 'sz' },
  { code: '002594', name: '比亚迪', market: 'sz' },
  { code: '300750', name: '宁德时代', market: 'sz' },
  { code: '600519', name: '贵州茅台', market: 'sh' },
  { code: '600690', name: '海尔智家', market: 'sh' },
  { code: '601318', name: '中国平安', market: 'sh' },
  { code: '01114', name: '华晨中国', market: 'hk' },
  { code: '00700', name: '腾讯控股', market: 'hk' },
];

const OUT_DIR = resolve(__dirname, '../../deploy/data/reports/');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('🚀 PMQD V6.0 报告生成器启动\n');

  let ok = 0;
  let fail = 0;

  for (const s of STOCKS) {
    try {
      const q = await fetchQuote(s);
      if (!q) {
        console.log(`  ⚠️  ${s.name} 行情获取失败，跳过`);
        fail++;
        continue;
      }

      const wk = await fetch52Week(s);
      const { l1Data, gaps } = buildL1Input(s, q, wk);

      const contract = await assemble({ stock: s.code, name: s.name, l1Data });

      // 剔除不可序列化的 render 函数
      const modules = contract.modules.map((m) => ({
        id: m.id, layer: m.layer, title: m.title, data: m.data,
      }));

      const scoring = contract.modules.find((m) => m.id === 'pmqd_scoring')?.data as any;
      const rating = contract.modules.find((m) => m.id === 'rating_conclusion')?.data as any;
      const kelly = contract.modules.find((m) => m.id === 'kelly_position')?.data as any;
      const safety = contract.modules.find((m) => m.id === 'safety_margin')?.data as any;
      const health = contract.modules.find((m) => m.id === 'health_check_8d')?.data as any;

      const out = {
        generated_at: new Date().toISOString(),
        engine: {
          framework: contract.meta.framework,
          version: contract.meta.engine,
          rulesVersion: (contract.meta as any).rulesVersion ?? null,
        },
        stock: { code: s.code, name: s.name, market: s.market, currency: q.currency },
        market: (l1Data as any).market,
        strategy: contract.strategy,
        overallRating: contract.overallRating,
        determinism: contract.meta.determinism,
        pmqd: {
          P: scoring?.raw?.P ?? null,
          M: scoring?.raw?.M ?? null,
          Q: scoring?.raw?.Q ?? null,
          D: scoring?.raw?.D ?? null,
          total: scoring?.total ?? null,
          weights: scoring?.weights ?? null,
          points: scoring?.points ?? null,
          verified: (l1Data as any)._verified,
        },
        // V6.0.7 新增：星级 / 仓位提示 / 结构性修正留痕
        stars: rating?.stars ?? null,
        ratingLabel: rating?.label ?? null,
        positionHint: rating?.positionHint ?? null,
        downgrades: rating?.downgrades ?? [],
        corrections: scoring?.corrections ?? [],
        safety: safety ? { score: safety.score ?? null, max: 50, passed: safety.passed ?? null } : null,
        health8d: health ? { score: health.score ?? null, max: 30, capped: !!health.capped } : null,
        ratingScore: rating?.total ?? null,
        ratingNarrative: rating?.narrative ?? null,
        kelly: kelly
          ? {
              b: kelly.b ?? null,
              p: kelly.p ?? null,
              fStar: kelly.fStar ?? null,
              halfKelly: kelly.halfKelly ?? null,
              competence: kelly.competence ?? null,
              finalPosition: kelly.finalPosition ?? null,
              ceiling: kelly.ceiling ?? null,
              formula: kelly.formula ?? null,
              pParts: kelly.pParts ?? null,
            }
          : null,
        modules,
        coherence: contract.coherence,
        dataGaps: gaps,
        sources: (l1Data as any).sources,
      };

      const cleanCode = s.code;   // 文件名用干净代码（与前端 cleanCode 规则一致）
      writeFileSync(join(OUT_DIR, `${cleanCode}.json`), JSON.stringify(out, null, 2), 'utf-8');

      console.log(
        `  ✅ ${s.name.padEnd(6)} ${String(s.code).padEnd(6)} ` +
        `策略${contract.strategy} | PMQD ${scoring?.total} | 评级 ${contract.overallRating} | ` +
        `模块 ${modules.length} | 确定性 ${contract.meta.determinism}`
      );
      ok++;
    } catch (err: any) {
      console.log(`  ❌ ${s.name} 生成失败: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ 完成 — 成功 ${ok} | 失败 ${fail} | 输出目录 ${OUT_DIR}`);
}

main();
