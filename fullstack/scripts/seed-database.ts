// ═══════════════════════════════════════════════
// 风林慧策 — 种子分析数据导入
// 运行: npx tsx scripts/seed-database.ts
// 目的: 导入美的集团和贵州茅台的预计算分析数据到 D1
// 注意: 需要先执行 db:init 和 db:seed 导入基础数据
// ═══════════════════════════════════════════════

import { execSync } from 'child_process';

const DB_NAME = 'windforest-db';

function runWrangler(sql: string): string {
  try {
    // Escape single quotes in SQL for command line
    const escaped = sql.replace(/'/g, "''");
    return execSync(`npx wrangler d1 execute ${DB_NAME} --command="${escaped}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    console.error(`wrangler error: ${err.stderr || err.message}`);
    throw err;
  }
}

async function seedAnalysisData() {
  console.log('📝 导入预计算分析数据...\n');

  // 美的集团 (sz000333)
  console.log('  美的集团 (000333)...');

  const mideaIdResult = runWrangler(`SELECT id FROM stocks WHERE full_code = 'sz000333' LIMIT 1`);
  const mideaMatch = mideaIdResult.match(/\|\s*(\d+)\s*\|/);
  if (!mideaMatch) {
    console.log('  ⚠️ 未找到美的集团');
  } else {
    const mideaId = mideaMatch[1];

    runWrangler(`INSERT OR REPLACE INTO market_data (stock_id, price, change_pct, pe_ttm, pb, market_cap, div_yield_ttm, high_52w, low_52w, volume, turnover)
      VALUES (${mideaId}, 83.23, -2.48, 14.34, 2.73, 512000000000, 4.2, 92.5, 68.3, 18000000, 0.8)`);

    runWrangler(`INSERT OR REPLACE INTO financial_data (stock_id, fiscal_year, revenue, net_profit_parent, roe, total_assets, net_assets, cash_equivalents, interest_bearing_debt, goodwill, operating_cf, fcf, basic_eps, gross_cash, net_cash, eff_market_cap, eff_pe)
      VALUES (${mideaId}, 'FY2025', 372000000000, 33700000000, 18.59, 486000000000, 190000000000, 148000000000, 65600000000, 31000000000, 50700000000, 34500000000, 4.85, 148000000000, 52400000000, 459600000000, 13.6)`);

    const mideaReport = JSON.stringify({
      modules: [
        { module_id: 'summary', module_name: '投资概要', data: { text: '美的集团PMQD 80/100，进取级。ROE 18.6%稳健，净现金¥2,232亿，分红4.2%。有效PE仅8.62x，安全边际充足，凯利仓位建议15%。' } },
        { module_id: 'pmqd', module_name: 'PMQD评分', data: { total: 80, P: { score: 35, max: 40 }, M: { score: 14, max: 18 }, Q: { score: 24, max: 30 }, D: { score: 7, max: 12 } } },
        { module_id: 'kelly', module_name: '凯利仓位', data: { f: 0.15, b: 0.45, p: 0.55, verdict: '中等仓位' } },
      ],
    }).replace(/'/g, "''");

    runWrangler(`INSERT OR REPLACE INTO analysis_cache
      (stock_id, pmqd_total, pmqd_p_score, pmqd_m_score, pmqd_q_score, pmqd_d_score,
       pmqd_stars, pmqd_verdict, kelly_f, kelly_b, kelly_p, kelly_verdict, strategy,
       safety_q1_pass, safety_q2_pass, safety_q3_pass, safety_total,
       solvency_score, health_check_score, data_freshness, data_sources, report_json)
      VALUES (${mideaId}, 80, 35, 14, 24, 7, '★★★★☆', '进取级·策略一核心',
       0.15, 0.45, 0.55, '中等仓位·核心', 'strategy-1-core',
       1, 1, 1, 3, 93, 24, 'today',
       'westock-data, tushare-finance, financial-data-verifier',
       '${mideaReport}')`);

    console.log('  ✅ 美的集团分析数据已导入');
  }

  // 贵州茅台 (sh600519)
  console.log('  贵州茅台 (600519)...');

  const moutaiIdResult = runWrangler(`SELECT id FROM stocks WHERE full_code = 'sh600519' LIMIT 1`);
  const moutaiMatch = moutaiIdResult.match(/\|\s*(\d+)\s*\|/);
  if (!moutaiMatch) {
    console.log('  ⚠️ 未找到贵州茅台');
  } else {
    const moutaiId = moutaiMatch[1];

    runWrangler(`INSERT OR REPLACE INTO market_data (stock_id, price, change_pct, pe_ttm, pb, market_cap, div_yield_ttm, high_52w, low_52w, volume, turnover)
      VALUES (${moutaiId}, 1580.5, 1.2, 25.6, 7.8, 1980000000000, 3.8, 1920, 1280, 3500000, 0.3)`);

    runWrangler(`INSERT OR REPLACE INTO financial_data (stock_id, fiscal_year, revenue, net_profit_parent, roe, total_assets, net_assets, cash_equivalents, interest_bearing_debt, goodwill, operating_cf, fcf, basic_eps, gross_cash, net_cash, eff_market_cap, eff_pe)
      VALUES (${moutaiId}, 'FY2025', 168000000000, 78000000000, 30.5, 320000000000, 260000000000, 168000000000, 0, 0, 85000000000, 72000000000, 62.1, 168000000000, 168000000000, 1812000000000, 23.2)`);

    const moutaiReport = JSON.stringify({
      modules: [
        { module_id: 'summary', module_name: '投资概要', data: { text: '贵州茅台PMQD 58/100。ROE 30.5%行业顶尖，零有息负债，安全边际充足。当前PE 25.6x相对偏高，凯利仓位约5%，需等待更佳买点。' } },
        { module_id: 'pmqd', module_name: 'PMQD评分', data: { total: 58 } },
      ],
    }).replace(/'/g, "''");

    runWrangler(`INSERT OR REPLACE INTO analysis_cache
      (stock_id, pmqd_total, pmqd_p_score, pmqd_m_score, pmqd_q_score, pmqd_d_score,
       pmqd_stars, pmqd_verdict, kelly_f, kelly_b, kelly_p, kelly_verdict, strategy,
       safety_q1_pass, safety_q2_pass, safety_q3_pass, safety_total,
       solvency_score, health_check_score, data_freshness, data_sources, report_json)
      VALUES (${moutaiId}, 58, 10, 16, 28, 4, '★★★☆☆', '观察级·策略二边界',
       0.05, 0.2, 0.6, '小仓位·观察仓', 'strategy-2-boundary',
       1, 1, 1, 3, 98, 28, 'today',
       'westock-data, tushare-finance',
       '${moutaiReport}')`);

    console.log('  ✅ 贵州茅台分析数据已导入');
  }

  console.log('\n🎉 种子分析数据导入完成！');
}

seedAnalysisData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
