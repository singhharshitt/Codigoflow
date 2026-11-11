import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

import repositoriesRouter from './routes/repositories';
import aiRouter from './routes/ai';
import dockerRouter from './routes/docker';
import githubRouter from './routes/github';
import jobsRouter from './routes/jobs';

import { getDockerStatus } from './integrations/docker';
import { isAIConfigured, isGitHubConfigured } from './config';

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // Socket.IO for live operation logs
  const io = new SocketServer(httpServer, {
    cors: { origin: config.CLIENT_ORIGIN, credentials: true },
  });

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected via Socket.IO');
    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });

  // Attach io to app so routes can emit events
  app.set('io', io);

  // ── Security & middleware ────────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: config.CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(requestLogger);

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
  });
  app.use('/api', limiter);

  // ── Health endpoint ──────────────────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    const dockerStatus = await getDockerStatus().catch(() => ({ available: false }));
    res.json({
      success: true,
      data: {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        integrations: {
          ai: { configured: isAIConfigured() },
          github: { configured: isGitHubConfigured() },
          docker: dockerStatus,
        },
      },
    });
  });

  // ── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/repositories', repositoriesRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/docker', dockerRouter);
  app.use('/api/github', githubRouter);
  app.use('/api/jobs', jobsRouter);
  // Alias for history
  app.use('/api/history', (_req, res, next) => {
    _req.url = '/history';
    jobsRouter(_req, res, next);
  });

  // ── Error handling ───────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, httpServer, io };
}
