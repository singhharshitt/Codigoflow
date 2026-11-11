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

function validateGraph(workflowJson: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let parsed: { nodes?: unknown[]; edges?: unknown[] };
  try {
    parsed = JSON.parse(workflowJson);
  } catch {
    return { valid: false, errors: ['workflow_json is not valid JSON'] };
  }
  if (!Array.isArray(parsed.nodes)) errors.push('nodes must be an array');
  if (!Array.isArray(parsed.edges)) errors.push('edges must be an array');

  const nodes = (parsed.nodes ?? []) as { id?: string; data?: { kind?: string } }[];
  for (const node of nodes) {
    const kind = node.data?.kind ?? '';
    if (String(kind).startsWith('future')) {
      errors.push(`Node ${node.id ?? '?'} uses planned integration '${kind}' and is not executable`);
    }
  }
  return { valid: errors.length === 0, errors };
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
    const body = WorkflowBodySchema.partial({ name: true }).extend({
      name: z.string().min(1).max(200).optional(),
    }).parse(req.body);
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
    const result = validateGraph(wf.workflow_json);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/run', (req: Request, res: Response, next: NextFunction) => {
  try {
    const wf = getWorkflow(req.params.id);
    const validation = validateGraph(wf.workflow_json);
    if (!validation.valid) {
      throw createError(
        `Workflow is not executable: ${validation.errors.join('; ')}`,
        400,
        'WORKFLOW_INVALID',
      );
    }
    // Execution engine for real node runners arrives in a later phase.
    throw createError(
      'Workflow execution is not enabled yet. Persistence and validation are available.',
      501,
      'WORKFLOW_EXECUTION_UNAVAILABLE',
    );
  } catch (err) {
    next(err);
  }
});

export default router;
