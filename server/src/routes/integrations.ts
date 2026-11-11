import { Router, Request, Response, NextFunction } from 'express';
import { getIntegrationsStatus } from '../services/integrationStatusService';

const router = Router();

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const force = req.query.refresh === '1' || req.query.refresh === 'true';
    const data = await getIntegrationsStatus(force);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
