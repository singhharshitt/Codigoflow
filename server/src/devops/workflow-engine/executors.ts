import { z } from 'zod';
import {
  terraformFmt,
  terraformInit,
  terraformValidate,
  terraformPlan,
  terraformApply,
} from '../../integrations/terraform';
import {
  validateInventory,
  ansiblePing,
  ansibleFacts,
  validatePlaybook,
  checkPlaybook,
  runPlaybook,
} from '../../integrations/ansible';
import {
  getPuppetStatus,
  validateManifest,
  puppetAgentRun,
  puppetApply,
} from '../../integrations/puppet';
import {
  getNagiosStatus,
  readNagiosStatus,
  runPlugin,
  writeExternalCommand,
} from '../../integrations/nagios';
import type { NodeExecutor, NodeExecutorContext, NodeExecutorResult } from './types';

function ok(result?: unknown, message?: string): NodeExecutorResult {
  return { status: 'succeeded', result, message };
}

function requireApprovalGate(config: Record<string, unknown>, key = 'approve'): void {
  if (config[key] !== true) {
    const err = new Error(`Node requires ${key}: true before execution`);
    (err as Error & { code?: string }).code = 'WAITING_APPROVAL';
    throw err;
  }
}

const ProjectPath = z.object({ projectPath: z.string().min(1) });
const Inventory = z.object({ inventory: z.string().min(1) });
const Playbook = z.object({
  playbook: z.string().min(1),
  inventory: z.string().min(1),
});

function simple(
  kind: string,
  schema: z.ZodTypeAny | null,
  run: (cfg: Record<string, unknown>, ctx: NodeExecutorContext) => Promise<NodeExecutorResult>,
): NodeExecutor {
  return {
    kind,
    validate(config) {
      if (!schema) return { valid: true, errors: [] };
      const parsed = schema.safeParse(config);
      return parsed.success
        ? { valid: true, errors: [] }
        : { valid: false, errors: parsed.error.issues.map((i) => i.message) };
    },
    async preflight(ctx) {
      ctx.log(`Preflight ${kind}`);
    },
    async execute(ctx) {
      return run(ctx.node.config ?? {}, ctx);
    },
    async cancel() {
      return { supported: false, message: 'Cancellation is not supported for this node type' };
    },
  };
}

export const nodeExecutors: NodeExecutor[] = [
  simple('start', null, async () => ok({}, 'Workflow started')),
  simple('end', null, async () => ok({}, 'Workflow finished')),

  simple('terraform.fmt', ProjectPath, async (cfg) =>
    ok(await terraformFmt(String(cfg.projectPath))),
  ),
  simple('terraform.init', ProjectPath, async (cfg) =>
    ok(await terraformInit(String(cfg.projectPath))),
  ),
  simple('terraform.validate', ProjectPath, async (cfg) =>
    ok(await terraformValidate(String(cfg.projectPath))),
  ),
  simple('terraform.plan', ProjectPath, async (cfg) =>
    ok(await terraformPlan(String(cfg.projectPath), String(cfg.workspace ?? 'default'))),
  ),
  simple(
    'terraform.apply',
    z.object({ planId: z.string().min(1), approve: z.boolean() }),
    async (cfg) => {
      requireApprovalGate(cfg);
      return ok(await terraformApply(String(cfg.planId), true, String(cfg.approvedBy ?? 'workflow')));
    },
  ),

  simple('ansible.inventory.validate', Inventory, async (cfg) =>
    ok(await validateInventory(String(cfg.inventory))),
  ),
  simple('ansible.ping', Inventory, async (cfg) =>
    ok(await ansiblePing(String(cfg.inventory), cfg.limit ? String(cfg.limit) : undefined)),
  ),
  simple('ansible.facts', Inventory, async (cfg) =>
    ok(await ansibleFacts(String(cfg.inventory), cfg.limit ? String(cfg.limit) : undefined)),
  ),
  simple('ansible.playbook.validate', z.object({ playbook: z.string().min(1) }), async (cfg) =>
    ok(await validatePlaybook(String(cfg.playbook))),
  ),
  simple('ansible.playbook.check', Playbook, async (cfg) =>
    ok(await checkPlaybook(String(cfg.playbook), String(cfg.inventory), true)),
  ),
  simple(
    'ansible.playbook.run',
    Playbook.extend({ approve: z.boolean() }),
    async (cfg) => {
      requireApprovalGate(cfg);
      return ok(await runPlaybook(String(cfg.playbook), String(cfg.inventory), true));
    },
  ),

  simple('puppet.status', null, async () => ok(await getPuppetStatus())),
  simple('puppet.manifest.validate', z.object({ manifest: z.string().min(1) }), async (cfg) =>
    ok(await validateManifest(String(cfg.manifest))),
  ),
  simple('puppet.agent.noop', null, async () => ok(await puppetAgentRun(true, true))),
  simple('puppet.agent.run', z.object({ approve: z.boolean() }), async (cfg) => {
    requireApprovalGate(cfg);
    return ok(await puppetAgentRun(false, true));
  }),
  simple(
    'puppet.apply',
    z.object({ manifest: z.string().min(1), approve: z.boolean(), noop: z.boolean().optional() }),
    async (cfg) => {
      if (!cfg.noop) requireApprovalGate(cfg);
      return ok(await puppetApply(String(cfg.manifest), Boolean(cfg.noop), Boolean(cfg.approve || cfg.noop)));
    },
  ),

  simple('nagios.status', null, async () => ok(await getNagiosStatus())),
  simple('nagios.check.host', null, async () => {
    const data = readNagiosStatus();
    return ok({ hosts: data.hosts });
  }),
  simple('nagios.check.service', null, async () => {
    const data = readNagiosStatus();
    return ok({ services: data.services });
  }),
  simple('nagios.verify.application', null, async () =>
    ok(await runPlugin('check_codigoflow_http.py', ['-H', '127.0.0.1', '-p', '8080'])),
  ),
  simple(
    'nagios.schedule.downtime',
    z.object({
      host: z.string().min(1),
      start: z.number(),
      end: z.number(),
      comment: z.string().min(1),
      approve: z.boolean(),
      service: z.string().optional(),
    }),
    async (cfg) => {
      requireApprovalGate(cfg);
      const duration = Math.max(0, Number(cfg.end) - Number(cfg.start));
      const cmd = cfg.service
        ? `SCHEDULE_SVC_DOWNTIME;${cfg.host};${cfg.service};${cfg.start};${cfg.end};1;0;${duration};workflow;${cfg.comment}`
        : `SCHEDULE_HOST_DOWNTIME;${cfg.host};${cfg.start};${cfg.end};1;0;${duration};workflow;${cfg.comment}`;
      return ok(writeExternalCommand(cmd, true));
    },
  ),
];
