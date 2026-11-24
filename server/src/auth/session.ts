import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { config } from '../config';
import { createError } from '../middleware/errorHandler';
import { getDb } from '../database';
import { asRow } from '../utils/dbCast';

const COOKIE_NAME = 'cf_session';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

/** 'admin' and 'operator' both carry operator privileges; admins can also manage users and AI settings. */
export type SessionRole = 'operator' | 'admin';

export interface SessionPayload {
  role: SessionRole;
  exp: number;
  iat: number;
  jti: string;
  /** user id; absent for the DEVOPS_API_TOKEN admin fallback */
  sub?: string;
  /** display name for the UI */
  name?: string;
}

export function hasOperatorAccess(session: SessionPayload | null | undefined): boolean {
  return session?.role === 'operator' || session?.role === 'admin';
}

let generatedSecret: string | null = null;

/**
 * Signing secret: SESSION_SECRET > DEVOPS_API_TOKEN (backward compatible) >
 * a random secret generated once and kept server-side in SQLite, so ordinary
 * users never have to edit env files. Falls back to a per-process secret if
 * the database is not available (e.g. isolated unit tests).
 */
function sessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim() || process.env.DEVOPS_API_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (generatedSecret) return generatedSecret;
  try {
    const db = getDb();
    const row = asRow<{ value: string } | undefined>(
      db.prepare("SELECT value FROM app_settings WHERE key = 'auth.sessionSecret'").get(),
    );
    if (row) {
      generatedSecret = JSON.parse(row.value) as string;
    } else {
      generatedSecret = randomBytes(48).toString('hex');
      db.prepare("INSERT INTO app_settings (key, value) VALUES ('auth.sessionSecret', ?)").run(JSON.stringify(generatedSecret));
    }
  } catch {
    generatedSecret = randomBytes(48).toString('hex');
  }
  return generatedSecret;
}

export function isSessionConfigured(): boolean {
  return Boolean(sessionSecret());
}

function dbAvailable(): boolean {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
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

export function createSessionToken(
  role: SessionRole = 'operator',
  user?: { id: string; name?: string | null },
): string {
  const now = Date.now();
  const payload: SessionPayload = {
    role,
    iat: now,
    exp: now + MAX_AGE_MS,
    jti: randomBytes(12).toString('hex'),
    ...(user ? { sub: user.id, name: user.name ?? undefined } : {}),
  };
  // Register server-side so logout/user deletion can revoke it.
  if (dbAvailable()) {
    getDb()
      .prepare('INSERT INTO sessions (id, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(payload.jti, user?.id ?? null, role, Math.floor(now / 1000), Math.floor(payload.exp / 1000));
  }
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function revokeSession(jti: string): void {
  if (!dbAvailable()) return;
  getDb().prepare("UPDATE sessions SET revoked_at = strftime('%s','now') WHERE id = ? AND revoked_at IS NULL").run(jti);
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
    if (payload.role !== 'operator' && payload.role !== 'admin') return null;
    if (dbAvailable()) {
      const row = asRow<{ revoked_at: number | null } | undefined>(
        getDb().prepare('SELECT revoked_at FROM sessions WHERE id = ?').get(payload.jti),
      );
      // Unknown (pre-registry) or revoked sessions are rejected.
      if (!row || row.revoked_at) return null;
    }
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
