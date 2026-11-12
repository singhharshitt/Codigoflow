import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  GitBranch,
  Container,
  Bot,
  Activity,
  ArrowUpRight,
  Clock,
  Plus,
  RefreshCw,
  GitCommit,
  Terminal,
  Sparkles,
  History,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  StatCard,
  LoadingSpinner,
  EmptyState,
  Alert,
  PageHeader,
  Button,
  Badge,
  Card,
  Select,
} from '../components/ui';
import { PageBackground, MaskLineArt, SpiderEmblem } from '../components/shared';
import { theme } from '../config/theme';
import { useRepoStore } from '../stores/repoStore';
import { useAppStore } from '../stores/appStore';
import { repositoriesApi, dockerApi, jobsApi } from '../services/api';
import type { RepoStatus, CommitEntry, ContainerInfo, Job } from '../types';

const JOB_STATUS_VARIANT: Record<
  Job['status'],
  'success' | 'warning' | 'error' | 'info' | 'muted'
> = {
  succeeded: 'success',
  failed: 'error',
  running: 'info',
  cancelled: 'warning',
  queued: 'muted',
};

function jobStatusVariant(status: Job['status']) {
  return JOB_STATUS_VARIANT[status] ?? 'muted';
}

function formatJobTime(createdAt: number) {
  return new Date(createdAt * 1000).toLocaleString();
}

