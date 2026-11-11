import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../database';

const router = Router();

// GET /api/jobs
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    const jobs = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?').all(limit);
    res.json({ success: true, data: jobs });
  } catch (err) {
    next(err);
  }
});

// GET /api/history
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

export default router;
