import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Github,
  FolderGit2,
  Search,
  ChevronDown,
  ChevronRight,
  Lock,
  Globe,
  GitBranch,
  Info,
} from 'lucide-react';
import {
  Modal,
  Button,
  Input,
  Badge,
  Tabs,
  LoadingSpinner,
} from '../../components/ui';
import { repositoriesApi, githubApi, type LocalRepoInspect } from '../../services/api';
import type { Repository } from '../../types';

const GITHUB_URL_RE =
  /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?(\.git)?\/?(\?.*)?$/i;

type Workflow = 'clone' | 'local';

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.trim().match(/github\.com\/([^/]+)\/([^/.\s?#]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, '') };
}

function validateGithubUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return 'GitHub URL is required';
  if (!GITHUB_URL_RE.test(trimmed) && !parseGithubUrl(trimmed)) {
    return 'Enter a valid GitHub URL (https://github.com/owner/repo)';
  }
  return undefined;
}

function joinDest(parent: string, folder: string): string {
  const p = parent.replace(/[/\\]+$/, '');
  if (!p) return folder;
  const sep = p.includes('\\') && !p.startsWith('/') ? '\\' : '/';
  return `${p}${sep}${folder}`;
}

export function AddRepositoryModal({
  open,
  onClose,
  existingPaths,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  existingPaths: string[];
  onRegistered: (repo: Repository) => void;
}) {
  const [workflow, setWorkflow] = useState<Workflow>('clone');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Clone workflow
  const [url, setUrl] = useState('');
  const [destParent, setDestParent] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [urlError, setUrlError] = useState<string>();
  const [destError, setDestError] = useState<string>();
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Local workflow
  const [localPath, setLocalPath] = useState('');
  const [localName, setLocalName] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [pathError, setPathError] = useState<string>();
  const [inspect, setInspect] = useState<LocalRepoInspect | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  const parsed = useMemo(() => parseGithubUrl(url), [url]);
  const suggestedFolder = parsed?.repo ?? '';
  const destination = destParent.trim()
    ? joinDest(destParent.trim(), suggestedFolder || 'repository')
    : '';

  const pathAlreadyRegistered = (absPath: string) => {
    const norm = absPath.replace(/\\/g, '/').toLowerCase();
    return existingPaths.some((p) => p.replace(/\\/g, '/').toLowerCase() === norm);
  };

  function reset() {
    setWorkflow('clone');
    setAdvancedOpen(false);
    setUrl('');
    setDestParent('');
    setCloneName('');
    setCloneDescription('');
    setUrlError(undefined);
    setDestError(undefined);
    setPreview(null);
    setLocalPath('');
    setLocalName('');
    setLocalDescription('');
    setPathError(undefined);
    setInspect(null);
  }

  function handleClose() {
    if (cloning || registering) return;
    reset();
    onClose();
  }

  async function handlePreview() {
    const err = validateGithubUrl(url);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError(undefined);
    setPreviewLoading(true);
    setPreview(null);
    const res = await githubApi.repo(url.trim());
    setPreviewLoading(false);
    if (!res.success) {
      const code = res.error?.code;
      if (code === 'RATE_LIMIT') {
        toast.error(res.error?.message ?? 'GitHub rate limit exceeded');
      } else if (code === 'GITHUB_NOT_FOUND') {
        toast.error('Repository not found, private without token, or URL is invalid');
      } else {
        toast.error(res.error?.message ?? 'Could not preview repository');
      }
      return;
    }
    const data = res.data as Record<string, unknown>;
    setPreview(data);
    if (!cloneName.trim() && typeof data.name === 'string') {
      setCloneName(data.name);
    }
    if (!cloneDescription.trim() && typeof data.description === 'string' && data.description) {
      setCloneDescription(data.description);
    }
    toast.success('Repository metadata loaded');
  }

  async function handleClone() {
    const uErr = validateGithubUrl(url);
    if (uErr) {
      setUrlError(uErr);
      return;
    }
    if (!destParent.trim()) {
      setDestError('Choose a parent directory for the clone (absolute path on this machine)');
      return;
    }
    if (!suggestedFolder) {
      setUrlError('Could not derive repository folder name from URL');
      return;
    }
    setUrlError(undefined);
    setDestError(undefined);

    if (pathAlreadyRegistered(destination)) {
      toast.error('That destination path is already registered in CódigoFlow');
      setDestError('Destination already registered');
      return;
    }

    setCloning(true);
    const res = await repositoriesApi.clone({
      url: url.trim().replace(/\.git$/i, ''),
      destination,
      name: cloneName.trim() || undefined,
      description: cloneDescription.trim() || undefined,
    });
    setCloning(false);

    if (!res.success) {
      const code = res.error?.code;
      if (code === 'DEST_NOT_EMPTY') {
        setDestError('Destination folder exists and is not empty');
      } else if (code === 'PATH_NOT_FOUND') {
        setDestError('Parent directory does not exist on the server machine');
      } else if (code === 'CLONE_FAILED') {
        toast.error(res.error?.message ?? 'Clone failed — check URL, permissions, and network');
      } else {
        toast.error(res.error?.message ?? 'Clone failed');
      }
      return;
    }

    toast.success('Repository cloned and registered');
    onRegistered(res.data as Repository);
    reset();
    onClose();
  }

  async function handleInspect() {
    if (!localPath.trim()) {
      setPathError('Absolute path is required');
      return;
    }
    setPathError(undefined);
    setInspectLoading(true);
    setInspect(null);
    const res = await repositoriesApi.inspect(localPath.trim());
    setInspectLoading(false);
    if (!res.success) {
      toast.error(res.error?.message ?? 'Could not inspect path');
      return;
    }
    const data = res.data as LocalRepoInspect;
    setInspect(data);
    if (!localName.trim() && data.nameHint) setLocalName(data.nameHint);
    if (!data.exists) setPathError('Directory does not exist on the server machine');
    else if (!data.isGit) setPathError('Directory exists but is not a Git repository (.git missing)');
    else if (data.alreadyRegistered) setPathError('This repository is already registered');
    else toast.success('Valid Git repository detected');
  }

  async function handleRegisterLocal() {
    if (!localPath.trim()) {
      setPathError('Absolute path is required');
      return;
    }
    if (inspect && (!inspect.exists || !inspect.isGit || inspect.alreadyRegistered)) {
      setPathError(
        !inspect.exists
          ? 'Directory does not exist'
          : !inspect.isGit
            ? 'Not a Git repository'
            : 'Already registered',
      );
      return;
    }
    if (pathAlreadyRegistered(localPath.trim()) || inspect?.alreadyRegistered) {
      setPathError('This repository is already registered');
      toast.error('Duplicate registration blocked');
      return;
    }

    setRegistering(true);
    const res = await repositoriesApi.register({
      path: localPath.trim(),
      name: localName.trim() || undefined,
      description: localDescription.trim() || undefined,
    });
    setRegistering(false);

    if (!res.success) {
      const code = res.error?.code;
      if (code === 'PATH_NOT_FOUND') setPathError('Path does not exist');
      else if (code === 'NOT_A_GIT_REPO') setPathError('No Git repository at this path');
      else toast.error(res.error?.message ?? 'Registration failed');
      return;
    }

    const repo = res.data as Repository;
    if (existingPaths.some((p) => p === repo.path)) {
      toast.message('Repository was already registered', {
        description: repo.path,
      });
    } else {
      toast.success('Repository registered');
    }
    onRegistered(repo);
    reset();
    onClose();
  }

  const cloneDisabled =
    cloning || previewLoading || !url.trim() || !destParent.trim() || Boolean(urlError || destError);
  const localDisabled =
    registering ||
    inspectLoading ||
    !localPath.trim() ||
    Boolean(pathError) ||
    (inspect != null && (!inspect.isGit || inspect.alreadyRegistered || !inspect.exists));

  return (
    <Modal open={open} onClose={handleClose} title="Add repository" size="lg">
      <div className="space-y-4">
        <Tabs
          tabs={[
            { id: 'clone' as const, label: 'Clone from GitHub' },
            { id: 'local' as const, label: 'Add existing local' },
          ]}
          value={workflow}
          onChange={(id) => {
            setWorkflow(id);
            setAdvancedOpen(false);
          }}
        />

        <div className="flex gap-2 rounded-lg border border-cf-border/80 bg-cf-navy/50 px-3 py-2 text-xs text-cf-muted">
          <Info className="w-3.5 h-3.5 text-cf-cyan shrink-0 mt-0.5" />
          <p>
            Paths are resolved by the CódigoFlow <span className="text-cf-text">backend on this machine</span>.
            Browsers cannot browse arbitrary folders — enter an absolute path the server can access
            (for example <code className="font-mono text-cf-cyan">D:\Projects</code>).
          </p>
        </div>

        {workflow === 'clone' ? (
          <div className="space-y-4">
            <Input
              label="GitHub repository URL"
              placeholder="https://github.com/owner/repository"
              value={url}
              error={urlError}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlError(undefined);
                setPreview(null);
              }}
              disabled={cloning}
              autoComplete="off"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handlePreview()}
                loading={previewLoading}
                disabled={cloning || !url.trim()}
              >
                <Search className="w-4 h-4" />
                Preview metadata
              </Button>
            </div>

            {previewLoading && (
              <div className="flex items-center gap-2 text-xs text-cf-muted">
                <LoadingSpinner size="sm" />
                Fetching GitHub metadata…
              </div>
            )}

            {preview && (
              <div className="rounded-xl border border-cf-border bg-cf-card/80 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-cf-text">
                      <Github className="w-4 h-4 text-cf-cyan shrink-0" />
                      <span className="truncate">
                        {(preview.full_name as string) ||
                          (parsed ? `${parsed.owner}/${parsed.repo}` : 'Repository')}
                      </span>
                    </div>
                    {typeof preview.description === 'string' && preview.description && (
                      <p className="text-xs text-cf-muted mt-1">{preview.description}</p>
                    )}
                  </div>
                  {preview.private === true ? (
                    <Badge variant="warning">
                      <span className="inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Private
                      </span>
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Public
                      </span>
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {typeof preview.language === 'string' && preview.language && (
                    <Badge variant="info">{preview.language}</Badge>
                  )}
                  {typeof preview.default_branch === 'string' && (
                    <Badge variant="violet">
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        {preview.default_branch}
                      </span>
                    </Badge>
                  )}
                  {typeof preview.stargazers_count === 'number' && (
                    <Badge variant="muted">★ {preview.stargazers_count}</Badge>
                  )}
                </div>
                {preview.private === true && (
                  <p className="text-[11px] text-cf-faint">
                    Private clones use server-side Git credentials / <code className="font-mono">GITHUB_TOKEN</code>.
                    Tokens are never sent to the browser.
                  </p>
                )}
              </div>
            )}

            <Input
              label="Local destination parent directory"
              placeholder="e.g. D:\Projects"
              value={destParent}
              error={destError}
              onChange={(e) => {
                setDestParent(e.target.value);
                setDestError(undefined);
              }}
              disabled={cloning}
              autoComplete="off"
            />
            {destination && (
              <p className="text-[11px] font-mono text-cf-cyan/90 break-all">
                Will clone into: {destination}
              </p>
            )}

            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-cf-muted hover:text-cf-cyan"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              {advancedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Advanced details
            </button>
            {advancedOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Display name"
                  placeholder={suggestedFolder || 'Optional'}
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  disabled={cloning}
                />
                <Input
                  label="Description"
                  placeholder="Optional"
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  disabled={cloning}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={cloning}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={cloning}
                disabled={cloneDisabled}
                onClick={() => void handleClone()}
              >
                <Github className="w-4 h-4" />
                Clone & register
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Absolute path to existing Git repository"
              placeholder="e.g. D:\Projects\my-app"
              value={localPath}
              error={pathError}
              onChange={(e) => {
                setLocalPath(e.target.value);
                setPathError(undefined);
                setInspect(null);
              }}
              disabled={registering}
              autoComplete="off"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleInspect()}
                loading={inspectLoading}
                disabled={registering || !localPath.trim()}
              >
                <FolderGit2 className="w-4 h-4" />
                Validate path
              </Button>
            </div>

            {inspect && inspect.exists && inspect.isGit && (
              <div className="rounded-xl border border-cf-border bg-cf-card/80 p-4 space-y-2 text-sm">
                <div className="font-medium text-cf-text">{inspect.nameHint}</div>
                <div className="text-xs font-mono text-cf-faint break-all">{inspect.path}</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {inspect.branch && (
                    <Badge variant="violet">
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        {inspect.branch}
                      </span>
                    </Badge>
                  )}
                  {inspect.alreadyRegistered ? (
                    <Badge variant="warning">Already registered</Badge>
                  ) : (
                    <Badge variant="success">Ready to register</Badge>
                  )}
                  {inspect.status && (
                    <Badge variant="muted">
                      {inspect.status.staged} staged · {inspect.status.unstaged} modified ·{' '}
                      {inspect.status.untracked} untracked
                    </Badge>
                  )}
                </div>
                {inspect.remoteUrl && (
                  <p className="text-[11px] text-cf-muted truncate">Remote: {inspect.remoteUrl}</p>
                )}
              </div>
            )}

            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-cf-muted hover:text-cf-cyan"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              {advancedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Advanced details
            </button>
            {advancedOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Display name"
                  placeholder={inspect?.nameHint || 'Optional'}
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  disabled={registering}
                />
                <Input
                  label="Description"
                  placeholder="Optional"
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  disabled={registering}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={registering}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={registering}
                disabled={localDisabled}
                onClick={() => void handleRegisterLocal()}
              >
                Register repository
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
