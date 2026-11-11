import path from 'path';
import { createError } from '../../middleware/errorHandler';

const SAFE_EXECUTABLE = /^[A-Za-z0-9._+-]+$/;
const FORBIDDEN_ARG_CHARS = /[\0\r\n]/;

/** Allowlist of DevOps binaries the runner may invoke. */
export const ALLOWED_EXECUTABLES = new Set([
  'terraform',
  'ansible',
  'ansible-playbook',
  'ansible-inventory',
  'ansible-galaxy',
  'puppet',
  'puppetserver',
  'nagios',
  'nagios3',
  'wsl',
  'ssh',
  'which',
  'where',
  'command',
  'bash',
  'uname',
  'cat',
  'test',
  'ls',
]);

export function assertSafeExecutable(name: string): void {
  if (!SAFE_EXECUTABLE.test(name) || !ALLOWED_EXECUTABLES.has(name)) {
    throw createError(`Executable '${name}' is not allowlisted`, 403, 'EXEC_NOT_ALLOWED');
  }
}

export function assertSafeArgs(args: string[]): void {
  for (const arg of args) {
    if (typeof arg !== 'string') {
      throw createError('Invalid argument type', 400, 'INVALID_ARG');
    }
    if (FORBIDDEN_ARG_CHARS.test(arg)) {
      throw createError('Argument contains forbidden characters', 400, 'INVALID_ARG');
    }
    if (arg.length > 4096) {
      throw createError('Argument too long', 400, 'INVALID_ARG');
    }
  }
}

export function assertSafeCwd(cwd: string, allowedRoots: string[]): string {
  const resolved = path.resolve(cwd);
  const ok = allowedRoots.some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
  if (!ok) {
    throw createError('Working directory is outside approved roots', 403, 'CWD_FORBIDDEN');
  }
  if (resolved.includes('..')) {
    throw createError('Path traversal is not allowed', 400, 'INVALID_PATH');
  }
  return resolved;
}

export function redactSecrets(text: string): string {
  return text
    .replace(/(api[_-]?key|token|password|secret|aws_secret_access_key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/AKIA[0-9A-Z]{16}/g, '[redacted-aws-key]')
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, '[redacted-key]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]');
}

export function summarizeCommand(executable: string, args: string[]): string {
  const clipped = args.map((a) => (a.length > 40 ? `${a.slice(0, 37)}...` : a));
  return `${executable} ${clipped.join(' ')}`.trim();
}
