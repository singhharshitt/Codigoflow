import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';
import { createError } from '../../middleware/errorHandler';

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Allowlisted Git operations — never pass raw user input as shell strings
const ALLOWED_GIT_COMMANDS = new Set([
  'status', 'log', 'branch', 'diff', 'add', 'commit', 'push',
  'fetch', 'clone', 'remote', 'stash', 'show', 'rev-parse', 'ls-files',
]);

export function validateRepoPath(repoPath: string): void {
  if (!repoPath || typeof repoPath !== 'string') {
    throw createError('Repository path is required', 400, 'INVALID_PATH');
  }

  const normalized = path.normalize(repoPath);

  // Block path traversal
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

export async function isGitRepository(repoPath: string): Promise<boolean> {
  try {
    const result = await runGitCommand(repoPath, ['rev-parse', '--git-dir']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function runGitCommand(
  repoPath: string,
  args: string[],
  options?: { timeoutMs?: number }
): Promise<GitCommandResult> {
  const command = args[0];
  if (!command || !ALLOWED_GIT_COMMANDS.has(command)) {
    throw createError(`Git command '${command}' is not allowed`, 403, 'FORBIDDEN_COMMAND');
  }

  return new Promise((resolve, reject) => {
    const timeout = options?.timeoutMs ?? 30000;
    const proc = spawn('git', args, {
      cwd: repoPath,
      shell: false, // Never use shell — prevents injection
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
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
      logger.debug({ command: `git ${args.join(' ')}`, exitCode: code, repoPath });
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
    const index = line[0];  // staged status
    const work  = line[1];  // working tree status
    const file  = line.slice(3).trim();

    if (index === '?') {
      untracked.push(file);
    } else {
      if (index !== ' ') staged.push(file);
      if (work !== ' ') unstaged.push(file);
    }
  }

  return { staged, unstaged, untracked };
}

// Block common sensitive file patterns
const SENSITIVE_PATTERNS = [
  /\.env$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.p12$/i,
  /\.pfx$/i,
  /credentials/i,
  /secret/i,
];

export function hasSensitiveFiles(files: string[]): string[] {
  return files.filter((f) => SENSITIVE_PATTERNS.some((p) => p.test(f)));
}
