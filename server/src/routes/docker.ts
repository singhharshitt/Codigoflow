import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getDockerStatus,
  listContainers,
  listImages,
  containerAction,
  getContainerLogs,
  inspectContainer,
  buildImage,
  composeAction,
} from '../integrations/docker';
import { createError } from '../middleware/errorHandler';

const router = Router();

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getDockerStatus() });
  } catch (err) {
    next(err);
  }
});

router.get('/containers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const all = req.query.all !== 'false';
    res.json({ success: true, data: await listContainers(all) });
  } catch (err) {
    next(err);
  }
});

router.get('/images', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await listImages() });
  } catch (err) {
    next(err);
  }
});

router.get('/containers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await inspectContainer(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/containers/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tail = Math.min(parseInt(String(req.query.tail ?? '100'), 10), 500);
    const logs = await getContainerLogs(req.params.id, tail);
    res.json({ success: true, data: { logs } });
  } catch (err) {
    next(err);
  }
});

router.post('/containers/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await containerAction(req.params.id, 'start');
    if (!result.success) throw createError(result.output || 'Start failed', 500, 'DOCKER_START_FAILED');
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/containers/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await containerAction(req.params.id, 'stop');
    if (!result.success) throw createError(result.output || 'Stop failed', 500, 'DOCKER_STOP_FAILED');
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/containers/:id/restart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await containerAction(req.params.id, 'restart');
    if (!result.success) throw createError(result.output || 'Restart failed', 500, 'DOCKER_RESTART_FAILED');
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

const BuildSchema = z.object({
  repositoryId: z.string().min(1),
  dockerfile: z.string().optional(),
  context: z.string().optional(),
  tag: z.string().optional(),
});

router.post('/build', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = BuildSchema.parse(req.body);
    const result = await buildImage(body);
    res.json({ success: result.success, data: result });
  } catch (err) {
    next(err);
  }
});

const ComposeSchema = z.object({
  repositoryId: z.string().min(1),
  file: z.string().optional(),
  action: z.enum(['up', 'down', 'ps']),
});

router.post('/compose', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ComposeSchema.parse(req.body);
    const result = await composeAction(body);
    res.json({ success: result.success, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
