import { spawn } from 'child_process';
import type { ControlNodeInfo, DevOpsExecutor, ExecRequest, ExecResult } from './types';
import {
  assertSafeArgs,
  assertSafeExecutable,
  redactSecrets,
  summarizeCommand,
} from './sanitize';
import { translateRequestPathsForWsl } from './pathBridge';

/**
 * Execute allowlisted commands inside a fixed WSL distribution.
 * Uses: wsl -d <distro> -- <executable> <args...>
 * Never concatenates user strings into a shell.
 */
export class WslExecutor implements DevOpsExecutor {
  readonly mode = 'wsl' as const;

  constructor(private readonly distro = process.env.DEVOPS_WSL_DISTRO || 'Ubuntu') {}

  async probe(): Promise<ControlNodeInfo> {
    if (process.platform !== 'win32') {
      return {
        mode: 'wsl',
        available: false,
        detail: 'WSL is only available on Windows',
      };
    }

    const list = await this.rawWsl(['-l', '-v']);
    if (list.exitCode !== 0) {
      return {
        mode: 'wsl',
        available: false,
        detail: list.stderr || 'WSL not available',
      };
    }

    // wsl -l output is UTF-16 on some systems; normalize
    const text = list.stdout.replace(/\0/g, '');
    const hasDistro = text.toLowerCase().includes(this.distro.toLowerCase());
    if (!hasDistro) {
      return {
        mode: 'wsl',
        available: false,
        detail: `Distro '${this.distro}' not found. Available:\n${text}`,
        distro: this.distro,
      };
    }

    const uname = await this.run({
      executable: 'uname',
      args: ['-a'],
      timeoutMs: 10_000,
    });

    return {
      mode: 'wsl',
      available: uname.exitCode === 0,
      detail:
        uname.exitCode === 0
          ? `WSL ${this.distro} ready`
          : uname.stderr || 'Failed to execute inside WSL (is the distro stopped?)',
      distro: this.distro,
    };
  }

  async which(executable: string): Promise<string | null> {
    assertSafeExecutable(executable);
    const result = await this.run({
      executable: 'bash',
      args: ['-lc', `command -v ${executable}`],
      timeoutMs: 8_000,
    });
    // bash -lc with fixed executable name only (executable already allowlisted)
    if (result.exitCode !== 0) return null;
    const line = result.stdout.trim().split(/\r?\n/)[0];
    return line || null;
  }

  async run(req: ExecRequest): Promise<ExecResult> {
    assertSafeExecutable(req.executable);
    assertSafeArgs(req.args);

    // Windows host paths must be translated before entering the Linux distro.
    const translated = translateRequestPathsForWsl({
      cwd: req.cwd,
      args: req.args,
    });

    // Special-case: allow bash -lc only for fixed internal probes with allowlisted content
    const wslArgs = ['-d', this.distro, '--'];
    if (translated.cwd) {
      // Use bash -lc with validated cwd and executable/args re-joined safely via "$@"
      // We pass: bash -lc 'cd "$1" && shift && exec "$@"' _ <cwd> <exe> <args...>
      wslArgs.push(
        'bash',
        '-lc',
        'cd "$1" && shift && exec "$@"',
        '_',
        translated.cwd,
        req.executable,
        ...translated.args,
      );
    } else {
      wslArgs.push(req.executable, ...translated.args);
    }

    return this.rawWsl(
      wslArgs,
      req.timeoutMs ?? 180_000,
      req.maxOutputChars,
      req.executable,
      req.args,
    );
  }

  private rawWsl(
    args: string[],
    timeoutMs = 30_000,
    maxOutputChars = 200_000,
    exeForSummary = 'wsl',
    summaryArgs: string[] = args,
  ): Promise<ExecResult> {
    const started = Date.now();
    return new Promise((resolve) => {
      const proc = spawn('wsl', args, {
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
      }, timeoutMs);

      proc.stdout.on('data', (d) => {
        if (stdout.length < maxOutputChars) stdout += d.toString();
      });
      proc.stderr.on('data', (d) => {
        if (stderr.length < maxOutputChars) stderr += d.toString();
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
          commandSummary: summarizeCommand(exeForSummary, summaryArgs),
        });
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout: redactSecrets(stdout.replace(/\0/g, '')),
          stderr: redactSecrets(stderr.replace(/\0/g, '')),
          exitCode: code ?? 1,
          timedOut,
          durationMs: Date.now() - started,
          mode: this.mode,
          commandSummary: summarizeCommand(exeForSummary, summaryArgs),
        });
      });
    });
  }
}
