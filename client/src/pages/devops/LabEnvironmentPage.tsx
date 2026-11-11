import { useCallback, useEffect, useState } from 'react';
import { devopsApi } from '../../services/devopsApi';
import { PageBackground } from '../../components/shared';
import { PageHeader, Button, Alert, Card, Badge, LoadingSpinner } from '../../components/ui';

export function LabEnvironmentPage() {
  const [loading, setLoading] = useState(true);
  const [preflight, setPreflight] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [pf, st] = await Promise.all([devopsApi.preflight(), devopsApi.status()]);
    if (pf.success) setPreflight(pf.data as Record<string, unknown>);
    if (st.success) setStatus(st.data as Record<string, unknown>);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tools = (status?.tools as Array<Record<string, unknown>> | undefined) ?? [];
  const missing = tools.filter((t) => !t.available);

  return (
    <div className="page-shell relative">
      <PageBackground />
      <PageHeader
        title="Lab Environment"
        description="WSL2 Ubuntu, SSH control node, or native Linux readiness for CódigoFlow DevOps."
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Re-run preflight
          </Button>
        }
      />

      <Alert variant="info" className="relative z-10">
        Tools are not installed automatically. Use docs/lab-setup.md and devops/lab scripts with explicit approval.
      </Alert>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="relative z-10 space-y-4">
          <Card>
            <div className="section-title mb-2">Workspace</div>
            <p className="text-sm font-mono text-cf-cyan">{String(status?.workspaceRoot ?? '')}</p>
          </Card>

          <Card>
            <div className="section-title mb-2">Missing prerequisites</div>
            {missing.length === 0 ? (
              <Badge variant="success">All detected tools available on control node</Badge>
            ) : (
              <div className="space-y-2">
                {missing.map((t) => (
                  <div key={String(t.name)} className="text-sm">
                    <span className="text-cf-warning font-medium">{String(t.name)}</span>
                    <div className="text-xs text-cf-faint">{String(t.installHint ?? t.error ?? '')}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="section-title mb-2">Preflight result</div>
            <pre className="text-xs font-mono text-cf-muted whitespace-pre-wrap max-h-[480px] overflow-auto">
              {JSON.stringify(preflight, null, 2)}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
}
