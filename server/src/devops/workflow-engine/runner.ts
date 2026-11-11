import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database';
import { asRows } from '../../utils/dbCast';
import { createError } from '../../middleware/errorHandler';
import { runJob } from '../../jobs/jobService';
import { getExecutor, isExecutableKind } from './registry';
import type { NodeRunStatus, WorkflowEdge, WorkflowNodeConfig } from './types';

const activeWorkflowRuns = new Set<string>();

export function validateWorkflowGraph(nodes: WorkflowNodeConfig[], edges: WorkflowEdge[]) {
  const errors: string[] = [];
  if (!Array.isArray(nodes) || nodes.length === 0) errors.push('Workflow has no nodes');
  if (!Array.isArray(edges)) errors.push('edges must be an array');

  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id) errors.push('Node missing id');
    else if (ids.has(node.id)) errors.push(`Duplicate node id ${node.id}`);
    else ids.add(node.id);

    const kind = node.kind || '';
    if (String(kind).startsWith('future')) {
      errors.push(`Node ${node.id} uses planned integration '${kind}' and is not executable`);
      continue;
    }
    if (!isExecutableKind(kind)) {
      errors.push(`Node ${node.id} kind '${kind}' has no executor`);
      continue;
    }
    const executor = getExecutor(kind)!;
    const v = executor.validate(node.config ?? {});
    if (!v.valid) errors.push(`Node ${node.id}: ${v.errors.join('; ')}`);
  }

  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      errors.push(`Edge references missing node (${edge.source} -> ${edge.target})`);
    }
  }

  // Cycle detection (DFS)
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const edge of edges) adj.get(edge.source)?.push(edge.target);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adj.get(id) ?? []) {
      if (hasCycle(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of ids) {
    if (hasCycle(id)) {
      errors.push('Workflow graph contains a cycle');
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

export function topologicalOrder(nodes: WorkflowNodeConfig[], edges: WorkflowEdge[]): string[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.source) || !indeg.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (indeg.get(next) ?? 1) - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (order.length !== nodes.length) {
    throw createError('Cannot order workflow nodes (cycle or disconnected deps)', 400, 'WORKFLOW_ORDER');
  }
  return order;
}

function persistNodeRun(input: {
  workflowRunId: string;
  nodeId: string;
  nodeKind: string;
  status: NodeRunStatus;
  startedAt?: number;
  finishedAt?: number;
  logExcerpt?: string;
  resultJson?: string;
  errorMessage?: string;
}) {
  const id = uuidv4();
  getDb()
    .prepare(
      `INSERT INTO workflow_node_runs
       (id, workflow_run_id, node_id, node_kind, status, started_at, finished_at, log_excerpt, result_json, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.workflowRunId,
      input.nodeId,
      input.nodeKind,
      input.status,
      input.startedAt ?? null,
      input.finishedAt ?? null,
      input.logExcerpt ?? null,
      input.resultJson ?? null,
      input.errorMessage ?? null,
    );
  return id;
}

export function listNodeRuns(workflowRunId: string) {
  return asRows(
    getDb()
      .prepare(
        `SELECT * FROM workflow_node_runs WHERE workflow_run_id = ? ORDER BY started_at ASC`,
      )
      .all(workflowRunId),
  );
}

export async function runWorkflowExecution(input: {
  workflowId: string;
  nodes: WorkflowNodeConfig[];
  edges: WorkflowEdge[];
}) {
  if (activeWorkflowRuns.has(input.workflowId)) {
    throw createError('Workflow is already running', 409, 'WORKFLOW_BUSY');
  }

  const validation = validateWorkflowGraph(input.nodes, input.edges);
  if (!validation.valid) {
    throw createError(
      `Workflow is not executable: ${validation.errors.join('; ')}`,
      400,
      'WORKFLOW_INVALID',
    );
  }

  const order = topologicalOrder(input.nodes, input.edges);
  const byId = new Map(input.nodes.map((n) => [n.id, n]));

  activeWorkflowRuns.add(input.workflowId);
  try {
    return await runJob(
      {
        operation: 'workflow.run',
        type: 'workflow',
        summary: `workflow:${input.workflowId}`,
      },
      async (ctx) => {
        const workflowRunId = ctx.jobId;
        const nodeResults: Record<string, unknown> = {};

        for (const nodeId of order) {
          if (ctx.isCancelled()) {
            persistNodeRun({
              workflowRunId,
              nodeId,
              nodeKind: byId.get(nodeId)?.kind ?? 'unknown',
              status: 'cancelled',
              errorMessage: 'Cancelled',
            });
            throw new Error('Workflow cancelled');
          }

          const node = byId.get(nodeId)!;
          const executor = getExecutor(node.kind)!;
          const startedAt = Math.floor(Date.now() / 1000);
          ctx.log(`Node ${nodeId} (${node.kind}) running`);

          try {
            await executor.preflight({
              node,
              log: ctx.log,
              isCancelled: ctx.isCancelled,
            });
            const result = await executor.execute({
              node,
              log: ctx.log,
              isCancelled: ctx.isCancelled,
            });
            const finishedAt = Math.floor(Date.now() / 1000);
            persistNodeRun({
              workflowRunId,
              nodeId,
              nodeKind: node.kind,
              status: result.status,
              startedAt,
              finishedAt,
              logExcerpt: result.message,
              resultJson: JSON.stringify(result.result ?? null).slice(0, 8000),
            });
            nodeResults[nodeId] = result;
            if (result.status === 'failed') {
              throw new Error(result.message || `Node ${nodeId} failed`);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
            const status: NodeRunStatus =
              code === 'WAITING_APPROVAL' ? 'waiting_approval' : 'failed';
            persistNodeRun({
              workflowRunId,
              nodeId,
              nodeKind: node.kind,
              status,
              startedAt,
              finishedAt: Math.floor(Date.now() / 1000),
              errorMessage: message,
            });
            // Skip downstream nodes
            const remaining = order.slice(order.indexOf(nodeId) + 1);
            for (const skippedId of remaining) {
              persistNodeRun({
                workflowRunId,
                nodeId: skippedId,
                nodeKind: byId.get(skippedId)?.kind ?? 'unknown',
                status: 'skipped',
                errorMessage: `Skipped due to upstream ${status}`,
              });
            }
            throw err;
          }
        }

        return { workflowRunId, nodeResults, order };
      },
    );
  } finally {
    activeWorkflowRuns.delete(input.workflowId);
  }
}
