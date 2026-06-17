// ══════
// 风林慧策 — 认证服务
// Web Crypto API PBKDF2 密码哈希 + jose JWT 签发/验证
// 完全兼容 Cloudflare Workers / Node.js / 浏览器
// ══════

import * as jose from 'jose';

/* ─── PBKDF2 密码哈希 ─── */

async function getKeyMaterial(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const keyMaterial = await getKeyMaterial(password);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltB64 = btoaBytes(salt);
  const hashB64 = btoaBytes(new Uint8Array(derivedBits));
  return `${saltB64}:${hashB64}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':');
  if (!saltB64 || !hashB64) return false;

  const salt = atobBytes(saltB64);
  const keyMaterial = await getKeyMaterial(password);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const derivedB64 = btoaBytes(new Uint8Array(derivedBits));
  return hashB64 === derivedB64;
}

/* ─── JWT ─── */

function getSecret(c: any): Uint8Array {
  const env = c.env as Record<string, unknown> | undefined;
  const secret = (env && env.JWT_SECRET) || (typeof globalThis !== 'undefined' && (globalThis as any).JWT_SECRET);
  if (!secret) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret as string);
}

export interface JWTPayload {
  userId: number;
  account: string;
  plan: string | null;
  jwtVersion: number;
}

export async function generateJWT(c: any, payload: JWTPayload): Promise<string> {
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

export async function decodeJWT(c: any, token: string): Promise<JWTPayload | null> {
  try {
    const secret = getSecret(c);
    const { payload } = await jose.jwtVerify(token, secret);
    return {
      userId: payload.userId as number,
      account: payload.account as string,
      plan: payload.plan as string | null,
      jwtVersion: payload.jwtVersion as number,
    };
  } catch {
    return null;
  }
}

/* ─── Utils ─── */

function btoaBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function atobBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
