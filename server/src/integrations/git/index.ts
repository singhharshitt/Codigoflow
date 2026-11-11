import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';
import { createError } from '../../middleware/errorHandler';
import { GIT_DEFAULT_TIMEOUT_MS } from '../../config';

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const ALLOWED_GIT_COMMANDS = new Set([
  'status',
  'log',
  'branch',
  'diff',
  'add',
  'commit',
  'push',
  'fetch',
  'clone',
  'remote',
  'stash',
  'show',
  'rev-parse',
  'rev-list',
  'ls-files',
  'checkout',
  'reset',
  'restore',
  'version',
]);

/** Per-repo mutex to prevent concurrent Git operations on the same working tree. */
const repoLocks = new Map<string, Promise<void>>();

export async function withRepoLock<T>(repoPath: string, fn: () => Promise<T>): Promise<T> {
  const key = path.resolve(repoPath);
  const previous = repoLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = previous.then(() => gate);
  repoLocks.set(key, chain);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (repoLocks.get(key) === chain) repoLocks.delete(key);
  }
}

export function validateRepoPath(repoPath: string): void {
  if (!repoPath || typeof repoPath !== 'string') {
    throw createError('Repository path is required', 400, 'INVALID_PATH');
  }

  const normalized = path.normalize(repoPath);
  if (normalized.includes('..')) {
    throw createError('Path traversal is not allowed', 400, 'INVALID_PATH');
  }

  if (!fs.existsSync(normalized)) {
    throw createError(`Path does not exist: ${normalized}`, 400, 'PATH_NOT_FOUND');
  }

  const stat = fs.statSync(normalized);
  if (!stat.isDirectory()) {
    throw createError('Path must be a directory', 400, 'INVALID_PATH');
  }
}

export function validateCloneDestination(destPath: string): string {
  const normalized = path.resolve(destPath);
  if (normalized.includes('..')) {
    throw createError('Path traversal is not allowed', 400, 'INVALID_PATH');
  }
  const parent = path.dirname(normalized);
  if (!fs.existsSync(parent)) {
    throw createError(`Parent directory does not exist: ${parent}`, 400, 'PATH_NOT_FOUND');
  }
  if (fs.existsSync(normalized) && fs.readdirSync(normalized).length > 0) {
    throw createError('Destination directory is not empty', 400, 'DEST_NOT_EMPTY');
  }
  return normalized;
}

export function sanitizeRemoteUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return url.replace(/\/\/([^/@]+)@/g, '//***@');
  }
}

export async function isGitRepository(repoPath: string): Promise<boolean> {
  try {
    const result = await runGitCommand(repoPath, ['rev-parse', '--git-dir']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function getGitVersion(): Promise<{ available: boolean; version?: string }> {
  try {
    const result = await runGitCommand(process.cwd(), ['version'], { allowCwdFallback: true });
    if (result.exitCode === 0) {
      return { available: true, version: result.stdout.trim().replace(/^git version\s+/i, '') };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}

export async function runGitCommand(
  repoPath: string,
  args: string[],
  options?: { timeoutMs?: number; allowCwdFallback?: boolean },
): Promise<GitCommandResult> {
  const command = args[0];
  if (!command || !ALLOWED_GIT_COMMANDS.has(command)) {
    throw createError(`Git command '${command}' is not allowed`, 403, 'FORBIDDEN_COMMAND');
  }

  const cwd = options?.allowCwdFallback ? repoPath : path.resolve(repoPath);

  return new Promise((resolve, reject) => {
    const timeout = options?.timeoutMs ?? GIT_DEFAULT_TIMEOUT_MS;
    const proc = spawn('git', args, {
      cwd,
      shell: false,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      proc.kill();
      reject(createError('Git command timed out', 504, 'GIT_TIMEOUT'));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      logger.debug({ command: `git ${args[0]} …`, exitCode: code, cwd });
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(createError('Git is not installed or not found in PATH', 503, 'GIT_NOT_FOUND'));
      } else {
        reject(createError(`Git process error: ${err.message}`, 500, 'GIT_PROCESS_ERROR'));
      }
    });
  });
}

export function parseGitStatus(rawStatus: string): {
  staged: string[];
  unstaged: string[];
  untracked: string[];
} {
  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];

  const lines = rawStatus.split('\n').filter(Boolean);
  for (const line of lines) {
    if (line.length < 2) continue;
    const index = line[0];
    const work = line[1];
    const file = line.slice(3).trim();

    if (index === '?' && work === '?') {
      untracked.push(file);
    } else {
      if (index !== ' ' && index !== '?') staged.push(file);
      if (work !== ' ' && work !== '?') unstaged.push(file);
    }
  }

  return { staged, unstaged, untracked };
}

const SENSITIVE_PATTERNS = [
  /\.env$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.p12$/i,
  /\.pfx$/i,
  /credentials/i,
  /secrets?\./i,
];

export function hasSensitiveFiles(files: string[]): string[] {
  return files.filter((f) => SENSITIVE_PATTERNS.some((p) => p.test(f)));
}

export function isAllowedGitRemote(url: string): boolean {
  const patterns = [
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/i,
    /^git@github\.com:[\w.-]+\/[\w.-]+(\.git)?$/i,
    /^https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+(\.git)?\/?$/i,
  ];
  return patterns.some((p) => p.test(url.trim()));
}
