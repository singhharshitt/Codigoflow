import type { ControlNodeInfo, DevOpsExecutor, ExecutionMode, ExecRequest, ExecResult } from './types';
import { NativeExecutor } from './nativeExecutor';
import { WslExecutor } from './wslExecutor';
import { SshExecutor } from './sshExecutor';

export * from './types';
export * from './sanitize';

const preferred = (process.env.DEVOPS_EXECUTION_MODE || 'auto').toLowerCase() as
  | ExecutionMode
  | 'auto';

let cached: { executor: DevOpsExecutor; info: ControlNodeInfo } | null = null;

export async function resolveExecutor(force = false): Promise<{
  executor: DevOpsExecutor;
  info: ControlNodeInfo;
}> {
  if (cached && !force) return cached;

  const candidates: DevOpsExecutor[] = [];

  if (preferred === 'native') candidates.push(new NativeExecutor());
  else if (preferred === 'wsl') candidates.push(new WslExecutor());
  else if (preferred === 'ssh') candidates.push(new SshExecutor());
  else {
    // auto: prefer native Linux, then WSL on Windows, then SSH if configured
    if (process.platform !== 'win32') candidates.push(new NativeExecutor());
    if (process.platform === 'win32') candidates.push(new WslExecutor());
    if (process.env.DEVOPS_SSH_HOST) candidates.push(new SshExecutor());
    if (process.platform === 'win32') candidates.push(new NativeExecutor()); // last resort messaging
  }

  for (const executor of candidates) {
    const info = await executor.probe();
    if (info.available) {
      cached = { executor, info };
      return cached;
    }
  }

  // Return first probed unavailable executor for honest messaging
  const fallback = candidates[0] ?? new NativeExecutor();
  const info = await fallback.probe();
  cached = { executor: fallback, info };
  return cached;
}

export async function runDevOps(req: ExecRequest): Promise<ExecResult> {
  const { executor } = await resolveExecutor();
  return executor.run(req);
}

export async function getControlNodeStatus(force = false) {
  const { info, executor } = await resolveExecutor(force);
  return { ...info, preferredMode: preferred, activeMode: executor.mode };
}
