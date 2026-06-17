// ══════
// 风林慧策 API — /api/subscribe 路由
// 用户订阅管理（需 JWT 鉴权）
// ══════
import { Hono } from 'hono';
import { getDB } from '../db/client';
export const subscribeRoute = new Hono();
// POST — 创建/更新订阅
subscribeRoute.post('/', async (c) => {
    try {
        const user = c.get('user');
        if (!user || !user.userId) {
            return c.json({ status: 'error', message: '请先登录' }, 401);
        }
        const body = await c.req.json();
        const { code, market, daily, weekly, alert } = body;
        if (!code) {
            return c.json({ status: 'error', message: '请指定股票代码' }, 400);
        }
        const db = getDB(c);
        // Find stock
        const fullCode = (market || 'sz') === 'us' ? `us${code}` :
            (market || 'sz') === 'hk' ? `hk${code}` :
                `${market || 'sz'}${code}`;
        const stock = await db.prepare(`SELECT id, name FROM stocks WHERE full_code = ? OR code = ? LIMIT 1`).bind(fullCode, code).first();
        if (!stock) {
            return c.json({ status: 'error', message: '股票不存在' }, 404);
        }
        const stockId = stock.id;
        const stockName = stock.name;
        // Upsert subscription
        await db.prepare(`INSERT INTO subscriptions (email, stock_id, frequency_daily, frequency_weekly, frequency_alert)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email, stock_id) DO UPDATE SET
         frequency_daily = excluded.frequency_daily,
         frequency_weekly = excluded.frequency_weekly,
         frequency_alert = excluded.frequency_alert,
         active = 1`).bind(user.account, stockId, daily ? 1 : 0, weekly ? 1 : 0, alert !== false ? 1 : 0).run();
        return c.json({
            status: 'ok',
            message: `订阅成功！您将收到 ${stockName}(${code}) 的分析更新通知。`,
        });
    }
    catch (err) {
        console.error('Subscribe error:', err);
        return c.json({ status: 'error', message: '订阅失败，请稍后重试' }, 500);
    }
});
// DELETE — 取消订阅
subscribeRoute.delete('/', async (c) => {
    try {
        const user = c.get('user');
        if (!user || !user.userId) {
            return c.json({ status: 'error', message: '请先登录' }, 401);
        }
        const body = await c.req.json();
        const { code, market } = body;
        if (!code) {
            return c.json({ status: 'error', message: '参数不完整' }, 400);
        }
        const db = getDB(c);
        const fullCode = (market || 'sz') === 'us' ? `us${code}` :
            (market || 'sz') === 'hk' ? `hk${code}` :
                `${market || 'sz'}${code}`;
        const stock = await db.prepare(`SELECT id FROM stocks WHERE full_code = ? OR code = ? LIMIT 1`).bind(fullCode, code).first();
        if (!stock) {
            return c.json({ status: 'error', message: '股票不存在' }, 404);
        }
        const stockId = stock.id;
        await db.prepare(`UPDATE subscriptions SET active = 0 WHERE email = ? AND stock_id = ?`).bind(user.account, stockId).run();
        return c.json({
            status: 'ok',
            message: '已取消订阅',
        });
    }
    catch (err) {
        console.error('Unsubscribe error:', err);
        return c.json({ status: 'error', message: '取消订阅失败' }, 500);
    }
});
// GET — 查看我的订阅列表
subscribeRoute.get('/my', async (c) => {
    try {
        const user = c.get('user');
        if (!user || !user.userId) {
            return c.json({ status: 'error', message: '请先登录' }, 401);
        }
        const db = getDB(c);
        const result = await db.prepare(`SELECT s.code, s.name, s.market, sub.frequency_daily, sub.frequency_weekly, sub.frequency_alert, sub.created_at
       FROM subscriptions sub
       JOIN stocks s ON s.id = sub.stock_id
       WHERE sub.email = ? AND sub.active = 1
       ORDER BY sub.created_at DESC`).bind(user.account).all();
        const list = result.results.map(row => ({
            code: row.code,
            name: row.name,
            market: row.market,
            daily: !!row.frequency_daily,
            weekly: !!row.frequency_weekly,
            alert: !!row.frequency_alert,
            createdAt: row.created_at,
        }));
        return c.json({ status: 'ok', data: list });
    }
    catch (err) {
        console.error('My subscriptions error:', err);
        return c.json({ status: 'error', message: '查询失败' }, 500);
    }
});
//# sourceMappingURL=subscribe.js.map