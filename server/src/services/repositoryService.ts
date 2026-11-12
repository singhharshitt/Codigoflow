import { getDb } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { createError } from '../middleware/errorHandler';
import {
  validateRepoPath,
  validateCloneDestination,
  isGitRepository,
  runGitCommand,
  parseGitStatus,
  hasSensitiveFiles,
  withRepoLock,
  isAllowedGitRemote,
  sanitizeRemoteUrl,
} from '../integrations/git';
import { logger } from '../utils/logger';
import { asRow, asRows } from '../utils/dbCast';
import path from 'path';
import fs from 'fs';

export interface Repository {
  id: string;
  name: string;
  path: string;
  description?: string;
  remote_url?: string;
  github_owner?: string;
  github_repo?: string;
  created_at: number;
  updated_at: number;
}

export interface RepoStatus {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface CommitEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  insertions: number;
  deletions: number;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  tracking?: string;
}

// ── Repository CRUD ──────────────────────────────────────────────────────────

export async function registerRepository(input: {
  path: string;
  name?: string;
  description?: string;
}): Promise<Repository> {
  validateRepoPath(input.path);

  const absPath = path.resolve(input.path);
  const isGit = await isGitRepository(absPath);
  if (!isGit) {
    throw createError(`No Git repository found at: ${absPath}`, 400, 'NOT_A_GIT_REPO');
  }

  const db = getDb();

  // Check for duplicate
  const existing = asRow<Repository | undefined>(
    db.prepare('SELECT * FROM repositories WHERE path = ?').get(absPath),
  );
  if (existing) {
    return existing;
  }

  // Derive name from directory if not provided
  const name = input.name ?? path.basename(absPath);

  // Fetch remote URL
  let remoteUrl: string | undefined;
  try {
    const result = await runGitCommand(absPath, ['remote', 'get-url', 'origin']);
    if (result.exitCode === 0) remoteUrl = result.stdout.trim();
  } catch {
    // Remote may not exist
  }

  // Parse GitHub owner/repo from remote URL
  let githubOwner: string | undefined;
  let githubRepo: string | undefined;
  if (remoteUrl) {
    const match =
      remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/) ??
      remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (match) {
      githubOwner = match[1];
      githubRepo = match[2].replace(/\.git$/, '');
    }
  }

  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO repositories (id, name, path, description, remote_url, github_owner, github_repo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, absPath, input.description ?? null, remoteUrl ?? null, githubOwner ?? null, githubRepo ?? null, now, now);

  logger.info({ id, name, path: absPath }, 'Repository registered');
  return asRow<Repository>(db.prepare('SELECT * FROM repositories WHERE id = ?').get(id));
}

export function listRepositories(): Repository[] {
  const db = getDb();
  return asRows<Repository>(
    db.prepare('SELECT * FROM repositories ORDER BY updated_at DESC').all(),
  );
}

export function getRepository(id: string): Repository {
  const db = getDb();
  const repo = asRow<Repository | undefined>(
    db.prepare('SELECT * FROM repositories WHERE id = ?').get(id),
  );
  if (!repo) throw createError(`Repository ${id} not found`, 404, 'REPO_NOT_FOUND');
  return repo;
}

export function deleteRepository(id: string): void {
  const db = getDb();
  const result = db.prepare('DELETE FROM repositories WHERE id = ?').run(id) as { changes: number };
  if (result.changes === 0) throw createError(`Repository ${id} not found`, 404, 'REPO_NOT_FOUND');
}

// ── Git Operations ────────────────────────────────────────────────────────────

export async function getRepoStatus(id: string): Promise<RepoStatus> {
  const repo = getRepository(id);

  const [statusResult, branchResult] = await Promise.all([
    runGitCommand(repo.path, ['status', '--porcelain=v1']),
    runGitCommand(repo.path, ['rev-parse', '--abbrev-ref', 'HEAD']),
  ]);

  const { staged, unstaged, untracked } = parseGitStatus(statusResult.stdout);
  const branch = branchResult.stdout.trim() || 'HEAD';

  // Compute ahead/behind
  let ahead = 0;
  let behind = 0;
  try {
    const ab = await runGitCommand(repo.path, ['rev-list', '--left-right', '--count', `${branch}...@{u}`]);
    if (ab.exitCode === 0) {
      const parts = ab.stdout.trim().split(/\s+/);
      ahead = parseInt(parts[0] ?? '0', 10);
      behind = parseInt(parts[1] ?? '0', 10);
    }
  } catch {
    // No upstream configured
  }

  return { branch, staged, unstaged, untracked, ahead, behind };
}

export async function getBranches(id: string): Promise<BranchInfo[]> {
  const repo = getRepository(id);
  const result = await runGitCommand(repo.path, ['branch', '-vv', '--format=%(refname:short)|%(upstream:short)|%(HEAD)']);
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, tracking, head] = line.split('|');
      return {
        name: name?.trim() ?? '',
        current: head?.trim() === '*',
        tracking: tracking?.trim() || undefined,
      };
    });
}

