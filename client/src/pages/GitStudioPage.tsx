import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GitBranch,
  GitCommit,
  RefreshCw,
  FileCode,
  Search,
  CheckSquare,
  Square,
  MinusCircle,
  PlusCircle,
  Upload,
  Sparkles,
  FolderGit2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageBackground } from '../components/shared';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
} from '../components/ui';
import { repositoriesApi, aiApi } from '../services/api';
import { useRepoStore } from '../stores/repoStore';
import type { ApiResponse, BranchInfo, CommitEntry, RepoStatus } from '../types';

// ── Diff parsing ─────────────────────────────────────────────────────────────

type DiffLineKind = 'hunk' | 'add' | 'del' | 'ctx' | 'meta';

interface ParsedDiffLine {
  kind: DiffLineKind;
  text: string;
  oldNo?: number;
  newNo?: number;
}

function parseUnifiedDiff(raw: string): ParsedDiffLine[] {
  const lines = raw.split('\n');
  const result: ParsedDiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = Number.parseInt(match[1], 10);
        newLine = Number.parseInt(match[2], 10);
      }
      result.push({ kind: 'hunk', text: line });
      continue;
    }
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ')) {
      result.push({ kind: 'meta', text: line });
      continue;
    }
    if (line.startsWith('+')) {
      result.push({ kind: 'add', text: line.slice(1), newNo: newLine });
      newLine += 1;
    } else if (line.startsWith('-')) {
      result.push({ kind: 'del', text: line.slice(1), oldNo: oldLine });
      oldLine += 1;
    } else if (line.startsWith(' ') || line === '') {
      const body = line.startsWith(' ') ? line.slice(1) : line;
      result.push({ kind: 'ctx', text: body, oldNo: oldLine, newNo: newLine });
      oldLine += 1;
      newLine += 1;
    } else {
      result.push({ kind: 'meta', text: line });
    }
  }
  return result;
}

function diffStats(lines: ParsedDiffLine[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const l of lines) {
    if (l.kind === 'add') additions += 1;
    if (l.kind === 'del') deletions += 1;
  }
  return { additions, deletions };
}

// ── File change helpers ────────────────────────────────────────────────────────

type FileChangeStatus = 'staged' | 'modified' | 'untracked';

interface ChangedFile {
  path: string;
  status: FileChangeStatus;
}

function apiErrorMessage(res: ApiResponse<unknown>, fallback: string): string {
  return res.error?.message ?? fallback;
}

function hasUncommittedChanges(status: RepoStatus | null): boolean {
  if (!status) return false;
  return status.staged.length + status.unstaged.length + status.untracked.length > 0;
}

function buildChangedFiles(status: RepoStatus): ChangedFile[] {
  const staged = status.staged.map((path) => ({ path, status: 'staged' as const }));
  const modified = status.unstaged.map((path) => ({ path, status: 'modified' as const }));
  const untracked = status.untracked.map((path) => ({ path, status: 'untracked' as const }));
  return [...staged, ...modified, ...untracked];
}

function statusBadgeVariant(status: FileChangeStatus): 'success' | 'warning' | 'muted' {
  if (status === 'staged') return 'success';
  if (status === 'modified') return 'warning';
  return 'muted';
}

function statusLabel(status: FileChangeStatus): string {
  if (status === 'staged') return 'Staged';
  if (status === 'modified') return 'Modified';
  return 'Untracked';
}

// ── Diff viewer ──────────────────────────────────────────────────────────────

