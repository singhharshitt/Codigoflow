import fs from 'fs';
import path from 'path';
import { getRepository } from './repositoryService';
import { createError } from '../middleware/errorHandler';

export type Confidence = 'detected' | 'inferred' | 'recommended';

export type AnalysisFinding = {
  key: string;
  value: string | boolean | number | string[] | null;
  confidence: Confidence;
  evidence?: string;
};

export type DeployRecommendation = {
  tool: 'docker' | 'terraform' | 'ansible' | 'puppet' | 'nagios' | 'workflow';
  action: string;
  confidence: Confidence;
  rationale: string;
};

export type ProposedWorkflowNode = {
  id: string;
  type: 'cfNode';
  position: { x: number; y: number };
  data: {
    label: string;
    kind: string;
    status: 'idle';
    config: Record<string, unknown>;
  };
};

export type ProposedWorkflowEdge = {
  id: string;
  source: string;
  target: string;
  style?: { stroke: string; strokeWidth: number };
};

function exists(root: string, rel: string): boolean {
  try {
    return fs.existsSync(path.join(root, rel));
  } catch {
    return false;
  }
}

function readTextSafe(root: string, rel: string, max = 80_000): string | null {
  const full = path.join(root, rel);
  if (!full.startsWith(path.resolve(root))) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return fs.readFileSync(full, 'utf8').slice(0, max);
}

function parsePackageJson(raw: string | null): {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
} | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      engines?: Record<string, string>;
    };
  } catch {
    return null;
  }
}

function envVarNamesFromExample(raw: string | null): string[] {
  if (!raw) return [];
  const names = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m) names.add(m[1]);
  }
  return [...names].slice(0, 40);
}

function detectPort(pkgScripts: Record<string, string> | undefined, dockerfile: string | null): number | null {
  const hay = `${Object.values(pkgScripts ?? {}).join('\n')}\n${dockerfile ?? ''}`;
  const m = hay.match(/(?:PORT|--port|-p)\s*[=:]?\s*(\d{2,5})/i) || hay.match(/EXPOSE\s+(\d{2,5})/i);
  if (m) return Number(m[1]);
  if (pkgScripts?.start?.includes('express') || hay.includes('express')) return 3000;
  return null;
}

/**
 * Static repository analysis — reads files only; never executes package scripts or Docker.
 */