export async function getCommits(id: string, limit = 30): Promise<CommitEntry[]> {
  const repo = getRepository(id);
  // Use a safe separator to parse the log
  const format = '%H|%h|%s|%an|%ae|%aI';
  const result = await runGitCommand(repo.path, [
    'log',
    `--max-count=${Math.min(limit, 100)}`,
    `--pretty=format:${format}`,
    '--shortstat',
  ]);

  const commits: CommitEntry[] = [];
  const lines = result.stdout.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }

    const parts = line.split('|');
    if (parts.length >= 6) {
      const [hash, shortHash, message, author, email, date] = parts;

      let insertions = 0;
      let deletions = 0;
      // Look ahead for stat line
      const nextLine = lines[i + 1] ?? '';
      if (nextLine.includes('insertion') || nextLine.includes('deletion')) {
        const insMatch = nextLine.match(/(\d+) insertion/);
        const delMatch = nextLine.match(/(\d+) deletion/);
        insertions = insMatch ? parseInt(insMatch[1], 10) : 0;
        deletions = delMatch ? parseInt(delMatch[1], 10) : 0;
        i++;
      }

      commits.push({
        hash: hash ?? '',
        shortHash: shortHash ?? '',
        message: message ?? '',
        author: author ?? '',
        email: email ?? '',
        date: date ?? '',
        insertions,
        deletions,
      });
    }
    i++;
  }

  return commits;
}

export async function getDiff(id: string, file?: string): Promise<string> {
  const repo = getRepository(id);
  const args = file
    ? ['diff', 'HEAD', '--', file]
    : ['diff', 'HEAD'];
  const result = await runGitCommand(repo.path, args);
  return result.stdout;
}

export async function stageFiles(id: string, files: string[]): Promise<void> {
  if (!files || files.length === 0) {
    throw createError('At least one file must be specified for staging', 400, 'NO_FILES');
  }

  const repo = getRepository(id);
  const sensitive = hasSensitiveFiles(files);
  if (sensitive.length > 0) {
    logger.warn({ sensitive }, 'Staging potentially sensitive files');
  }

  await withRepoLock(repo.path, async () => {
    for (const file of files) {
      const result = await runGitCommand(repo.path, ['add', '--', file]);
      if (result.exitCode !== 0) {
        throw createError(`Failed to stage ${file}: ${result.stderr}`, 500, 'STAGE_FAILED');
      }
    }
  });
}

export async function unstageFiles(id: string, files: string[]): Promise<void> {
  if (!files || files.length === 0) {
    throw createError('At least one file must be specified for unstaging', 400, 'NO_FILES');
  }
  const repo = getRepository(id);
  await withRepoLock(repo.path, async () => {
    for (const file of files) {
      const result = await runGitCommand(repo.path, ['restore', '--staged', '--', file]);
      if (result.exitCode !== 0) {
        // Fallback for older Git
        const fallback = await runGitCommand(repo.path, ['reset', 'HEAD', '--', file]);
        if (fallback.exitCode !== 0) {
          throw createError(
            `Failed to unstage ${file}: ${result.stderr || fallback.stderr}`,
            500,
            'UNSTAGE_FAILED',
          );
        }
      }
    }
  });
}

export async function checkoutBranch(
  id: string,
  branch: string,
  force = false,
): Promise<{ branch: string; warning?: string }> {
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) {
    throw createError('Invalid branch name', 400, 'INVALID_BRANCH');
  }
  const repo = getRepository(id);
  return withRepoLock(repo.path, async () => {
    const status = await runGitCommand(repo.path, ['status', '--porcelain=v1']);
    const dirty = status.stdout.trim().length > 0;
    if (dirty && !force) {
      throw createError(
        'Working tree has uncommitted changes. Commit, stash, or confirm force checkout.',
        409,
        'DIRTY_WORKTREE',
      );
    }
    const args = force ? ['checkout', '-f', branch] : ['checkout', branch];
    const result = await runGitCommand(repo.path, args);
    if (result.exitCode !== 0) {
      throw createError(`Checkout failed: ${result.stderr}`, 500, 'CHECKOUT_FAILED');
    }
    return {
      branch,
      warning: dirty ? 'Forced checkout with a dirty working tree' : undefined,
    };
  });
}

export async function commitChanges(
  id: string,
  message: string,
  confirm = true,
): Promise<{ hash: string; message: string }> {
  // Frontend already confirms via modal; optional body.confirm=false rejects.
  if (confirm === false) {
    throw createError('Commit requires explicit confirmation', 400, 'CONFIRMATION_REQUIRED');
  }
  if (!message || message.trim().length === 0) {
    throw createError('Commit message cannot be empty', 400, 'EMPTY_MESSAGE');
  }
  if (message.length > 5000) {
    throw createError('Commit message is too long', 400, 'MESSAGE_TOO_LONG');
  }

  const repo = getRepository(id);
  return withRepoLock(repo.path, async () => {
    const result = await runGitCommand(repo.path, ['commit', '-m', message]);
    if (result.exitCode !== 0) {
      throw createError(`Commit failed: ${result.stderr}`, 500, 'COMMIT_FAILED');
    }
    const hashResult = await runGitCommand(repo.path, ['rev-parse', 'HEAD']);
    return { hash: hashResult.stdout.trim(), message: message.trim() };
  });
}

