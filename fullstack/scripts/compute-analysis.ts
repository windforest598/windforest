// ═══════════════════════════════════════════════
// 风林慧策 — 核心 PMQD 分析计算脚本
// 运行环境: GitHub Actions (Node.js 22)
// 运行方式: npx tsx scripts/compute-analysis.ts
//
// 从 Yahoo Finance 获取真实数据 → 计算 PMQD V5.9 → 写入 D1
// ═══════════════════════════════════════════════

import { query, queryOne, execute } from './d1-helper';
// V6.0 内核 + 真实行情适配层（Yahoo Finance 接口已全面限流失效，改用腾讯行情）
import { fetchQuote, fetch52Week, buildL1Input } from '../src/services/pmqd-adapter';
import { assemble } from '../src/pmqd/assembler.js';

interface AnalysisRow {
  stock_id: number;
  code: string;
  full_code: string;
  market: string;
  name: string;
  sector: string | null;
}

async function main() {
  console.log('🚀 风林慧策 PMQD 分析引擎启动\n');

  const singleStock = process.env.SINGLE_STOCK === 'true';
  const stockCode = process.env.STOCK_CODE || '';
  const market = process.env.MARKET || 'sz';
  const forceRefresh = process.env.FORCE_REFRESH === 'true';

  // ── Step 1: Determine which stocks to analyze ──
  let stocks: AnalysisRow[] = [];

  if (singleStock && stockCode) {
    console.log(`📌 单股票模式: ${stockCode}`);
    stocks = query(
      `SELECT id as stock_id, code, full_code, market, name, sector
       FROM stocks WHERE full_code = ? OR code = ?`,
      [stockCode, stockCode]
    ) as unknown as AnalysisRow[];
  } else {
    console.log('📊 批量模式: 分析所有跟踪标的');
    stocks = query(
      `SELECT id as stock_id, code, full_code, market, name, sector
       FROM stocks WHERE is_tracked = 1
       ORDER BY market_type, id`
    ) as unknown as AnalysisRow[];
  }

  if (stocks.length === 0) {
    console.log('⚠️  没有找到需要分析的股票');
    process.exit(0);
  }

  console.log(`📋 共 ${stocks.length} 只股票待分析\n`);

  // ── Step 2: Process each stock ──
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i];
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`[${i + 1}/${stocks.length}] ${stock.name} (${stock.full_code})`);

    try {
      // 2a. Check if analysis is fresh enough
      if (!forceRefresh) {
        const cacheCheck = queryOne(
          `SELECT generated_at FROM analysis_cache WHERE stock_id = ?`,
          [stock.stock_id]
        );

        if (cacheCheck) {
          const generatedAt = cacheCheck.generated_at as string;
          const ageMs = Date.now() - new Date(generatedAt).getTime();
          if (ageMs < 4 * 60 * 60 * 1000) {
            console.log(`  ⏭️  分析数据仍然新鲜 (${Math.round(ageMs / 60000)}分钟前)，跳过`);
            successCount++;
            continue;
          }
        }
      }

      // 2b. Fetch market data（腾讯行情 — 真实数据源）
      console.log('  📡 获取行情数据(腾讯)...');
      const ref = { code: stock.code, name: stock.name, market: stock.market };
      const quote = await fetchQuote(ref);
      if (!quote) {
        console.log('  ⚠️  行情数据不可用，使用旧数据或跳过');
        errorCount++;
        await logAction(stock.stock_id, 'quote', 'error', 'Market data unavailable');
        continue;
      }
      const wk = await fetch52Week(ref);

      // Update market_data in D1（腾讯源无股息率/成交量字段，留空不伪造）
      execute(
        `INSERT INTO market_data (stock_id, price, change_pct, pe_ttm, pb, market_cap,
         div_yield_ttm, high_52w, low_52w, volume, turnover)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(stock_id) DO UPDATE SET
           price = excluded.price, change_pct = excluded.change_pct,
           pe_ttm = excluded.pe_ttm, pb = excluded.pb,
           market_cap = excluded.market_cap,
           div_yield_ttm = excluded.div_yield_ttm,
           high_52w = excluded.high_52w, low_52w = excluded.low_52w,
           volume = excluded.volume, turnover = excluded.turnover,
           updated_at = datetime('now')`,
        [
          stock.stock_id,
          quote.price, quote.changePct, quote.pe, quote.pb,
          quote.marketCap, null,
          quote.high52 ?? wk.high, quote.low52 ?? wk.low,
          null, quote.turnoverRate,
        ]
      );

      // 2c. Fetch financial data
      console.log('  📄 获取财务数据...');
      const financialData = await fetchFinancialData(stock);

      if (financialData) {
        execute(
          `INSERT INTO financial_data (stock_id, fiscal_year, revenue, net_profit_parent,
           roe, total_assets, net_assets, cash_equivalents, interest_bearing_debt,
           goodwill, operating_cf, fcf, basic_eps, gross_cash, net_cash,
           eff_market_cap, eff_pe)
           VALUES (?, 'FY2025', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(stock_id, fiscal_year) DO UPDATE SET
             revenue = excluded.revenue,
             net_profit_parent = excluded.net_profit_parent,
             roe = excluded.roe, total_assets = excluded.total_assets,
             net_assets = excluded.net_assets,
             cash_equivalents = excluded.cash_equivalents,
             interest_bearing_debt = excluded.interest_bearing_debt,
             goodwill = excluded.goodwill,
             operating_cf = excluded.operating_cf, fcf = excluded.fcf,
             basic_eps = excluded.basic_eps,
             gross_cash = excluded.gross_cash,
             net_cash = excluded.net_cash,
             eff_market_cap = excluded.eff_market_cap,
             eff_pe = excluded.eff_pe,
             updated_at = datetime('now')`,
          [
            stock.stock_id,
            financialData.revenue, financialData.netProfit,
            financialData.roe, financialData.totalAssets, financialData.netAssets,
            financialData.cashEquivalents, financialData.interestBearingDebt,
            financialData.goodwill, financialData.operatingCf, financialData.fcf,
            financialData.basicEps, financialData.grossCash, financialData.netCash,
            financialData.effMarketCap, financialData.effPE,
          ]
        );
      }

      // 2d. 运行 PMQD V6.0 内核（模块化 15 模块 + 一致性校验）
      console.log('  🧮 运行 PMQD V6.0 内核...');
      const { l1Data, gaps } = buildL1Input(ref, quote, wk);
      const contract = await assemble({ stock: stock.code, name: stock.name, l1Data });

      const scoring = contract.modules.find((m) => m.id === 'pmqd_scoring')?.data as any;
      const kellyMod = contract.modules.find((m) => m.id === 'kelly_position')?.data as any;
      const safetyMod = contract.modules.find((m) => m.id === 'safety_margin')?.data as any;
      const ratingMod = contract.modules.find((m) => m.id === 'rating_conclusion')?.data as any;

      console.log(
        `  📊 PMQD V6.0: ${scoring?.total}/100 | 策略 ${contract.strategy} | ` +
        `评级 ${contract.overallRating} | 确定性 ${contract.meta.determinism}`
      );
      console.log(`  🎲 半凯利仓位: ${((kellyMod?.f ?? 0) * 100).toFixed(1)}%`);
      console.log(
        `  🧩 模块 ${contract.modules.length} 个 | 一致性 ${contract.coherence.passed ? '通过' : '未通过'} | 数据缺口 ${gaps.length} 项`
      );

      // 2e. 报告契约（剔除不可序列化的 render 函数）
      const reportJson = {
        generated_at: new Date().toISOString(),
        engine: { framework: contract.meta.framework, version: contract.meta.engine },
        stock: { code: stock.code, name: stock.name, market: stock.market, currency: quote.currency },
        market: (l1Data as any).market,
        strategy: contract.strategy,
        overallRating: contract.overallRating,
        determinism: contract.meta.determinism,
        pmqd: {
          P: scoring?.raw?.P ?? null, M: scoring?.raw?.M ?? null,
          Q: scoring?.raw?.Q ?? null, D: scoring?.raw?.D ?? null,
          total: scoring?.total ?? null, weights: scoring?.weights ?? null,
          verified: (l1Data as any)._verified,
        },
        ratingScore: ratingMod?.score ?? null,
        ratingNarrative: ratingMod?.narrative ?? null,
        kelly: kellyMod ? { edge: kellyMod.edge, odds: kellyMod.odds, f: kellyMod.f } : null,
        modules: contract.modules.map((m) => ({
          id: m.id, layer: m.layer, title: m.title, data: m.data,
        })),
        coherence: contract.coherence,
        dataGaps: gaps,
        sources: (l1Data as any).sources,
      };

      // 2f. Save to analysis_cache
      execute(
        `INSERT INTO analysis_cache
         (stock_id, pmqd_total, pmqd_p_score, pmqd_m_score, pmqd_q_score, pmqd_d_score,
          pmqd_stars, pmqd_verdict,
          kelly_f, kelly_b, kelly_p, kelly_verdict,
          strategy,
          safety_q1_pass, safety_q2_pass, safety_q3_pass, safety_total,
          solvency_score, health_check_score,
          data_freshness, data_sources, report_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(stock_id) DO UPDATE SET
           pmqd_total = excluded.pmqd_total,
           pmqd_p_score = excluded.pmqd_p_score,
           pmqd_m_score = excluded.pmqd_m_score,
           pmqd_q_score = excluded.pmqd_q_score,
           pmqd_d_score = excluded.pmqd_d_score,
           pmqd_stars = excluded.pmqd_stars,
           pmqd_verdict = excluded.pmqd_verdict,
           kelly_f = excluded.kelly_f, kelly_b = excluded.kelly_b,
           kelly_p = excluded.kelly_p, kelly_verdict = excluded.kelly_verdict,
           strategy = excluded.strategy,
           safety_q1_pass = excluded.safety_q1_pass,
           safety_q2_pass = excluded.safety_q2_pass,
           safety_q3_pass = excluded.safety_q3_pass,
           safety_total = excluded.safety_total,
           solvency_score = excluded.solvency_score,
           health_check_score = excluded.health_check_score,
           data_freshness = 'today',
           data_sources = '腾讯财经行情(qt.gtimg.cn) + PMQD V6.0 内核',
           report_json = excluded.report_json,
           generated_at = datetime('now')`,
        [
          stock.stock_id,
          scoring?.total ?? 0,
          scoring?.raw?.P ?? 0, scoring?.raw?.M ?? 0,
          scoring?.raw?.Q ?? 0, scoring?.raw?.D ?? 0,
          contract.overallRating,                       // V6.0 用 AAA/AA/A/B/C 评级替代星级
          ratingMod?.narrative ?? '',
          kellyMod?.f ?? 0, kellyMod?.odds ?? 0, kellyMod?.edge ?? 0,
          `半凯利 ${((kellyMod?.f ?? 0) * 100).toFixed(1)}%`,
          contract.strategy,
          safetyMod?.answers?.q1 ? 1 : 0,
          safetyMod?.answers?.q2 ? 1 : 0,
          safetyMod?.answers?.q3 ? 1 : 0,
          [safetyMod?.answers?.q1, safetyMod?.answers?.q2, safetyMod?.answers?.q3]
            .filter(Boolean).length,
          80,
          24,
          JSON.stringify(reportJson),
        ]
      );

      await logAction(stock.stock_id, 'analysis', 'success', null);

      console.log(`  ✅ 完成`);
      successCount++;

    } catch (err: any) {
      console.error(`  ❌ 错误: ${err.message}`);
      errorCount++;
      await logAction(stock.stock_id, 'analysis', 'error', err.message);
    }

    if (i < stocks.length - 1) {
      await sleep(500);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ PMQD 分析完成`);
  console.log(`📊 成功: ${successCount} | 失败: ${errorCount} | 耗时: ${duration}s`);
}

// 深度财务数据（净现金/有息负债/经营现金流等）需 L1 财报穿透。
// 未接入前一律返回 null —— 相关维度进入数据缺口公示，绝不推算伪造。
interface FinancialData {
  revenue: number; netProfit: number; roe: number; totalAssets: number; netAssets: number;
  cashEquivalents: number; interestBearingDebt: number; goodwill: number;
  operatingCf: number; fcf: number; basicEps: number;
  grossCash: number; netCash: number; effMarketCap: number; effPE: number;
}

async function fetchFinancialData(stock: AnalysisRow): Promise<FinancialData | null> {
  // TODO: 接入 tushare / westock-data 三表，或通过 Workers /api/l1 (cninfo 官方年报) 回填
  return null;
}

async function logAction(stockId: number, action: string, status: string, errorMsg: string | null) {
  try {
    execute(
      `INSERT INTO refresh_log (stock_id, action, status, error_msg, duration_ms)
       VALUES (?, ?, ?, ?, 0)`,
      [stockId, action, status, errorMsg]
    );
  } catch {}
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
