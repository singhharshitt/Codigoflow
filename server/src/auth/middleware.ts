import type { NextFunction, Request, Response } from 'express';
import { createError } from '../middleware/errorHandler';
import { readSession } from './session';
import { countUsers } from './users';

/**
 * Signed-in check for user-scoped features (AI Copilot, settings).
 * Before the first account exists (fresh install), requests pass so the app
 * keeps working on loopback; the UI routes the user to first-run setup.
 */
export function requireSignedIn(req: Request, _res: Response, next: NextFunction): void {
  if (countUsers() === 0 && !process.env.DEVOPS_API_TOKEN?.trim()) {
    next();
    return;
  }
  if (!readSession(req)) {
    next(createError('Sign in to continue', 401, 'AUTH_REQUIRED'));
    return;
  }
  next();
}

/** Admin-only (user management, AI provider defaults). Same fresh-install pass-through. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (countUsers() === 0 && !process.env.DEVOPS_API_TOKEN?.trim()) {
    next();
    return;
  }
  const session = readSession(req);
  if (!session) {
    next(createError('Sign in to continue', 401, 'AUTH_REQUIRED'));
    return;
  }
  if (session.role !== 'admin') {
    next(createError('Administrator access required', 403, 'ADMIN_REQUIRED'));
    return;
  }
  next();
}
