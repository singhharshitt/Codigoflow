import { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { jobsApi } from '../services/api';
import { LoadingSpinner, EmptyState, PageHeader } from '../components/ui';
import type { Job } from '../types';

const STATUS_CONFIG = {
  queued:    { icon: Clock, cls: 'badge-muted' },
  running:   { icon: Loader2, cls: 'badge-info' },
  succeeded: { icon: CheckCircle, cls: 'badge-success' },
  failed:    { icon: XCircle, cls: 'badge-error' },
  cancelled: { icon: AlertCircle, cls: 'badge-warning' },
};

export function ExecutionHistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobsApi.list(100).then((res) => {
      if (res.success && res.data) setJobs(res.data as Job[]);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Execution History"
        description="Past and active automation jobs"
      />

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : jobs.length === 0 ? (
        <div className="card">
          <EmptyState icon={Clock} title="No jobs yet" description="Jobs appear here when you run Git, Docker, or AI operations." />
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.queued;
            const Icon = config.icon;
            return (
              <div key={job.id} className="card flex items-start gap-4">
                <div className={`p-1.5 rounded-lg bg-surface-3 flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${job.status === 'running' ? 'animate-spin text-cyan-400' : job.status === 'succeeded' ? 'text-green-400' : job.status === 'failed' ? 'text-red-400' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">{job.operation}</span>
                    <span className={config.cls}>{job.status}</span>
                  </div>
                  {job.summary && <div className="text-xs text-gray-400 mt-0.5">{job.summary}</div>}
                  {job.error_message && (
                    <div className="text-xs text-red-400 mt-0.5 font-mono">{job.error_message}</div>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 flex-shrink-0">
                  {new Date(job.created_at * 1000).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function WorkflowBuilderPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Workflow Builder" description="Visual CI/CD pipeline configuration — coming in Phase 2" />
      <div className="card">
        <EmptyState
          icon={Clock}
          title="Workflow Builder"
          description="This feature is planned for Phase 2. It will provide a visual interface to build Git → Docker → Terraform → Ansible → Puppet → Nagios deployment pipelines."
        />
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_BASE_URL ?? '/api');

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Settings" description="Application configuration" />
      <div className="card space-y-4 max-w-xl">
        <div className="text-sm font-semibold text-gray-200">Connection</div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">API Base URL</label>
          <input className="input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} readOnly />
          <div className="text-[10px] text-gray-600 mt-1">Set via VITE_API_BASE_URL in client/.env</div>
        </div>
        <div className="text-xs text-gray-500 pt-2 border-t border-surface-4">
          Configure AI, GitHub, and Docker settings via <code className="font-mono bg-surface-3 px-1 rounded">server/.env</code>.
          Never put secrets in frontend environment variables.
        </div>
      </div>
    </div>
  );
}
