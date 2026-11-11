import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { createError } from './errorHandler';
import { config } from '../config';

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
 * Privileged DevOps mutations require:
 * 1. Loopback client when DEVOPS_REQUIRE_LOOPBACK=true (default), AND
 * 2. Bearer token matching DEVOPS_API_TOKEN when that token is configured.
 *
 * Read-only status/preflight endpoints remain open on localhost for the dashboard.
 * If DEVOPS_API_TOKEN is unset in development, mutations still require loopback
 * but log that token auth is not configured (production should set the token).
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
    const enforceToken =
      Boolean(expected) || config.NODE_ENV === 'production' || process.env.DEVOPS_ENFORCE_TOKEN === 'true';

    if (enforceToken) {
      if (!expected) {
        throw createError(
          'DEVOPS_API_TOKEN must be configured to authorize privileged DevOps operations',
          503,
          'DEVOPS_TOKEN_NOT_CONFIGURED',
        );
      }
      const header = req.header('authorization') || '';
      const match = header.match(/^Bearer\s+(.+)$/i);
      const provided = match?.[1]?.trim() || req.header('x-devops-token') || '';
      if (!provided || !safeEqual(provided, expected)) {
        throw createError('Unauthorized DevOps mutation', 401, 'DEVOPS_UNAUTHORIZED');
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

/** Optional helper for workflow run — same privilege model as DevOps mutations. */
export const requireWorkflowRunAuth = requireDevOpsMutationAuth;
