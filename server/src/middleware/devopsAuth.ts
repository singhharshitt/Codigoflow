import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { createError } from './errorHandler';
import { config } from '../config';
import { assertTrustedOrigin, readSession } from '../auth/session';
import { logger } from '../utils/logger';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function clientIp(req: Request): string {
  const raw = req.socket.remoteAddress || '';
  return raw.replace(/^::ffff:/, '');
}

export function isLoopbackAddress(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '';
}

/**
 * Privileged DevOps / workflow mutations.
 *
 * Auth model (no secrets in the Vite bundle):
 * 1. Loopback required by default (DEVOPS_REQUIRE_LOOPBACK).
 * 2. When DEVOPS_API_TOKEN is configured (or production):
 *    - HttpOnly session cookie from POST /api/auth/login, OR
 *    - Authorization: Bearer <DEVOPS_API_TOKEN> for server-side / CLI clients only.
 * 3. Cookie-authenticated browser requests must pass Origin checks.
 */
export function requireDevOpsMutationAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const ip = clientIp(req);
    const requireLoopback = process.env.DEVOPS_REQUIRE_LOOPBACK !== 'false';
    if (requireLoopback && !isLoopbackAddress(ip)) {
      throw createError(
        'Privileged DevOps operations are restricted to loopback clients',
        403,
        'DEVOPS_LOOPBACK_REQUIRED',
      );
    }

    const expected = (process.env.DEVOPS_API_TOKEN || '').trim();
    const enforceAuth =
      Boolean(expected) || config.NODE_ENV === 'production' || process.env.DEVOPS_ENFORCE_TOKEN === 'true';

    if (!enforceAuth) {
      next();
      return;
    }

    if (!expected) {
      throw createError(
        'DEVOPS_API_TOKEN must be configured to authorize privileged DevOps operations',
        503,
        'DEVOPS_TOKEN_NOT_CONFIGURED',
      );
    }

    const session = readSession(req);
    if (session?.role === 'operator') {
      assertTrustedOrigin(req);
      logger.info(
        { path: req.path, method: req.method, jti: session.jti },
        'Privileged DevOps operation authorized via session',
      );
      next();
      return;
    }

    const header = req.header('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    const provided = match?.[1]?.trim() || '';
    // Intentionally do NOT accept x-devops-token from browsers in docs;
    // Bearer remains for local CLI/automation only.
    if (!provided || !safeEqual(provided, expected)) {
      throw createError('Unauthorized DevOps mutation', 401, 'DEVOPS_UNAUTHORIZED');
    }

    logger.info(
      { path: req.path, method: req.method, via: 'bearer' },
      'Privileged DevOps operation authorized via bearer',
    );
    next();
  } catch (err) {
    next(err);
  }
}

export const requireWorkflowRunAuth = requireDevOpsMutationAuth;
