// ═══════════════════════════════════════════════
// 风林慧策 — 数据刷新脚本
// 运行: npx tsx scripts/refresh-data.ts
// 目的: 刷新所有跟踪标的的市场数据（不重新计算PMQD）
// ═══════════════════════════════════════════════

import { query, execute } from './d1-helper';

async function refreshData() {
  console.log('🔄 风林慧策 — 数据刷新\n');

  const stocks = query(
    `SELECT id as stock_id, code, market, name FROM stocks WHERE is_tracked = 1`
  ) as unknown as Array<{
    stock_id: number;
    code: string;
    market: string;
    name: string;
  }>;

  console.log(`📋 共 ${stocks.length} 只跟踪标的\n`);

  let updated = 0;
  let errors = 0;

  for (const stock of stocks) {
    try {
      let symbol: string;
      if (stock.market === 'sh') symbol = `${stock.code}.SS`;
      else if (stock.market === 'sz') symbol = `${stock.code}.SZ`;
      else if (stock.market === 'hk') symbol = `${String(stock.code).padStart(4, '0')}.HK`;
      else if (stock.market === 'us') symbol = stock.code;
      else continue;

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WindForestBot/1.0)' },
      });

      if (!resp.ok) {
        console.log(`  ⚠️  ${stock.name}: HTTP ${resp.status}`);
        errors++;
        continue;
      }

      const data = await resp.json() as any;
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) {
        console.log(`  ⚠️  ${stock.name}: 无数据`);
        errors++;
        continue;
      }

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
           volume = excluded.volume, updated_at = datetime('now')`,
        [
          stock.stock_id,
          meta.regularMarketPrice || 0,
          meta.regularMarketPrice && meta.previousClose
            ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100 : 0,
          meta.trailingPE || 0,
          meta.priceToBook || 0,
          meta.marketCap || 0,
          meta.dividendYield ? meta.dividendYield * 100 : 0,
          meta.fiftyTwoWeekHigh || 0,
          meta.fiftyTwoWeekLow || 0,
          meta.regularMarketVolume || 0,
          0,
        ]
      );

      console.log(`  ✅ ${stock.name}: ¥${meta.regularMarketPrice?.toFixed(2) || 'N/A'}`);
      updated++;
      await sleep(300);
    } catch (err: any) {
      console.log(`  ❌ ${stock.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ 刷新完成: ${updated} 更新, ${errors} 失败`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

refreshData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
