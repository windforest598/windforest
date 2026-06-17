// ══════
// 风林慧策 — 认证服务
// Web Crypto API PBKDF2 密码哈希 + jose JWT 签发/验证
// 完全兼容 Cloudflare Workers / Node.js / 浏览器
// ══════
import * as jose from 'jose';
/* ─── PBKDF2 密码哈希 ─── */
async function getKeyMaterial(password) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
}
export async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const keyMaterial = await getKeyMaterial(password);
    const derivedBits = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt,
        iterations: 600_000,
        hash: 'SHA-256',
    }, keyMaterial, 256);
    const saltB64 = btoaBytes(salt);
    const hashB64 = btoaBytes(new Uint8Array(derivedBits));
    return `${saltB64}:${hashB64}`;
}
export async function verifyPassword(password, stored) {
    const [saltB64, hashB64] = stored.split(':');
    if (!saltB64 || !hashB64)
        return false;
    const salt = atobBytes(saltB64);
    const keyMaterial = await getKeyMaterial(password);
    const derivedBits = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt,
        iterations: 600_000,
        hash: 'SHA-256',
    }, keyMaterial, 256);
    const derivedB64 = btoaBytes(new Uint8Array(derivedBits));
    return hashB64 === derivedB64;
}
/* ─── JWT ─── */
function getSecret(c) {
    const env = c.env;
    const secret = (env && env.JWT_SECRET) || (typeof globalThis !== 'undefined' && globalThis.JWT_SECRET);
    if (!secret)
        throw new Error('JWT_SECRET not configured');
    return new TextEncoder().encode(secret);
}
export async function generateJWT(c, payload) {
    const secret = getSecret(c);
    return new jose.SignJWT({
        userId: payload.userId,
        account: payload.account,
        plan: payload.plan,
        jwtVersion: payload.jwtVersion,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('180d')
        .setIssuedAt()
        .sign(secret);
}
export async function decodeJWT(c, token) {
    try {
        const secret = getSecret(c);
        const { payload } = await jose.jwtVerify(token, secret);
        return {
            userId: payload.userId,
            account: payload.account,
            plan: payload.plan,
            jwtVersion: payload.jwtVersion,
        };
    }
    catch {
        return null;
    }
}
/* ─── Utils ─── */
function btoaBytes(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}
function atobBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
    return bytes;
}
//# sourceMappingURL=auth.js.map