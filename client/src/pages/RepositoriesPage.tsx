import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  FolderOpen,
  GitBranch,
  ExternalLink,
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
import { repositoriesApi } from '../services/api';
import { AddRepositoryModal } from '../features/repositories/AddRepositoryModal';
import type { Repository, RepoStatus, CommitEntry } from '../types';

function formatRepoDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

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
    selectRepository,
    selectedId,
  } = useRepoStore();

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, RepoDetails>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Repository | null>(null);
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

  async function handleRegistered(repo: Repository) {
    selectRepository(repo.id);
    await fetchRepositories();
  }

  return (
    <div className="page-shell relative space-y-6 animate-fade-in">
      <PageBackground />

      <div className="relative z-10">
      <PageHeader
        title="Repositories"
        description="Clone from GitHub or register an existing local Git folder, then open Git Studio"
        action={
          <>
            <Button variant="secondary" onClick={() => void fetchRepositories()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />
              Add repository
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
            description="Clone a GitHub repository to this machine or register an existing local Git folder. Removing a registration never deletes files."
            action={
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4" />
                Add repository
              </Button>
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

      <AddRepositoryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingPaths={repositories.map((r) => r.path)}
        onRegistered={(repo) => void handleRegistered(repo)}
      />

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
