import { spawn } from 'child_process';
import type { ControlNodeInfo, DevOpsExecutor, ExecRequest, ExecResult } from './types';
import {
  assertSafeArgs,
  assertSafeExecutable,
  redactSecrets,
  summarizeCommand,
} from './sanitize';
import { createError } from '../../middleware/errorHandler';

/**
 * Execute allowlisted commands on a configured SSH control node.
 * Requires DEVOPS_SSH_HOST and DEVOPS_SSH_USER. Optional DEVOPS_SSH_KEY_PATH.
 * Uses OpenSSH client with BatchMode and fixed args — no shell concatenation.
 */
export class SshExecutor implements DevOpsExecutor {
  readonly mode = 'ssh' as const;

  private get host() {
    return process.env.DEVOPS_SSH_HOST?.trim();
  }
  private get user() {
    return process.env.DEVOPS_SSH_USER?.trim();
  }
  private get keyPath() {
    return process.env.DEVOPS_SSH_KEY_PATH?.trim();
  }
  private get port() {
    return process.env.DEVOPS_SSH_PORT?.trim() || '22';
  }

  async probe(): Promise<ControlNodeInfo> {
    if (!this.host || !this.user) {
      return {
        mode: 'ssh',
        available: false,
        detail: 'Set DEVOPS_SSH_HOST and DEVOPS_SSH_USER to enable SSH control node',
      };
    }

    const result = await this.run({
      executable: 'uname',
      args: ['-a'],
      timeoutMs: 15_000,
    });

    return {
      mode: 'ssh',
      available: result.exitCode === 0,
      detail:
        result.exitCode === 0
          ? `SSH control node ${this.user}@${this.host} reachable`
          : result.stderr || 'SSH probe failed',
      host: `${this.user}@${this.host}`,
      distro: result.stdout.trim() || undefined,
    };
  }

  async which(executable: string): Promise<string | null> {
    assertSafeExecutable(executable);
    const result = await this.run({
      executable: 'bash',
      args: ['-lc', `command -v ${executable}`],
      timeoutMs: 10_000,
    });
    if (result.exitCode !== 0) return null;
    return result.stdout.trim().split(/\r?\n/)[0] || null;
  }

  async run(req: ExecRequest): Promise<ExecResult> {
    if (!this.host || !this.user) {
      throw createError('SSH control node is not configured', 503, 'SSH_NOT_CONFIGURED');
    }
    assertSafeExecutable(req.executable);
    assertSafeArgs(req.args);

    const remoteArgv = req.cwd
      ? ['bash', '-lc', 'cd "$1" && shift && exec "$@"', '_', req.cwd, req.executable, ...req.args]
      : [req.executable, ...req.args];

    // Default to StrictHostKeyChecking=yes (known_hosts required).
    // Lab convenience: DEVOPS_SSH_STRICT_HOST_KEY=accept-new
    const strictHostKey =
      process.env.DEVOPS_SSH_STRICT_HOST_KEY?.trim() || 'yes';
    if (!['yes', 'ask', 'accept-new', 'no'].includes(strictHostKey)) {
      throw createError('Invalid DEVOPS_SSH_STRICT_HOST_KEY', 400, 'SSH_CONFIG_INVALID');
    }

    const sshArgs = [
      '-o',
      'BatchMode=yes',
      '-o',
      `StrictHostKeyChecking=${strictHostKey}`,
      '-p',
      this.port,
    ];
    if (this.keyPath) {
      sshArgs.push('-i', this.keyPath);
    }
    sshArgs.push(`${this.user}@${this.host}`, '--', ...remoteArgv);

    const started = Date.now();
    const maxChars = req.maxOutputChars ?? 200_000;

    return new Promise((resolve) => {
      const proc = spawn('ssh', sshArgs, {
        shell: false,
        windowsHide: true,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, req.timeoutMs ?? 180_000);

      proc.stdout.on('data', (d) => {
        if (stdout.length < maxChars) stdout += d.toString();
      });
      proc.stderr.on('data', (d) => {
        if (stderr.length < maxChars) stderr += d.toString();
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          stdout: '',
          stderr: redactSecrets(err.message),
          exitCode: 127,
          timedOut: false,
          durationMs: Date.now() - started,
          mode: this.mode,
          commandSummary: summarizeCommand(req.executable, req.args),
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout: redactSecrets(stdout),
          stderr: redactSecrets(stderr),
          exitCode: code ?? 1,
          timedOut,
          durationMs: Date.now() - started,
          mode: this.mode,
          commandSummary: summarizeCommand(req.executable, req.args),
        });
      });
    });
  }
}
