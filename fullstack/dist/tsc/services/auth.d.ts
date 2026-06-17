export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, stored: string): Promise<boolean>;
export interface JWTPayload {
    userId: number;
    account: string;
    plan: string | null;
    jwtVersion: number;
}
export declare function generateJWT(c: any, payload: JWTPayload): Promise<string>;
export declare function decodeJWT(c: any, token: string): Promise<JWTPayload | null>;
//# sourceMappingURL=auth.d.ts.map