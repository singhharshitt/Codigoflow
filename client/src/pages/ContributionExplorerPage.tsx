import { useMemo, useState } from 'react';
import { Github, Users, GitCommit, Search, ExternalLink, GitBranch } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { toast } from 'sonner';
import { githubApi } from '../services/api';
import { theme } from '../config/theme';
import {
  Alert,
  PageHeader,
  LoadingSpinner,
  EmptyState,
  Button,
  Input,
  Badge,
  Card,
} from '../components/ui';
import { PageBackground } from '../components/shared';
import type { GitHubCommit, GitHubContributor } from '../types';

export function ContributionExplorerPage() {
  const [url, setUrl] = useState('');
  const [repoInfo, setRepoInfo] = useState<Record<string, unknown> | null>(null);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [contributors, setContributors] = useState<GitHubContributor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommit | null>(null);

  async function handleSearch() {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setRepoInfo(null);
    setCommits([]);
    setContributors([]);
    setSelectedCommit(null);

    const repoRes = await githubApi.repo(url.trim());
    if (!repoRes.success || !repoRes.data) {
      setError(repoRes.error?.message ?? 'Failed to fetch repository');
      setLoading(false);
      return;
    }
    setRepoInfo(repoRes.data);

    const match = url.match(/github\.com\/([^/]+)\/([^/.\s]+)/);
    if (!match) {
      setError('Could not parse owner/repo from the GitHub URL.');
      setLoading(false);
      return;
    }

    const [, owner, repo] = match;
    const [commitsRes, contributorsRes] = await Promise.allSettled([
      githubApi.commits(owner, repo),
      githubApi.contributors(owner, repo),
    ]);

    if (commitsRes.status === 'fulfilled' && commitsRes.value.success) {
      setCommits(commitsRes.value.data ?? []);
    } else if (commitsRes.status === 'fulfilled') {
      toast.error(commitsRes.value.error?.message ?? 'Commits unavailable');
    }

    if (contributorsRes.status === 'fulfilled' && contributorsRes.value.success) {
      setContributors(contributorsRes.value.data ?? []);
    } else if (contributorsRes.status === 'fulfilled') {
      toast.error(contributorsRes.value.error?.message ?? 'Contributors unavailable');
    }

    setLoading(false);
  }

  const contributorChart = useMemo(
    () =>
      contributors.slice(0, 10).map((c) => ({
        name: c.login,
        contributions: c.contributions,
      })),
    [contributors],
  );

  const activityChart = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const c of commits) {
      const day = new Date(c.commit.author.date).toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
      });
      buckets.set(day, (buckets.get(day) ?? 0) + 1);
    }
    return Array.from(buckets.entries())
      .map(([day, count]) => ({ day, count }))
      .reverse();
  }, [commits]);

  return (
    <div className="page-shell relative">
      <PageBackground />
      <PageHeader
        title="Contribution Explorer"
        description="Inspect public GitHub activity from real API data — no invented calendars or stats"
      />

      <Card className="relative z-10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              label="GitHub repository URL"
              placeholder="https://github.com/owner/repository"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void handleSearch()} loading={loading}>
              <Search className="w-4 h-4" /> Explore
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Alert variant="error" className="relative z-10">
          {error}
        </Alert>
      )}

      {loading && (
        <div className="flex justify-center py-16 relative z-10">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {repoInfo && !loading && (
        <div className="relative z-10 space-y-6">
          <div className="card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cf-elevated border border-cf-border flex items-center justify-center">
                <Github className="w-5 h-5 text-cf-text" />
              </div>
              <div>
                <div className="text-lg font-semibold text-cf-text">
                  {String(repoInfo.full_name ?? repoInfo.name ?? 'Repository')}
                </div>
                <p className="text-sm text-cf-muted mt-1 max-w-2xl">
                  {String(repoInfo.description ?? 'No description provided by GitHub.')}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="info">
                    <GitBranch className="w-3 h-3" /> {String(repoInfo.default_branch ?? '—')}
                  </Badge>
                  <Badge variant="muted">
                    <GitCommit className="w-3 h-3" /> {commits.length} loaded commits
                  </Badge>
                  <Badge variant="violet">
                    <Users className="w-3 h-3" /> {contributors.length} contributors
                  </Badge>
                  {repoInfo.stargazers_count != null && (
                    <Badge variant="muted">★ {String(repoInfo.stargazers_count)}</Badge>
                  )}
                </div>
              </div>
            </div>
            {typeof repoInfo.html_url === 'string' && (
              <a
                href={repoInfo.html_url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                <ExternalLink className="w-4 h-4" /> Open on GitHub
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Commit activity (loaded window)">
              {activityChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={activityChart}>
                    <defs>
                      <linearGradient id="cfActivity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.chart.cyan} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={theme.chart.cyan} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.chart.grid} />
                    <XAxis dataKey="day" tick={{ fill: theme.chart.axis, fontSize: 11 }} />
                    <YAxis tick={{ fill: theme.chart.axis, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: theme.chart.tooltipBg,
                        border: `1px solid ${theme.chart.tooltipBorder}`,
                        borderRadius: 8,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={theme.chart.cyan}
                      fill="url(#cfActivity)"
                      name="Commits"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={GitCommit} title="No commit activity loaded" />
              )}
            </Card>

            <Card title="Contributor activity">
              {contributorChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={contributorChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.chart.grid} />
                    <XAxis dataKey="name" tick={{ fill: theme.chart.axis, fontSize: 10 }} />
                    <YAxis tick={{ fill: theme.chart.axis, fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: theme.chart.tooltipBg,
                        border: `1px solid ${theme.chart.tooltipBorder}`,
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="contributions" fill={theme.chart.red} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={Users} title="No contributor data" />
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <Card title="Recent commits">
              {commits.length === 0 ? (
                <EmptyState icon={GitCommit} title="No commits returned" />
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {commits.map((c) => (
                    <button
                      key={c.sha}
                      type="button"
                      onClick={() => setSelectedCommit(c)}
                      className="w-full text-left p-3 rounded-lg border border-cf-border hover:border-cf-cyan/40 hover:bg-cf-elevated/40 transition-colors"
                    >
                      <div className="text-sm text-cf-text truncate">{c.commit.message.split('\n')[0]}</div>
                      <div className="text-[11px] text-cf-faint mt-1 font-mono">
                        {c.sha.slice(0, 7)} · {c.commit.author.name} ·{' '}
                        {new Date(c.commit.author.date).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Commit details">
              {!selectedCommit ? (
                <EmptyState icon={GitCommit} title="Select a commit" description="Choose a commit from the list" />
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="text-cf-text font-medium whitespace-pre-wrap">
                    {selectedCommit.commit.message}
                  </div>
                  <div className="font-mono text-xs text-cf-cyan">{selectedCommit.sha}</div>
                  <div className="text-cf-muted">
                    {selectedCommit.commit.author.name}
                    <span className="text-cf-faint">
                      {' '}
                      · {new Date(selectedCommit.commit.author.date).toLocaleString()}
                    </span>
                  </div>
                  {selectedCommit.author && (
                    <div className="flex items-center gap-2 text-xs text-cf-muted">
                      <img
                        src={selectedCommit.author.avatar_url}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                      @{selectedCommit.author.login}
                    </div>
                  )}
                  <a
                    href={selectedCommit.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-cyan inline-flex"
                  >
                    <ExternalLink className="w-4 h-4" /> View on GitHub
                  </a>
                  <p className="text-[11px] text-cf-faint">
                    File-level additions/deletions are shown only when returned by the GitHub API for this
                    endpoint.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {!repoInfo && !loading && !error && (
        <div className="card relative z-10">
          <EmptyState
            icon={Github}
            title="Explore a GitHub repository"
            description="Enter a public repository URL to load metadata, commits, and contributors."
          />
        </div>
      )}
    </div>
  );
}
