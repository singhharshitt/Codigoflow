import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { getDb } from '../database';
import { asRow, asRows } from '../utils/dbCast';
import { createError } from '../middleware/errorHandler';

export type UserRole = 'admin' | 'operator';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  createdAt: number;
  lastLoginAt: number | null;
}

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  password_hash: string;
  role: UserRole;
  created_at: number;
  last_login_at: number | null;
}

// scrypt parameters (OWASP-acceptable interactive settings; ~50ms on a laptop)
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export const PASSWORD_MIN_LENGTH = 10;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Constant-ish work for unknown usernames so timing doesn't reveal which accounts exist. */
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

function toPublic(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export function countUsers(): number {
  try {
    const row = asRow<{ n: number }>(getDb().prepare('SELECT COUNT(*) AS n FROM users').get());
    return Number(row.n);
  } catch {
    return 0;
  }
}

export function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw createError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`, 400, 'PASSWORD_TOO_SHORT');
  }
  if (password.length > 256) {
    throw createError('Password is too long', 400, 'PASSWORD_TOO_LONG');
  }
}

export function createUser(input: {
  username: string;
  password: string;
  displayName?: string;
  role: UserRole;
}): PublicUser {
  const username = input.username.trim();
  if (!USERNAME_RE.test(username)) {
    throw createError('Username must be 3–32 characters: letters, numbers, dot, dash or underscore', 400, 'USERNAME_INVALID');
  }
  validatePassword(input.password);
  const exists = getDb().prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  if (exists) throw createError('That username is taken', 409, 'USERNAME_TAKEN');

  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      'INSERT INTO users (id, username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(id, username, input.displayName?.trim() || null, hashPassword(input.password), input.role, now);
  return getUser(id)!;
}

export function getUser(id: string): PublicUser | null {
  const row = asRow<UserRow | undefined>(getDb().prepare('SELECT * FROM users WHERE id = ?').get(id));
  return row ? toPublic(row) : null;
}

export function listUsers(): PublicUser[] {
  return asRows<UserRow>(getDb().prepare('SELECT * FROM users ORDER BY created_at').all()).map(toPublic);
}

/** Returns the user on success, null otherwise (same timing either way). */
export function authenticate(username: string, password: string): PublicUser | null {
  const row = asRow<UserRow | undefined>(
    getDb().prepare('SELECT * FROM users WHERE username = ?').get(username.trim()),
  );
  const ok = verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) return null;
  getDb().prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), row.id);
  return toPublic({ ...row, last_login_at: Math.floor(Date.now() / 1000) });
}

export function changePassword(userId: string, current: string, next: string): void {
  const row = asRow<UserRow | undefined>(getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId));
  if (!row || !verifyPassword(current, row.password_hash)) {
    throw createError('Current password is incorrect', 401, 'AUTH_INVALID');
  }
  validatePassword(next);
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), userId);
}

export function deleteUser(id: string): void {
  const target = getUser(id);
  if (!target) throw createError('User not found', 404, 'USER_NOT_FOUND');
  if (target.role === 'admin') {
    const admins = asRow<{ n: number }>(getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get());
    if (Number(admins.n) <= 1) throw createError('Cannot delete the last admin', 400, 'LAST_ADMIN');
  }
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  getDb().prepare("UPDATE sessions SET revoked_at = strftime('%s','now') WHERE user_id = ? AND revoked_at IS NULL").run(id);
}
