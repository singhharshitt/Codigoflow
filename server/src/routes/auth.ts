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
  setSessionCookie,
} from '../auth/session';
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

router.get('/status', (req: Request, res: Response) => {
  const session = readSession(req);
  const tokenConfigured = Boolean(process.env.DEVOPS_API_TOKEN?.trim());
  res.json({
    success: true,
    data: {
      authenticated: Boolean(session),
      role: session?.role ?? null,
      expiresAt: session?.exp ?? null,
      tokenConfigured,
      sessionConfigured: isSessionConfigured(),
      loopback: isLoopbackAddress(clientIp(req)),
      authMode: tokenConfigured
        ? 'session-or-bearer'
        : config.NODE_ENV === 'production'
          ? 'required'
          : 'loopback-dev',
    },
  });
});

router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    assertTrustedOrigin(req);
    const body = z.object({ token: z.string().min(1) }).parse(req.body);
    const expected = process.env.DEVOPS_API_TOKEN?.trim() || '';
    if (!expected) {
      throw createError(
        'DEVOPS_API_TOKEN is not configured on the server',
        503,
        'DEVOPS_TOKEN_NOT_CONFIGURED',
      );
    }
    if (!safeEqual(body.token, expected)) {
      logger.warn({ ip: clientIp(req) }, 'Failed operator login');
      throw createError('Invalid operator token', 401, 'AUTH_INVALID');
    }
    const sessionToken = createSessionToken('operator');
    setSessionCookie(res, sessionToken);
    logger.info({ ip: clientIp(req) }, 'Operator session created');
    res.json({
      success: true,
      message: 'Authenticated',
      data: { role: 'operator', expiresInMs: 8 * 60 * 60 * 1000 },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  try {
    assertTrustedOrigin(req);
    clearSessionCookie(res);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

export default router;
