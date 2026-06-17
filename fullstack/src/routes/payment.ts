// ══════
// 风林慧策 API — /api/payment 路由
// 微信支付 + 支付宝 下单 + 异步回调
// ══════

import { Hono } from 'hono';
import { getDB } from '../db/client';
import {
  createWechatNativePay,
  createAlipayPagePay,
  decryptWechatNotify,
  verifyAlipayNotify,
} from '../services/payment';
import type { Context } from 'hono';
import type { PaymentRequest, PaymentResponse } from '../types';

type Variables = { user: { userId: number; account: string } };
export const paymentRoute = new Hono<{ Variables: Variables }>();

// ── POST /api/payment/create ──
// 创建支付订单，返回支付 URL / 二维码链接
paymentRoute.post('/create', async (c) => {
  try {
    // 鉴权：从 JWT 获取用户信息
    const user = c.get('user');
    if (!user || !user.userId) {
      return c.json({ status: 'error', message: '请先登录' }, 401);
    }

    const body = await c.req.json<PaymentRequest>();
    const { planIndex, method, returnUrl } = body;

    if (planIndex === undefined || planIndex < 0 || planIndex > 2) {
      return c.json({ status: 'error', message: '无效的订阅方案' }, 400);
    }
    if (!['wechat', 'alipay'].includes(method)) {
      return c.json({ status: 'error', message: '不支持的支付方式' }, 400);
    }

    // 方案定价
    const plans = [
      { name: '年费会员', amount: 59800 },   // 单位：分
      { name: '月费会员', amount: 6000 },
      { name: '10天体验', amount: 3000 },
    ];
    const plan = plans[planIndex];

    // 生成商户订单号
    const outTradeNo = `WF${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

    const db = getDB(c);

    // 写入支付记录（pending）
    await db.prepare(
      `INSERT INTO payments (user_id, amount, currency, method, plan, status, out_trade_no)
       VALUES (?, ?, 'CNY', ?, ?, 'pending', ?)`
    ).bind(user.userId, plan.amount / 100, method, plan.name, outTradeNo).run();

    let payUrl: string | undefined;
    let qrCode: string | undefined;

    if (method === 'wechat') {
      const result = await createWechatNativePay(c, {
        outTradeNo,
        description: `风林慧策 - ${plan.name}`,
        amount: plan.amount,
      });
      qrCode = result.codeUrl;
      payUrl = result.codeUrl; // 微信 Native 返回 code_url（二维码内容）
    } else {
      const result = await createAlipayPagePay(c, {
        outTradeNo,
        description: `风林慧策 - ${plan.name}`,
        amount: plan.amount,
        returnUrl,
      });
      payUrl = result.payUrl;
    }

    return c.json({
      status: 'ok',
      data: {
        payUrl,
        qrCode,           // 微信支付二维码（客户端生成 QR 图）
        outTradeNo,
        amount: plan.amount,
        planName: plan.name,
      },
    } satisfies PaymentResponse);
  } catch (err) {
    console.error('Payment create error:', err);
    return c.json({ status: 'error', message: '支付下单失败，请稍后重试' }, 500);
  }
});

// ── POST /api/payment/wechat-notify ──
// 微信支付异步回调（APIv3）
paymentRoute.post('/wechat-notify', async (c) => {
  try {
    const body = await c.req.json();
    const { ciphertext, associated_data, nonce } = body.resource;

    const decrypted = await decryptWechatNotify(c, ciphertext, associated_data, nonce);
    console.log('WeChat notify decrypted:', JSON.stringify(decrypted));

    const { out_trade_no, trade_state, transaction_id } = decrypted as any;

    if (trade_state === 'SUCCESS') {
      const db = getDB(c);
      await db.prepare(
        `UPDATE payments SET status = 'success', paid_at = datetime('now')
         WHERE out_trade_no = ?`
      ).bind(out_trade_no).run();

      // 更新用户订阅计划
      const payRecord = await db.prepare(
        `SELECT user_id, plan FROM payments WHERE out_trade_no = ? LIMIT 1`
      ).bind(out_trade_no).first();
      if (payRecord) {
        await db.prepare(
          `UPDATE users SET plan = ?, subscribed_at = datetime('now')
           WHERE id = ?`
        ).bind(payRecord.plan as string, payRecord.user_id as number).run();
      }
    }

    return c.json({ code: 'SUCCESS', message: '成功' });
  } catch (err) {
    console.error('WeChat notify error:', err);
    return c.json({ code: 'FAIL', message: '失败' }, 500);
  }
});

// ── POST /api/payment/alipay-notify ──
// 支付宝异步回调
paymentRoute.post('/alipay-notify', async (c) => {
  try {
    const body = await c.req.parseBody();
    const params = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, v as string])
    );

    const valid = await verifyAlipayNotify(c, params);
    if (!valid) {
      return c.text('failure');
    }

    const tradeStatus = params.trade_status;
    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      const db = getDB(c);
      await db.prepare(
        `UPDATE payments SET status = 'success', paid_at = datetime('now')
         WHERE out_trade_no = ?`
      ).bind(outTradeNo).run();

      const payRecord = await db.prepare(
        `SELECT user_id, plan FROM payments WHERE out_trade_no = ? LIMIT 1`
      ).bind(outTradeNo).first();
      if (payRecord) {
        await db.prepare(
          `UPDATE users SET plan = ?, subscribed_at = datetime('now')
           WHERE id = ?`
        ).bind(payRecord.plan as string, payRecord.user_id as number).run();
      }
    }

    return c.text('success');
  } catch (err) {
    console.error('Alipay notify error:', err);
    return c.text('failure');
  }
});

// ── GET /api/payment/status ──
// 前端轮询支付状态
paymentRoute.get('/status', async (c) => {
  try {
    const user = c.get('user');
    if (!user || !user.userId) {
      return c.json({ status: 'error', message: '请先登录' }, 401);
    }

    const outTradeNo = c.req.query('out_trade_no');
    if (!outTradeNo) {
      return c.json({ status: 'error', message: '缺少订单号' }, 400);
    }

    const db = getDB(c);
    const row = await db.prepare(
      `SELECT status, plan, paid_at FROM payments WHERE out_trade_no = ? AND user_id = ? LIMIT 1`
    ).bind(outTradeNo, user.userId).first();

    if (!row) {
      return c.json({ status: 'error', message: '订单不存在' }, 404);
    }

    return c.json({
      status: 'ok',
      data: {
        status: row.status,
        plan: row.plan,
        paidAt: row.paid_at,
      },
    });
  } catch (err) {
    console.error('Payment status error:', err);
    return c.json({ status: 'error', message: '查询失败' }, 500);
  }
});
