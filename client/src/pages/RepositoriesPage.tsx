import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  FolderOpen,
  GitBranch,
  ExternalLink,
  Github,
  Search,
  ChevronDown,
  ChevronRight,
  GitCommit,
  FolderGit2,
  RefreshCw,
} from 'lucide-react';
import {
  Modal,
  Button,
  Input,
  Alert,
  EmptyState,
  PageHeader,
  Badge,
  Table,
  LoadingSpinner,
  Card,
} from '../components/ui';
import { PageBackground, SpiderEmblem } from '../components/shared';
import { useRepoStore } from '../stores/repoStore';
import { repositoriesApi, githubApi } from '../services/api';
import type { Repository, RepoStatus, CommitEntry } from '../types';

const GITHUB_URL_RE =
  /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?(\?.*)?$/i;

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim();
  const match = trimmed.match(/github\.com\/([^/]+)\/([^/.\s?#]+)/i);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, '');
  if (!owner || !repo) return null;
  return { owner, repo };
}

function formatRepoDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

type LocalForm = { name: string; path: string; description: string };
type GithubForm = { url: string; path: string; name: string; description: string };

type RepoDetails = {
  status: RepoStatus | null;
  commits: CommitEntry[];
  loading: boolean;
  error: string | null;
};

export function RepositoriesPage() {
  const navigate = useNavigate();
  const {
    repositories,
    loading,
    error,
    fetchRepositories,
    addRepository,
    selectRepository,
    selectedId,
  } = useRepoStore();

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, RepoDetails>>({});

  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Repository | null>(null);

  const [localForm, setLocalForm] = useState<LocalForm>({ name: '', path: '', description: '' });
  const [localErrors, setLocalErrors] = useState<Partial<Record<keyof LocalForm, string>>>({});
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const [githubForm, setGithubForm] = useState<GithubForm>({
    url: '',
    path: '',
    name: '',
    description: '',
  });
  const [githubErrors, setGithubErrors] = useState<Partial<Record<keyof GithubForm, string>>>({});
  const [githubSubmitting, setGithubSubmitting] = useState(false);
  const [githubPreview, setGithubPreview] = useState<Record<string, unknown> | null>(null);
  const [githubPreviewLoading, setGithubPreviewLoading] = useState(false);

  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  useEffect(() => {
    void fetchRepositories();
  }, [fetchRepositories]);

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repositories;
    return repositories.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false) ||
        (r.github_owner?.toLowerCase().includes(q) ?? false) ||
        (r.github_repo?.toLowerCase().includes(q) ?? false),
    );
  }, [repositories, search]);

  const loadRepoDetails = useCallback(async (id: string) => {
    setDetailsById((prev) => ({
      ...prev,
      [id]: {
        status: prev[id]?.status ?? null,
        commits: prev[id]?.commits ?? [],
        loading: true,
        error: null,
      },
    }));

    const [statusRes, commitsRes] = await Promise.allSettled([
      repositoriesApi.status(id),
      repositoriesApi.commits(id, 8),
    ]);

    let status: RepoStatus | null = null;
    let commits: CommitEntry[] = [];
    let err: string | null = null;

    if (statusRes.status === 'fulfilled' && statusRes.value.success) {
      status = statusRes.value.data as RepoStatus;
    } else if (statusRes.status === 'fulfilled') {
      err = statusRes.value.error?.message ?? 'Failed to load repository status';
    } else {
      err = 'Failed to load repository status';
    }

    if (commitsRes.status === 'fulfilled' && commitsRes.value.success) {
      commits = (commitsRes.value.data as CommitEntry[]) ?? [];
    }

    setDetailsById((prev) => ({
      ...prev,
      [id]: { status, commits, loading: false, error: err },
    }));
  }, []);

  function toggleExpand(id: string) {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    selectRepository(id);
    if (next && !detailsById[id]?.status && !detailsById[id]?.loading) {
      void loadRepoDetails(id);
    }
  }

  function validateLocalForm(): boolean {
    const errs: Partial<Record<keyof LocalForm, string>> = {};
    if (!localForm.path.trim()) errs.path = 'Absolute path is required';
    else if (localForm.path.trim().length < 2) errs.path = 'Enter a valid filesystem path';
    if (localForm.name.trim().length > 120) errs.name = 'Name must be 120 characters or fewer';
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleLocalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateLocalForm()) return;
    setLocalSubmitting(true);
    try {
      await addRepository(
        localForm.path.trim(),
        localForm.name.trim() || undefined,
        localForm.description.trim() || undefined,
      );
      toast.success('Repository registered');
      setLocalModalOpen(false);
      setLocalForm({ name: '', path: '', description: '' });
      setLocalErrors({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register repository';
      toast.error(msg);
    } finally {
      setLocalSubmitting(false);
    }
  }

  function validateGithubUrl(url: string): string | undefined {
    const trimmed = url.trim();
    if (!trimmed) return 'GitHub URL is required';
    if (!GITHUB_URL_RE.test(trimmed) && !parseGithubUrl(trimmed)) {
      return 'Enter a valid GitHub repository URL (https://github.com/owner/repo)';
    }
    return undefined;
  }

  async function handleGithubPreview() {
    const urlErr = validateGithubUrl(githubForm.url);
    if (urlErr) {
      setGithubErrors({ url: urlErr });
      return;
    }
    setGithubErrors({});
    setGithubPreviewLoading(true);
    setGithubPreview(null);
    const res = await githubApi.repo(githubForm.url.trim());
    setGithubPreviewLoading(false);
    if (!res.success) {
      toast.error(res.error?.message ?? 'Could not fetch repository metadata');
      return;
    }
    setGithubPreview(res.data as Record<string, unknown>);
    const parsed = parseGithubUrl(githubForm.url);
    if (parsed && !githubForm.name.trim()) {
      setGithubForm((f) => ({ ...f, name: parsed.repo }));
    }
    toast.success('GitHub metadata loaded');
  }

  async function handleGithubImport(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<keyof GithubForm, string>> = {};
    const urlErr = validateGithubUrl(githubForm.url);
    if (urlErr) errs.url = urlErr;
    if (!githubForm.path.trim()) {
      errs.path =
        'Local path is required — clone or copy the repo on disk, then register that folder';
    }
    if (githubForm.name.trim().length > 120) errs.name = 'Name must be 120 characters or fewer';
    setGithubErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setGithubSubmitting(true);
    try {
      const res = await repositoriesApi.register({
        path: githubForm.path.trim(),
        name: githubForm.name.trim() || undefined,
        description: githubForm.description.trim() || undefined,
      });
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Registration failed');
      }
      toast.success('Repository registered from local path');
      setGithubModalOpen(false);
      setGithubForm({ url: '', path: '', name: '', description: '' });
      setGithubPreview(null);
      setGithubErrors({});
      await fetchRepositories();
      const repo = res.data as Repository;
      selectRepository(repo.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register repository';
      toast.error(msg);
    } finally {
      setGithubSubmitting(false);
    }
  }

  function openGitStudio(repo: Repository) {
    selectRepository(repo.id);
    navigate('/git');
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setRemoveSubmitting(true);
    const res = await repositoriesApi.remove(removeTarget.id);
    setRemoveSubmitting(false);
    if (res.success) {
      const removedId = removeTarget.id;
      if (selectedId === removedId) selectRepository(null);
      if (expandedId === removedId) setExpandedId(null);
      await fetchRepositories();
      toast.success(`Removed “${removeTarget.name}” from CódigoFlow`);
      setRemoveTarget(null);
    } else {
      toast.error(res.error?.message ?? 'Failed to remove repository');
    }
  }

  function resetLocalModal() {
    setLocalModalOpen(false);
    setLocalForm({ name: '', path: '', description: '' });
    setLocalErrors({});
  }

  function resetGithubModal() {
    setGithubModalOpen(false);
    setGithubForm({ url: '', path: '', name: '', description: '' });
    setGithubErrors({});
    setGithubPreview(null);
  }

  return (
    <div className="page-shell relative space-y-6 animate-fade-in">
      <PageBackground />

      <div className="relative z-10">
      <PageHeader
        title="Repositories"
        description="Register local Git folders, inspect status, and open Git Studio"
        action={
          <>
            <Button variant="secondary" onClick={() => void fetchRepositories()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => setGithubModalOpen(true)}>
              <Github className="w-4 h-4" />
              Import from GitHub
            </Button>
            <Button variant="primary" onClick={() => setLocalModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Add local repository
            </Button>
          </>
        }
      />
      </div>

      <div className="relative z-10">
        <Input
          label="Search repositories"
          placeholder="Filter by name or path…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {error && (
        <div className="relative z-10">
          <Alert variant="error" title="Could not load repositories">
            {error}
          </Alert>
        </div>
      )}

      {loading && repositories.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-20 gap-3">
          <LoadingSpinner size="lg" />
          <span className="text-sm text-cf-muted">Loading repositories…</span>
        </div>
      ) : repositories.length === 0 ? (
        <Card className="relative z-10">
          <EmptyState
            icon={FolderGit2}
            title="No repositories registered"
            description="Add a folder on disk that already contains a .git directory. CódigoFlow does not delete files when you remove a registration."
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="primary" onClick={() => setLocalModalOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Add local repository
                </Button>
                <Button variant="secondary" onClick={() => setGithubModalOpen(true)}>
                  <Github className="w-4 h-4" />
                  Import from GitHub
                </Button>
              </div>
            }
          />
        </Card>
      ) : filteredRepos.length === 0 ? (
        <Card className="relative z-10">
          <EmptyState
            icon={Search}
            title="No matches"
            description={`No repositories match “${search.trim()}”.`}
            action={
              <Button variant="ghost" onClick={() => setSearch('')}>
                Clear search
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="relative z-10 p-0 overflow-hidden">
          <Table>
            <thead>
              <tr>
                <th className="w-8" aria-label="Expand" />
                <th>Name</th>
                <th className="hidden lg:table-cell">Path</th>
                <th className="hidden md:table-cell">GitHub</th>
                <th className="hidden sm:table-cell">Added</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRepos.map((repo) => {
                const expanded = expandedId === repo.id;
                const isSelected = selectedId === repo.id;
                const details = detailsById[repo.id];

                return (
                  <RepoTableSection
                    key={repo.id}
                    repo={repo}
                    expanded={expanded}
                    isSelected={isSelected}
                    details={details}
                    onToggle={() => toggleExpand(repo.id)}
                    onOpenGitStudio={() => openGitStudio(repo)}
                    onRemove={() => setRemoveTarget(repo)}
                    onRefreshDetails={() => void loadRepoDetails(repo.id)}
                  />
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <div className="relative z-10 flex items-center gap-2 text-xs text-cf-faint pb-2">
        <SpiderEmblem size={18} />
        <span>
          Registering only links CódigoFlow to a folder on your machine — removing a registration never deletes
          repository files.
        </span>
      </div>

      {/* Add local modal */}
      <Modal open={localModalOpen} onClose={resetLocalModal} title="Add local repository" size="lg">
        <form onSubmit={(e) => void handleLocalSubmit(e)} className="space-y-4">
          <Alert variant="info">
            The path must point to an existing Git repository (a <code className="font-mono text-cf-cyan">.git</code>{' '}
            folder).
          </Alert>
          <Input
            label="Absolute path *"
            placeholder="e.g. D:\Projects\my-app"
            value={localForm.path}
            error={localErrors.path}
            onChange={(e) => setLocalForm((f) => ({ ...f, path: e.target.value }))}
            disabled={localSubmitting}
            autoComplete="off"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Display name"
              placeholder="Auto-detected from folder name"
              value={localForm.name}
              error={localErrors.name}
              onChange={(e) => setLocalForm((f) => ({ ...f, name: e.target.value }))}
              disabled={localSubmitting}
            />
            <Input
              label="Description"
              placeholder="Optional"
              value={localForm.description}
              onChange={(e) => setLocalForm((f) => ({ ...f, description: e.target.value }))}
              disabled={localSubmitting}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={resetLocalModal} disabled={localSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={localSubmitting}>
              Register repository
            </Button>
          </div>
        </form>
      </Modal>

      {/* GitHub import modal */}
      <Modal open={githubModalOpen} onClose={resetGithubModal} title="Import from GitHub" size="lg">
        <form onSubmit={(e) => void handleGithubImport(e)} className="space-y-4">
          <Alert variant="warning" title="Clone on disk first">
            CódigoFlow registers <strong className="font-medium">local</strong> Git folders only. Clone or copy the
            GitHub repository to your machine, then provide that folder path below. We can preview metadata from GitHub
            before you register.
          </Alert>

          <Input
            label="GitHub repository URL *"
            placeholder="https://github.com/owner/repository"
            value={githubForm.url}
            error={githubErrors.url}
            onChange={(e) => setGithubForm((f) => ({ ...f, url: e.target.value }))}
            disabled={githubSubmitting}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleGithubPreview()}
              loading={githubPreviewLoading}
              disabled={githubSubmitting}
            >
              <Search className="w-4 h-4" />
              Preview metadata
            </Button>
          </div>

          {githubPreview && (
            <div className="rounded-lg border border-cf-border bg-cf-navy/40 p-3 text-sm space-y-1">
              <div className="font-medium text-cf-text">
                {(githubPreview.full_name as string) ?? (githubPreview.name as string) ?? 'Repository'}
              </div>
              {typeof githubPreview.description === 'string' && githubPreview.description && (
                <p className="text-cf-muted text-xs">{githubPreview.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-cf-faint">
                {typeof githubPreview.stargazers_count === 'number' && (
                  <Badge variant="muted">★ {githubPreview.stargazers_count}</Badge>
                )}
                {typeof githubPreview.language === 'string' && (
                  <Badge variant="info">{githubPreview.language}</Badge>
                )}
                {typeof githubPreview.default_branch === 'string' && (
                  <Badge variant="violet">default: {githubPreview.default_branch}</Badge>
                )}
              </div>
            </div>
          )}

          <Input
            label="Local folder path *"
            placeholder="Path where you cloned the repository"
            value={githubForm.path}
            error={githubErrors.path}
            onChange={(e) => setGithubForm((f) => ({ ...f, path: e.target.value }))}
            disabled={githubSubmitting}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Display name"
              placeholder="Optional"
              value={githubForm.name}
              error={githubErrors.name}
              onChange={(e) => setGithubForm((f) => ({ ...f, name: e.target.value }))}
              disabled={githubSubmitting}
            />
            <Input
              label="Description"
              placeholder="Optional"
              value={githubForm.description}
              onChange={(e) => setGithubForm((f) => ({ ...f, description: e.target.value }))}
              disabled={githubSubmitting}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={resetGithubModal} disabled={githubSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={githubSubmitting}>
              Register local copy
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove confirmation */}
      <Modal
        open={removeTarget !== null}
        onClose={() => !removeSubmitting && setRemoveTarget(null)}
        title="Remove registration?"
        size="sm"
      >
        {removeTarget && (
          <div className="space-y-4">
            <p className="text-sm text-cf-muted">
              Remove <span className="text-cf-text font-medium">{removeTarget.name}</span> from CódigoFlow?
            </p>
            <Alert variant="warning" title="Files stay on disk">
              This only removes the registration in CódigoFlow. Nothing is deleted from{' '}
              <code className="font-mono text-xs text-cf-cyan break-all">{removeTarget.path}</code>.
            </Alert>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setRemoveTarget(null)}
                disabled={removeSubmitting}
              >
                Cancel
              </Button>
              <Button variant="danger" loading={removeSubmitting} onClick={() => void handleConfirmRemove()}>
                <Trash2 className="w-4 h-4" />
                Remove registration
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function RepoTableSection({
  repo,
  expanded,
  isSelected,
  details,
  onToggle,
  onOpenGitStudio,
  onRemove,
  onRefreshDetails,
}: {
  repo: Repository;
  expanded: boolean;
  isSelected: boolean;
  details?: RepoDetails;
  onToggle: () => void;
  onOpenGitStudio: () => void;
  onRemove: () => void;
  onRefreshDetails: () => void;
}) {
  return (
    <>
      <tr
        className={isSelected ? 'bg-cf-cyan/5' : undefined}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <td className="text-cf-faint">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </td>
        <td>
          <div className="flex items-center gap-2 min-w-0">
            <FolderIcon selected={isSelected} />
            <div className="min-w-0">
              <div className="font-medium text-cf-text truncate">{repo.name}</div>
              {repo.description && (
                <div className="text-xs text-cf-faint truncate max-w-xs">{repo.description}</div>
              )}
            </div>
          </div>
        </td>
        <td className="hidden lg:table-cell">
          <span className="font-mono text-xs text-cf-muted truncate max-w-[240px] inline-block" title={repo.path}>
            {repo.path}
          </span>
        </td>
        <td className="hidden md:table-cell">
          {repo.github_owner && repo.github_repo ? (
            <Badge variant="info">
              {repo.github_owner}/{repo.github_repo}
            </Badge>
          ) : repo.remote_url ? (
            <span className="text-xs text-cf-faint truncate max-w-[140px] inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3 shrink-0" />
              remote
            </span>
          ) : (
            <span className="text-xs text-cf-faint">—</span>
          )}
        </td>
        <td className="hidden sm:table-cell text-xs text-cf-faint whitespace-nowrap">
          {formatRepoDate(repo.created_at)}
        </td>
        <td className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-1">
            <Button variant="cyan" size="sm" onClick={onOpenGitStudio} title="Open Git Studio">
              <GitBranch className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Git Studio</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove} title="Remove registration" aria-label={`Remove ${repo.name}`}>
              <Trash2 className="w-3.5 h-3.5 text-cf-error" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-cf-navy/30 border-t border-cf-border/50">
            <RepoDetailsPanel repo={repo} details={details} isSelected={isSelected} onRefresh={onRefreshDetails} />
          </td>
        </tr>
      )}
    </>
  );
}

function FolderIcon({ selected }: { selected: boolean }) {
  return (
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
        selected ? 'bg-cf-cyan/20 border-cf-cyan/40' : 'bg-cf-elevated border-cf-border'
      }`}
    >
      <FolderOpen className={`w-4 h-4 ${selected ? 'text-cf-cyan' : 'text-cf-muted'}`} />
    </div>
  );
}

function RepoDetailsPanel({
  repo,
  details,
  isSelected,
  onRefresh,
}: {
  repo: Repository;
  details?: RepoDetails;
  isSelected: boolean;
  onRefresh: () => void;
}) {
  const loading = details?.loading ?? true;
  const status = details?.status;
  const commits = details?.commits ?? [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FolderIcon selected={isSelected} />
          <span className="text-sm font-medium text-cf-text truncate">{repo.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs text-cf-muted">
          <GitBranch className="w-3.5 h-3.5 text-cf-cyan" />
          {loading ? (
            <span>Loading status…</span>
          ) : status ? (
            <>
              <Badge variant="violet">{status.branch}</Badge>
              {(status.ahead > 0 || status.behind > 0) && (
                <Badge variant="muted">
                  {status.ahead > 0 && `↑${status.ahead} `}
                  {status.behind > 0 && `↓${status.behind}`}
                </Badge>
              )}
              <span>
                {status.staged.length} staged · {status.unstaged.length} modified · {status.untracked.length} untracked
              </span>
            </>
          ) : (
            <span className="text-cf-error">{details?.error ?? 'Status unavailable'}</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {repo.remote_url && (
        <div className="text-xs text-cf-faint flex items-center gap-1.5">
          <ExternalLink className="w-3 h-3" />
          <span className="font-mono truncate">{repo.remote_url}</span>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-cf-muted mb-2 flex items-center gap-1.5">
          <GitCommit className="w-3.5 h-3.5" />
          Recent commits
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="md" />
          </div>
        ) : commits.length === 0 ? (
          <p className="text-xs text-cf-faint">No commits returned for this repository.</p>
        ) : (
          <ul className="space-y-2">
            {commits.map((c) => (
              <li
                key={c.hash}
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs border border-cf-border/60 rounded-lg px-3 py-2 bg-cf-card/50"
              >
                <code className="font-mono text-cf-cyan shrink-0">{c.shortHash}</code>
                <span className="text-cf-text flex-1 truncate">{c.message}</span>
                <span className="text-cf-faint shrink-0">
                  {c.author} · {new Date(c.date).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