export async function analyzeRepository(repositoryId: string) {
  const repo = getRepository(repositoryId);
  const root = path.resolve(repo.path);
  if (!fs.existsSync(root)) {
    throw createError('Repository path missing on disk', 404, 'REPO_PATH_MISSING');
  }

  const findings: AnalysisFinding[] = [];
  const pkgRaw = readTextSafe(root, 'package.json');
  const pkg = parsePackageJson(pkgRaw);
  const hasDockerfile = exists(root, 'Dockerfile') || exists(root, 'dockerfile');
  const hasCompose =
    exists(root, 'docker-compose.yml') ||
    exists(root, 'docker-compose.yaml') ||
    exists(root, 'compose.yml');
  const hasTerraform = exists(root, 'main.tf') || exists(root, 'terraform') || exists(root, 'infra');
  const hasAnsible = exists(root, 'ansible') || exists(root, 'playbook.yml') || exists(root, 'playbooks');
  const hasPuppet = exists(root, 'manifests') || exists(root, 'puppet');
  const hasRequirements = exists(root, 'requirements.txt');
  const hasGoMod = exists(root, 'go.mod');
  const hasCargo = exists(root, 'Cargo.toml');
  const hasPom = exists(root, 'pom.xml');
  const dockerfile = hasDockerfile
    ? readTextSafe(root, exists(root, 'Dockerfile') ? 'Dockerfile' : 'dockerfile')
    : null;
  const envNames = [
    ...envVarNamesFromExample(readTextSafe(root, '.env.example')),
    ...envVarNamesFromExample(readTextSafe(root, '.env.sample')),
  ];

  let stack = 'unknown';
  let stackConfidence: Confidence = 'inferred';
  if (pkg) {
    stack = 'node';
    stackConfidence = 'detected';
    findings.push({
      key: 'runtime',
      value: 'Node.js',
      confidence: 'detected',
      evidence: 'package.json',
    });
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.express || deps['@nestjs/core'] || deps.fastify || deps.koa) {
      findings.push({
        key: 'framework',
        value: deps.express
          ? 'Express'
          : deps['@nestjs/core']
            ? 'NestJS'
            : deps.fastify
              ? 'Fastify'
              : 'Koa',
        confidence: 'detected',
        evidence: 'package.json dependencies',
      });
    }
    if (pkg.scripts?.build) {
      findings.push({
        key: 'buildCommand',
        value: 'npm run build',
        confidence: 'detected',
        evidence: 'package.json scripts.build',
      });
    }
    if (pkg.scripts?.start) {
      findings.push({
        key: 'startCommand',
        value: 'npm start',
        confidence: 'detected',
        evidence: 'package.json scripts.start',
      });
    } else if (pkg.scripts?.dev) {
      findings.push({
        key: 'startCommand',
        value: 'npm run dev',
        confidence: 'inferred',
        evidence: 'package.json scripts.dev (dev-only; confirm for production)',
      });
    }
    if (pkg.engines?.node) {
      findings.push({
        key: 'nodeEngine',
        value: pkg.engines.node,
        confidence: 'detected',
        evidence: 'package.json engines.node',
      });
    }
  } else if (hasRequirements) {
    stack = 'python';
    stackConfidence = 'detected';
    findings.push({ key: 'runtime', value: 'Python', confidence: 'detected', evidence: 'requirements.txt' });
  } else if (hasGoMod) {
    stack = 'go';
    stackConfidence = 'detected';
    findings.push({ key: 'runtime', value: 'Go', confidence: 'detected', evidence: 'go.mod' });
  } else if (hasCargo) {
    stack = 'rust';
    stackConfidence = 'detected';
    findings.push({ key: 'runtime', value: 'Rust', confidence: 'detected', evidence: 'Cargo.toml' });
  } else if (hasPom) {
    stack = 'java';
    stackConfidence = 'detected';
    findings.push({ key: 'runtime', value: 'Java', confidence: 'detected', evidence: 'pom.xml' });
  }

  findings.push({
    key: 'dockerfile',
    value: hasDockerfile,
    confidence: hasDockerfile ? 'detected' : 'inferred',
    evidence: hasDockerfile ? 'Dockerfile present' : 'No Dockerfile found',
  });
  findings.push({
    key: 'dockerCompose',
    value: hasCompose,
    confidence: hasCompose ? 'detected' : 'inferred',
  });
  findings.push({
    key: 'terraformHints',
    value: hasTerraform,
    confidence: hasTerraform ? 'detected' : 'inferred',
  });
  findings.push({
    key: 'ansibleHints',
    value: hasAnsible,
    confidence: hasAnsible ? 'detected' : 'inferred',
  });
  findings.push({
    key: 'puppetHints',
    value: hasPuppet,
    confidence: hasPuppet ? 'detected' : 'inferred',
  });

  const port = detectPort(pkg?.scripts, dockerfile);
  if (port != null) {
    findings.push({
      key: 'likelyPort',
      value: port,
      confidence: dockerfile?.match(/EXPOSE/i) ? 'detected' : 'inferred',
      evidence: dockerfile?.match(/EXPOSE/i) ? 'Dockerfile EXPOSE' : 'scripts / heuristics',
    });
  }

  if (envNames.length) {
    findings.push({
      key: 'envVarNames',
      value: envNames,
      confidence: 'detected',
      evidence: '.env.example / .env.sample (names only; values never read from .env)',
    });
  }

  const recommendations: DeployRecommendation[] = [];
  if (hasDockerfile || stack === 'node') {
    recommendations.push({
      tool: 'docker',
      action: hasDockerfile
        ? 'Build using existing Dockerfile'
        : 'Add a Dockerfile before production packaging',
      confidence: hasDockerfile ? 'detected' : 'recommended',
      rationale: hasDockerfile
        ? 'Dockerfile detected in repository root'
        : 'Node apps are typically packaged with Docker in CódigoFlow pipelines',
    });
  }
  recommendations.push({
    tool: 'terraform',
    action: 'Provision infrastructure with an approved Terraform plan',
    confidence: hasTerraform ? 'detected' : 'recommended',
    rationale: hasTerraform
      ? 'Terraform files detected in the repository'
      : 'Use CódigoFlow DevOps Terraform projects (e.g. local-lab / aws) with explicit approval',
  });
  recommendations.push({
    tool: 'ansible',
    action: 'Deploy application release via allowlisted playbook',
    confidence: hasAnsible ? 'detected' : 'recommended',
    rationale: 'Ansible owns deployment sequencing after infrastructure is ready',
  });
  recommendations.push({
    tool: 'puppet',
    action: 'Enforce OS baseline (noop → approve → apply)',
    confidence: hasPuppet ? 'detected' : 'recommended',
    rationale: 'Puppet owns long-lived configuration drift correction',
  });
  recommendations.push({
    tool: 'nagios',
    action: 'Verify host and application health after deploy',
    confidence: 'recommended',
    rationale: 'Nagios owns monitoring verification; sample status is never live',
  });
  recommendations.push({
    tool: 'workflow',
    action: 'Review the proposed Terraform→Ansible→Puppet→Nagios workflow before execution',
    confidence: 'recommended',
    rationale: 'CódigoFlow orchestrates tools; it does not auto-apply destructive changes',
  });

  return {
    repositoryId: repo.id,
    repositoryName: repo.name,
    path: repo.path,
    stack: { name: stack, confidence: stackConfidence },
    findings,
    recommendations,
    limitations: [
      'Analysis is static filesystem inspection only — no scripts were executed.',
      'Inferred values require user confirmation before deployment.',
      'Secret values are never read from .env files.',
    ],
  };
}

