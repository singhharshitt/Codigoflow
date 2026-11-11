import { getDb } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { createError } from '../middleware/errorHandler';
import {
  validateRepoPath,
  isGitRepository,
  runGitCommand,
  parseGitStatus,
  hasSensitiveFiles,
} from '../integrations/git';
import { logger } from '../utils/logger';
import path from 'path';

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
  const existing = db
    .prepare('SELECT * FROM repositories WHERE path = ?')
    .get(absPath) as Repository | undefined;
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
  return db.prepare('SELECT * FROM repositories WHERE id = ?').get(id) as Repository;
}

export function listRepositories(): Repository[] {
  const db = getDb();
  return db.prepare('SELECT * FROM repositories ORDER BY updated_at DESC').all() as Repository[];
}

export function getRepository(id: string): Repository {
  const db = getDb();
  const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id) as
    | Repository
    | undefined;
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

  // Warn about sensitive files but do not auto-block (let user decide)
  const sensitive = hasSensitiveFiles(files);
  if (sensitive.length > 0) {
    logger.warn({ sensitive }, 'Staging potentially sensitive files');
  }

  // Stage each file individually to avoid argument injection
  for (const file of files) {
    const result = await runGitCommand(repo.path, ['add', '--', file]);
    if (result.exitCode !== 0) {
      throw createError(`Failed to stage ${file}: ${result.stderr}`, 500, 'STAGE_FAILED');
    }
  }
}

export async function commitChanges(
  id: string,
  message: string,
): Promise<{ hash: string; message: string }> {
  if (!message || message.trim().length === 0) {
    throw createError('Commit message cannot be empty', 400, 'EMPTY_MESSAGE');
  }
  if (message.length > 5000) {
    throw createError('Commit message is too long', 400, 'MESSAGE_TOO_LONG');
  }

  const repo = getRepository(id);
  const result = await runGitCommand(repo.path, ['commit', '-m', message]);

  if (result.exitCode !== 0) {
    throw createError(`Commit failed: ${result.stderr}`, 500, 'COMMIT_FAILED');
  }

  // Get the new commit hash
  const hashResult = await runGitCommand(repo.path, ['rev-parse', 'HEAD']);
  return {
    hash: hashResult.stdout.trim(),
    message: message.trim(),
  };
}

export async function pushChanges(id: string, remote = 'origin', branch?: string): Promise<string> {
  const repo = getRepository(id);

  const currentBranch = branch ?? (await runGitCommand(repo.path, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();

  const args = ['push', remote, currentBranch];
  const result = await runGitCommand(repo.path, args, { timeoutMs: 60000 });

  if (result.exitCode !== 0) {
    throw createError(`Push failed: ${result.stderr}`, 500, 'PUSH_FAILED');
  }

  return result.stdout + result.stderr;
}
