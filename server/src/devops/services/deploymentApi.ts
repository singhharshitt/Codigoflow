import { createError } from '../../middleware/errorHandler';

export type DeploymentAction = 'deploy-nginx' | 'rollback-nginx';

/**
 * Connector to the FastAPI deployment service on the EC2 control node.
 *
 * FastAPI stays bound to 127.0.0.1:8000 on EC2 and is reached through an SSH
 * tunnel (local 127.0.0.1:<port> -> remote 127.0.0.1:8000). The service token
 * (CODIGOFLOW_API_TOKEN) only ever lives in server env, never in the client.
 *
 * Env (read on every call so .env.local / restarts take effect predictably):
 *   DEPLOYMENT_API_BASE_URL   default http://127.0.0.1:8000 (FASTAPI_BASE_URL is a legacy alias)
 *   CODIGOFLOW_API_TOKEN      must match backend/.env on EC2
 *   DEPLOYMENT_API_ALLOW_REMOTE=true  permit a non-loopback URL, and only over https
 */
const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';
/** FastAPI kills Ansible after 180s; leave headroom for its response. */
export const DEPLOYMENT_TIMEOUT_MS = 190_000;
const PROBE_TIMEOUT_MS = 5_000;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export interface DeploymentTarget {
  baseUrl: string;
  /** host:port only, safe to show in the UI */
  display: string;
}

/** Resolve and vet the base URL. Throws DEPLOYMENT_URL_NOT_ALLOWED for unsafe targets. */
export function resolveDeploymentTarget(): DeploymentTarget {
  const raw = (process.env.DEPLOYMENT_API_BASE_URL || process.env.FASTAPI_BASE_URL || DEFAULT_BASE_URL).trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw createError('DEPLOYMENT_API_BASE_URL is not a valid URL', 503, 'DEPLOYMENT_URL_INVALID');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw createError('DEPLOYMENT_API_BASE_URL must use http or https', 503, 'DEPLOYMENT_URL_INVALID');
  }
  if (url.username || url.password) {
    throw createError('DEPLOYMENT_API_BASE_URL must not embed credentials', 503, 'DEPLOYMENT_URL_INVALID');
  }

  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (!loopback) {
    // Sending the API key to a remote host over plain HTTP would leak it.
    const allowRemote = process.env.DEPLOYMENT_API_ALLOW_REMOTE?.trim().toLowerCase() === 'true';
    if (!allowRemote || url.protocol !== 'https:') {
      throw createError(
        'Deployment service must be reached through the SSH tunnel on 127.0.0.1 ' +
          '(remote URLs require https and DEPLOYMENT_API_ALLOW_REMOTE=true)',
        503,
        'DEPLOYMENT_URL_NOT_ALLOWED',
      );
    }
  }

  const baseUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  return { baseUrl, display: url.host };
}

