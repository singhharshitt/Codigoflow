import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { authApi, type AuthStatus } from '../../services/authApi';
import { Alert, Badge, Button, Card, Input } from '../ui';

/**
 * Operator session for privileged DevOps mutations.
 * Token is posted to the server once; the browser keeps only an HttpOnly cookie.
 */
export function OperatorAuthPanel() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await authApi.status();
    if (res.success && res.data) setStatus(res.data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function login() {
    if (!token.trim()) {
      setError('Enter the server DEVOPS_API_TOKEN');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await authApi.login(token.trim());
    setBusy(false);
    if (!res.success) {
      setError(res.error?.message ?? 'Login failed');
      return;
    }
    setToken('');
    toast.success('Operator session established');
    await refresh();
  }

  async function logout() {
    setBusy(true);
    await authApi.logout();
    setBusy(false);
    toast.success('Logged out');
    await refresh();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="section-title">Operator session</div>
          <p className="text-xs text-cf-muted mt-1">
            Privileged mutations use an HttpOnly session cookie. The API token never ships in the Vite bundle.
          </p>
        </div>
        <Badge variant={status?.authenticated ? 'success' : 'warning'}>
          {status?.authenticated ? 'authenticated' : 'not signed in'}
        </Badge>
      </div>

      {status && !status.tokenConfigured && (
        <Alert variant="warning" className="mb-3">
          DEVOPS_API_TOKEN is not set on the server. Mutations may be open in local loopback-dev mode.
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      )}

      {status?.authenticated ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-cf-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-cf-cyan" />
            Role: {status.role ?? 'operator'}
            {status.expiresAt
              ? ` · expires ${new Date(status.expiresAt).toLocaleString()}`
              : ''}
          </span>
          <Button variant="secondary" disabled={busy} onClick={() => void logout()}>
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <Input
              label="Server operator token"
              type="password"
              autoComplete="off"
              placeholder="Paste DEVOPS_API_TOKEN (stored server-side only)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
            />
          </div>
          <Button disabled={busy || !token.trim()} onClick={() => void login()}>
            <KeyRound className="w-4 h-4" />
            Sign in
          </Button>
        </div>
      )}
    </Card>
  );
}
