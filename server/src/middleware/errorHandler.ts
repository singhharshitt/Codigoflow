import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function createError(message: string, statusCode: number, code?: string): ApiError {
  const err: ApiError = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export function errorHandler(
  err: ApiError | ZodError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  const apiErr = err as ApiError;
  const statusCode = apiErr.statusCode ?? 500;
  const code = apiErr.code ?? 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Server error');
  } else {
    logger.warn({ code, message: err.message, path: req.path }, 'Client error');
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: statusCode >= 500 ? 'An internal server error occurred' : err.message,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
