import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { config } from '../config';
import { createError } from '../middleware/errorHandler';

const COOKIE_NAME = 'cf_session';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

export type SessionRole = 'operator';

export interface SessionPayload {
  role: SessionRole;
  exp: number;
  iat: number;
  jti: string;
}

function sessionSecret(): string {
  const secret =
    process.env.SESSION_SECRET?.trim() ||
    process.env.DEVOPS_API_TOKEN?.trim() ||
    '';
  return secret;
}

export function isSessionConfigured(): boolean {
  return Boolean(sessionSecret());
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

function sign(payloadB64: string): string {
  return b64url(createHmac('sha256', sessionSecret()).update(payloadB64).digest());
}

export function createSessionToken(role: SessionRole = 'operator'): string {
  if (!isSessionConfigured()) {
    throw new Error('SESSION_SECRET or DEVOPS_API_TOKEN required for sessions');
  }
  const now = Date.now();
  const payload: SessionPayload = {
    role,
    iat: now,
    exp: now + MAX_AGE_MS,
    jti: randomBytes(12).toString('hex'),
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!isSessionConfigured()) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(payloadB64).toString('utf8')) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.role !== 'operator') return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export function readSession(req: Request): SessionPayload | null {
  const cookies = parseCookies(req.header('cookie'));
  const fromCookie = cookies[COOKIE_NAME];
  if (fromCookie) return verifySessionToken(fromCookie);
  return null;
}

export function setSessionCookie(res: Response, token: string): void {
  const secure = config.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}${secure}`,
  );
}

export function clearSessionCookie(res: Response): void {
  const secure = config.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
}

export function assertTrustedOrigin(req: Request): void {
  const origin = req.header('origin');
  if (!origin) return; // non-browser clients (curl/supertest)
  const allowed = config.CLIENT_ORIGIN.replace(/\/$/, '');
  if (origin.replace(/\/$/, '') !== allowed) {
    throw createError('Origin not allowed', 403, 'ORIGIN_FORBIDDEN');
  }
}

export { COOKIE_NAME, MAX_AGE_MS };
