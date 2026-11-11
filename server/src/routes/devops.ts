import { Router, Request, Response, NextFunction } from 'express';
import { getControlNodeStatus } from '../devops/adapters';
import { detectDevOpsTools } from '../devops/services/toolDetection';
import { runDevOpsPreflight, getDevOpsWorkspaceRoot } from '../devops/services/preflight';

const router = Router();

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const control = await getControlNodeStatus(true);
    const tools = await detectDevOpsTools(true);
    res.json({
      success: true,
      data: {
        control,
        tools,
        workspaceRoot: getDevOpsWorkspaceRoot(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/preflight', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await runDevOpsPreflight();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
