import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

import {
  config,
  APP_VERSION,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  REQUEST_JSON_LIMIT,
  isAIConfigured,
  isGitHubConfigured,
  getAIProviderLabel,
} from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

import repositoriesRouter from './routes/repositories';
import aiRouter from './routes/ai';
import dockerRouter from './routes/docker';
import githubRouter from './routes/github';
import jobsRouter from './routes/jobs';
import workflowsRouter from './routes/workflows';
import integrationsRouter from './routes/integrations';
import { registerSockets } from './sockets';

import { getDockerStatus } from './integrations/docker';

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: { origin: config.CLIENT_ORIGIN, credentials: true },
  });

  registerSockets(io);
  app.set('io', io);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: config.CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: REQUEST_JSON_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: REQUEST_JSON_LIMIT }));
  app.use(requestLogger);

  const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Too many requests' },
    },
  });
  app.use('/api', limiter);

  app.get('/api/health', async (_req, res) => {
    const dockerStatus = await getDockerStatus().catch(() => ({
      available: false,
      error: 'Unable to probe Docker',
    }));

    res.json({
      success: true,
      data: {
        status: 'ok',
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        integrations: {
          ai: {
            configured: isAIConfigured(),
            provider: getAIProviderLabel(),
            // Never expose keys
          },
          github: { configured: isGitHubConfigured() },
          docker: dockerStatus,
        },
      },
    });
  });

  app.use('/api/repositories', repositoriesRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/docker', dockerRouter);
  app.use('/api/github', githubRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/workflows', workflowsRouter);
  app.use('/api/integrations', integrationsRouter);
  app.use('/api/history', (req, res, next) => {
    req.url = '/history';
    jobsRouter(req, res, next);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, httpServer, io };
}
