import fs from 'fs';
import path from 'path';
import { runDevOpsPreflight, getDevOpsWorkspaceRoot } from './preflight';

export type StageStatus = 'ready' | 'blocked' | 'degraded';

export interface PipelineStageReport {
  id: string;
  name: string;
  status: StageStatus;
  blockers: string[];
  evidence: string[];
}

/**
 * Honest readiness report for Terraform → Ansible → Puppet → Nagios.
 * Does not claim execution success; only reports whether stages can run.
 */
export async function assessPipelineReadiness() {
  const preflight = await runDevOpsPreflight();
  const { control, tools } = preflight;
  const root = getDevOpsWorkspaceRoot();

  const tool = (name: string) => tools.find((t) => t.name === name);

  const terraform = tool('terraform');
  const ansible = tool('ansible');
  const playbook = tool('ansible-playbook');
  const puppet = tool('puppet');
  const nagios = tool('nagios');

  const sampleStatus = path.join(root, 'nagios', 'config', 'status.dat.sample');
  const hasNagiosStatus =
    Boolean(process.env.NAGIOS_STATUS_FILE && fs.existsSync(process.env.NAGIOS_STATUS_FILE)) ||
    fs.existsSync(sampleStatus);

  const stages: PipelineStageReport[] = [
    {
      id: 'preflight',
      name: 'Control node preflight',
      status: control.available ? 'ready' : 'blocked',
      blockers: control.available ? [] : [control.detail || 'Control node unavailable'],
      evidence: [`mode=${control.mode}`, `available=${control.available}`],
    },
    {
      id: 'terraform',
      name: 'Terraform provision',
      status: terraform?.available ? 'ready' : 'blocked',
      blockers: terraform?.available
        ? []
        : [terraform?.error || 'terraform binary missing on control node'],
      evidence: [
        `workspace=${path.join(root, 'terraform')}`,
        `awsModule=${fs.existsSync(path.join(root, 'terraform', 'aws'))}`,
      ],
    },
    {
      id: 'ansible',
      name: 'Ansible deploy',
      status: ansible?.available && playbook?.available ? 'ready' : 'blocked',
      blockers:
        ansible?.available && playbook?.available
          ? []
          : ['ansible and/or ansible-playbook missing on control node'],
      evidence: [
        `playbooks=${fs.existsSync(path.join(root, 'ansible', 'playbooks'))}`,
        `inventory=${fs.existsSync(path.join(root, 'ansible', 'inventory', 'lab.ini'))}`,
      ],
    },
    {
      id: 'puppet',
      name: 'Puppet enforce',
      status: puppet?.available ? 'ready' : 'blocked',
      blockers: puppet?.available ? [] : [puppet?.error || 'puppet binary missing'],
      evidence: [
        `manifests=${fs.existsSync(path.join(root, 'puppet', 'manifests', 'site.pp'))}`,
        `driftModule=${fs.existsSync(
          path.join(root, 'puppet', 'modules', 'codigoflow_app', 'manifests', 'drift.pp'),
        )}`,
      ],
    },
    {
      id: 'nagios',
      name: 'Nagios verify',
      status: nagios?.available ? 'ready' : hasNagiosStatus ? 'degraded' : 'blocked',
      blockers: nagios?.available
        ? []
        : hasNagiosStatus
          ? ['Live nagios binary missing; sample/status file parsing only']
          : ['Nagios binary and status file unavailable'],
      evidence: [
        `statusFileConfigured=${Boolean(process.env.NAGIOS_STATUS_FILE)}`,
        `sampleStatus=${fs.existsSync(sampleStatus)}`,
        `plugins=${fs.existsSync(path.join(root, 'nagios', 'plugins'))}`,
      ],
    },
  ];

  const blocked = stages.filter((s) => s.status === 'blocked').map((s) => s.id);
  const degraded = stages.filter((s) => s.status === 'degraded').map((s) => s.id);
  const pipelineExecutable = stages.every((s) => s.status === 'ready');

  return {
    timestamp: new Date().toISOString(),
    control,
    tools,
    preflightReady: preflight.ready,
    missingTools: preflight.missing,
    stages,
    blockedStages: blocked,
    degradedStages: degraded,
    pipelineExecutable,
    realInfrastructureExecutable: Boolean(
      terraform?.available &&
        ansible?.available &&
        playbook?.available &&
        puppet?.available &&
        nagios?.available,
    ),
    notes: [
      'pipelineExecutable requires every stage ready (Nagios degraded is not enough).',
      'realInfrastructureExecutable requires live binaries for all four tools.',
      'Do not claim cloud provisioning success without apply evidence from an approved plan.',
    ],
  };
}
