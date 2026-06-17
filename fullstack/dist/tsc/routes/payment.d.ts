import { Hono } from 'hono';
type Variables = {
    user: {
        userId: number;
        account: string;
    };
};
export declare const paymentRoute: Hono<{
    Variables: Variables;
}, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=payment.d.ts.map