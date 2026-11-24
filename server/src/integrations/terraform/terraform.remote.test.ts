import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Terraform plan on an SSH control node: the plan file lives on the remote
 * host, so the plans dir is created there and the integrity hash comes from
 * the remote `sha256sum`, never from a local file that does not exist.
 */
const runDevOps = jest.fn();
jest.mock('../../devops/adapters', () => ({
  resolveExecutor: async () => ({ executor: { mode: 'ssh' }, info: { available: true } }),
  runDevOps: (...args: unknown[]) => runDevOps(...args),
}));

import { closeDatabase, resetDatabaseForTests } from '../../database';
import { approveTerraformPlan, terraformPlan } from './index';

const HASH = 'a'.repeat(64);

describe('terraform plan on a remote (SSH) control node', () => {
  let dbPath: string;

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `cf-tf-remote-${Date.now()}.db`);
    resetDatabaseForTests(dbPath);
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  beforeEach(() => runDevOps.mockReset());

  const ok = (stdout = '') => ({ exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 1, mode: 'ssh', commandSummary: '' });

  it('creates the plans dir remotely and hashes the plan with sha256sum', async () => {
    runDevOps.mockImplementation(async (req: { executable: string; args: string[] }) => {
      if (req.executable === 'mkdir') return ok();
      if (req.executable === 'terraform') return ok('Plan: 1 to add, 0 to change, 0 to destroy.');
      if (req.executable === 'sha256sum') return ok(`${HASH}  ${req.args[0]}\n`);
      throw new Error(`unexpected ${req.executable}`);
    });

    const plan = await terraformPlan('local-lab');

    expect(plan.planHash).toBe(HASH);
    const calls = runDevOps.mock.calls.map(([r]) => r.executable);
    expect(calls).toEqual(['mkdir', 'terraform', 'sha256sum']);
    expect(runDevOps.mock.calls[0][0].args[0]).toBe('-p');
    // Same path for -out and for the hash check
    const out = (runDevOps.mock.calls[1][0].args as string[]).find((a) => a.startsWith('-out='))!.slice(5);
    expect(runDevOps.mock.calls[2][0].args[0]).toBe(out);
  });

  it('refuses approval when the remote plan file changed', async () => {
    runDevOps.mockImplementation(async (req: { executable: string; args: string[] }) => {
      if (req.executable === 'sha256sum') return ok(`${HASH}  ${req.args[0]}\n`);
      return ok('Plan: 0 to add');
    });
    const plan = await terraformPlan('local-lab');

    runDevOps.mockImplementation(async (req: { executable: string; args: string[] }) =>
      ok(`${'b'.repeat(64)}  ${req.args[0]}\n`),
    );
    await expect(approveTerraformPlan(plan.planId, 'operator')).rejects.toMatchObject({ code: 'TF_PLAN_TAMPERED' });
  });

  it('reports a missing remote plan file', async () => {
    runDevOps.mockImplementation(async (req: { executable: string }) =>
      req.executable === 'sha256sum' ? { ...ok(), exitCode: 1, stderr: 'No such file' } : ok(),
    );
    await expect(terraformPlan('local-lab')).rejects.toMatchObject({ code: 'TF_PLAN_MISSING' });
  });
});
