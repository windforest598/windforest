// ══════
// 风林慧策 API — Cloudflare Workers 入口
// Hono 框架路由 + D1 数据库 + JWT 鉴权
// ══════

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoute } from './routes/auth';
import { searchRoute } from './routes/search';
import { quoteRoute } from './routes/quote';
import { analysisRoute } from './routes/analysis';
import { reportRoute } from './routes/report';
import { subscribeRoute } from './routes/subscribe';
import { triggerRoute } from './routes/trigger';
import { hotStocksRoute } from './routes/hot-stocks';
import { paymentRoute } from './routes/payment';
import type { Context } from 'hono';

const app = new Hono();

// ── CORS ──
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// ── JWT 鉴权中间件 ──
// 用于需要登录的路由：subscribe, report, analysis
async function jwtMiddleware(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ status: 'error', message: '请先登录' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const { decodeJWT } = await import('./services/auth');
    const payload = await decodeJWT(c, token);
    if (!payload) {
      return c.json({ status: 'error', message: 'Token 无效或已过期' }, 401);
    }
    // 将用户信息挂载到 c.env
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ status: 'error', message: 'Token 验证失败' }, 401);
  }
}

// ── Health Check ──
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    time: new Date().toISOString(),
    version: '2.0.0',
  });
});

// ── 公开路由（无需登录）──
app.route('/api/auth', authRoute);       // POST /api/auth/register, /api/auth/login
app.route('/api/search', searchRoute);
app.route('/api/quote', quoteRoute);
app.route('/api/hot-stocks', hotStocksRoute);

// ── 登录后可访问 ──
app.use('/api/subscribe/*', jwtMiddleware);
app.route('/api/subscribe', subscribeRoute);

app.use('/api/analysis/*', jwtMiddleware);
app.route('/api/analysis', analysisRoute);

app.use('/api/report/*', jwtMiddleware);
app.route('/api/report', reportRoute);

app.use('/api/trigger-analysis/*', jwtMiddleware);
app.route('/api/trigger-analysis', triggerRoute);

// ── 支付回调（微信/支付宝异步通知，无需 JWT）──
app.route('/api/payment', paymentRoute);

// ── Error Handling ──
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    status: 'error',
    message: err instanceof Error ? err.message : 'Internal server error',
  }, 500);
});

// ── 404 ──
app.notFound((c) => {
  return c.json({ status: 'error', message: 'Not found' }, 404);
});

export default app;