function DiffViewer({ raw }: { raw: string }) {
  const lines = useMemo(() => parseUnifiedDiff(raw), [raw]);

  if (!raw.trim()) {
    return (
      <p className="text-xs text-cf-faint text-center py-10">No diff content for this file.</p>
    );
  }

  return (
    <div className="rounded-lg border border-cf-border bg-cf-navy/40 overflow-hidden">
      <pre className="text-[11px] font-mono leading-relaxed max-h-[min(52vh,28rem)] overflow-auto">
        {lines.map((line, i) => {
          const rowCls =
            line.kind === 'add'
              ? 'bg-cf-success/10'
              : line.kind === 'del'
                ? 'bg-cf-error/10'
                : line.kind === 'hunk'
                  ? 'bg-cf-cyan/5'
                  : '';

          const textCls =
            line.kind === 'add'
              ? 'text-cf-success'
              : line.kind === 'del'
                ? 'text-cf-error'
                : line.kind === 'hunk'
                  ? 'text-cf-cyan'
                  : 'text-cf-muted';

          return (
            <div key={i} className={`flex ${rowCls}`}>
              <span className="select-none w-10 shrink-0 text-right pr-2 text-cf-faint border-r border-cf-border/50">
                {line.oldNo ?? ''}
              </span>
              <span className="select-none w-10 shrink-0 text-right pr-2 text-cf-faint border-r border-cf-border/50">
                {line.newNo ?? ''}
              </span>
              <span className={`flex-1 px-2 py-px whitespace-pre-wrap break-all ${textCls}`}>
                {line.kind === 'add' && '+'}
                {line.kind === 'del' && '-'}
                {line.kind === 'ctx' && ' '}
                {line.text}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function GitStudioPage() {
  const { repositories, selectedId, selectRepository, fetchRepositories, loading: reposLoading } =
    useRepoStore();

  const selectedRepo = repositories.find((r) => r.id === selectedId);

  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [diff, setDiff] = useState('');
  const [viewedFile, setViewedFile] = useState<ChangedFile | null>(null);
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [fileSearch, setFileSearch] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [aiMessages, setAiMessages] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);
  const [staging, setStaging] = useState(false);
  const [unstaging, setUnstaging] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [loadError, setLoadError] = useState('');

  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);

  useEffect(() => {
    void fetchRepositories();
  }, [fetchRepositories]);

  const loadAll = useCallback(async () => {
    if (!selectedId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');

    const [statusRes, commitsRes, branchesRes] = await Promise.all([
      repositoriesApi.status(selectedId),
      repositoriesApi.commits(selectedId, 20),
      repositoriesApi.branches(selectedId),
    ]);

    const errors: string[] = [];
    if (statusRes.success && statusRes.data) {
      setStatus(statusRes.data);
    } else {
      errors.push(apiErrorMessage(statusRes, 'Failed to load repository status'));
    }
    if (commitsRes.success && commitsRes.data) {
      setCommits(commitsRes.data);
    } else {
      errors.push(apiErrorMessage(commitsRes, 'Failed to load commits'));
    }
    if (branchesRes.success && branchesRes.data) {
      setBranches(branchesRes.data);
    } else {
      errors.push(apiErrorMessage(branchesRes, 'Failed to load branches'));
    }

    if (errors.length > 0) {
      setLoadError(errors[0]);
      toast.error(errors[0]);
    }

    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    setCheckedFiles(new Set());
    setViewedFile(null);
    setDiff('');
    setCommitMsg('');
    setAiMessages([]);
    void loadAll();
  }, [selectedId, loadAll]);

  const changedFiles = useMemo(() => (status ? buildChangedFiles(status) : []), [status]);

  const filteredFiles = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    if (!q) return changedFiles;
    return changedFiles.filter((f) => f.path.toLowerCase().includes(q));
  }, [changedFiles, fileSearch]);

  const parsedDiff = useMemo(() => parseUnifiedDiff(diff), [diff]);
  const viewedStats = useMemo(() => diffStats(parsedDiff), [parsedDiff]);

  const checkedStaged = useMemo(() => {
    if (!status) return [];
    return Array.from(checkedFiles).filter((p) => status.staged.includes(p));
  }, [checkedFiles, status]);

  const checkedUnstaged = useMemo(() => {
    if (!status) return [];
    return Array.from(checkedFiles).filter(
      (p) => status.unstaged.includes(p) || status.untracked.includes(p),
    );
  }, [checkedFiles, status]);

  async function viewFileDiff(file: ChangedFile) {
    if (!selectedId) return;
    setViewedFile(file);
    setDiffLoading(true);
    const res = await repositoriesApi.diff(selectedId, file.path);
    setDiffLoading(false);
    if (res.success && res.data) {
      setDiff(res.data.diff);
    } else {
      setDiff('');
      toast.error(apiErrorMessage(res, 'Failed to load diff'));
    }
  }

  function toggleChecked(path: string) {
    setCheckedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function handleStageSelected() {
    if (!selectedId || checkedUnstaged.length === 0) return;
    setStaging(true);
    const res = await repositoriesApi.stage(selectedId, checkedUnstaged);
    setStaging(false);
    if (res.success) {
      toast.success(`Staged ${checkedUnstaged.length} file(s)`);
      setCheckedFiles(new Set());
      await loadAll();
      if (viewedFile && checkedUnstaged.includes(viewedFile.path)) {
        await viewFileDiff({ ...viewedFile, status: 'staged' });
      }
    } else {
      toast.error(apiErrorMessage(res, 'Stage failed'));
    }
  }

  async function handleUnstageSelected() {
    if (!selectedId || checkedStaged.length === 0) return;
    setUnstaging(true);
    const res = await repositoriesApi.unstage(selectedId, checkedStaged);
    setUnstaging(false);
    if (res.success) {
      toast.success(`Unstaged ${checkedStaged.length} file(s)`);
      setCheckedFiles(new Set());
      await loadAll();
    } else {
      toast.error(apiErrorMessage(res, 'Unstage failed'));
    }
  }

  async function handleGenerateAiMessages() {
    if (!selectedId) return;
    setAiLoading(true);
    setAiMessages([]);
    const diffRes = await repositoriesApi.diff(selectedId);
    if (!diffRes.success || !diffRes.data?.diff?.trim()) {
      setAiLoading(false);
      toast.error(
        diffRes.success
          ? 'No changes to summarize. Make edits or stage files first.'
          : apiErrorMessage(diffRes, 'Failed to load diff for AI'),
      );
      return;
    }
    const aiRes = await aiApi.commitMessages(diffRes.data.diff);
    setAiLoading(false);
    if (aiRes.success && aiRes.data?.messages) {
      setAiMessages(aiRes.data.messages.slice(0, 3));
    } else {
      toast.error(apiErrorMessage(aiRes, 'AI commit message generation failed'));
    }
  }

  async function confirmCommit() {
    if (!selectedId || !commitMsg.trim()) return;
    setCommitting(true);
    const res = await repositoriesApi.commit(selectedId, commitMsg.trim());
    setCommitting(false);
    setCommitModalOpen(false);
    if (res.success) {
      toast.success('Commit created');
      setCommitMsg('');
      setAiMessages([]);
      await loadAll();
    } else {
      toast.error(apiErrorMessage(res, 'Commit failed'));
    }
  }

  async function confirmPush() {
    if (!selectedId || !status) return;
    setPushing(true);
    const res = await repositoriesApi.push(selectedId, 'origin', status.branch);
    setPushing(false);
    setPushModalOpen(false);
    if (res.success) {
      toast.success(`Pushed to origin/${status.branch}`);
      await loadAll();
    } else {
      toast.error(apiErrorMessage(res, 'Push failed'));
    }
  }

  function requestBranchSwitch(branch: string) {
    if (!status || branch === status.branch) return;
    if (hasUncommittedChanges(status)) {
      setPendingBranch(branch);
      setCheckoutModalOpen(true);
      return;
    }
    void performCheckout(branch);
  }

  async function performCheckout(branch: string) {
    if (!selectedId) return;
    setCheckoutLoading(true);
    const res = await repositoriesApi.checkout(selectedId, branch);
    setCheckoutLoading(false);
    setCheckoutModalOpen(false);
    setPendingBranch(null);
    if (res.success) {
      toast.success(`Checked out ${branch}`);
      setCheckedFiles(new Set());
      setViewedFile(null);
      setDiff('');
      await loadAll();
    } else {
      toast.error(apiErrorMessage(res, 'Checkout failed'));
    }
  }

  if (!reposLoading && repositories.length === 0) {
    return (
      <div className="relative">
        <PageBackground showWeb={false} showGlow />
        <div className="card mt-4 relative z-10">
          <EmptyState
            icon={FolderGit2}
            title="No repositories"
            description="Register a repository from Repositories to use Git Studio."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 animate-fade-in min-h-[calc(100vh-7rem)]">
      <PageBackground showWeb={false} showGlow />

      <PageHeader
        title="Git Studio"
        description={
          selectedRepo
            ? `Version control for ${selectedRepo.name}`
            : 'Select a repository to begin'
        }
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadAll()}
            disabled={!selectedId || loading}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        }
      />

      {loadError && (
        <Alert variant="error" title="Load error">
          {loadError}
        </Alert>
      )}

      {loading && selectedId ? (
        <div className="flex justify-center py-16 relative z-10">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 min-h-0">
          {/* LEFT — selectors & changes */}
          <aside className="xl:col-span-3 flex flex-col gap-3 min-h-0">
            <div className="card space-y-3">
              <Select
                label="Repository"
                value={selectedId ?? ''}
                onChange={(e) => selectRepository(e.target.value || null)}
              >
                <option value="">Select repository…</option>
                {repositories.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>

              {status && (
                <Select
                  label="Branch"
                  value={status.branch}
                  disabled={checkoutLoading}
                  onChange={(e) => requestBranchSwitch(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                      {b.current ? ' (current)' : ''}
                    </option>
                  ))}
                </Select>
              )}

              {status && (status.ahead > 0 || status.behind > 0) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {status.ahead > 0 && <Badge variant="info">{status.ahead} ahead</Badge>}
                  {status.behind > 0 && <Badge variant="warning">{status.behind} behind</Badge>}
                </div>
              )}
            </div>

            <div className="card flex flex-col min-h-[280px] xl:min-h-0 xl:flex-1 gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-cf-text">Changed files</span>
                <Badge variant="muted">{changedFiles.length}</Badge>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cf-faint" />
                <input
                  type="search"
                  placeholder="Filter paths…"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  className="input pl-8 text-xs font-mono"
                  aria-label="Search changed files"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  disabled={checkedUnstaged.length === 0 || staging}
                  loading={staging}
                  onClick={() => void handleStageSelected()}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Stage ({checkedUnstaged.length})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  disabled={checkedStaged.length === 0 || unstaging}
                  loading={unstaging}
                  onClick={() => void handleUnstageSelected()}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  Unstage ({checkedStaged.length})
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-0.5 min-h-[12rem] max-h-[40vh] xl:max-h-none">
                {filteredFiles.length === 0 ? (
                  <p className="text-xs text-cf-faint text-center py-6">
                    {changedFiles.length === 0 ? 'Working tree clean' : 'No paths match filter'}
                  </p>
                ) : (
                  filteredFiles.map((file) => {
                    const isViewed = viewedFile?.path === file.path;
                    const isChecked = checkedFiles.has(file.path);
                    return (
                      <div
                        key={`${file.status}:${file.path}`}
                        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg border border-transparent transition-colors ${
                          isViewed ? 'bg-cf-cyan/10 border-cf-cyan/20' : 'hover:bg-cf-elevated'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleChecked(file.path)}
                          className="shrink-0 text-cf-faint hover:text-cf-cyan"
                          aria-label={isChecked ? 'Deselect file' : 'Select file'}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-cf-cyan" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void viewFileDiff(file)}
                          className="flex-1 min-w-0 text-left flex items-center gap-2"
                        >
                          <Badge variant={statusBadgeVariant(file.status)}>{statusLabel(file.status)}</Badge>
                          <span className="font-mono text-[11px] text-cf-muted truncate">{file.path}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          {/* CENTER — diff */}
          <section className="xl:col-span-5 flex flex-col gap-3 min-h-0">
            <div className="card flex flex-col flex-1 min-h-[320px] gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode className="w-4 h-4 text-cf-cyan shrink-0" />
                  <DiffPanelTitle viewedFile={viewedFile} />
                </div>
                {viewedFile && (
                  <div className="flex gap-2 text-xs font-mono shrink-0">
                    <span className="text-cf-success">+{viewedStats.additions}</span>
                    <span className="text-cf-error">-{viewedStats.deletions}</span>
                  </div>
                )}
              </div>

              {viewedFile && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-b border-cf-border pb-3">
                  <div>
                    <dt className="text-cf-faint">Path</dt>
                    <dd className="font-mono text-cf-muted truncate" title={viewedFile.path}>
                      {viewedFile.path}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-cf-faint">Status</dt>
                    <dd>
                      <Badge variant={statusBadgeVariant(viewedFile.status)}>{statusLabel(viewedFile.status)}</Badge>
                    </dd>
                  </div>
                </dl>
              )}

              {diffLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : viewedFile ? (
                <DiffViewer raw={diff} />
              ) : (
                <EmptyState
                  icon={FileCode}
                  title="Select a file"
                  description="Choose a changed file on the left to inspect its unified diff."
                />
              )}
            </div>
          </section>

          {/* RIGHT — commit & history */}
          <aside className="xl:col-span-4 flex flex-col gap-3 min-h-0">
            <div className="card space-y-4">
              <CommitSectionHeader />

              <div>
                <label htmlFor="commit-message" className="block text-xs text-cf-muted mb-1.5">
                  Commit message
                </label>
                <textarea
                  id="commit-message"
                  className="input resize-none font-mono text-xs min-h-[88px]"
                  rows={4}
                  placeholder="Describe your changes…"
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-cf-violet w-full justify-start"
                loading={aiLoading}
                disabled={!selectedId}
                onClick={() => void handleGenerateAiMessages()}
              >
                <Sparkles className="w-4 h-4" />
                Generate 3 AI suggestions
              </Button>

              {aiMessages.length > 0 && (
                <ul className="space-y-1.5" aria-label="AI commit suggestions">
                  {aiMessages.map((msg, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setCommitMsg(msg)}
                        className="w-full text-left text-xs p-2.5 rounded-lg border border-cf-violet/25 bg-cf-violet/10 hover:bg-cf-violet/15 text-cf-text transition-colors"
                      >
                        {msg}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!commitMsg.trim() || !(status && status.staged.length > 0)}
                  onClick={() => setCommitModalOpen(true)}
                >
                  <GitCommit className="w-4 h-4" />
                  Commit…
                </Button>
                <Button
                  variant="cyan"
                  size="sm"
                  disabled={!status || status.ahead === 0}
                  onClick={() => setPushModalOpen(true)}
                >
                  <Upload className="w-4 h-4" />
                  Push…
                </Button>
              </div>

              {status && status.staged.length === 0 && (
                <p className="text-[10px] text-cf-faint flex items-center gap-1">
                  Stage files before committing. Files are never auto-staged.
                </p>
              )}
            </div>

            <div className="card flex flex-col min-h-[200px] xl:flex-1 gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-cf-text">
                <GitCommit className="w-4 h-4 text-cf-faint" />
                Recent commits
              </div>
              <ul className="flex-1 overflow-y-auto space-y-2 max-h-[40vh] xl:max-h-none">
                {commits.length === 0 ? (
                  <li>
                    <EmptyState icon={GitCommit} title="No commits" />
                  </li>
                ) : (
                  commits.map((c) => (
                    <li
                      key={c.hash}
                      className="p-2.5 rounded-lg border border-cf-border/60 bg-cf-navy/30 hover:bg-cf-elevated/50 transition-colors"
                    >
                      <p className="text-xs text-cf-text line-clamp-2 mb-1">{c.message}</p>
                      <p className="font-mono text-[10px] text-cf-faint">
                        {c.shortHash} · {c.author}
                      </p>
                      <div className="flex gap-2 mt-1 font-mono text-[10px]">
                        {c.insertions > 0 && <span className="text-cf-success">+{c.insertions}</span>}
                        {c.deletions > 0 && <span className="text-cf-error">-{c.deletions}</span>}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* Commit confirmation */}
      <Modal open={commitModalOpen} onClose={() => !committing && setCommitModalOpen(false)} title="Confirm commit">
        <p className="text-sm text-cf-muted mb-3">
          Create a commit on{' '}
          <span className="font-mono text-cf-cyan">{status?.branch}</span> with{' '}
          <strong className="text-cf-text">{status?.staged.length ?? 0}</strong> staged file(s)?
        </p>
        <blockquote className="text-xs font-mono text-cf-text bg-cf-navy/50 border border-cf-border rounded-lg p-3 mb-4 whitespace-pre-wrap">
          {commitMsg.trim() || '(empty message)'}
        </blockquote>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={committing} onClick={() => setCommitModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={committing}
            disabled={!commitMsg.trim()}
            onClick={() => void confirmCommit()}
          >
            Commit
          </Button>
        </div>
      </Modal>

      {/* Push confirmation */}
      <Modal open={pushModalOpen} onClose={() => !pushing && setPushModalOpen(false)} title="Confirm push">
        <p className="text-sm text-cf-muted mb-4">
          Push local commits to{' '}
          <span className="font-mono text-cf-cyan">
            origin/{status?.branch}
          </span>
          ? This uploads your history to the remote.
        </p>
        {status && status.ahead > 0 && (
          <Alert variant="info" className="mb-4">
            {status.ahead} commit(s) will be pushed.
          </Alert>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={pushing} onClick={() => setPushModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="cyan" size="sm" loading={pushing} onClick={() => void confirmPush()}>
            Push
          </Button>
        </div>
      </Modal>

      {/* Branch switch warning */}
      <Modal
        open={checkoutModalOpen}
        onClose={() => !checkoutLoading && setCheckoutModalOpen(false)}
        title="Uncommitted changes"
      >
        <Alert variant="warning" className="mb-4">
          <span className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            You have uncommitted changes. Switching branches may fail or lose work in progress.
          </span>
        </Alert>
        <p className="text-sm text-cf-muted mb-4">
          Switch to <span className="font-mono text-cf-cyan">{pendingBranch}</span> anyway?
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={checkoutLoading}
            onClick={() => {
              setCheckoutModalOpen(false);
              setPendingBranch(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={checkoutLoading}
            onClick={() => pendingBranch && void performCheckout(pendingBranch)}
          >
            Switch branch
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DiffPanelTitle({ viewedFile }: { viewedFile: ChangedFile | null }) {
  return (
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-cf-text">Diff viewer</h2>
      {viewedFile && (
        <p className="font-mono text-[10px] text-cf-faint truncate">{viewedFile.path}</p>
      )}
    </div>
  );
}

function CommitSectionHeader() {
  return (
    <div className="flex items-center gap-2">
      <GitBranch className="w-4 h-4 text-cf-cyan" />
      <span className="text-sm font-semibold text-cf-text">Commit</span>
    </div>
  );
}