/** Build a reviewable workflow graph using existing executor kinds (approve flags false). */
export function proposeDeploymentWorkflow(analysis: Awaited<ReturnType<typeof analyzeRepository>>) {
  const y = 160;
  const nodes: ProposedWorkflowNode[] = [
    {
      id: 'start',
      type: 'cfNode',
      position: { x: 40, y },
      data: { label: 'Start', kind: 'start', status: 'idle', config: {} },
    },
    {
      id: 'tf-init',
      type: 'cfNode',
      position: { x: 200, y },
      data: {
        label: 'Terraform Init',
        kind: 'terraform.init',
        status: 'idle',
        config: { projectPath: 'local-lab' },
      },
    },
    {
      id: 'tf-validate',
      type: 'cfNode',
      position: { x: 380, y },
      data: {
        label: 'Terraform Validate',
        kind: 'terraform.validate',
        status: 'idle',
        config: { projectPath: 'local-lab' },
      },
    },
    {
      id: 'tf-plan',
      type: 'cfNode',
      position: { x: 560, y },
      data: {
        label: 'Terraform Plan',
        kind: 'terraform.plan',
        status: 'idle',
        config: { projectPath: 'local-lab', workspace: 'default' },
      },
    },
    {
      id: 'ans-validate',
      type: 'cfNode',
      position: { x: 740, y },
      data: {
        label: 'Ansible Inventory Validate',
        kind: 'ansible.inventory.validate',
        status: 'idle',
        config: { inventory: 'inventories/lab.ini' },
      },
    },
    {
      id: 'ans-check',
      type: 'cfNode',
      position: { x: 920, y },
      data: {
        label: 'Ansible Playbook Check',
        kind: 'ansible.playbook.check',
        status: 'idle',
        config: {
          playbook: 'playbooks/health-check.yml',
          inventory: 'inventories/lab.ini',
          approveCheck: true,
        },
      },
    },
    {
      id: 'puppet-noop',
      type: 'cfNode',
      position: { x: 1100, y },
      data: {
        label: 'Puppet No-op',
        kind: 'puppet.agent.noop',
        status: 'idle',
        config: {},
      },
    },
    {
      id: 'nagios-status',
      type: 'cfNode',
      position: { x: 1280, y },
      data: {
        label: 'Nagios Status',
        kind: 'nagios.status',
        status: 'idle',
        config: {},
      },
    },
    {
      id: 'end',
      type: 'cfNode',
      position: { x: 1460, y },
      data: { label: 'End', kind: 'end', status: 'idle', config: {} },
    },
  ];

  const chain = [
    'start',
    'tf-init',
    'tf-validate',
    'tf-plan',
    'ans-validate',
    'ans-check',
    'puppet-noop',
    'nagios-status',
    'end',
  ];
  const edges: ProposedWorkflowEdge[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    edges.push({
      id: `e-${chain[i]}-${chain[i + 1]}`,
      source: chain[i],
      target: chain[i + 1],
      style: { stroke: '#38DFFF', strokeWidth: 1.5 },
    });
  }

  return {
    name: `Deploy: ${analysis.repositoryName}`,
    description:
      'Proposed guided pipeline (safe/check stages). Destructive apply/run nodes omitted until you add approve:true explicitly.',
    repositoryId: analysis.repositoryId,
    stack: analysis.stack,
    basedOn: analysis.findings.map((f) => f.key),
    reviewRequired: true,
    autoExecute: false,
    notes: [
      'This proposal is recommended, not verified fact.',
      'Terraform apply / Ansible run / Puppet apply require separate explicit approvals.',
      analysis.stack.name === 'node' && !analysis.findings.find((f) => f.key === 'dockerfile' && f.value === true)
        ? 'No Dockerfile detected — add packaging before production deploy.'
        : null,
    ].filter(Boolean),
    nodes,
    edges,
  };
}

export async function analyzeAndPropose(repositoryId: string) {
  const analysis = await analyzeRepository(repositoryId);
  const proposal = proposeDeploymentWorkflow(analysis);
  return { analysis, proposal };
}
