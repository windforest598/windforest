// ═══════════════════════════════════════════════
// 风林慧策 API — /api/hot-stocks 路由
// 热门标的推荐
// ═══════════════════════════════════════════════
import { Hono } from 'hono';
export const hotStocksRoute = new Hono();
// 热门标的池（硬编码精选列表，按分类组织）
const HOT_STOCKS = {
    ashare: [
        { code: '000333', market: 'sz', label: '美的集团', reason: '家电龙头' },
        { code: '600519', market: 'sh', label: '贵州茅台', reason: '价值标杆' },
        { code: '300750', market: 'sz', label: '宁德时代', reason: '新能源电池' },
        { code: '000858', market: 'sz', label: '五粮液', reason: '高端白酒' },
        { code: '600036', market: 'sh', label: '招商银行', reason: '零售之王' },
        { code: '002594', market: 'sz', label: '比亚迪', reason: '新能源车' },
        { code: '601318', market: 'sh', label: '中国平安', reason: '综合金融' },
        { code: '002415', market: 'sz', label: '海康威视', reason: 'AIoT龙头' },
        { code: '000651', market: 'sz', label: '格力电器', reason: '空调霸主' },
        { code: '002230', market: 'sz', label: '科大讯飞', reason: 'AI先锋' },
    ],
    hkshare: [
        { code: '00700', market: 'hk', label: '腾讯控股', reason: '社交霸主' },
        { code: '09988', market: 'hk', label: '阿里巴巴', reason: '电商巨头' },
    ],
    usshare: [
        { code: 'NVDA', market: 'us', label: 'NVIDIA', reason: 'AI算力之王' },
        { code: 'AAPL', market: 'us', label: 'Apple', reason: '消费科技' },
    ],
};
hotStocksRoute.get('/', async (c) => {
    try {
        // Combine all hot stocks
        const allHot = [
            ...HOT_STOCKS.ashare,
            ...HOT_STOCKS.hkshare,
            ...HOT_STOCKS.usshare,
        ];
        return c.json({
            stocks: allHot.map(s => ({
                code: s.code,
                market: s.market,
                name: s.label,
                reason: s.reason,
                market_type: s.market === 'hk' ? 'hkshare' : s.market === 'us' ? 'usshare' : 'ashare',
            })),
        });
    }
    catch (err) {
        console.error('Hot stocks error:', err);
        return c.json({ stocks: [] }, 500);
    }
});
//# sourceMappingURL=hot-stocks.js.map