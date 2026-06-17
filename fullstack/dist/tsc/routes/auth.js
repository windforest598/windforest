// ════════
// 风林慧策 API — /api/auth 路由
// 用户注册 / 登录 / JWT 签发
// ════════
import { Hono } from 'hono';
import { hashPassword, verifyPassword, generateJWT, decodeJWT } from '../services/auth';
import { getDB } from '../db/client';
export const authRoute = new Hono();
// POST /api/auth/register
authRoute.post('/register', async (c) => {
    try {
        const body = await c.req.json();
        const { account, password, email } = body;
        if (!account || !password) {
            return c.json({ status: 'error', message: '请输入账号和密码' }, 400);
        }
        if (password.length < 6) {
            return c.json({ status: 'error', message: '密码长度至少6位' }, 400);
        }
        const db = getDB(c);
        // Check if account exists
        const existing = await db.prepare('SELECT id FROM users WHERE account = ? LIMIT 1').bind(account).first();
        if (existing) {
            return c.json({ status: 'error', message: '账号已存在，请直接登录' }, 409);
        }
        const passwordHash = await hashPassword(password);
        const result = await db.prepare(`INSERT INTO users (account, password_hash, email, free_trial_used)
       VALUES (?, ?, ?, 0)`).bind(account, passwordHash, email || null).run();
        const userId = result.meta?.last_row_id;
        // Auto-login: generate JWT
        const token = await generateJWT(c, { userId: Number(userId), account, plan: null, jwtVersion: 0 });
        return c.json({
            status: 'ok',
            message: '注册成功！已赠送您1次完整分析免费体验',
            data: {
                token,
                user: { id: userId, account, email: email || null, plan: null, freeTrialUsed: 0 },
            },
        });
    }
    catch (err) {
        console.error('Register error:', err);
        return c.json({ status: 'error', message: '注册失败，请稍后重试' }, 500);
    }
});
// POST /api/auth/login
authRoute.post('/login', async (c) => {
    try {
        const body = await c.req.json();
        const { account, password } = body;
        if (!account || !password) {
            return c.json({ status: 'error', message: '请输入账号和密码' }, 400);
        }
        const db = getDB(c);
        const user = await db.prepare(`SELECT id, account, password_hash, email, plan, plan_index,
              subscribed_at, free_trial_used, jwt_version
       FROM users WHERE account = ? LIMIT 1`).bind(account).first();
        if (!user) {
            return c.json({ status: 'error', message: '账号不存在' }, 404);
        }
        const passwordHash = user.password_hash;
        const valid = await verifyPassword(password, passwordHash);
        if (!valid) {
            return c.json({ status: 'error', message: '密码错误' }, 401);
        }
        const token = await generateJWT(c, {
            userId: user.id,
            account: user.account,
            plan: user.plan,
            jwtVersion: user.jwt_version,
        });
        return c.json({
            status: 'ok',
            message: '登录成功！',
            data: {
                token,
                user: {
                    id: user.id,
                    account: user.account,
                    email: user.email,
                    plan: user.plan,
                    planIndex: user.plan_index,
                    subscribedAt: user.subscribed_at,
                    freeTrialUsed: user.free_trial_used,
                },
            },
        });
    }
    catch (err) {
        console.error('Login error:', err);
        return c.json({ status: 'error', message: '登录失败，请稍后重试' }, 500);
    }
});
// GET /api/auth/me — 获取当前用户信息（需 JWT）
authRoute.get('/me', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ status: 'error', message: '未登录' }, 401);
        }
        const token = authHeader.replace('Bearer ', '');
        const payload = await decodeJWT(c, token);
        if (!payload) {
            return c.json({ status: 'error', message: 'Token 无效或已过期' }, 401);
        }
        const db = getDB(c);
        const user = await db.prepare(`SELECT id, account, email, plan, plan_index, subscribed_at, free_trial_used
       FROM users WHERE id = ? AND jwt_version = ? LIMIT 1`).bind(payload.userId, payload.jwtVersion).first();
        if (!user) {
            return c.json({ status: 'error', message: '用户不存在或Token已失效' }, 401);
        }
        return c.json({
            status: 'ok',
            data: {
                id: user.id,
                account: user.account,
                email: user.email,
                plan: user.plan,
                planIndex: user.plan_index,
                subscribedAt: user.subscribed_at,
                freeTrialUsed: user.free_trial_used,
            },
        });
    }
    catch (err) {
        console.error('Get me error:', err);
        return c.json({ status: 'error', message: '获取用户信息失败' }, 500);
    }
});
// POST /api/auth/logout — 客户端清除 Token（服务端无状态）
authRoute.post('/logout', async (c) => {
    return c.json({ status: 'ok', message: '已退出登录' });
});
//# sourceMappingURL=auth.js.map