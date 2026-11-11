import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { runDevOps } from '../../devops/adapters';
import { getDevOpsWorkspaceRoot } from '../../devops/services/preflight';
import { createError } from '../../middleware/errorHandler';
import { getDb } from '../../database';
import { asRow, asRows } from '../../utils/dbCast';
import { detectDevOpsTools } from '../../devops/services/toolDetection';

function terraformRoot() {
  return path.join(getDevOpsWorkspaceRoot(), 'terraform');
}

function plansDir() {
  const dir = path.join(getDevOpsWorkspaceRoot(), '.plans');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveTerraformProject(projectPath: string): string {
  const root = path.resolve(terraformRoot());
  const resolved = path.resolve(projectPath.startsWith('.') || !path.isAbsolute(projectPath)
    ? path.join(root, projectPath)
    : projectPath);
  if (!(resolved === root || resolved.startsWith(root + path.sep))) {
    throw createError('Terraform project must be under devops/terraform', 403, 'TF_PATH_FORBIDDEN');
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw createError('Terraform project directory not found', 404, 'TF_PROJECT_NOT_FOUND');
  }
  return resolved;
}

export async function getTerraformStatus() {
  const tools = await detectDevOpsTools();
  const tf = tools.find((t) => t.name === 'terraform');
  return {
    available: Boolean(tf?.available),
    version: tf?.version,
    mode: tf?.mode,
    error: tf?.error,
    installHint: tf?.installHint,
    destroyEnabled: process.env.DEVOPS_TF_DESTROY_ENABLED === 'true',
    warning: 'Cloud applies can create billable resources. Human approval is required.',
  };
}

export function listTerraformProjects() {
  const root = terraformRoot();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => ({
      id: d.name,
      name: d.name,
      path: path.join(root, d.name),
      relativePath: d.name,
    }));
}

async function tf(cwd: string, args: string[], timeoutMs = 180_000) {
  return runDevOps({ executable: 'terraform', args, cwd, timeoutMs });
}

export async function terraformFmt(projectPath: string) {
  const cwd = resolveTerraformProject(projectPath);
  const result = await tf(cwd, ['fmt', '-recursive', '-check=false']);
  return { ...result, projectPath: cwd };
}

export async function terraformInit(projectPath: string) {
  const cwd = resolveTerraformProject(projectPath);
  const result = await tf(cwd, ['init', '-input=false', '-no-color'], 300_000);
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'terraform init failed', 500, 'TF_INIT_FAILED');
  }
  return { ...result, projectPath: cwd };
}

export async function terraformValidate(projectPath: string) {
  const cwd = resolveTerraformProject(projectPath);
  const result = await tf(cwd, ['validate', '-no-color']);
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'terraform validate failed', 400, 'TF_VALIDATE_FAILED');
  }
  return { ...result, projectPath: cwd };
}

export async function terraformPlan(projectPath: string, workspace = 'default') {
  const cwd = resolveTerraformProject(projectPath);
  const planId = uuidv4();
  const planFile = path.join(plansDir(), `${planId}.tfplan`);
  const result = await tf(
    cwd,
    ['plan', '-input=false', '-no-color', `-out=${planFile}`],
    300_000,
  );
  if (result.exitCode !== 0 && result.exitCode !== 2) {
    // exit 2 can mean changes present depending on -detailed-exitcode; we didn't set that
    throw createError(result.stderr || 'terraform plan failed', 500, 'TF_PLAN_FAILED');
  }
  if (!fs.existsSync(planFile)) {
    throw createError('Plan file was not created', 500, 'TF_PLAN_MISSING');
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(planFile)).digest('hex');
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `INSERT INTO terraform_plans
       (id, project_path, workspace, plan_hash, plan_file_path, summary_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'created', ?)`,
    )
    .run(
      planId,
      cwd,
      workspace,
      hash,
      planFile,
      JSON.stringify({
        stdoutExcerpt: result.stdout.slice(0, 4000),
        durationMs: result.durationMs,
      }),
      now,
    );

  return {
    planId,
    projectPath: cwd,
    workspace,
    planHash: hash,
    status: 'created',
    output: result.stdout,
    warning: 'Review this plan carefully. Apply requires explicit approval of this saved plan.',
  };
}

export function getTerraformPlan(planId: string) {
  const row = asRow<{
    id: string;
    project_path: string;
    workspace: string;
    plan_hash: string;
    plan_file_path: string;
    summary_json: string | null;
    status: string;
    created_at: number;
    approved_at: number | null;
    approved_by: string | null;
  } | undefined>(getDb().prepare('SELECT * FROM terraform_plans WHERE id = ?').get(planId));
  if (!row) throw createError('Plan not found', 404, 'TF_PLAN_NOT_FOUND');
  return row;
}

