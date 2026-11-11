import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { devopsApi } from '../../services/devopsApi';
import { PageBackground } from '../../components/shared';
import { PageHeader, Button, Alert, Card, Badge, LoadingSpinner } from '../../components/ui';

export function TerraformPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; relativePath?: string; name: string }>>([]);
  const [projectPath, setProjectPath] = useState('aws');
  const [output, setOutput] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [st, pr] = await Promise.all([devopsApi.terraform.status(), devopsApi.terraform.projects()]);
    if (st.success) setStatus(st.data as Record<string, unknown>);
    if (pr.success) {
      const list = (pr.data as Array<{ id: string; relativePath?: string; name: string }>) ?? [];
      setProjects(list);
      if (list[0]) setProjectPath(list[0].relativePath || list[0].id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: string, fn: () => Promise<{ success: boolean; data?: unknown; error?: { message?: string } }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) {
      toast.error(res.error?.message ?? `${action} failed`);
      setOutput(res.error?.message ?? 'failed');
      return;
    }
    toast.success(`${action} completed`);
    setOutput(JSON.stringify(res.data, null, 2));
    const data = res.data as { planId?: string };
    if (data?.planId) setPlanId(data.planId);
  }

  return (
    <div className="page-shell relative">
      <PageBackground />
      <PageHeader
        title="Terraform"
        description="Format, init, validate, plan, approve, and apply saved plans under devops/terraform."
      />

      <Alert variant="warning" className="relative z-10">
        Cloud applies can create billable resources. Apply never runs without an explicit approved saved plan.
      </Alert>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="relative z-10 space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={status?.available ? 'success' : 'warning'}>
                {status?.available ? `terraform ${String(status.version ?? '')}` : 'unavailable'}
              </Badge>
              <select
                className="input text-sm max-w-xs"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.relativePath || p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void run('fmt', () => devopsApi.terraform.fmt(projectPath))}>
                Format
              </Button>
              <Button disabled={busy} onClick={() => void run('init', () => devopsApi.terraform.init(projectPath))}>
                Init
              </Button>
              <Button
                disabled={busy}
                onClick={() => void run('validate', () => devopsApi.terraform.validate(projectPath))}
              >
                Validate
              </Button>
              <Button disabled={busy} onClick={() => void run('plan', () => devopsApi.terraform.plan(projectPath))}>
                Plan
              </Button>
              <Button
                disabled={busy || !planId}
                variant="secondary"
                onClick={() => planId && void run('approve', () => devopsApi.terraform.approve(planId))}
              >
                Approve plan
              </Button>
              <Button
                disabled={busy || !planId}
                variant="danger"
                onClick={() =>
                  planId &&
                  void run('apply', () => devopsApi.terraform.apply(planId, true))
                }
              >
                Apply approved plan
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => void run('outputs', () => devopsApi.terraform.outputs(projectPath))}
              >
                Outputs
              </Button>
            </div>
            {planId && (
              <p className="mt-3 text-xs font-mono text-cf-cyan">Saved plan: {planId}</p>
            )}
          </Card>

          <Card>
            <div className="section-title mb-2">Execution output</div>
            <pre className="text-xs font-mono text-cf-muted whitespace-pre-wrap max-h-96 overflow-auto">
              {output || 'Run an operation to see logs and results.'}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
}