export async function pushChanges(
  id: string,
  remote = 'origin',
  branch?: string,
  confirm = true,
): Promise<string> {
  if (confirm === false) {
    throw createError('Push requires explicit confirmation', 400, 'CONFIRMATION_REQUIRED');
  }
  if (!/^[A-Za-z0-9._-]+$/.test(remote)) {
    throw createError('Invalid remote name', 400, 'INVALID_REMOTE');
  }

  const repo = getRepository(id);
  return withRepoLock(repo.path, async () => {
    const currentBranch =
      branch ??
      (await runGitCommand(repo.path, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    const result = await runGitCommand(repo.path, ['push', remote, currentBranch], {
      timeoutMs: 60_000,
    });
    if (result.exitCode !== 0) {
      throw createError(`Push failed: ${result.stderr}`, 500, 'PUSH_FAILED');
    }
    return result.stdout + result.stderr;
  });
}

/** Inspect a local path without registering — used by the onboarding UI. */
export async function inspectLocalRepository(inputPath: string): Promise<{
  path: string;
  exists: boolean;
  isGit: boolean;
  alreadyRegistered: boolean;
  registeredId?: string;
  nameHint: string;
  branch?: string;
  remoteUrl?: string;
  status?: {
    staged: number;
    unstaged: number;
    untracked: number;
  };
}> {
  if (!inputPath || typeof inputPath !== 'string') {
    throw createError('Repository path is required', 400, 'INVALID_PATH');
  }
  if (inputPath.includes('..')) {
    throw createError('Path traversal is not allowed', 400, 'INVALID_PATH');
  }
  const absPath = path.resolve(inputPath);

  const exists = fs.existsSync(absPath) && fs.statSync(absPath).isDirectory();
  if (!exists) {
    return {
      path: absPath,
      exists: false,
      isGit: false,
      alreadyRegistered: false,
      nameHint: path.basename(absPath) || 'repository',
    };
  }

  const db = getDb();
  const existing = asRow<Repository | undefined>(
    db.prepare('SELECT * FROM repositories WHERE path = ?').get(absPath),
  );

  const isGit = await isGitRepository(absPath);
  if (!isGit) {
    return {
      path: absPath,
      exists: true,
      isGit: false,
      alreadyRegistered: Boolean(existing),
      registeredId: existing?.id,
      nameHint: path.basename(absPath),
    };
  }

  let branch: string | undefined;
  let remoteUrl: string | undefined;
  let status: { staged: number; unstaged: number; untracked: number } | undefined;

  try {
    const [branchResult, remoteResult, statusResult] = await Promise.all([
      runGitCommand(absPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
      runGitCommand(absPath, ['remote', 'get-url', 'origin']).catch(() => ({
        exitCode: 1,
        stdout: '',
        stderr: '',
      })),
      runGitCommand(absPath, ['status', '--porcelain=v1']),
    ]);
    branch = branchResult.stdout.trim() || undefined;
    if (remoteResult.exitCode === 0) remoteUrl = remoteResult.stdout.trim() || undefined;
    const parsed = parseGitStatus(statusResult.stdout);
    status = {
      staged: parsed.staged.length,
      unstaged: parsed.unstaged.length,
      untracked: parsed.untracked.length,
    };
  } catch {
    // Best-effort inspection
  }

  return {
    path: absPath,
    exists: true,
    isGit: true,
    alreadyRegistered: Boolean(existing),
    registeredId: existing?.id,
    nameHint: existing?.name ?? path.basename(absPath),
    branch,
    remoteUrl,
    status,
  };
}

export async function cloneRepository(input: {
  url: string;
  destination: string;
  name?: string;
  description?: string;
}): Promise<Repository> {
  if (!isAllowedGitRemote(input.url)) {
    throw createError('Unsupported or invalid Git remote URL', 400, 'INVALID_REMOTE_URL');
  }
  const dest = validateCloneDestination(input.destination);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const parent = path.dirname(dest);
  const folder = path.basename(dest);
  const result = await runGitCommand(
    parent,
    ['clone', '--', input.url, folder],
    { timeoutMs: 120_000, allowCwdFallback: true },
  );
  if (result.exitCode !== 0) {
    throw createError(
      `Clone failed: ${result.stderr || result.stdout}`,
      500,
      'CLONE_FAILED',
    );
  }

  logger.info(
    { url: sanitizeRemoteUrl(input.url), destination: dest },
    'Repository cloned',
  );

  return registerRepository({
    path: dest,
    name: input.name,
    description: input.description,
  });
}
