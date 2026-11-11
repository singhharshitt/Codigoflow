import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../database';
import {
  listJobs,
  getJob,
  listJobLogs,
  requestCancel,
} from '../jobs/jobService';

const router = Router();

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    res.json({ success: true, data: listJobs(limit) });
  } catch (err) {
    next(err);
  }
});

router.get('/history', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    const history = db
      .prepare('SELECT * FROM operation_history ORDER BY executed_at DESC LIMIT ?')
      .all(limit);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: getJob(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/logs', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: listJobLogs(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = requestCancel(req.params.id);
    res.json({ success: true, data: job, message: 'Cancellation requested' });
  } catch (err) {
    next(err);
  }
});

export default router;