export function OverviewPage() {
  const { repositories, selectedId, fetchRepositories, selectRepository } = useRepoStore();
  const { health, fetchHealth } = useAppStore();
  const navigate = useNavigate();

  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const selectedRepo = repositories.find((r) => r.id === selectedId);
  const lastCommit = commits[0] ?? null;

  useEffect(() => {
    void fetchHealth();
    void fetchRepositories();
  }, [fetchHealth, fetchRepositories]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [containersRes, jobsRes] = await Promise.allSettled([
      dockerApi.containers(true),
      jobsApi.list(12),
    ]);

    if (containersRes.status === 'fulfilled' && containersRes.value.success) {
      setContainers((containersRes.value.data as ContainerInfo[]) ?? []);
    }
    if (jobsRes.status === 'fulfilled' && jobsRes.value.success) {
      setRecentJobs((jobsRes.value.data as Job[]) ?? []);
    }

    if (selectedId) {
      const [statusRes, commitsRes] = await Promise.allSettled([
        repositoriesApi.status(selectedId),
        repositoriesApi.commits(selectedId, 14),
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.success) {
        setStatus(statusRes.value.data as RepoStatus);
      } else {
        setStatus(null);
      }
      if (commitsRes.status === 'fulfilled' && commitsRes.value.success) {
        setCommits((commitsRes.value.data as CommitEntry[]) ?? []);
      } else {
        setCommits([]);
      }
    } else {
      setStatus(null);
      setCommits([]);
    }

    setLoading(false);
    setRefreshing(false);
  }

  const chartData = useMemo(
    () =>
      [...commits]
        .slice(0, 14)
        .reverse()
        .map((c) => ({
          day: new Date(c.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          insertions: c.insertions,
          deletions: c.deletions,
        })),
    [commits],
  );

  const runningContainers = containers.filter((c) => c.state === 'running').length;
  const changedFiles = status
    ? status.staged.length + status.unstaged.length + status.untracked.length
    : 0;

  const commitsStat = commits.length > 0 ? commits.length : changedFiles;
  const commitsStatLabel = commits.length > 0 ? 'Recent commits' : 'Changed files';

  if (loading) {
    return (
      <div className="page-shell relative">
        <PageBackground />
        <div className="relative z-10 flex items-center justify-center min-h-[16rem]">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-sm text-cf-faint">Loading dashboard</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell relative">
      <PageBackground />

      {/* Welcome header */}
      <section className="relative z-10 overflow-hidden rounded-xl border border-cf-border bg-cf-card/90 backdrop-blur-md p-5 md:p-6">
        <MaskLineArt className="absolute -right-2 top-1/2 h-28 w-28 -translate-y-1/2 opacity-[0.1] md:right-6 md:h-32 md:w-32" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-cf-cyan">
              AI-powered DevOps orchestration
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-cf-text">
              Welcome to Código<span className="text-cf-red">Flow</span>
            </h1>
            <p className="mt-1 max-w-xl text-sm text-cf-muted">
              Import a repository, review a guided deployment proposal, orchestrate Terraform → Ansible →
              Puppet → Nagios, and troubleshoot with real execution logs.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto lg:min-w-[20rem]">
            {repositories.length > 0 && (
              <Select
                label="Active repository"
                value={selectedId ?? ''}
                onChange={(e) => selectRepository(e.target.value || null)}
                className="min-w-[12rem] flex-1"
              >
                {repositories.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void loadData(true)}
                disabled={refreshing}
                aria-label="Refresh dashboard"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/repositories')}>
                <Plus className="h-4 w-4" />
                Import repo
              </Button>
              <Button variant="cyan" size="sm" onClick={() => navigate('/workflow')}>
                <Sparkles className="h-4 w-4" />
                Workflows
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/history')}>
                <History className="h-4 w-4" />
                History
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/git')}>
                <GitBranch className="h-4 w-4" />
                Git Studio
              </Button>
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {[
            {
              title: '1. Import',
              body: 'Paste a public GitHub URL — no local path required.',
              to: '/repositories',
            },
            {
              title: '2. Analyse',
              body: 'Detect stack, Dockerfile, and env names (no secret values).',
              to: '/repositories',
            },
            {
              title: '3. Review workflow',
              body: 'Load a proposed Terraform→Ansible→Puppet→Nagios graph.',
              to: '/workflow',
            },
            {
              title: '4. Observe',
              body: 'Track jobs, logs, and AI diagnostics for failures.',
              to: '/history',
            },
          ].map((step) => (
            <button
              key={step.title}
              type="button"
              onClick={() => navigate(step.to)}
              className="rounded-lg border border-cf-border/80 bg-cf-navy/40 px-3 py-2.5 text-left hover:border-cf-cyan/40 transition-colors"
            >
              <div className="text-xs font-semibold text-cf-cyan">{step.title}</div>
              <div className="mt-1 text-[11px] text-cf-muted leading-snug">{step.body}</div>
            </button>
          ))}
        </div>
      </section>

      {repositories.length === 0 && (
        <Alert variant="info" title="No repositories registered" className="relative z-10">
          Register your first Git repository to unlock status, commits, and automation on this dashboard.
        </Alert>
      )}

      {/* Stats */}
      <div className="relative z-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Repositories" value={repositories.length} icon={FolderGit2} color="brand" />
        <StatCard
          label={commitsStatLabel}
          value={selectedId ? commitsStat : '—'}
          icon={GitCommit}
          color="cyan"
        />
        <StatCard
          label="Running containers"
          value={health?.integrations.docker.available ? runningContainers : '—'}
          icon={Container}
          color="violet"
        />
        <StatCard label="Recent jobs" value={recentJobs.length} icon={Activity} color="green" />
      </div>

      {/* Repository overview */}
      <Card
        className="relative z-10"
        title="Repository overview"
        action={
          selectedRepo ? (
            <button
              type="button"
              onClick={() => navigate('/git')}
              className="flex items-center gap-1 text-xs text-cf-cyan hover:text-cf-ice"
            >
              Open Git Studio <ArrowUpRight className="h-3 w-3" />
            </button>
          ) : undefined
        }
      >
        {selectedRepo && status ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <OverviewField label="Name" value={selectedRepo.name} />
            <OverviewField
              label="Branch"
              value={
                <span className="inline-flex items-center gap-1.5 font-mono text-sm text-cf-cyan">
                  <GitBranch className="h-3.5 w-3.5" />
                  {status.branch}
                </span>
              }
            />
            <OverviewField
              label="Last commit"
              value={
                lastCommit ? (
                  <div className="min-w-0">
                    <div className="truncate text-sm text-cf-text">{lastCommit.message}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-cf-faint">
                      {lastCommit.shortHash} · {new Date(lastCommit.date).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-cf-faint">No commits loaded</span>
                )
              }
            />
            <OverviewField
              label="Working tree"
              value={
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">{status.staged.length} staged</Badge>
                  <Badge variant="warning">{status.unstaged.length} modified</Badge>
                  <Badge variant="muted">{status.untracked.length} untracked</Badge>
                  {status.ahead > 0 && <Badge variant="info">{status.ahead} ahead</Badge>}
                  {status.behind > 0 && <Badge variant="warning">{status.behind} behind</Badge>}
                </div>
              }
            />
          </div>
        ) : (
          <EmptyState
            icon={FolderGit2}
            title="No repository selected"
            description="Register a repository or pick one from the selector above."
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/repositories')}>
                Manage repositories
              </Button>
            }
          />
        )}
      </Card>

      {/* Git activity + timeline */}
      <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Git activity">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="overviewGradIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.chart.cyan} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={theme.chart.cyan} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="overviewGradDel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.chart.red} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={theme.chart.red} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.chart.grid} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: theme.chart.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: theme.chart.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.chart.tooltipBg,
                    border: `1px solid ${theme.chart.tooltipBorder}`,
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: theme.colors.text }}
                />
                <Area
                  type="monotone"
                  dataKey="insertions"
                  stroke={theme.chart.cyan}
                  fill="url(#overviewGradIn)"
                  strokeWidth={2}
                  name="Additions"
                />
                <Area
                  type="monotone"
                  dataKey="deletions"
                  stroke={theme.chart.red}
                  fill="url(#overviewGradDel)"
                  strokeWidth={2}
                  name="Deletions"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Activity}
              title="No commit data"
              description={
                selectedRepo
                  ? 'No commits returned for this repository.'
                  : 'Select a repository to view commit activity.'
              }
            />
          )}
        </Card>

        <Card title="Working tree">
          {status ? (
            <div className="space-y-3">
              <StatusGroup label="Staged" items={status.staged} tone="success" />
              <StatusGroup label="Modified" items={status.unstaged} tone="warning" />
              <StatusGroup label="Untracked" items={status.untracked} tone="muted" />
            </div>
          ) : (
            <EmptyState icon={GitBranch} title="No status" description="Select a repository to inspect changes." />
          )}
        </Card>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Recent commits"
          action={
            selectedRepo ? (
              <button
                type="button"
                onClick={() => navigate('/git')}
                className="flex items-center gap-1 text-xs text-cf-cyan hover:text-cf-ice"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </button>
            ) : undefined
          }
        >
          {commits.length > 0 ? (
            <ol className="relative space-y-0 border-l border-cf-border pl-4">
              {commits.slice(0, 8).map((c) => (
                <li key={c.hash} className="relative pb-4 last:pb-0">
                  <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full border border-cf-cyan bg-cf-card" />
                  <div className="text-xs text-cf-text">{c.message}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-cf-faint">
                    <span className="font-mono text-cf-muted">{c.shortHash}</span>
                    <span>{c.author}</span>
                    <span>{new Date(c.date).toLocaleDateString()}</span>
                    {c.insertions > 0 && <span className="text-cf-success">+{c.insertions}</span>}
                    {c.deletions > 0 && <span className="text-cf-red">-{c.deletions}</span>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={Clock} title="No commits" description="Commit history will appear here when available." />
          )}
        </Card>

        <Card
          title="Docker overview"
          action={
            <button
              type="button"
              onClick={() => navigate('/docker')}
              className="flex items-center gap-1 text-xs text-cf-cyan hover:text-cf-ice"
            >
              Manage <ArrowUpRight className="h-3 w-3" />
            </button>
          }
        >
          {health == null ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : !health.integrations.docker.available ? (
            <Alert variant="warning" title="Docker unavailable">
              {health.integrations.docker.error ??
                'Start Docker Desktop or configure the Docker integration on the server.'}
            </Alert>
          ) : containers.length > 0 ? (
            <div className="space-y-2">
              <div className="mb-3 flex gap-3 text-xs text-cf-muted">
                <span>
                  <span className="text-cf-text">{containers.length}</span> total
                </span>
                <span>
                  <span className="text-cf-success">{runningContainers}</span> running
                </span>
                {health.integrations.docker.version && (
                  <span className="font-mono text-cf-faint">v{health.integrations.docker.version}</span>
                )}
              </div>
              {containers.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-cf-border/60 bg-cf-navy/40 p-2 transition-colors hover:border-cf-cyan/30"
                >
                  <span className={c.state === 'running' ? 'status-dot-online' : 'status-dot-offline'} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-cf-text">{c.name}</div>
                    <div className="truncate text-[10px] text-cf-faint">{c.image}</div>
                  </div>
                  <Badge variant={c.state === 'running' ? 'success' : 'muted'}>{c.state}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Container} title="No containers" description="No Docker containers were found." />
          )}
        </Card>
      </div>

      {/* AI Copilot */}
      <Card className="relative z-10 overflow-hidden">
        <div className="mb-4 flex items-center gap-2">
          <SpiderEmblem size={22} glowing />
          <div className="text-sm font-semibold text-cf-text">AI Copilot quick actions</div>
        </div>
        {health == null ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        ) : !health.integrations.ai.configured ? (
          <Alert variant="warning" title="AI Copilot not configured">
            Set <code className="rounded bg-cf-elevated px-1 font-mono text-cf-cyan">AI_API_KEY</code> in{' '}
            <code className="rounded bg-cf-elevated px-1 font-mono">server/.env</code> to enable commit
            messages, error explanation, and log analysis. Quick actions stay disabled until the server reports a
            configured key.
          </Alert>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Generate commit message', desc: 'From staged diff', icon: GitCommit },
              { label: 'Explain error', desc: 'Paste any stack trace', icon: Sparkles },
              { label: 'Analyze Docker logs', desc: 'Diagnose failures', icon: Terminal },
              { label: 'Ask Copilot', desc: 'Code and workflow help', icon: Bot },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate('/ai')}
                className="card-sm group text-left transition-all hover:border-cf-violet/50 hover:bg-cf-violet/5"
              >
                <action.icon className="mb-2 h-4 w-4 text-cf-violet group-hover:text-cf-cyan" />
                <div className="text-xs font-medium text-cf-text group-hover:text-cf-ice">{action.label}</div>
                <div className="mt-0.5 text-[10px] text-cf-faint">{action.desc}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Recent operations */}
      <Card
        className="relative z-10"
        title="Recent operations"
        action={
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="flex items-center gap-1 text-xs text-cf-cyan hover:text-cf-ice"
          >
            Full history <History className="h-3 w-3" />
          </button>
        }
      >
        {recentJobs.length > 0 ? (
          <div className="space-y-2">
            {recentJobs.slice(0, 8).map((job) => (
              <div
                key={job.id}
                className="flex items-start gap-3 rounded-lg border border-cf-border/50 bg-cf-navy/30 p-3"
              >
                <JobStatusDot status={job.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-cf-text">{job.operation}</span>
                    <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                  </div>
                  {job.summary && <p className="mt-0.5 text-xs text-cf-muted">{job.summary}</p>}
                  {job.error_message && (
                    <p className="mt-1 font-mono text-[10px] text-cf-error">{job.error_message}</p>
                  )}
                </div>
                <time className="shrink-0 text-[10px] text-cf-faint">{formatJobTime(job.created_at)}</time>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No operations yet"
            description="Jobs from Git, Docker, and AI workflows will show up here."
          />
        )}
      </Card>

      {/* Integration status */}
      {health && (
        <section className="relative z-10">
          <PageHeader title="Integration status" description="Live configuration from the CódigoFlow API health check." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <IntegrationTile
              label="AI Copilot"
              active={health.integrations.ai.configured}
              detail={health.integrations.ai.configured ? 'API key configured' : 'Not configured'}
            />
            <IntegrationTile
              label="GitHub"
              active={health.integrations.github.configured}
              detail={health.integrations.github.configured ? 'Token configured' : 'Not configured'}
            />
            <IntegrationTile
              label="Docker"
              active={health.integrations.docker.available}
              detail={
                health.integrations.docker.available
                  ? health.integrations.docker.version
                    ? `Engine v${health.integrations.docker.version}`
                    : 'Engine available'
                  : health.integrations.docker.error ?? 'Not available'
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}

function OverviewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-cf-faint">{label}</div>
      <div className="mt-1.5 text-cf-text">{value}</div>
    </div>
  );
}

function StatusGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: 'success' | 'warning' | 'muted';
}) {
  if (items.length === 0) return null;

  const toneCls = {
    success: 'text-cf-success',
    warning: 'text-cf-warning',
    muted: 'text-cf-faint',
  }[tone];

  return (
    <div>
      <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${toneCls}`}>
        {label} ({items.length})
      </div>
      <div className="space-y-0.5">
        {items.slice(0, 5).map((f) => (
          <div key={f} className="truncate pl-2 font-mono text-[11px] text-cf-muted">
            {f}
          </div>
        ))}
        {items.length > 5 && <div className="pl-2 text-[11px] text-cf-faint">+{items.length - 5} more</div>}
      </div>
    </div>
  );
}

function IntegrationTile({
  label,
  active,
  detail,
}: {
  label: string;
  active: boolean;
  detail: string;
}) {
  return (
    <div className="card flex items-center justify-between gap-3 border-cf-border/80">
      <div>
        <div className="text-sm font-medium text-cf-text">{label}</div>
        <div className="mt-0.5 text-[11px] text-cf-faint">{detail}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={active ? 'status-dot-online' : 'status-dot-offline'} />
        <Badge variant={active ? 'success' : 'error'}>{active ? 'Ready' : 'Off'}</Badge>
      </div>
    </div>
  );
}

function JobStatusDot({ status }: { status: Job['status'] }) {
  const tone =
    status === 'succeeded'
      ? 'border-cf-success bg-cf-success/80'
      : status === 'running'
        ? 'border-cf-cyan bg-cf-cyan/80 animate-pulse'
        : status === 'failed'
          ? 'border-cf-error bg-cf-error/70'
          : status === 'cancelled'
            ? 'border-cf-warning bg-cf-warning/70'
            : 'border-cf-faint bg-cf-elevated';

  return <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full border ${tone}`} aria-hidden />;
}
