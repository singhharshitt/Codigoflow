import { spawn } from 'child_process';
import type { ControlNodeInfo, DevOpsExecutor, ExecRequest, ExecResult } from './types';
import {
  assertSafeArgs,
  assertSafeExecutable,
  redactSecrets,
  summarizeCommand,
} from './sanitize';

export class NativeExecutor implements DevOpsExecutor {
  readonly mode = 'native' as const;

  async probe(): Promise<ControlNodeInfo> {
    return {
      mode: 'native',
      available: process.platform !== 'win32',
      detail:
        process.platform === 'win32'
          ? 'Native Linux tools are not available on Windows; use WSL or SSH control node'
          : `Running natively on ${process.platform}`,
      distro: process.platform,
    };
  }

  async which(executable: string): Promise<string | null> {
    assertSafeExecutable(executable);
    const result = await this.run({
      executable: process.platform === 'win32' ? 'where' : 'which',
      args: [executable],
      timeoutMs: 5_000,
    }).catch(() => null);
    if (!result || result.exitCode !== 0) return null;
    return result.stdout.trim().split(/\r?\n/)[0] || null;
  }

  async run(req: ExecRequest): Promise<ExecResult> {
    // 'where' is Windows-only helper for which(); allow it transiently
    if (req.executable !== 'where') {
      assertSafeExecutable(req.executable);
    }
    assertSafeArgs(req.args);

    const started = Date.now();
    const maxChars = req.maxOutputChars ?? 200_000;

    return new Promise((resolve) => {
      const proc = spawn(req.executable, req.args, {
        cwd: req.cwd,
        env: { ...process.env, ...req.env },
        shell: false,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, req.timeoutMs ?? 120_000);

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
