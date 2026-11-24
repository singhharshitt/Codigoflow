import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getRepository, getCommits } from '../../services/repositoryService';
import { analyzeRepository } from '../../services/repositoryAnalysis';
import { getDevOpsWorkspaceRoot } from '../../devops/services/preflight';
import { resolveTerraformProject } from '../terraform';
import { readNagiosStatus } from '../nagios';
import { getJob, listJobLogs } from '../../jobs/jobService';
import { getWorkflow } from '../../database/repositories/workflowRepository';
import { getDb } from '../../database';
import { asRow } from '../../utils/dbCast';
import { redactSecrets, truncate } from './redact';

/**
 * Builds the CódigoFlow context block for a Copilot request.
 *
 * Only what the request names is included, each section has its own budget,
 * every byte is redacted, and the result is wrapped as untrusted data by the
 * caller (see COPILOT_SYSTEM_PROMPT). Nothing here executes anything.
 */
export const ContextRequestSchema = z
  .object({
    repositoryId: z.string().uuid().optional(),
    /** what to include for the repository */
    repository: z.array(z.enum(['analysis', 'files', 'commits'])).max(3).optional(),
    terraformProject: z.string().regex(/^[A-Za-z0-9._-]+$/).max(64).optional(),
    playbook: z.string().max(200).optional(),
    puppet: z.boolean().optional(),
    nagios: z.boolean().optional(),
    workflowId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional(),
  })
  .strict();

export type ContextRequest = z.infer<typeof ContextRequestSchema>;

export const CONTEXT_BUDGET_CHARS = 16_000;
const SECTION_BUDGET = 6_000;
const FILE_BUDGET = 3_000;

/** Files that must never be sent to a provider, even if requested indirectly. */
const DENY = [
  /(^|[\\/])\.env(\..*)?$/i,
  /\.(pem|key|p12|pfx|jks|kdbx|tfstate(\.backup)?|tfvars)$/i,
  /(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /(^|[\\/])(credentials|secrets?)(\.[a-z]+)?$/i,
  /(^|[\\/])\.(git|ssh|aws|terraform)([\\/]|$)/i,
];

export function isDeniedPath(p: string): boolean {
  return DENY.some((re) => re.test(p));
}

/** Read a text file strictly inside `root`; null if missing, denied, binary or outside. */
export function readSafeFile(root: string, rel: string, max = FILE_BUDGET): string | null {
  const base = path.resolve(root);
  const full = path.resolve(base, rel);
  if (!(full === base || full.startsWith(base + path.sep))) return null;
  if (isDeniedPath(path.relative(base, full))) return null;
  try {
    const stat = fs.statSync(full);
    if (!stat.isFile() || stat.size > 512 * 1024) return null;
    const text = fs.readFileSync(full, 'utf8');
    if (text.includes('\u0000')) return null;
    return truncate(redactSecrets(text), max);
  } catch {
    return null;
  }
}

interface Section {
  title: string;
  body: string;
}

function section(title: string, body: string, budget = SECTION_BUDGET): Section {
  return { title, body: truncate(redactSecrets(body), budget) };
}

async function repositorySections(id: string, parts: Set<string>): Promise<Section[]> {
  const repo = getRepository(id);
  const out: Section[] = [section(`Repository ${repo.name}`, `Name: ${repo.name}\nDescription: ${repo.description ?? '(none)'}`, 500)];

  if (parts.has('analysis')) {
    try {
      const a = await analyzeRepository(id);
      out.push(section('Repository analysis (static, nothing executed)', JSON.stringify(a, null, 1)));
    } catch (e) {
      out.push(section('Repository analysis', `Unavailable: ${(e as Error).message}`, 300));
    }
  }

  if (parts.has('files')) {
    const candidates = ['README.md', 'package.json', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml'];
    const files = candidates
      .map((f) => ({ f, text: readSafeFile(repo.path, f) }))
      .filter((x): x is { f: string; text: string } => Boolean(x.text));
    const body = files.length
      ? files.map((x) => `--- ${x.f} ---\n${x.text}`).join('\n\n')
      : 'No README, package.json, Dockerfile or Compose file at the repository root.';
    out.push(section('Key repository files', body, 9_000));
  }

  if (parts.has('commits')) {
    try {
      const commits = await getCommits(id, 10);
      out.push(
        section(
          'Recent commits',
          commits.map((c) => `${c.shortHash} ${c.date} ${c.author}: ${c.message} (+${c.insertions}/-${c.deletions})`).join('\n') ||
            'No commits',
          2_000,
        ),
      );
    } catch (e) {
      out.push(section('Recent commits', `Unavailable: ${(e as Error).message}`, 300));
    }
  }
  return out;
}

function terraformSection(project: string): Section {
  const dir = resolveTerraformProject(project);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.tf'))
    .sort()
    .slice(0, 12);
  const body = files.map((f) => `--- ${f} ---\n${readSafeFile(dir, f) ?? '(unreadable)'}`).join('\n\n');

  const plan = asRow<{ summary_json: string | null; status: string; created_at: number } | undefined>(
    getDb()
      .prepare('SELECT summary_json, status, created_at FROM terraform_plans WHERE project_path = ? ORDER BY created_at DESC LIMIT 1')
      .get(dir),
  );
  let planText = '';
  if (plan?.summary_json) {
    try {
      const s = JSON.parse(plan.summary_json) as { stdoutExcerpt?: string };
      planText = `\n\n--- latest saved plan (${plan.status}, ${new Date(plan.created_at * 1000).toISOString()}) ---\n${truncate(s.stdoutExcerpt ?? '', 2_000)}`;
    } catch {
      /* ignore malformed summary */
    }
  }
  return section(`Terraform project ${project}`, (body || 'No .tf files') + planText, 8_000);
}

function playbookSection(rel: string): Section {
  const root = path.join(getDevOpsWorkspaceRoot(), 'ansible');
  const text = readSafeFile(root, rel, 5_000);
  return section(`Ansible playbook ${rel}`, text ?? 'Playbook not found under devops/ansible (or not readable)');
}

function puppetSection(): Section {
  const root = path.join(getDevOpsWorkspaceRoot(), 'puppet');
  const manifests: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 3 || manifests.length >= 8) return;
    for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.name.endsWith('.pp')) manifests.push(path.relative(root, full));
    }
  };
  walk(root, 0);
  const body = manifests.map((m) => `--- ${m} ---\n${readSafeFile(root, m, 1_500) ?? ''}`).join('\n\n');
  return section('Puppet manifests', body || 'No Puppet manifests found');
}

