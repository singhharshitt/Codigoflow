import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index';
import { asRow, asRows } from '../../utils/dbCast';
import { createError } from '../../middleware/errorHandler';

export interface WorkflowRecord {
  id: string;
  name: string;
  description?: string | null;
  workflow_json: string;
  created_at: number;
  updated_at: number;
}

export function listWorkflows(): WorkflowRecord[] {
  return asRows<WorkflowRecord>(
    getDb().prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all(),
  );
}

export function getWorkflow(id: string): WorkflowRecord {
  const row = asRow<WorkflowRecord | undefined>(
    getDb().prepare('SELECT * FROM workflows WHERE id = ?').get(id),
  );
  if (!row) throw createError(`Workflow ${id} not found`, 404, 'WORKFLOW_NOT_FOUND');
  return row;
}

export function createWorkflow(input: {
  name: string;
  description?: string;
  workflow_json: string;
}): WorkflowRecord {
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `INSERT INTO workflows (id, name, description, workflow_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.name, input.description ?? null, input.workflow_json, now, now);
  return getWorkflow(id);
}

export function updateWorkflow(
  id: string,
  input: { name?: string; description?: string; workflow_json?: string },
): WorkflowRecord {
  const existing = getWorkflow(id);
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `UPDATE workflows
       SET name = ?, description = ?, workflow_json = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      input.name ?? existing.name,
      input.description ?? existing.description ?? null,
      input.workflow_json ?? existing.workflow_json,
      now,
      id,
    );
  return getWorkflow(id);
}

export function deleteWorkflow(id: string): void {
  const result = getDb().prepare('DELETE FROM workflows WHERE id = ?').run(id) as {
    changes: number;
  };
  if (result.changes === 0) {
    throw createError(`Workflow ${id} not found`, 404, 'WORKFLOW_NOT_FOUND');
  }
}
