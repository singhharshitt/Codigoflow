import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Rocket, RotateCcw } from 'lucide-react';
import { authApi } from '../../services/authApi';
import { devopsApi } from '../../services/devopsApi';
import { Alert, Badge, Button, Card, Modal } from '../ui';

type Action = 'deploy' | 'rollback';

export function DeploymentControlPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshAuth() {
    try {
      const response = await authApi.status();
      setAuthenticated(
        response.success && response.data?.authenticated === true
      );
    } catch {
      setAuthenticated(false);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void refreshAuth();
  }, []);

  async function execute() {
    if (!pending || busy) return;

    const action = pending;
    setPending(null);
    setBusy(true);
    setResult(null);
    setError(null);

    try {
      const response =
        action === 'deploy'
          ? await devopsApi.deployment.deploy()
          : await devopsApi.deployment.rollback();

      if (!response.success) {
        const message = response.error?.message ?? 'Operation failed';
        setError(message);
        toast.error(message);
        return;
      }

      const message =
        action === 'deploy'
          ? 'Nginx deployment completed successfully'
          : 'Nginx rollback completed successfully';

      setResult(message);
      toast.success(message);
    } catch {
      setError('Unable to reach the deployment API');
      toast.error('Deployment request failed');
    } finally {
      setBusy(false);
      await refreshAuth();
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="section-title">Deployment Control</div>
          <p className="text-xs text-cf-muted mt-1">
            Secure Nginx deployment and rollback through FastAPI and Ansible.
          </p>
        </div>

        <Badge variant={authenticated ? 'success' : 'warning'}>
          {authenticated ? 'Operator authenticated' : 'Authentication required'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={busy || checking || !authenticated}
          loading={busy}
          onClick={() => setPending('deploy')}
        >
          <Rocket className="w-4 h-4" />
          Deploy Nginx
        </Button>

        <Button
          variant="danger"
          disabled={busy || checking || !authenticated}
          onClick={() => setPending('rollback')}
        >
          <RotateCcw className="w-4 h-4" />
          Rollback Nginx
        </Button>

        <Button
          variant="secondary"
          disabled={busy || checking}
          onClick={() => {
            setChecking(true);
            void refreshAuth();
          }}
        >
          Refresh authentication
        </Button>
      </div>

      {busy && (
        <Alert variant="info" className="mt-3">
          Deployment operation in progress. Please wait.
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
        title={pending === 'deploy' ? 'Confirm Deployment' : 'Confirm Rollback'}
        size="sm"
      >
        <p className="text-sm text-cf-muted mb-4">
          {pending === 'deploy'
            ? 'Deploy the approved Nginx configuration to the managed EC2 instance?'
            : 'Rollback Nginx on the managed EC2 instance to its previous configuration?'}
        </p>

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setPending(null)}
          >
            Cancel
          </Button>

          <Button
            variant={pending === 'rollback' ? 'danger' : 'primary'}
            disabled={busy}
            onClick={() => void execute()}
          >
            Confirm {pending === 'deploy' ? 'Deployment' : 'Rollback'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
