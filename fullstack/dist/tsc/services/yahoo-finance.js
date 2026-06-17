// ═══════════════════════════════════════════════
// 风林慧策 — Yahoo Finance 实时数据回退
// Workers 环境中直接 fetch，无需 CLI 工具
// ═══════════════════════════════════════════════
/**
 * Get real-time quote from Yahoo Finance v8 API (free, no key required)
 * Works inside Cloudflare Workers environment
 */
export async function getYahooFinanceQuote(code, market) {
    try {
        // Map market to Yahoo Finance symbol format
        let symbol;
        if (market === 'sh') {
            symbol = `${code}.SS`; // Shanghai: 600519.SS
        }
        else if (market === 'sz') {
            symbol = `${code}.SZ`; // Shenzhen: 000333.SZ
        }
        else if (market === 'hk') {
            symbol = `${code}.HK`; // Hong Kong: 0700.HK
        }
        else if (market === 'us') {
            symbol = code; // US: AAPL (no suffix)
        }
        else {
            return null;
        }
        // Yahoo Finance v8 API (unofficial, free endpoint)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WindForestBot/1.0)',
            },
        });
        if (!response.ok) {
            console.warn(`Yahoo Finance returned ${response.status} for ${symbol}`);
            return null;
        }
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        if (!result)
            return null;
        const meta = result.meta;
        const quote = {
            price: meta.regularMarketPrice || 0,
            change_pct: meta.regularMarketPrice && meta.previousClose
                ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
                : 0,
            pe_ttm: meta.trailingPE || 0,
            pb: meta.priceToBook || 0,
            market_cap: meta.marketCap || 0,
            div_yield_ttm: meta.dividendYield ? meta.dividendYield * 100 : 0,
            high_52w: meta.fiftyTwoWeekHigh || 0,
            low_52w: meta.fiftyTwoWeekLow || 0,
            volume: meta.regularMarketVolume || 0,
            turnover: 0, // Not provided by Yahoo
            updated_at: new Date().toISOString(),
        };
        return quote;
    }
    catch (err) {
        console.error('Yahoo Finance fetch error:', err);
        return null;
    }
}
/**
 * Search for a stock symbol using Yahoo Finance autocomplete
 */
export async function searchYahooFinance(query) {
    try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WindForestBot/1.0)',
            },
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const quotes = data?.quotes || [];
        return quotes
            .filter((q) => q.quoteType === 'EQUITY')
            .map((q) => ({
            symbol: q.symbol,
            name: q.shortname || q.longname || q.symbol,
            exchange: q.exchange || '',
        }));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=yahoo-finance.js.map