export function approveTerraformPlan(planId: string, approvedBy: string) {
  const plan = getTerraformPlan(planId);
  if (plan.status !== 'created') {
    throw createError('Only newly created plans can be approved', 400, 'TF_PLAN_NOT_APPROVABLE');
  }
  if (!fs.existsSync(plan.plan_file_path)) {
    throw createError('Saved plan file missing', 400, 'TF_PLAN_FILE_MISSING');
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(plan.plan_file_path)).digest('hex');
  if (hash !== plan.plan_hash) {
    throw createError('Plan integrity check failed', 409, 'TF_PLAN_TAMPERED');
  }
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `UPDATE terraform_plans SET status = 'approved', approved_at = ?, approved_by = ? WHERE id = ?`,
    )
    .run(now, approvedBy, planId);
  getDb()
    .prepare(
      `INSERT INTO devops_approvals (id, kind, reference_id, approved, approved_by, created_at)
       VALUES (?, 'terraform.plan', ?, 1, ?, ?)`,
    )
    .run(uuidv4(), planId, approvedBy, now);
  return getTerraformPlan(planId);
}

const activeApplies = new Set<string>();

export async function terraformApply(planId: string, approve: boolean, approvedBy?: string) {
  if (!approve) {
    throw createError('Apply requires approve: true', 400, 'CONFIRMATION_REQUIRED');
  }
  let plan = getTerraformPlan(planId);
  if (plan.status === 'created') {
    plan = approveTerraformPlan(planId, approvedBy || 'operator');
  }
  if (plan.status !== 'approved') {
    throw createError('Plan must be approved before apply', 400, 'TF_PLAN_NOT_APPROVED');
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(plan.plan_file_path)).digest('hex');
  if (hash !== plan.plan_hash) {
    throw createError('Plan integrity check failed before apply', 409, 'TF_PLAN_TAMPERED');
  }

  const lockKey = `${plan.project_path}::${plan.workspace}`;
  if (activeApplies.has(lockKey)) {
    throw createError(
      'Another terraform apply is already running for this project/workspace',
      409,
      'TF_APPLY_IN_PROGRESS',
    );
  }
  activeApplies.add(lockKey);
  try {
    const result = await tf(
      plan.project_path,
      ['apply', '-input=false', '-no-color', '-auto-approve', plan.plan_file_path],
      600_000,
    );
    if (result.exitCode !== 0) {
      throw createError(result.stderr || 'terraform apply failed', 500, 'TF_APPLY_FAILED');
    }
    const now = Math.floor(Date.now() / 1000);
    getDb()
      .prepare(`UPDATE terraform_plans SET status = 'applied', applied_at = ? WHERE id = ?`)
      .run(now, planId);
    return { planId, output: result.stdout, status: 'applied' };
  } finally {
    activeApplies.delete(lockKey);
  }
}

export async function terraformWorkspaces(projectPath: string) {
  const cwd = resolveTerraformProject(projectPath);
  const result = await tf(cwd, ['workspace', 'list', '-no-color']);
  return {
    projectPath: cwd,
    output: result.stdout,
    exitCode: result.exitCode,
  };
}

export async function terraformWorkspaceNew(projectPath: string, name: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw createError('Invalid workspace name', 400, 'INVALID_WORKSPACE');
  }
  const cwd = resolveTerraformProject(projectPath);
  const result = await tf(cwd, ['workspace', 'new', name, '-no-color']);
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'workspace create failed', 500, 'TF_WORKSPACE_FAILED');
  }
  return { projectPath: cwd, workspace: name, output: result.stdout };
}

export async function terraformWorkspaceSelect(projectPath: string, name: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw createError('Invalid workspace name', 400, 'INVALID_WORKSPACE');
  }
  const cwd = resolveTerraformProject(projectPath);
  const result = await tf(cwd, ['workspace', 'select', name, '-no-color']);
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'workspace select failed', 500, 'TF_WORKSPACE_FAILED');
  }
  return { projectPath: cwd, workspace: name, output: result.stdout };
}

export async function terraformOutputs(projectPath: string) {
  const cwd = resolveTerraformProject(projectPath);
  const result = await tf(cwd, ['output', '-json', '-no-color']);
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'terraform output failed', 500, 'TF_OUTPUT_FAILED');
  }
  let parsed: Record<string, { value?: unknown; sensitive?: boolean }> = {};
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw createError('Unable to parse terraform outputs', 500, 'TF_OUTPUT_PARSE');
  }
  const safe: Record<string, unknown> = {};
  for (const [key, meta] of Object.entries(parsed)) {
    if (meta?.sensitive) {
      safe[key] = '[sensitive]';
    } else {
      safe[key] = meta?.value;
    }
  }
  return { projectPath: cwd, outputs: safe };
}

export function listStoredPlans(limit = 20) {
  return asRows(
    getDb()
      .prepare(
        `SELECT id, project_path, workspace, plan_hash, status, created_at, approved_at, approved_by, applied_at
         FROM terraform_plans ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit),
  );
}