function isTimeout(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

export async function executeDeployment(action: DeploymentAction): Promise<{
  action: DeploymentAction;
  success: boolean;
  message: string;
}> {
  if (action !== 'deploy-nginx' && action !== 'rollback-nginx') {
    throw createError('Unsupported deployment action', 400, 'INVALID_DEPLOYMENT_ACTION');
  }

  const token = process.env.CODIGOFLOW_API_TOKEN?.trim();
  if (!token) {
    throw createError('Deployment service is not configured', 503, 'DEPLOYMENT_NOT_CONFIGURED');
  }

  const target = resolveDeploymentTarget();
  let response: Response;

  try {
    response = await fetch(`${target.baseUrl}/api/deploy/${action}`, {
      method: 'POST',
      headers: {
        'X-API-Key': token,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(DEPLOYMENT_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeout(error)) {
      // The request reached FastAPI (or the tunnel stalled) but no answer came
      // back. Ansible may still be running remotely, so the outcome is unknown.
      throw createError(
        `No response from the deployment service within ${DEPLOYMENT_TIMEOUT_MS / 1000}s. ` +
          'The playbook may still be running on EC2; check it before retrying.',
        504,
        'DEPLOYMENT_TIMEOUT',
      );
    }
    throw createError(
      `Deployment service is unavailable at ${target.display}. Is the SSH tunnel running?`,
      503,
      'DEPLOYMENT_SERVICE_UNAVAILABLE',
    );
  }

  if (response.status === 409) {
    throw createError('Another deployment is already running', 409, 'DEPLOYMENT_CONFLICT');
  }

  if (response.status === 401 || response.status === 403) {
    throw createError(
      'Deployment service rejected the API token (check CODIGOFLOW_API_TOKEN matches EC2)',
      502,
      'DEPLOYMENT_AUTH_FAILED',
    );
  }

  if (response.status === 400) {
    throw createError('Deployment service rejected the action', 400, 'DEPLOYMENT_REJECTED');
  }

  if (!response.ok) {
    throw createError(
      'Deployment operation failed; check the FastAPI/Ansible logs on EC2',
      502,
      'DEPLOYMENT_FAILED',
    );
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw createError('Invalid deployment service response', 502, 'DEPLOYMENT_INVALID_RESPONSE');
  }

  if (
    !result ||
    typeof result !== 'object' ||
    !('success' in result) ||
    result.success !== true ||
    !('action' in result) ||
    result.action !== action
  ) {
    throw createError('Unexpected deployment service response', 502, 'DEPLOYMENT_INVALID_RESPONSE');
  }

  return {
    action,
    success: true,
    message: 'Deployment completed successfully',
  };
}

export type DeploymentConnectionState =
  | 'ready'
  | 'not_configured'
  | 'url_not_allowed'
  | 'unreachable'
  | 'timeout'
  | 'unhealthy'
  | 'auth_failed';

export interface DeploymentConnectionStatus {
  state: DeploymentConnectionState;
  /** host:port of the tunnel endpoint, never the token */
  target: string | null;
  tokenConfigured: boolean;
  reachable: boolean;
  authenticated: boolean;
  latencyMs: number | null;
  message: string;
  checkedAt: string;
}

/**
 * Read-only health check: GET /health, then GET /api/auth-check with the key.
 * Never throws and never returns the token.
 */
export async function checkDeploymentConnection(): Promise<DeploymentConnectionStatus> {
  const tokenConfigured = Boolean(process.env.CODIGOFLOW_API_TOKEN?.trim());
  const base = {
    tokenConfigured,
    reachable: false,
    authenticated: false,
    latencyMs: null as number | null,
    checkedAt: new Date().toISOString(),
  };

  let target: DeploymentTarget;
  try {
    target = resolveDeploymentTarget();
  } catch (error) {
    return {
      ...base,
      state: 'url_not_allowed',
      target: null,
      message: (error as Error).message,
    };
  }

  const started = Date.now();
  try {
    const health = await fetch(`${target.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - started;
    const body = (await health.json().catch(() => null)) as { status?: string } | null;
    if (!health.ok || body?.status !== 'healthy') {
      return {
        ...base,
        state: 'unhealthy',
        target: target.display,
        reachable: true,
        latencyMs,
        message: `Deployment service answered with HTTP ${health.status}`,
      };
    }

    if (!tokenConfigured) {
      return {
        ...base,
        state: 'not_configured',
        target: target.display,
        reachable: true,
        latencyMs,
        message: 'Service reachable, but CODIGOFLOW_API_TOKEN is not set on the CódigoFlow server',
      };
    }

    const auth = await fetch(`${target.baseUrl}/api/auth-check`, {
      method: 'GET',
      headers: { 'X-API-Key': process.env.CODIGOFLOW_API_TOKEN!.trim() },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (auth.status === 401 || auth.status === 403) {
      return {
        ...base,
        state: 'auth_failed',
        target: target.display,
        reachable: true,
        latencyMs,
        message: 'Service reachable, but it rejected CODIGOFLOW_API_TOKEN',
      };
    }
    const authBody = (await auth.json().catch(() => null)) as { authenticated?: boolean } | null;
    if (!auth.ok || authBody?.authenticated !== true) {
      return {
        ...base,
        state: 'unhealthy',
        target: target.display,
        reachable: true,
        latencyMs,
        message: `Auth check answered with HTTP ${auth.status}`,
      };
    }

    return {
      ...base,
      state: 'ready',
      target: target.display,
      reachable: true,
      authenticated: true,
      latencyMs,
      message: 'Deployment service reachable and authenticated',
    };
  } catch (error) {
    return {
      ...base,
      state: isTimeout(error) ? 'timeout' : 'unreachable',
      target: target.display,
      message: isTimeout(error)
        ? `No response from ${target.display} within ${PROBE_TIMEOUT_MS / 1000}s`
        : `Cannot reach ${target.display}. Start the SSH tunnel (see docs/ec2-integration.md)`,
    };
  }
}
