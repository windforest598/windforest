// ══════
// 风林慧策 — 微信支付 + 支付宝 服务
// 纯 HTTP 签名调用，零依赖，兼容 Cloudflare Workers
// ══════
// ─── 配置读取 ───
function getWechatConfig(c) {
    const env = c.env;
    return {
        mchId: env.WECHAT_MCH_ID || '',
        apiV3Key: env.WECHAT_API_V3_KEY || '',
        serialNo: env.WECHAT_SERIAL_NO || '',
        privateKey: env.WECHAT_PRIVATE_KEY || '', // PEM format, \n replaced with \n
        notifyUrl: env.WECHAT_NOTIFY_URL || '',
    };
}
function getAlipayConfig(c) {
    const env = c.env;
    return {
        appId: env.ALIPAY_APP_ID || '',
        merchantPrivateKey: env.ALIPAY_PRIVATE_KEY || '', // PKCS8 PEM
        alipayPublicKey: env.ALIPAY_PUBLIC_KEY || '',
        notifyUrl: env.ALIPAY_NOTIFY_URL || '',
        returnUrl: env.ALIPAY_RETURN_URL || '',
    };
}
export async function createWechatNativePay(c, params) {
    const cfg = getWechatConfig(c);
    if (!cfg.mchId)
        throw new Error('WECHAT_MCH_ID not configured');
    const body = {
        mchid: cfg.mchId,
        out_trade_no: params.outTradeNo,
        appid: '', // Not needed for Native
        description: params.description,
        notify_url: cfg.notifyUrl,
        amount: {
            total: params.amount,
            currency: 'CNY',
        },
    };
    const url = '/v3/pay/transactions/native';
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = generateNonce();
    const signMessage = `POST\n${url}\n${timestamp}\n${nonceStr}\n${JSON.stringify(body)}\n`;
    const signature = await signWithRSA(c, cfg.privateKey, signMessage);
    const authHeader = `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${cfg.serialNo}",signature="${signature}"`;
    const resp = await fetch(`https://api.mch.weixin.qq.com${url}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'Accept': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const respData = await resp.json();
    if (!resp.ok) {
        throw new Error(`WeChat Pay error: ${JSON.stringify(respData)}`);
    }
    return {
        codeUrl: respData.code_url,
        outTradeNo: params.outTradeNo,
    };
}
export async function createAlipayPagePay(c, params) {
    const cfg = getAlipayConfig(c);
    if (!cfg.appId)
        throw new Error('ALIPAY_APP_ID not configured');
    const bizContent = JSON.stringify({
        out_trade_no: params.outTradeNo,
        total_amount: (params.amount / 100).toFixed(2), // 分转元
        subject: params.description,
        product_code: 'FAST_INSTANT_TRADE_PAY',
    });
    const commonParams = {
        app_id: cfg.appId,
        method: 'alipay.trade.page.pay',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: formatDateTime(new Date()),
        version: '1.0',
        notify_url: cfg.notifyUrl,
        return_url: params.returnUrl || cfg.returnUrl || '',
        biz_content: bizContent,
    };
    const signed = await signAlipayParams(c, commonParams, cfg.merchantPrivateKey);
    const queryString = Object.entries(signed)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    return {
        payUrl: `https://openapi.alipay.com/gateway.do?${queryString}`,
        outTradeNo: params.outTradeNo,
    };
}
// ─── 支付宝签名 ───
async function signAlipayParams(c, params, privateKeyPem) {
    // 1. Sort keys alphabetically, join as k=v&...
    const sorted = Object.entries(params)
        .filter(([_, v]) => v !== '')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
    // 2. RSA2 sign (SHA256WithRSA)
    const signBase64 = await signAlipayRSA2(privateKeyPem, sorted);
    // 3. Add signature to params
    params.sign = signBase64;
    return params;
}
async function signAlipayRSA2(privateKeyPem, data) {
    // Import key
    const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(privateKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
// ─── 微信支付回调解密 ───
export async function decryptWechatNotify(c, ciphertext, associatedData, nonce) {
    const cfg = getWechatConfig(c);
    const key = new TextEncoder().encode(cfg.apiV3Key);
    const aesKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(nonce), additionalData: new TextEncoder().encode(associatedData) }, aesKey, Uint8Array.from(atob(ciphertext)));
    return JSON.parse(new TextDecoder().decode(decrypted));
}
// ─── 支付宝回调验签 ───
export async function verifyAlipayNotify(c, params) {
    const cfg = getAlipayConfig(c);
    const sign = params.sign;
    delete params.sign;
    delete params.sign_type;
    const sorted = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
    // Verify with Alipay public key
    const key = await crypto.subtle.importKey('spki', pemToArrayBuffer(cfg.alipayPublicKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, Uint8Array.from(atob(sign || '')), new TextEncoder().encode(sorted));
    return valid;
}
// ─── Utils ───
function generateNonce() {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
function formatDateTime(d) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pemToArrayBuffer(pem) {
    const b64 = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
    const binary = atob(b64);
    const buf = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++)
        view[i] = binary.charCodeAt(i);
    return buf;
}
async function signWithRSA(c, privateKeyPem, data) {
    const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(privateKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
//# sourceMappingURL=payment.js.map