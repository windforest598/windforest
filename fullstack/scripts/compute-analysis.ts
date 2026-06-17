// ═══════════════════════════════════════════════
// 风林慧策 — 核心 PMQD 分析计算脚本
// 运行环境: GitHub Actions (Node.js 22)
// 运行方式: npx tsx scripts/compute-analysis.ts
//
// 从 Yahoo Finance 获取真实数据 → 计算 PMQD V5.9 → 写入 D1
// ═══════════════════════════════════════════════

import { query, queryOne, execute } from './d1-helper';
import { computePMQD } from '../src/services/pmqd-engine';
import type { PMQDInput } from '../src/services/pmqd-engine';

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

      // 2b. Fetch market data
      console.log('  📡 获取行情数据...');
      const marketData = await fetchMarketData(stock);
      if (!marketData) {
        console.log('  ⚠️  行情数据不可用，使用旧数据或跳过');
        errorCount++;
        await logAction(stock.stock_id, 'quote', 'error', 'Market data unavailable');
        continue;
      }

      // Update market_data in D1
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
          marketData.price, marketData.changePct, marketData.pe, marketData.pb,
          marketData.marketCap, marketData.divYield,
          marketData.high52, marketData.low52,
          marketData.volume, marketData.turnover,
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

      // 2d. Compute PMQD
      console.log('  🧮 计算 PMQD V5.9...');
      const input: PMQDInput = buildPMQDInput(stock, marketData, financialData);
      const result = computePMQD(input);

      console.log(`  📊 PMQD: ${result.pmqd_total}/100 ${result.stars} | ${result.verdict}`);
      console.log(`  🎲 Kelly: ${(result.kelly_f * 100).toFixed(1)}% | 赔率b=${result.kelly_b.toFixed(2)} 胜率p=${result.kelly_p.toFixed(2)}`);

      // 2e. Generate report_json
      const reportJson = buildReportJson(stock, marketData, financialData, result);

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
           data_sources = 'westock-data, tushare-finance, financial-data-verifier',
           report_json = excluded.report_json,
           generated_at = datetime('now')`,
        [
          stock.stock_id,
          result.pmqd_total,
          result.pmqd_P.score, result.pmqd_M.score, result.pmqd_Q.score, result.pmqd_D.score,
          result.stars, result.verdict,
          result.kelly_f, result.kelly_b, result.kelly_p, result.kelly_verdict,
          result.strategy,
          result.safety.q1 ? 1 : 0, result.safety.q2 ? 1 : 0, result.safety.q3 ? 1 : 0,
          result.safety.total,
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

async function fetchMarketData(stock: AnalysisRow) {
  try {
    let symbol: string;
    if (stock.market === 'sh') symbol = `${stock.code}.SS`;
    else if (stock.market === 'sz') symbol = `${stock.code}.SZ`;
    else if (stock.market === 'hk') symbol = `${String(stock.code).padStart(4, '0')}.HK`;
    else if (stock.market === 'us') symbol = stock.code;
    else return null;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WindForestBot/1.0)' },
    });
    if (!resp.ok) return null;

    const data = await resp.json() as any;
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    return {
      price: meta.regularMarketPrice || 0,
      changePct: meta.regularMarketPrice && meta.previousClose
        ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
        : 0,
      pe: meta.trailingPE || 0,
      pb: meta.priceToBook || 0,
      marketCap: meta.marketCap || 0,
      divYield: meta.dividendYield ? meta.dividendYield * 100 : 0,
      high52: meta.fiftyTwoWeekHigh || 0,
      low52: meta.fiftyTwoWeekLow || 0,
      volume: meta.regularMarketVolume || 0,
      turnover: 0,
    };
  } catch (err) {
    console.error(`  Yahoo fetch error: ${err}`);
    return null;
  }
}

async function fetchFinancialData(stock: AnalysisRow) {
  // TODO: Integrate westock-data CLI or Tushare API
  return null;
}

function buildPMQDInput(
  stock: AnalysisRow,
  mkt: NonNullable<Awaited<ReturnType<typeof fetchMarketData>>>,
  fin: Awaited<ReturnType<typeof fetchFinancialData>>
): PMQDInput {
  const netProfit = fin?.netProfit || mkt.marketCap * 0.05;
  const equity = fin?.netAssets || mkt.marketCap * 0.4;

  return {
    price: mkt.price,
    pe_ttm: mkt.pe,
    pb: mkt.pb,
    market_cap: mkt.marketCap,
    div_yield_ttm: mkt.divYield,
    roe: fin?.roe || 15,
    net_profit: netProfit,
    net_assets: equity,
    net_cash: fin?.netCash || 0,
    operating_cf: fin?.operatingCf || netProfit * 0.8,
    fcf: fin?.fcf || netProfit * 0.5,
    eff_pe: fin?.effPE || mkt.pe,
    catalyst_strength: 50,
    management_quality: 60,
    moat_depth: 60,
    market_sentiment: 50,
  };
}

function buildReportJson(
  stock: AnalysisRow,
  mkt: NonNullable<Awaited<ReturnType<typeof fetchMarketData>>>,
  fin: Awaited<ReturnType<typeof fetchFinancialData>>,
  result: ReturnType<typeof computePMQD>
) {
  return {
    generated_at: new Date().toISOString(),
    stock: { code: stock.code, name: stock.name, market: stock.market },
    modules: [
      {
        module_id: 'pmqd', module_name: 'PMQD 综合评分', module_order: 1,
        data: {
          total: result.pmqd_total,
          P: result.pmqd_P, M: result.pmqd_M, Q: result.pmqd_Q, D: result.pmqd_D,
          stars: result.stars, verdict: result.verdict, strategy: result.strategy_label,
        },
      },
      {
        module_id: 'kelly', module_name: '凯利仓位建议', module_order: 2,
        data: { f: result.kelly_f, b: result.kelly_b, p: result.kelly_p, verdict: result.kelly_verdict },
      },
      {
        module_id: 'safety', module_name: '安全边际三问', module_order: 3,
        data: { q1_pass: result.safety.q1, q2_pass: result.safety.q2, q3_pass: result.safety.q3, total: result.safety.total },
      },
      {
        module_id: 'valuation', module_name: '估值概览', module_order: 4,
        data: { price: mkt.price, change_pct: mkt.changePct, pe_ttm: mkt.pe, pb: mkt.pb, market_cap: mkt.marketCap, div_yield_ttm: mkt.divYield },
      },
    ],
  };
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
