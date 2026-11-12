import { Router, Request, Response, NextFunction } from 'express';
import { getControlNodeStatus } from '../devops/adapters';
import { detectDevOpsTools } from '../devops/services/toolDetection';
import { runDevOpsPreflight, getDevOpsWorkspaceRoot } from '../devops/services/preflight';
import terraformRouter from './devopsTerraform';
import ansibleRouter from './devopsAnsible';
import puppetRouter from './devopsPuppet';
import nagiosRouter from './devopsNagios';
import labRouter from './devopsLab';
import { assessPipelineReadiness } from '../devops/services/pipelineReadiness';
import { requireDevOpsMutationAuth } from '../middleware/devopsAuth';

const router = Router();

/** Protect mutating DevOps operations; keep GET status/preflight readable on localhost. */
function protectMutations(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  requireDevOpsMutationAuth(req, res, next);
}

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

router.get('/pipeline', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await assessPipelineReadiness() });
  } catch (err) {
    next(err);
  }
});

router.use('/terraform', protectMutations, terraformRouter);
router.use('/ansible', protectMutations, ansibleRouter);
router.use('/puppet', protectMutations, puppetRouter);
router.use('/nagios', protectMutations, nagiosRouter);
router.use('/lab', labRouter);

export default router;
