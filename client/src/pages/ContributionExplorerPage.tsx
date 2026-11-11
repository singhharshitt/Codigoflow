import { useState } from 'react';
import { Github, Users, GitCommit, Search, ExternalLink } from 'lucide-react';
import { githubApi } from '../services/api';
import { Alert, PageHeader, LoadingSpinner, EmptyState } from '../components/ui';
import type { GitHubCommit, GitHubContributor } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function ContributionExplorerPage() {
  const [url, setUrl] = useState('');
  const [repoInfo, setRepoInfo] = useState<Record<string, unknown> | null>(null);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [contributors, setContributors] = useState<GitHubContributor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch() {
    if (!url.trim()) return;
    setLoading(true); setError(''); setRepoInfo(null); setCommits([]); setContributors([]);

    const repoRes = await githubApi.repo(url);
    if (!repoRes.success) {
      setError(repoRes.error?.message ?? 'Failed to fetch repository');
      setLoading(false);
      return;
    }
    setRepoInfo(repoRes.data as Record<string, unknown>);

    // Parse owner/repo from URL
    const match = url.match(/github\.com\/([^/]+)\/([^/.\s]+)/);
    if (match) {
      const [, owner, repo] = match;
      const [commitsRes, contributorsRes] = await Promise.allSettled([
        githubApi.commits(owner, repo),
        githubApi.contributors(owner, repo),
      ]);
      if (commitsRes.status === 'fulfilled' && commitsRes.value.success)
        setCommits((commitsRes.value.data as GitHubCommit[]) ?? []);
      if (contributorsRes.status === 'fulfilled' && contributorsRes.value.success)
        setContributors((contributorsRes.value.data as GitHubContributor[]) ?? []);
    }

    setLoading(false);
  }

  const chartData = contributors.slice(0, 10).map((c) => ({
    name: c.login,
    contributions: c.contributions,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Contribution Explorer"
        description="Explore GitHub repository activity and contributors"
      />

      {/* Search */}
      <div className="card">
        <div className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="https://github.com/owner/repository"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            id="github-url-input"
          />
          <button onClick={handleSearch} disabled={loading} className="btn-primary">
            {loading ? <LoadingSpinner size="sm" /> : <Search className="w-4 h-4" />}
            Explore
          </button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading && <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>}

      {repoInfo && (
        <>
          {/* Repo info */}
          <div className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Github className="w-5 h-5 text-gray-400" />
                  <span className="text-lg font-bold text-white">
                    {String(repoInfo.full_name ?? '')}
                  </span>
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {String(repoInfo.description ?? 'No description')}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span>⭐ {String(repoInfo.stargazers_count ?? 0)}</span>
                  <span>🍴 {String(repoInfo.forks_count ?? 0)}</span>
                  <span>👁 {String(repoInfo.watchers_count ?? 0)}</span>
                  <span>🔀 {String(repoInfo.default_branch ?? 'main')}</span>
                </div>
              </div>
              <a
                href={String(repoInfo.html_url ?? '')}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs flex-shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View on GitHub
              </a>
            </div>
          </div>

          {/* Contributor chart */}
          {chartData.length > 0 && (
            <div className="card">
              <div className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Top Contributors
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1c2333', border: '1px solid #30363d', borderRadius: 8 }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Bar dataKey="contributions" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent commits */}
          {commits.length > 0 && (
            <div className="card">
              <div className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-brand-400" />
                Recent Commits
              </div>
              <div className="space-y-2">
                {commits.slice(0, 15).map((c) => (
                  <a
                    key={c.sha}
                    href={c.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors group"
                  >
                    {c.author?.avatar_url && (
                      <img src={c.author.avatar_url} alt={c.author.login} className="w-6 h-6 rounded-full flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-200 group-hover:text-white truncate">
                        {c.commit.message.split('\n')[0]}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        <span className="font-mono">{c.sha.slice(0, 7)}</span>
                        {' · '}{c.commit.author.name}
                        {' · '}{new Date(c.commit.author.date).toLocaleDateString()}
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Contributors list */}
          {contributors.length > 0 && (
            <div className="card">
              <div className="text-sm font-semibold text-gray-200 mb-4">All Contributors</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {contributors.map((c) => (
                  <a
                    key={c.login}
                    href={c.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <img src={c.avatar_url} alt={c.login} className="w-8 h-8 rounded-full" />
                    <div>
                      <div className="text-xs font-medium text-gray-200">{c.login}</div>
                      <div className="text-[10px] text-gray-500">{c.contributions} commits</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!repoInfo && !loading && (
        <div className="card">
          <EmptyState
            icon={Github}
            title="Enter a GitHub repository URL"
            description="Paste any public GitHub repository URL to explore commits and contributors."
          />
        </div>
      )}
    </div>
  );
}
