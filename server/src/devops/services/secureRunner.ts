import path from 'path';
import { runJob } from '../../jobs/jobService';
import { runDevOps, type ExecRequest, type ExecResult } from '../adapters';
import { getDevOpsWorkspaceRoot } from './preflight';

function assertSafeCwd(cwd: string, roots: string[]): string {
  const resolved = path.resolve(cwd);
  const ok = roots.some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
  if (!ok) {
    throw new Error('Working directory is outside approved roots');
  }
  return resolved;
}

export async function runTrackedDevOpsCommand(input: {
  operation: string;
  req: ExecRequest;
  allowedRoots?: string[];
}) {
  const roots = input.allowedRoots ?? [getDevOpsWorkspaceRoot(), path.resolve(process.cwd())];
  const req = { ...input.req };
  if (req.cwd) {
    req.cwd = assertSafeCwd(req.cwd, roots);
  }

  return runJob(
    { operation: input.operation, type: 'devops', summary: req.executable },
    async (ctx) => {
      ctx.log(`Executing ${req.executable} (${input.operation})`);
      if (ctx.isCancelled()) {
        throw new Error('Cancelled before start');
      }
      const result: ExecResult = await runDevOps(req);
      ctx.log(result.commandSummary);
      if (result.stdout) ctx.log(result.stdout.slice(0, 8000));
      if (result.stderr) {
        ctx.log(result.stderr.slice(0, 4000), result.exitCode === 0 ? 'warn' : 'error');
      }
      if (result.timedOut) throw new Error('Command timed out');
      if (result.exitCode !== 0) {
        throw new Error(`Exit code ${result.exitCode}: ${result.stderr || result.stdout}`);
      }
      return result;
    },
  );
}
