import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Server, Shield, Cloud, Activity } from 'lucide-react';
import { devopsApi } from '../../services/devopsApi';
import { jobsApi } from '../../services/api';
import type { Job } from '../../types';
import { PageBackground } from '../../components/shared';
import { OperatorAuthPanel } from '../../components/devops/OperatorAuthPanel';
import { PageHeader, Button, Badge, Alert, LoadingSpinner, Card } from '../../components/ui';

type ToolRow = {
  name: string;
  available?: boolean;
  version?: string;
  mode?: string;
  error?: string;
  installHint?: string;
};

export function DevOpsOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [st, jb] = await Promise.all([devopsApi.status(), jobsApi.list(20)]);
    if (!st.success) setError(st.error?.message ?? 'Failed to load DevOps status');
    else setStatus((st.data as Record<string, unknown>) ?? null);
    if (jb.success) setJobs(jb.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tools = (status?.tools as ToolRow[] | undefined) ?? [];
  const control = status?.control as Record<string, unknown> | undefined;

  return (
    <div className="page-shell relative">
      <PageBackground />
      <PageHeader
        title="DevOps Control Center"
        description="Unified Terraform, Ansible, Puppet, and Nagios operations with live tool detection."
        action={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="error" className="relative z-10">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="relative z-10 space-y-4">
          <OperatorAuthPanel />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { to: '/devops/terraform', label: 'Terraform', icon: Cloud },
              { to: '/devops/ansible', label: 'Ansible', icon: Server },
              { to: '/devops/puppet', label: 'Puppet', icon: Shield },
              { to: '/devops/nagios', label: 'Nagios', icon: Activity },
            ].map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="card hover:border-cf-cyan/40 transition-colors">
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-cf-cyan" />
                  <span className="font-display text-cf-text">{label}</span>
                </div>
              </Link>
            ))}
          </div>

          <Card>
            <div className="section-title mb-2">Control node</div>
            <div className="text-sm text-cf-muted space-y-1 font-mono">
              <div>Mode: {String(control?.activeMode ?? control?.mode ?? 'unknown')}</div>
              <div>Available: {String(control?.available ?? false)}</div>
              <div>Platform: {String(control?.platform ?? control?.distro ?? 'n/a')}</div>
              {control?.error ? <div className="text-cf-error">{String(control.error)}</div> : null}
            </div>
          </Card>

          <Card>
            <div className="section-title mb-3">Tool availability</div>
            <div className="space-y-2">
              {tools.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between gap-3 border-b border-cf-border/60 py-2 last:border-0"
                >
                  <div>
                    <div className="text-sm text-cf-text font-medium">{t.name}</div>
                    <div className="text-xs text-cf-faint font-mono">
                      {t.version || t.error || t.installHint || '—'}
                    </div>
                  </div>
                  <Badge variant={t.available ? 'success' : 'warning'}>
                    {t.available ? 'installed' : 'not installed'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="section-title mb-3">Recent jobs</div>
            {jobs.length === 0 ? (
              <p className="text-sm text-cf-faint">No jobs yet.</p>
            ) : (
              <div className="space-y-2">
                {jobs.slice(0, 8).map((j) => (
                  <div key={j.id} className="flex justify-between text-xs font-mono">
                    <span className="text-cf-cyan">{j.operation}</span>
                    <Badge variant={j.status === 'succeeded' ? 'success' : 'muted'}>
                      {j.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
