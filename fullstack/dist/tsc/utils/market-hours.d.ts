export interface MarketStatus {
    market: string;
    name: string;
    isOpen: boolean;
    nextEvent: string;
    nextEventTime: string;
    displayClass: string;
}
/**
 * Check if a market is currently open
 * Uses China Standard Time (UTC+8) for A-share
 * Uses local time for US (need to check US timezone)
 */
export declare function getMarketStatus(marketType: string): MarketStatus;
//# sourceMappingURL=market-hours.d.ts.map