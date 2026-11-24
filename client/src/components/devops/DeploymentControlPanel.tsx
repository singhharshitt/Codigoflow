import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Rocket, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { authApi } from '../../services/authApi';
import {
  devopsApi,
  type DeploymentConnectionState,
  type DeploymentConnectionStatus,
} from '../../services/devopsApi';
import { Alert, Button, Card, Modal } from '../ui';

type Action = 'deploy' | 'rollback';

const STATE_LABEL: Record<DeploymentConnectionState, string> = {
  ready: 'Connected',
  not_configured: 'Token not set',
  url_not_allowed: 'URL not allowed',
  unreachable: 'Tunnel down',
  timeout: 'Not responding',
  unhealthy: 'Service unhealthy',
  auth_failed: 'Token rejected',
};

/** Turn the server's error codes into something an operator can act on. */
function describeError(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'DEPLOYMENT_CONFLICT':
      return 'Another deployment is already running on EC2. Wait for it to finish, then try again.';
    case 'DEPLOYMENT_TIMEOUT':
      return 'No answer within the time limit. The playbook may still be running on EC2, so check there before retrying.';
    case 'DEPLOYMENT_SERVICE_UNAVAILABLE':
      return 'The deployment service is unreachable. Start the SSH tunnel and refresh.';
    case 'DEPLOYMENT_AUTH_FAILED':
      return 'FastAPI rejected the service token. CODIGOFLOW_API_TOKEN must match backend/.env on EC2.';
    case 'DEPLOYMENT_NOT_CONFIGURED':
      return 'CODIGOFLOW_API_TOKEN is not set on the CódigoFlow server.';
    case 'OPERATOR_AUTH_REQUIRED':
      return 'Your operator session expired. Sign in again.';
    case 'DEPLOYMENT_FAILED':
      return 'The playbook failed on EC2. Check the FastAPI and Ansible logs on the control node.';
    default:
      return fallback;
  }
}

export function DeploymentControlPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [connection, setConnection] = useState<DeploymentConnectionStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    const [auth, status] = await Promise.allSettled([authApi.status(), devopsApi.deployment.status()]);
    setAuthenticated(
      auth.status === 'fulfilled' && auth.value.success && auth.value.data?.authenticated === true,
    );
    setConnection(status.status === 'fulfilled' && status.value.success ? (status.value.data ?? null) : null);
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function execute() {
    if (!pending || busy) return;

    const action = pending;
    setPending(null);
    setBusy(true);
    setResult(null);
    setError(null);

    try {
      const response =
        action === 'deploy' ? await devopsApi.deployment.deploy() : await devopsApi.deployment.rollback();

      if (!response.success) {
        const message = describeError(response.error?.code, response.error?.message ?? 'Operation failed');
        setError(message);
        toast.error(message);
        return;
      }

      const message =
        action === 'deploy' ? 'Nginx deployment completed successfully' : 'Nginx rollback completed successfully';
      setResult(message);
      toast.success(message);
    } catch {
      setError('Unable to reach the CódigoFlow API');
      toast.error('Deployment request failed');
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  const ready = connection?.state === 'ready';
  const canAct = ready && authenticated && !busy && !checking;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-cf-text">Nginx deployment</h2>
          <p className="mt-1 text-sm text-cf-muted">
            Runs the approved playbooks on the EC2 control node through FastAPI and Ansible
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={checking || busy}>
          <RefreshCw className={clsx('h-4 w-4', checking && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-cf-border bg-cf-navy p-3">
          <dt className="text-xs text-cf-faint">Deployment service</dt>
          <dd className="mt-1 flex items-center gap-2 text-sm text-cf-text">
            <span
              className={clsx(
                'status-dot',
                checking ? 'bg-cf-faint' : ready ? 'bg-cf-success' : connection?.reachable ? 'bg-cf-warning' : 'bg-cf-error',
              )}
            />
            {checking ? 'Checking' : connection ? STATE_LABEL[connection.state] : 'Unknown'}
            {connection?.target && (
              <span className="font-mono text-xs text-cf-faint">
                {connection.target}
                {connection.latencyMs != null && ` · ${connection.latencyMs} ms`}
              </span>
            )}
          </dd>
          {!checking && connection && !ready && (
            <p className="mt-1 break-words text-xs text-cf-faint">{connection.message}</p>
          )}
        </div>
        <div className="rounded-lg border border-cf-border bg-cf-navy p-3">
          <dt className="text-xs text-cf-faint">Operator session</dt>
          <dd className="mt-1 flex items-center gap-2 text-sm text-cf-text">
            <span className={clsx('status-dot', authenticated ? 'bg-cf-success' : 'bg-cf-faint')} />
            {authenticated ? 'Signed in' : 'Sign in required'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button disabled={!canAct} loading={busy && pending === null} onClick={() => setPending('deploy')}>
          <Rocket className="h-4 w-4" />
          Deploy Nginx
        </Button>
        <Button variant="danger" disabled={!canAct} onClick={() => setPending('rollback')}>
          <RotateCcw className="h-4 w-4" />
          Rollback Nginx
        </Button>
      </div>

      {busy && (
        <Alert variant="info" className="mt-3">
          Running on EC2. This can take up to three minutes; the job is recorded in execution history.
        </Alert>
      )}
      {result && (
        <Alert variant="success" className="mt-3">
          {result}
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      <Modal
        open={pending !== null}
        onClose={() => {
          if (!busy) setPending(null);
        }}
        title={pending === 'deploy' ? 'Deploy Nginx' : 'Roll back Nginx'}
        size="sm"
      >
        <p className="mb-4 text-sm text-cf-muted">
          {pending === 'deploy'
            ? 'This runs the deploy playbook (with automatic rollback on failure) against the managed EC2 instance. It changes real infrastructure.'
            : 'This restores the previous Nginx configuration on the managed EC2 instance. It changes real infrastructure.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button variant={pending === 'rollback' ? 'danger' : 'primary'} disabled={busy} onClick={() => void execute()}>
            {pending === 'deploy' ? 'Deploy' : 'Roll back'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
