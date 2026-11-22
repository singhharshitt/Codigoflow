import { Router, Request, Response, NextFunction } from 'express';
import { readSession, assertTrustedOrigin } from '../auth/session';
import { createError } from '../middleware/errorHandler';
import { executeDeployment } from '../devops/services/deploymentApi';

const router = Router();

function requireOperator(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const session = readSession(req);

    if (session?.role !== 'operator') {
      throw createError(
        'Operator authentication required',
        401,
        'OPERATOR_AUTH_REQUIRED'
      );
    }

    assertTrustedOrigin(req);
    next();
  } catch (error) {
    next(error);
  }
}

router.post('/deploy', requireOperator, async (_req, res, next) => {
  try {
    const result = await executeDeployment('deploy-nginx');
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/rollback', requireOperator, async (_req, res, next) => {
  try {
    const result = await executeDeployment('rollback-nginx');
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