function nagiosSection(): Section {
  try {
    const s = readNagiosStatus();
    const f = (o: object, k: string) => String((o as Record<string, unknown>)[k] ?? '');
    const problems = [
      ...s.hosts
        .filter((h) => h.stateLabel !== 'UP')
        .map((h) => `HOST ${f(h, 'host_name')}: ${h.stateLabel} — ${f(h, 'plugin_output')}`),
      ...s.services
        .filter((x) => x.stateLabel !== 'OK')
        .map((x) => `SERVICE ${f(x, 'host_name')}/${f(x, 'service_description')}: ${x.stateLabel} — ${f(x, 'plugin_output')}`),
    ];
    const header = `Source: ${s.isSampleData ? 'SAMPLE DATA (not live monitoring)' : 'live status file'}\nHosts: ${s.hosts.length}, services: ${s.services.length}`;
    return section('Nagios status', `${header}\nProblems:\n${problems.join('\n') || 'none'}`, 3_000);
  } catch (e) {
    return section('Nagios status', `Unavailable: ${(e as Error).message}`, 300);
  }
}

function workflowSection(id: string): Section {
  const wf = getWorkflow(id);
  if (!wf) return section('Workflow', 'Not found', 100);
  return section(`Workflow ${wf.name}`, wf.workflow_json, 5_000);
}

function jobSection(id: string): Section {
  const job = getJob(id);
  const logs = listJobLogs(id)
    .slice(-60)
    .map((l) => `[${l.level}] ${l.message}`)
    .join('\n');
  return section(
    `Job ${job.operation}`,
    `Status: ${job.status}\nSummary: ${job.summary ?? ''}\nError: ${job.error_message ?? ''}\nDuration: ${job.duration_ms ?? '?'} ms\nLogs (latest):\n${logs || '(none)'}`,
    6_000,
  );
}

export interface BuiltContext {
  text: string;
  /** short human label persisted with the message, e.g. "repo:Codigoflow(analysis,files) · job" */
  label: string;
  chars: number;
}

export async function buildContext(req: ContextRequest | undefined): Promise<BuiltContext | null> {
  if (!req) return null;
  const sections: Section[] = [];
  const labels: string[] = [];

  if (req.repositoryId) {
    const parts = new Set(req.repository?.length ? req.repository : ['analysis']);
    const repo = getRepository(req.repositoryId);
    sections.push(...(await repositorySections(req.repositoryId, parts)));
    labels.push(`repo:${repo.name}(${[...parts].join(',')})`);
  }
  if (req.terraformProject) {
    sections.push(terraformSection(req.terraformProject));
    labels.push(`terraform:${req.terraformProject}`);
  }
  if (req.playbook) {
    sections.push(playbookSection(req.playbook));
    labels.push(`ansible:${path.basename(req.playbook)}`);
  }
  if (req.puppet) {
    sections.push(puppetSection());
    labels.push('puppet');
  }
  if (req.nagios) {
    sections.push(nagiosSection());
    labels.push('nagios');
  }
  if (req.workflowId) {
    sections.push(workflowSection(req.workflowId));
    labels.push('workflow');
  }
  if (req.jobId) {
    sections.push(jobSection(req.jobId));
    labels.push('job');
  }
  if (sections.length === 0) return null;

  let text = sections.map((s) => `## ${s.title}\n${s.body}`).join('\n\n');
  text = truncate(text, CONTEXT_BUDGET_CHARS);
  return { text, label: labels.join(' · '), chars: text.length };
}
