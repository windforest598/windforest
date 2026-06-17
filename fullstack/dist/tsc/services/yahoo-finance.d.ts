import type { QuoteResponse } from '../types';
/**
 * Get real-time quote from Yahoo Finance v8 API (free, no key required)
 * Works inside Cloudflare Workers environment
 */
export declare function getYahooFinanceQuote(code: string, market: string): Promise<QuoteResponse | null>;
/**
 * Search for a stock symbol using Yahoo Finance autocomplete
 */
export declare function searchYahooFinance(query: string): Promise<Array<{
    symbol: string;
    name: string;
    exchange: string;
}>>;
//# sourceMappingURL=yahoo-finance.d.ts.map