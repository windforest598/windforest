export interface PMQDInput {
    price: number;
    pe_ttm: number;
    pb: number;
    market_cap: number;
    div_yield_ttm: number;
    roe: number;
    net_profit: number;
    net_assets: number;
    net_cash: number;
    operating_cf: number;
    fcf: number;
    eff_pe: number;
    catalyst_strength: number;
    management_quality: number;
    moat_depth: number;
    market_sentiment: number;
}
export interface PMQDResult {
    pmqd_total: number;
    pmqd_P: {
        score: number;
        max: number;
        label: string;
    };
    pmqd_M: {
        score: number;
        max: number;
        label: string;
    };
    pmqd_Q: {
        score: number;
        max: number;
        label: string;
    };
    pmqd_D: {
        score: number;
        max: number;
        label: string;
    };
    stars: string;
    verdict: string;
    kelly_f: number;
    kelly_b: number;
    kelly_p: number;
    kelly_verdict: string;
    safety: {
        q1: boolean;
        q2: boolean;
        q3: boolean;
        total: number;
    };
    strategy: string;
    strategy_label: string;
}
/**
 * Main PMQD V5.9 computation engine
 */
export declare function computePMQD(input: PMQDInput): PMQDResult;
//# sourceMappingURL=pmqd-engine.d.ts.map