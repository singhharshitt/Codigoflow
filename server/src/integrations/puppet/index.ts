import fs from 'fs';
import path from 'path';
import { runDevOps } from '../../devops/adapters';
import { getDevOpsWorkspaceRoot } from '../../devops/services/preflight';
import { detectDevOpsTools } from '../../devops/services/toolDetection';
import { createError } from '../../middleware/errorHandler';

function puppetRoot() {
  return path.join(getDevOpsWorkspaceRoot(), 'puppet');
}

function resolveManifest(rel: string) {
  const root = path.resolve(puppetRoot());
  const resolved = path.resolve(path.isAbsolute(rel) ? rel : path.join(root, rel));
  if (!(resolved === root || resolved.startsWith(root + path.sep))) {
    throw createError('Manifest must be under devops/puppet', 403, 'PUPPET_PATH_FORBIDDEN');
  }
  if (!fs.existsSync(resolved)) {
    throw createError('Manifest not found', 404, 'PUPPET_MANIFEST_NOT_FOUND');
  }
  return resolved;
}

export async function getPuppetStatus() {
  const tools = await detectDevOpsTools();
  const puppet = tools.find((t) => t.name === 'puppet');
  return {
    available: Boolean(puppet?.available),
    version: puppet?.version,
    mode: puppet?.mode,
    error: puppet?.error,
    installHint: puppet?.installHint,
    serverConfigured: Boolean(process.env.PUPPET_SERVER_HOST),
  };
}

export function listModules() {
  const dir = path.join(puppetRoot(), 'modules');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, path: path.join(dir, d.name) }));
}

export async function validateManifest(manifestRel: string) {
  const manifest = resolveManifest(manifestRel);
  const result = await runDevOps({
    executable: 'puppet',
    args: ['parser', 'validate', manifest],
    cwd: puppetRoot(),
    timeoutMs: 60_000,
  });
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'manifest validation failed', 400, 'PUPPET_VALIDATE_FAILED');
  }
  return { manifest, output: result.stdout || 'OK' };
}

export async function puppetApply(manifestRel: string, noop: boolean, approve: boolean) {
  if (!noop && !approve) {
    throw createError('Apply requires approve: true', 400, 'CONFIRMATION_REQUIRED');
  }
  const manifest = resolveManifest(manifestRel);
  const args = ['apply', manifest, '--detailed-exitcodes'];
  if (noop) args.push('--noop');
  const result = await runDevOps({
    executable: 'puppet',
    args,
    cwd: puppetRoot(),
    timeoutMs: 300_000,
  });
  // detailed-exitcodes: 0 no changes, 2 changes, others errors
  const ok = result.exitCode === 0 || result.exitCode === 2;
  if (!ok) {
    throw createError(result.stderr || result.stdout || 'puppet apply failed', 500, 'PUPPET_APPLY_FAILED');
  }
  return {
    exitCode: result.exitCode,
    noop,
    output: result.stdout + result.stderr,
    changed: result.exitCode === 2,
  };
}

export async function puppetAgentRun(noop: boolean, approve: boolean) {
  if (!noop && !approve) {
    throw createError('Agent run requires approve: true', 400, 'CONFIRMATION_REQUIRED');
  }
  const args = ['agent', '--test', '--detailed-exitcodes'];
  if (noop) args.push('--noop');
  const result = await runDevOps({
    executable: 'puppet',
    args,
    timeoutMs: 300_000,
  });
  const ok = result.exitCode === 0 || result.exitCode === 2;
  if (!ok) {
    throw createError(result.stderr || result.stdout || 'agent run failed', 500, 'PUPPET_AGENT_FAILED');
  }
  return { exitCode: result.exitCode, noop, output: result.stdout + result.stderr };
}

export async function listCertificates() {
  const result = await runDevOps({
    executable: 'puppetserver',
    args: ['ca', 'list', '--all'],
    timeoutMs: 60_000,
  });
  return {
    available: result.exitCode === 0,
    output: result.stdout + result.stderr,
    error: result.exitCode === 0 ? undefined : 'puppetserver ca list failed or not installed',
  };
}

export async function signCertificate(certname: string, approve: boolean) {
  if (!approve) {
    throw createError('Certificate signing requires approve: true', 400, 'CONFIRMATION_REQUIRED');
  }
  if (!/^[A-Za-z0-9._-]+$/.test(certname)) {
    throw createError('Invalid certname', 400, 'INVALID_CERTNAME');
  }
  const result = await runDevOps({
    executable: 'puppetserver',
    args: ['ca', 'sign', certname],
    timeoutMs: 60_000,
  });
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'sign failed', 500, 'PUPPET_SIGN_FAILED');
  }
  return { certname, output: result.stdout + result.stderr };
}

export async function puppetFacts() {
  const result = await runDevOps({
    executable: 'puppet',
    args: ['facts', '--render-as', 'json'],
    timeoutMs: 60_000,
  });
  return { exitCode: result.exitCode, output: result.stdout || result.stderr };
}

export async function puppetDrift(manifestRel: string) {
  // Drift preview = noop apply
  return puppetApply(manifestRel, true, true);
}
