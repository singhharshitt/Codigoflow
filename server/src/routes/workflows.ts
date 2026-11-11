import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from '../database/repositories/workflowRepository';
import { createError } from '../middleware/errorHandler';
import {
  validateWorkflowGraph,
  runWorkflowExecution,
  listNodeRuns,
  type WorkflowNodeConfig,
  type WorkflowEdge,
} from '../devops/workflow-engine';

const router = Router();

const WorkflowBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
  workflow_json: z.string().optional(),
});

function toJsonPayload(body: z.infer<typeof WorkflowBodySchema>): string {
  if (body.workflow_json) return body.workflow_json;
  return JSON.stringify({
    name: body.name,
    nodes: body.nodes ?? [],
    edges: body.edges ?? [],
  });
}

function parseGraph(workflowJson: string): {
  nodes: WorkflowNodeConfig[];
  edges: WorkflowEdge[];
} {
  const parsed = JSON.parse(workflowJson) as {
    nodes?: Array<{
      id?: string;
      data?: { kind?: string; label?: string; config?: Record<string, unknown> };
      kind?: string;
      config?: Record<string, unknown>;
    }>;
    edges?: Array<{ id?: string; source: string; target: string }>;
  };

  const nodes: WorkflowNodeConfig[] = (parsed.nodes ?? []).map((n, idx) => ({
    id: n.id ?? `node-${idx}`,
    kind: n.data?.kind ?? n.kind ?? '',
    label: n.data?.label,
    config: n.data?.config ?? n.config ?? {},
  }));
  const edges: WorkflowEdge[] = (parsed.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }));
  return { nodes, edges };
}

function validateStoredWorkflow(workflowJson: string) {
  try {
    const { nodes, edges } = parseGraph(workflowJson);
    return validateWorkflowGraph(nodes, edges);
  } catch {
    return { valid: false, errors: ['workflow_json is not valid JSON'] };
  }
}

router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: listWorkflows() });
  } catch (err) {
    next(err);
  }
});

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = WorkflowBodySchema.parse(req.body);
    const workflow_json = toJsonPayload(body);
    const row = createWorkflow({
      name: body.name,
      description: body.description,
      workflow_json,
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: getWorkflow(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = WorkflowBodySchema.partial({ name: true })
      .extend({
        name: z.string().min(1).max(200).optional(),
      })
      .parse(req.body);
    const existing = getWorkflow(req.params.id);
    const workflow_json = body.workflow_json
      ? body.workflow_json
      : body.nodes || body.edges
        ? toJsonPayload({
            name: body.name ?? existing.name,
            nodes: body.nodes,
            edges: body.edges,
            description: body.description,
          })
        : undefined;
    const row = updateWorkflow(req.params.id, {
      name: body.name,
      description: body.description,
      workflow_json,
    });
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    deleteWorkflow(req.params.id);
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/validate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const wf = getWorkflow(req.params.id);
    const result = validateStoredWorkflow(wf.workflow_json);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/runs/:jobId/nodes', (req: Request, res: Response, next: NextFunction) => {
  try {
    getWorkflow(req.params.id);
    res.json({ success: true, data: listNodeRuns(req.params.jobId) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wf = getWorkflow(req.params.id);
    const { nodes, edges } = parseGraph(wf.workflow_json);
    const validation = validateWorkflowGraph(nodes, edges);
    if (!validation.valid) {
      throw createError(
        `Workflow is not executable: ${validation.errors.join('; ')}`,
        400,
        'WORKFLOW_INVALID',
      );
    }

    const { job, result } = await runWorkflowExecution({
      workflowId: wf.id,
      nodes,
      edges,
    });

    if (job.status === 'failed') {
      res.status(500).json({
        success: false,
        error: {
          message: job.error_message || 'Workflow failed',
          code: 'WORKFLOW_FAILED',
          jobId: job.id,
          nodeRuns: listNodeRuns(job.id),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        job,
        result,
        nodeRuns: listNodeRuns(job.id),
      },
      message: 'Workflow execution completed',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
