export interface Stock {
    id: number;
    code: string;
    full_code: string;
    market: 'sz' | 'sh' | 'bj' | 'hk' | 'us';
    market_type: 'ashare' | 'hkshare' | 'usshare';
    name: string;
    sector: string | null;
    pinyin: string | null;
    is_tracked: number;
    created_at: string;
}
export interface StockSearchResult {
    code: string;
    full_code: string;
    market: string;
    market_type: string;
    name: string;
    sector: string | null;
}
export interface MarketData {
    id: number;
    stock_id: number;
    price: number;
    change_pct: number;
    pe_ttm: number;
    pb: number;
    market_cap: number;
    total_shares: number;
    volume: number;
    turnover: number;
    div_yield_ttm: number;
    high_52w: number;
    low_52w: number;
    prev_close: number;
    open_price: number;
    updated_at: string;
}
export interface FinancialData {
    id: number;
    stock_id: number;
    fiscal_year: string;
    report_date: string;
    revenue: number;
    net_profit_parent: number;
    roe: number;
    total_assets: number;
    net_assets: number;
    cash_equivalents: number;
    trading_assets: number;
    interest_bearing_debt: number;
    goodwill: number;
    operating_cf: number;
    fcf: number;
    basic_eps: number;
    gross_cash: number;
    net_cash: number;
    eff_market_cap: number;
    eff_pe: number;
    updated_at: string;
}
export interface ScoreDimension {
    score: number;
    max: number;
    label: string;
    color: string;
}
export interface SafetyQuestion {
    question: string;
    status: 'pass' | 'fail';
    className: string;
}
export interface RiskItem {
    text: string;
    severity: 'high' | 'medium' | 'low';
}
export interface InsightItem {
    title: string;
    content: string;
    className: string;
}
export interface PMQDAnalysis {
    id: number;
    stock_id: number;
    pmqd_total: number;
    pmqd_p_score: number;
    pmqd_m_score: number;
    pmqd_q_score: number;
    pmqd_d_score: number;
    pmqd_stars: string;
    pmqd_verdict: string;
    kelly_f: number;
    kelly_b: number;
    kelly_p: number;
    kelly_verdict: string;
    strategy: string;
    safety_q1_pass: number;
    safety_q2_pass: number;
    safety_q3_pass: number;
    safety_total: number;
    solvency_score: number;
    health_check_score: number;
    report_json: string;
    data_freshness: string;
    generated_at: string;
    data_sources: string;
}
export interface ReportModule {
    module_id: string;
    module_name: string;
    module_order: number;
    data: Record<string, unknown>;
}
export interface FullReport {
    stock: Stock;
    market_data: MarketData;
    financial: FinancialData;
    analysis: PMQDAnalysis;
    modules: ReportModule[];
}
export interface Subscription {
    id: number;
    email: string;
    stock_id: number;
    frequency_daily: number;
    frequency_weekly: number;
    frequency_alert: number;
    active: number;
    created_at: string;
    last_sent_at: string | null;
}
export interface SubscribeRequest {
    email: string;
    code: string;
    market: string;
    daily?: boolean;
    weekly?: boolean;
    alert?: boolean;
}
export interface SearchResponse {
    results: StockSearchResult[];
    count: number;
}
export interface QuoteResponse {
    price: number;
    change_pct: number;
    pe_ttm: number;
    pb: number;
    market_cap: number;
    div_yield_ttm: number;
    high_52w: number;
    low_52w: number;
    volume: number;
    turnover: number;
    updated_at: string;
}
export interface AnalysisResponse {
    status: 'ok' | 'pending' | 'error';
    data?: PMQDAnalysis;
    message?: string;
    estimated_time?: string;
}
export interface ReportResponse {
    status: 'ok' | 'pending' | 'error';
    data?: FullReport;
    message?: string;
}
export interface TriggerResponse {
    status: 'triggered' | 'error';
    workflow_url?: string;
    message?: string;
}
export interface SubscribeResponse {
    status: 'ok' | 'error';
    message: string;
}
export interface HealthResponse {
    status: 'ok';
    time: string;
    version: string;
}
export interface UserRecord {
    id: number;
    account: string;
    password_hash: string;
    email: string | null;
    plan: string | null;
    plan_index: number | null;
    subscribed_at: string | null;
    free_trial_used: number;
    jwt_version: number;
    created_at: string;
    updated_at: string;
}
export interface PaymentRecord {
    id: number;
    user_id: number;
    amount: number;
    currency: string;
    method: 'wechat' | 'alipay' | 'free_trial';
    plan: string;
    status: 'pending' | 'success' | 'failed' | 'refunded';
    out_trade_no: string;
    paid_at: string | null;
    raw_response: string | null;
    created_at: string;
}
export interface PaymentRequest {
    planIndex: number;
    method: 'wechat' | 'alipay';
    returnUrl?: string;
}
export interface PaymentResponse {
    status: 'ok' | 'error';
    message?: string;
    data?: {
        payUrl?: string;
        qrCode?: string;
        outTradeNo: string;
        tradeNo?: string;
        amount?: number;
        planName?: string;
    };
}
export interface AuthResponse {
    status: 'ok' | 'error';
    message: string;
    data?: {
        token: string;
        user: {
            id: number;
            account: string;
            email: string | null;
            plan: string | null;
            freeTrialUsed: number;
        };
    };
}
export interface MeResponse {
    status: 'ok' | 'error';
    data?: {
        id: number;
        account: string;
        email: string | null;
        plan: string | null;
        planIndex: number | null;
        subscribedAt: string | null;
        freeTrialUsed: number;
    };
}
//# sourceMappingURL=index.d.ts.map