import fs from 'fs';
import path from 'path';
import { runDevOps } from '../../devops/adapters';
import { getDevOpsWorkspaceRoot } from '../../devops/services/preflight';
import { detectDevOpsTools } from '../../devops/services/toolDetection';
import { createError } from '../../middleware/errorHandler';

function ansibleRoot() {
  return path.join(getDevOpsWorkspaceRoot(), 'ansible');
}

function resolveUnderAnsible(relOrAbs: string): string {
  const root = path.resolve(ansibleRoot());
  const resolved = path.resolve(
    path.isAbsolute(relOrAbs) ? relOrAbs : path.join(root, relOrAbs),
  );
  if (!(resolved === root || resolved.startsWith(root + path.sep))) {
    throw createError('Path must be under devops/ansible', 403, 'ANSIBLE_PATH_FORBIDDEN');
  }
  return resolved;
}

export async function getAnsibleStatus() {
  const tools = await detectDevOpsTools();
  const ansible = tools.find((t) => t.name === 'ansible');
  const playbook = tools.find((t) => t.name === 'ansible-playbook');
  return {
    available: Boolean(ansible?.available && playbook?.available),
    version: ansible?.version,
    playbookVersion: playbook?.version,
    mode: ansible?.mode,
    error: ansible?.error || playbook?.error,
    installHint: ansible?.installHint,
  };
}

export function listInventories() {
  const dir = path.join(ansibleRoot(), 'inventory');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('.'))
    .map((f) => ({ name: f, path: path.join(dir, f), relativePath: path.join('inventory', f) }));
}

export function listPlaybooks() {
  const dir = path.join(ansibleRoot(), 'playbooks');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => ({ name: f, path: path.join(dir, f), relativePath: path.join('playbooks', f) }));
}

export function listRoles() {
  const dir = path.join(ansibleRoot(), 'roles');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, path: path.join(dir, d.name) }));
}

export async function validateInventory(inventoryRel: string) {
  const inventory = resolveUnderAnsible(inventoryRel);
  const result = await runDevOps({
    executable: 'ansible-inventory',
    args: ['-i', inventory, '--list'],
    cwd: ansibleRoot(),
    timeoutMs: 60_000,
  });
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'inventory validation failed', 400, 'ANSIBLE_INVENTORY_INVALID');
  }
  return { inventory, output: result.stdout };
}

export async function ansiblePing(inventoryRel: string, limit?: string) {
  const inventory = resolveUnderAnsible(inventoryRel);
  const args = ['all', '-i', inventory, '-m', 'ping'];
  if (limit) {
    if (!/^[A-Za-z0-9._:-]+$/.test(limit)) {
      throw createError('Invalid host limit', 400, 'INVALID_LIMIT');
    }
    args.push('-l', limit);
  }
  const result = await runDevOps({
    executable: 'ansible',
    args,
    cwd: ansibleRoot(),
    timeoutMs: 120_000,
  });
  return { exitCode: result.exitCode, output: result.stdout + result.stderr };
}

export async function ansibleFacts(inventoryRel: string, limit?: string) {
  const inventory = resolveUnderAnsible(inventoryRel);
  const args = ['all', '-i', inventory, '-m', 'setup'];
  if (limit) {
    if (!/^[A-Za-z0-9._:-]+$/.test(limit)) {
      throw createError('Invalid host limit', 400, 'INVALID_LIMIT');
    }
    args.push('-l', limit);
  }
  const result = await runDevOps({
    executable: 'ansible',
    args,
    cwd: ansibleRoot(),
    timeoutMs: 180_000,
  });
  return { exitCode: result.exitCode, output: result.stdout + result.stderr };
}

export async function validatePlaybook(playbookRel: string) {
  const playbook = resolveUnderAnsible(playbookRel);
  const result = await runDevOps({
    executable: 'ansible-playbook',
    args: ['--syntax-check', playbook],
    cwd: ansibleRoot(),
    timeoutMs: 60_000,
  });
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'syntax check failed', 400, 'ANSIBLE_SYNTAX_FAILED');
  }
  return { playbook, output: result.stdout || result.stderr };
}

export async function checkPlaybook(playbookRel: string, inventoryRel: string, approveCheck = true) {
  if (!approveCheck) {
    throw createError('Check mode requires explicit request', 400, 'CONFIRMATION_REQUIRED');
  }
  const playbook = resolveUnderAnsible(playbookRel);
  const inventory = resolveUnderAnsible(inventoryRel);
  const result = await runDevOps({
    executable: 'ansible-playbook',
    args: ['-i', inventory, '--check', '--diff', playbook],
    cwd: ansibleRoot(),
    timeoutMs: 300_000,
  });
  return {
    exitCode: result.exitCode,
    output: result.stdout + result.stderr,
    note: 'Check mode is an estimate; not all modules support it identically.',
  };
}

export async function runPlaybook(
  playbookRel: string,
  inventoryRel: string,
  approve: boolean,
) {
  if (!approve) {
    throw createError('Playbook run requires approve: true', 400, 'CONFIRMATION_REQUIRED');
  }
  const playbook = resolveUnderAnsible(playbookRel);
  const inventory = resolveUnderAnsible(inventoryRel);
  const result = await runDevOps({
    executable: 'ansible-playbook',
    args: ['-i', inventory, playbook],
    cwd: ansibleRoot(),
    timeoutMs: 600_000,
  });
  if (result.exitCode !== 0) {
    throw createError(result.stderr || result.stdout || 'playbook failed', 500, 'ANSIBLE_RUN_FAILED');
  }
  return { exitCode: result.exitCode, output: result.stdout + result.stderr };
}

const SAFE_ADHOC_MODULES = new Set(['ping', 'setup', 'shell']);
const SAFE_SHELL_COMMANDS = new Set(['uptime', 'df -h', 'whoami', 'uname -a']);

export async function ansibleAdHoc(input: {
  inventory: string;
  module: string;
  args?: string;
  limit?: string;
}) {
  if (!SAFE_ADHOC_MODULES.has(input.module)) {
    throw createError('Ad-hoc module not allowlisted', 403, 'ADHOC_NOT_ALLOWED');
  }
  if (input.module === 'shell') {
    if (!input.args || !SAFE_SHELL_COMMANDS.has(input.args)) {
      throw createError('Shell ad-hoc command not allowlisted', 403, 'ADHOC_SHELL_FORBIDDEN');
    }
  }
  const inventory = resolveUnderAnsible(input.inventory);
  const args = ['all', '-i', inventory, '-m', input.module];
  if (input.args) args.push('-a', input.args);
  if (input.limit) {
    if (!/^[A-Za-z0-9._:-]+$/.test(input.limit)) {
      throw createError('Invalid host limit', 400, 'INVALID_LIMIT');
    }
    args.push('-l', input.limit);
  }
  const result = await runDevOps({
    executable: 'ansible',
    args,
    cwd: ansibleRoot(),
    timeoutMs: 120_000,
  });
  return { exitCode: result.exitCode, output: result.stdout + result.stderr };
}
