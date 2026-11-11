import { useEffect, useState } from 'react';
import {
  FolderGit2, GitBranch, Container, Bot, Activity,
  ArrowUpRight, Clock, Plus, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { StatCard, LoadingSpinner, EmptyState, Alert, PageHeader } from '../components/ui';
import { useRepoStore } from '../stores/repoStore';
import { useAppStore } from '../stores/appStore';
import { repositoriesApi, dockerApi, jobsApi } from '../services/api';
import type { RepoStatus, CommitEntry, ContainerInfo, Job } from '../types';
import { useNavigate } from 'react-router-dom';

export function OverviewPage() {
  const { repositories, selectedId, fetchRepositories } = useRepoStore();
  const { health, fetchHealth } = useAppStore();
  const navigate = useNavigate();

  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const selectedRepo = repositories.find((r) => r.id === selectedId);

  useEffect(() => {
    fetchHealth();
    fetchRepositories();
  }, [fetchHealth, fetchRepositories]);

  useEffect(() => {
    if (!selectedId) { setLoading(false); return; }
    void loadData();
    // intentionally reloads when repository selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function loadData(isRefresh = false) {
    if (!selectedId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const [statusRes, commitsRes, containersRes, jobsRes] = await Promise.allSettled([
      repositoriesApi.status(selectedId),
      repositoriesApi.commits(selectedId, 14),
      dockerApi.containers(true),
      jobsApi.list(8),
    ]);

    if (statusRes.status === 'fulfilled' && statusRes.value.success)
      setStatus(statusRes.value.data as RepoStatus);
    if (commitsRes.status === 'fulfilled' && commitsRes.value.success)
      setCommits((commitsRes.value.data as CommitEntry[]) ?? []);
    if (containersRes.status === 'fulfilled' && containersRes.value.success)
      setContainers((containersRes.value.data as ContainerInfo[]) ?? []);
    if (jobsRes.status === 'fulfilled' && jobsRes.value.success)
      setRecentJobs((jobsRes.value.data as Job[]) ?? []);

    setLoading(false);
    setRefreshing(false);
  }

  // Build commit activity chart data from recent commits
  const chartData = commits.slice(0, 14).reverse().map((c, i) => ({
    day: new Date(c.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    insertions: c.insertions,
    deletions: c.deletions,
    index: i,
  }));

  const runningContainers = containers.filter((c) => c.state === 'running').length;
  const changedFiles = status
    ? status.staged.length + status.unstaged.length + status.untracked.length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <span className="text-sm text-gray-500">Loading dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Overview"
        description="Your development automation command center"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => loadData(true)}
              className="btn-secondary"
              disabled={refreshing}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={() => navigate('/repositories')} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Repository
            </button>
          </div>
        }
      />

      {/* No repository selected */}
      {repositories.length === 0 && (
        <Alert variant="info" title="No repositories registered">
          Add your first Git repository to get started with CódigoFlow's features.
        </Alert>
      )}

      {/* Integration warnings */}
      {health && !health.integrations.ai.configured && (
        <Alert variant="warning" title="AI Copilot not configured">
          Set <code className="font-mono bg-surface-3 px-1 rounded">AI_API_KEY</code> in{' '}
          <code className="font-mono bg-surface-3 px-1 rounded">server/.env</code> to enable AI features.
        </Alert>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Repositories"
          value={repositories.length}
          icon={FolderGit2}
          color="brand"
        />
        <StatCard
          label="Changed Files"
          value={status ? changedFiles : '—'}
          icon={GitBranch}
          color="cyan"
        />
        <StatCard
          label="Running Containers"
          value={health?.integrations.docker.available ? runningContainers : '—'}
          icon={Container}
          color="violet"
        />
        <StatCard
          label="Recent Jobs"
          value={recentJobs.length}
          icon={Activity}
          color="green"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commit activity chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-gray-200">Commit Activity</div>
            {selectedRepo && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <GitBranch className="w-3.5 h-3.5" />
                {status?.branch ?? '…'}
              </div>
            )}
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1c2333', border: '1px solid #30363d', borderRadius: 8 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Area type="monotone" dataKey="insertions" stroke="#22d3ee" fill="url(#gradIn)" strokeWidth={2} name="Additions" />
                <Area type="monotone" dataKey="deletions" stroke="#f97316" fill="url(#gradDel)" strokeWidth={2} name="Deletions" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Activity}
              title="No commit data"
              description={selectedRepo ? 'No commits found in this repository' : 'Select a repository to view activity'}
            />
          )}
        </div>

        {/* Working tree status */}
        <div className="card">
          <div className="text-sm font-semibold text-gray-200 mb-4">Working Tree</div>
          {status ? (
            <div className="space-y-3">
              <StatusGroup label="Staged" items={status.staged} variant="success" />
              <StatusGroup label="Modified" items={status.unstaged} variant="warning" />
              <StatusGroup label="Untracked" items={status.untracked} variant="muted" />
              {status.ahead > 0 && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-surface-4">
                  <span className="text-gray-400">Ahead of origin</span>
                  <span className="badge-info">{status.ahead} commits</span>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={GitBranch}
              title="No repository selected"
              description="Select or register a repository"
            />
          )}
        </div>
      </div>

      {/* Recent commits + Container summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent commits */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-gray-200">Recent Commits</div>
            {selectedRepo && (
              <button
                onClick={() => navigate('/git')}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                View all <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
          {commits.length > 0 ? (
            <div className="space-y-2">
              {commits.slice(0, 6).map((c) => (
                <div key={c.hash} className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-gray-200 truncate">{c.message}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      <span className="font-mono">{c.shortHash}</span>
                      {' · '}{c.author}
                      {' · '}{new Date(c.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-[10px] text-right">
                    {c.insertions > 0 && <div className="text-green-400">+{c.insertions}</div>}
                    {c.deletions > 0 && <div className="text-red-400">-{c.deletions}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Clock} title="No commits" description="No commit history available" />
          )}
        </div>

        {/* Container summary */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-gray-200">Docker Containers</div>
            <button
              onClick={() => navigate('/docker')}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              Manage <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {!health?.integrations.docker.available ? (
            <Alert variant="warning">
              Docker is not available. Start Docker Desktop to manage containers.
            </Alert>
          ) : containers.length > 0 ? (
            <div className="space-y-2">
              {containers.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors">
                  <span className={c.state === 'running' ? 'status-dot-online' : 'status-dot-offline'} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-gray-200 truncate">{c.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{c.image}</div>
                  </div>
                  <span className={c.state === 'running' ? 'badge-success' : 'badge-muted'}>
                    {c.state}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Container} title="No containers" description="No Docker containers found" />
          )}
        </div>
      </div>

      {/* AI quick actions */}
      <div className="card">
        <div className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-400" />
          AI Copilot Quick Actions
        </div>
        {!health?.integrations.ai.configured ? (
          <Alert variant="info">
            Configure your AI API key to enable commit message generation, error explanation, Docker log analysis, and code assistance.
          </Alert>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Generate Commit Message', desc: 'From staged diff', to: '/ai' },
              { label: 'Explain Error', desc: 'Paste any error', to: '/ai' },
              { label: 'Analyze Docker Logs', desc: 'Diagnose failures', to: '/ai' },
              { label: 'Ask Copilot', desc: 'Code questions', to: '/ai' },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                className="card-sm text-left hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group"
              >
                <div className="text-xs font-medium text-gray-200 group-hover:text-violet-300 transition-colors">{action.label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{action.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusGroup({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: 'success' | 'warning' | 'muted';
}) {
  if (items.length === 0) return null;

  const cls = {
    success: 'text-green-400',
    warning: 'text-yellow-400',
    muted:   'text-gray-500',
  }[variant];

  return (
    <div>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${cls} mb-1`}>
        {label} ({items.length})
      </div>
      <div className="space-y-0.5">
        {items.slice(0, 4).map((f) => (
          <div key={f} className="text-[11px] font-mono text-gray-400 truncate pl-2">{f}</div>
        ))}
        {items.length > 4 && (
          <div className="text-[11px] text-gray-600 pl-2">+{items.length - 4} more</div>
        )}
      </div>
    </div>
  );
}
