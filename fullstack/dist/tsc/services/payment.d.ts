import type { Context } from 'hono';
export interface WechatPayParams {
    outTradeNo: string;
    description: string;
    amount: number;
    attach?: string;
}
export declare function createWechatNativePay(c: Context, params: WechatPayParams): Promise<{
    codeUrl: string;
    outTradeNo: string;
}>;
export interface AlipayPayParams {
    outTradeNo: string;
    description: string;
    amount: number;
    returnUrl?: string;
}
export declare function createAlipayPagePay(c: Context, params: AlipayPayParams): Promise<{
    payUrl: string;
    outTradeNo: string;
}>;
export declare function decryptWechatNotify(c: Context, ciphertext: string, associatedData: string, nonce: string): Promise<Record<string, unknown>>;
export declare function verifyAlipayNotify(c: Context, params: Record<string, string>): Promise<boolean>;
//# sourceMappingURL=payment.d.ts.map