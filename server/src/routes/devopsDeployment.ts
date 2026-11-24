import { Router, Request, Response, NextFunction } from 'express';
import { readSession, assertTrustedOrigin, hasOperatorAccess } from '../auth/session';
import { createError } from '../middleware/errorHandler';
import {
  checkDeploymentConnection,
  executeDeployment,
  resolveDeploymentTarget,
  type DeploymentAction,
} from '../devops/services/deploymentApi';
import { runJob } from '../jobs/jobService';

const router = Router();

function actorOf(req: Request): string {
  const s = readSession(req);
  return s?.name ? `operator ${s.name}` : 'operator session';
}

/** Deploy/rollback are operator-only, always. There is no loopback bypass here. */
function requireOperator(req: Request, _res: Response, next: NextFunction): void {
  try {
    const session = readSession(req);

    if (!hasOperatorAccess(session)) {
      throw createError('Operator authentication required', 401, 'OPERATOR_AUTH_REQUIRED');
    }

    assertTrustedOrigin(req);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Read-only connection check (FastAPI /health + /api/auth-check through the tunnel).
 * Returns booleans and the tunnel host:port only — never the token.
 */
router.get('/status', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await checkDeploymentConnection() });
  } catch (error) {
    next(error);
  }
});

/**
 * Run a deployment action and record it in execution history. The original
 * typed error (conflict, timeout, auth...) is re-thrown so the UI can react.
 */
async function runAuditedDeployment(action: DeploymentAction, actor: string) {
  let failure: unknown;
  let target = 'unknown';
  try {
    target = resolveDeploymentTarget().display;
  } catch {
    /* executeDeployment reports the configuration error */
  }

  const { job, result } = await runJob(
    {
      operation: `deployment.${action}`,
      type: 'deployment',
      summary: `${action} via FastAPI (${target}) by ${actor}`,
    },
    async ({ log }) => {
      log(`Requesting ${action} from the deployment service at ${target}`);
      try {
        const outcome = await executeDeployment(action);
        log(outcome.message);
        return outcome;
      } catch (error) {
        failure = error;
        throw error;
      }
    },
  );

  if (failure) throw failure;
  return { ...result!, jobId: job.id };
}

router.post('/deploy', requireOperator, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await runAuditedDeployment('deploy-nginx', actorOf(_req)) });
  } catch (error) {
    next(error);
  }
});

router.post('/rollback', requireOperator, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await runAuditedDeployment('rollback-nginx', actorOf(_req)) });
  } catch (error) {
    next(error);
  }
});

export default router;
