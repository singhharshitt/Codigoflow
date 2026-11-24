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
  isGitHubConfigured,
} from './config';
import { getAIStatus } from './integrations/ai';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

import repositoriesRouter from './routes/repositories';
import aiRouter from './routes/ai';
import dockerRouter from './routes/docker';
import githubRouter from './routes/github';
import jobsRouter from './routes/jobs';
import workflowsRouter from './routes/workflows';
import integrationsRouter from './routes/integrations';
import devopsRouter from './routes/devops';
import authRouter from './routes/auth';
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
  // SSE (AI streaming) must not be buffered by compression.
  app.use(
    compression({
      filter: (req, res) =>
        String(req.headers.accept ?? '').includes('text/event-stream') ? false : compression.filter(req, res),
    }),
  );
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

  const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Too many login attempts' },
    },
  });
  app.use('/api/auth/login', authLoginLimiter);
  app.use('/api/auth', authRouter);

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
          ai: (() => {
            const ai = getAIStatus();
            // Provider ids/models only — never keys
            return {
              configured: ai.configured,
              provider: ai.provider,
              defaultProvider: ai.defaultProvider,
              providers: ai.providers.map((p) => ({ id: p.id, label: p.label, model: p.model })),
            };
          })(),
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
  app.use('/api/devops', devopsRouter);
  app.use('/api/history', (req, res, next) => {
    req.url = '/history';
    jobsRouter(req, res, next);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, httpServer, io };
}
