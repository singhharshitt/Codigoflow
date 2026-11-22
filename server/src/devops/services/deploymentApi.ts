import { createError } from '../../middleware/errorHandler';

export type DeploymentAction = 'deploy-nginx' | 'rollback-nginx';

const FASTAPI_BASE_URL = 'http://127.0.0.1:8000';
const DEPLOYMENT_TIMEOUT_MS = 190_000;

export async function executeDeployment(
  action: DeploymentAction
): Promise<{
  action: DeploymentAction;
  success: boolean;
  message: string;
}> {
  if (action !== 'deploy-nginx' && action !== 'rollback-nginx') {
    throw createError('Unsupported deployment action', 400, 'INVALID_DEPLOYMENT_ACTION');
  }

  const token = process.env.CODIGOFLOW_API_TOKEN?.trim();

  if (!token) {
    throw createError(
      'Deployment service is not configured',
      503,
      'DEPLOYMENT_NOT_CONFIGURED'
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${FASTAPI_BASE_URL}/api/deploy/${action}`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': token,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(DEPLOYMENT_TIMEOUT_MS),
      }
    );
  } catch {
    throw createError(
      'Deployment service is unavailable',
      503,
      'DEPLOYMENT_SERVICE_UNAVAILABLE'
    );
  }

  if (response.status === 409) {
    throw createError(
      'Another deployment is already running',
      409,
      'DEPLOYMENT_CONFLICT'
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw createError(
      'Deployment service authentication failed',
      502,
      'DEPLOYMENT_AUTH_FAILED'
    );
  }

  if (!response.ok) {
    throw createError(
      'Deployment operation failed',
      502,
      'DEPLOYMENT_FAILED'
    );
  }

  let result: unknown;

  try {
    result = await response.json();
  } catch {
    throw createError(
      'Invalid deployment service response',
      502,
      'DEPLOYMENT_INVALID_RESPONSE'
    );
  }

  if (
    !result ||
    typeof result !== 'object' ||
    !('success' in result) ||
    result.success !== true ||
    !('action' in result) ||
    result.action !== action
  ) {
    throw createError(
      'Unexpected deployment service response',
      502,
      'DEPLOYMENT_INVALID_RESPONSE'
    );
  }

  return {
    action,
    success: true,
    message: 'Deployment completed successfully',
  };
}
