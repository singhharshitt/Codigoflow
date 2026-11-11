import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Tabs,
  EmptyState,
  LoadingSpinner,
  Alert,
  Badge,
  Input,
} from '../components/ui';
import { PageBackground } from '../components/shared';
import { toast } from 'sonner';
import { useHistoryStore, type JobFilter } from '../stores/historyStore';
import { aiJobApi, jobsApi } from '../services/api';
import type { Job } from '../types';
import clsx from 'clsx';

const STATUS_ICON = {
  queued: Clock,
  running: Loader2,
  succeeded: CheckCircle,
  failed: XCircle,
  cancelled: AlertCircle,
};

export function ExecutionHistoryPage() {
  const {
    jobs,
    loading,
    error,
    filter,
    search,
    selectedId,
    fetchJobs,
    setFilter,
    setSearch,
    selectJob,
  } = useHistoryStore();
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 12;

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const filtered = useMemo(() => {
    let list = [...jobs];
    if (filter !== 'all') list = list.filter((j) => j.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.operation.toLowerCase().includes(q) ||
          j.id.toLowerCase().includes(q) ||
          (j.summary ?? '').toLowerCase().includes(q) ||
          (j.repo_id ?? '').toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => (sortAsc ? a.created_at - b.created_at : b.created_at - a.created_at));
    return list;
  }, [jobs, filter, search, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  useEffect(() => {
    setPage(0);
  }, [filter, search]);

  return (
    <div className="page-shell relative">
      <PageBackground showWeb={false} />
      <PageHeader
        title="Execution History"
        description="Past and active automation jobs from the CódigoFlow server"
        action={
          <Button variant="secondary" onClick={() => void fetchJobs()} loading={loading}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="error" className="relative z-10">
          {error}
        </Alert>
      )}

      <div className="relative z-10 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <Tabs
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'succeeded', label: 'Successful' },
            { id: 'failed', label: 'Failed' },
            { id: 'running', label: 'Running' },
            { id: 'cancelled', label: 'Cancelled' },
          ] satisfies { id: JobFilter; label: string }[]}
          value={filter === 'queued' ? 'all' : filter}
          onChange={(id) => setFilter(id)}
        />
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-cf-faint" />
            <input
              className="input pl-9 w-56"
              placeholder="Search jobs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="ghost" onClick={() => setSortAsc((v) => !v)}>
            Sort {sortAsc ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[1.4fr_0.8fr] gap-4">
        <div className="card !p-0 overflow-hidden">
          {loading && jobs.length === 0 ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : pageItems.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No jobs yet"
              description="Jobs appear here when Git, Docker, or AI operations are recorded by the server."
            />
          ) : (
            <div className="table-wrap !border-0 !rounded-none">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Operation</th>
                    <th>Repository</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((job) => {
                    const Icon = STATUS_ICON[job.status] ?? Clock;
                    return (
                      <tr
                        key={job.id}
                        className={clsx('cursor-pointer', selectedId === job.id && 'bg-cf-elevated/50')}
                        onClick={() => selectJob(job.id)}
                      >
                        <td className="font-mono text-xs text-cf-cyan">{job.id.slice(0, 8)}</td>
                        <td className="text-cf-text">{job.operation}</td>
                        <td className="font-mono text-xs">{job.repo_id?.slice(0, 8) ?? '—'}</td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <Icon
                              className={clsx(
                                'w-3.5 h-3.5',
                                job.status === 'running' && 'animate-spin text-cf-cyan',
                                job.status === 'succeeded' && 'text-cf-success',
                                job.status === 'failed' && 'text-cf-error',
                              )}
                            />
                            <StatusBadge status={job.status} />
                          </span>
                        </td>
                        <td className="text-xs">
                          {job.started_at
                            ? new Date(job.started_at * 1000).toLocaleString()
                            : new Date(job.created_at * 1000).toLocaleString()}
                        </td>
                        <td className="font-mono text-xs">{formatDuration(job)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 border-t border-cf-border text-xs text-cf-faint">
            <span>
              {filtered.length} job(s) · page {page + 1}/{pageCount}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <aside className="card space-y-3">
          <div className="text-sm font-semibold text-cf-text">Job details</div>
          {!selected ? (
            <EmptyState icon={Clock} title="Select a job" description="Choose a row to inspect logs and results" />
          ) : (
            <JobDetails job={selected} />
          )}
        </aside>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Job['status'] }) {
  const map: Record<Job['status'], 'success' | 'error' | 'info' | 'warning' | 'muted'> = {
    succeeded: 'success',
    failed: 'error',
    running: 'info',
    cancelled: 'warning',
    queued: 'muted',
  };
  return <Badge variant={map[status]}>{status}</Badge>;
}

function formatDuration(job: Job) {
  if (!job.started_at || !job.finished_at) return '—';
  const ms = (job.finished_at - job.started_at) * 1000;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function JobDetails({ job }: { job: Job }) {
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: number; level: string; message: string }>>(
    [],
  );
  const [logsLoading, setLogsLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAiResult(null);
    setLogsLoading(true);
    void jobsApi.logs(job.id).then((res) => {
      if (cancelled) return;
      setLogsLoading(false);
      if (res.success && res.data) setLogs(res.data);
      else setLogs([]);
    });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  async function runAiAnalysis() {
    setAiBusy(true);
    const res = await aiJobApi.analyzeJob(job.id);
    setAiBusy(false);
    if (!res.success || !res.data) {
      toast.error(res.error?.message ?? 'AI analysis failed');
      return;
    }
    setAiResult(res.data.analysis);
    toast.success('Analysis ready (advisory only)');
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-cf-faint">Operation</div>
        <div className="text-cf-text font-medium">{job.operation}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-cf-faint">Job ID</div>
        <div className="font-mono text-xs text-cf-cyan break-all">{job.id}</div>
      </div>
      <div className="flex gap-2 items-center">
        <StatusBadge status={job.status} />
        {job.repo_id && <span className="font-mono text-xs text-cf-faint">repo {job.repo_id}</span>}
      </div>
      {job.summary && <p className="text-cf-muted">{job.summary}</p>}
      {job.error_message && (
        <Alert variant="error">
          <pre className="font-mono text-xs whitespace-pre-wrap">{job.error_message}</pre>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs text-cf-faint">
        <div>
          Started
          <div className="text-cf-muted">
            {job.started_at ? new Date(job.started_at * 1000).toLocaleString() : '—'}
          </div>
        </div>
        <div>
          Finished
          <div className="text-cf-muted">
            {job.finished_at ? new Date(job.finished_at * 1000).toLocaleString() : '—'}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-[10px] uppercase tracking-wider text-cf-faint">Persisted logs</div>
          {(job.status === 'failed' || job.status === 'cancelled') && (
            <Button size="sm" variant="secondary" loading={aiBusy} onClick={() => void runAiAnalysis()}>
              AI diagnose
            </Button>
          )}
        </div>
        {logsLoading ? (
          <LoadingSpinner size="sm" />
        ) : logs.length === 0 ? (
          <p className="text-xs text-cf-faint">No log lines persisted for this job.</p>
        ) : (
          <pre className="code-block text-[10px] max-h-56 overflow-auto whitespace-pre-wrap">
            {logs.map((l) => `${new Date(l.timestamp * 1000).toISOString()} [${l.level}] ${l.message}`).join('\n')}
          </pre>
        )}
      </div>

      {aiResult && (
        <Alert variant="info">
          <div className="space-y-1 text-xs">
            <div className="font-medium text-cf-text">{String(aiResult.summary ?? '')}</div>
            <div>Likely cause: {String(aiResult.likelyCause ?? '—')}</div>
            <div>Next: {String(aiResult.suggestedNextStep ?? '—')}</div>
            <div className="text-cf-faint">Advisory only — no infrastructure commands were executed.</div>
          </div>
        </Alert>
      )}

      {job.log_ref && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-cf-faint mb-1">Log reference</div>
          <pre className="code-block text-xs">{job.log_ref}</pre>
        </div>
      )}
      <Input label="Notes (local only)" placeholder="Optional personal note — not persisted to server" />
    </div>
  );
}
