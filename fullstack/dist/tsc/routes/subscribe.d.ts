import { Hono } from 'hono';
type Variables = {
    user: {
        userId: number;
        account: string;
    };
};
export declare const subscribeRoute: Hono<{
    Variables: Variables;
}, import("hono/types").BlankSchema, "/">;
export {};
//# sourceMappingURL=subscribe.d.ts.map