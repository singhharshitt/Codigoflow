import { Router, Request, Response, NextFunction } from 'express';
import {
  getDockerStatus,
  listContainers,
  listImages,
  containerAction,
  getContainerLogs,
} from '../integrations/docker';
import { z } from 'zod';

const router = Router();

// GET /api/docker/status
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getDockerStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

// GET /api/docker/containers
router.get('/containers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const all = req.query.all !== 'false';
    const containers = await listContainers(all);
    res.json({ success: true, data: containers });
  } catch (err) {
    next(err);
  }
});

// GET /api/docker/images
router.get('/images', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const images = await listImages();
    res.json({ success: true, data: images });
  } catch (err) {
    next(err);
  }
});

// GET /api/docker/containers/:id/logs
router.get('/containers/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tail = Math.min(parseInt(String(req.query.tail ?? '100'), 10), 500);
    const logs = await getContainerLogs(req.params.id, tail);
    res.json({ success: true, data: { logs } });
  } catch (err) {
    next(err);
  }
});

// POST /api/docker/containers/:id/start
router.post('/containers/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await containerAction(req.params.id, 'start');
    res.json({ success: result.success, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/docker/containers/:id/stop
router.post('/containers/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await containerAction(req.params.id, 'stop');
    res.json({ success: result.success, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
