import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { createError } from '../middleware/errorHandler';
import { config } from '../config';
import {
  assertTrustedOrigin,
  clearSessionCookie,
  createSessionToken,
  isSessionConfigured,
  readSession,
  revokeSession,
  setSessionCookie,
  MAX_AGE_MS,
} from '../auth/session';
import {
  authenticate,
  changePassword,
  countUsers,
  createUser,
  deleteUser,
  getUser,
  listUsers,
  PASSWORD_MIN_LENGTH,
} from '../auth/users';
import { requireAdmin, requireSignedIn } from '../auth/middleware';
import { isLoopbackAddress } from '../middleware/devopsAuth';
import { logger } from '../utils/logger';

const router = Router();

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function clientIp(req: Request): string {
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

// ── Login throttling: 10 failures per IP+username per 15 minutes ─────────────
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_LIMIT = 10;
const failures = new Map<string, { count: number; first: number }>();

function throttleKey(req: Request, username: string) {
  return `${clientIp(req)}|${username.toLowerCase()}`;
}

function assertNotThrottled(key: string) {
  const entry = failures.get(key);
  if (entry && Date.now() - entry.first < FAIL_WINDOW_MS && entry.count >= FAIL_LIMIT) {
    throw createError('Too many failed sign-in attempts. Try again in 15 minutes.', 429, 'AUTH_THROTTLED');
  }
}

function recordFailure(key: string) {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || now - entry.first > FAIL_WINDOW_MS) failures.set(key, { count: 1, first: now });
  else entry.count += 1;
}

/** Rotate on every sign-in (session fixation): revoke any session presented with the request. */
function startSession(req: Request, res: Response, role: 'admin' | 'operator', user?: { id: string; name: string }) {
  const previous = readSession(req);
  if (previous) revokeSession(previous.jti);
  setSessionCookie(res, createSessionToken(role, user));
}

export function _resetLoginThrottleForTests() {
  failures.clear();
}

router.get('/status', (req: Request, res: Response) => {
  const session = readSession(req);
  const tokenConfigured = Boolean(process.env.DEVOPS_API_TOKEN?.trim());
  const users = countUsers();
  const user = session?.sub ? getUser(session.sub) : null;
  res.json({
    success: true,
    data: {
      authenticated: Boolean(session),
      role: session?.role ?? null,
      expiresAt: session?.exp ?? null,
      user: user
        ? { id: user.id, username: user.username, displayName: user.displayName, role: user.role }
        : session
          ? { id: null, username: 'admin-token', displayName: 'Admin (token)', role: session.role }
          : null,
      accountsEnabled: users > 0,
      setupRequired: users === 0,
      passwordMinLength: PASSWORD_MIN_LENGTH,
      tokenConfigured,
      sessionConfigured: isSessionConfigured(),
      loopback: isLoopbackAddress(clientIp(req)),
      authMode:
        users > 0
          ? 'accounts'
          : tokenConfigured
            ? 'session-or-bearer'
            : config.NODE_ENV === 'production'
              ? 'required'
              : 'loopback-dev',
    },
  });
});

/** First-run: create the initial admin. Only when no accounts exist, and only from this machine. */
router.post('/setup', (req: Request, res: Response, next: NextFunction) => {
  try {
    assertTrustedOrigin(req);
    if (countUsers() > 0) throw createError('Setup is already complete', 409, 'SETUP_DONE');
    if (!isLoopbackAddress(clientIp(req))) {
      throw createError('The first account can only be created from the machine running CódigoFlow', 403, 'SETUP_LOOPBACK_ONLY');
    }
    const body = z
      .object({ username: z.string().min(1).max(64), password: z.string().min(1).max(256), displayName: z.string().max(80).optional() })
      .parse(req.body);
    const user = createUser({ ...body, role: 'admin' });
    startSession(req, res, 'admin', { id: user.id, name: user.displayName || user.username });
    logger.info({ user: user.username }, 'Initial admin account created');
    res.status(201).json({ success: true, data: { user, expiresInMs: MAX_AGE_MS } });
  } catch (err) {
    next(err);
  }
});

const LoginSchema = z.union([
  z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(256) }),
  // Admin fallback for development/automation: the shared DEVOPS_API_TOKEN.
  z.object({ token: z.string().min(1).max(512) }),
]);

router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    assertTrustedOrigin(req);
    const body = LoginSchema.parse(req.body);

    if ('username' in body) {
      const key = throttleKey(req, body.username);
      assertNotThrottled(key);
      const user = authenticate(body.username, body.password);
      if (!user) {
        recordFailure(key);
        logger.warn({ ip: clientIp(req) }, 'Failed sign-in');
        throw createError('Incorrect username or password', 401, 'AUTH_INVALID');
      }
      failures.delete(key);
      startSession(req, res, user.role, { id: user.id, name: user.displayName || user.username });
      logger.info({ user: user.username }, 'User signed in');
      res.json({ success: true, message: 'Signed in', data: { user, role: user.role, expiresInMs: MAX_AGE_MS } });
      return;
    }

    const key = throttleKey(req, '#token');
    assertNotThrottled(key);
    const expected = process.env.DEVOPS_API_TOKEN?.trim() || '';
    if (!expected) {
      throw createError('DEVOPS_API_TOKEN is not configured on the server', 503, 'DEVOPS_TOKEN_NOT_CONFIGURED');
    }
    if (!safeEqual(body.token, expected)) {
      recordFailure(key);
      logger.warn({ ip: clientIp(req) }, 'Failed operator token login');
      throw createError('Invalid operator token', 401, 'AUTH_INVALID');
    }
    failures.delete(key);
    startSession(req, res, 'admin');
    logger.info({ ip: clientIp(req) }, 'Admin token session created');
    res.json({ success: true, message: 'Authenticated', data: { role: 'admin', expiresInMs: MAX_AGE_MS } });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  try {
    assertTrustedOrigin(req);
    const session = readSession(req);
    if (session) revokeSession(session.jti);
    clearSessionCookie(res);
    res.json({ success: true, message: 'Signed out' });
  } catch (err) {
    next(err);
  }
});

router.post('/password', requireSignedIn, (req: Request, res: Response, next: NextFunction) => {
  try {
    assertTrustedOrigin(req);
    const session = readSession(req);
    if (!session?.sub) throw createError('Token sessions have no password to change', 400, 'NO_ACCOUNT');
    const body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1) }).parse(req.body);
    changePassword(session.sub, body.currentPassword, body.newPassword);
    res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    next(err);
  }
});

router.get('/users', requireAdmin, (_req: Request, res: Response) => {
  res.json({ success: true, data: listUsers() });
});

router.post('/users', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    assertTrustedOrigin(req);
    const body = z
      .object({
        username: z.string().min(1).max(64),
        password: z.string().min(1).max(256),
        displayName: z.string().max(80).optional(),
        role: z.enum(['admin', 'operator']).default('operator'),
      })
      .parse(req.body);
    res.status(201).json({ success: true, data: createUser(body) });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    assertTrustedOrigin(req);
    if (readSession(req)?.sub === req.params.id) throw createError('You cannot delete your own account', 400, 'SELF_DELETE');
    deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
