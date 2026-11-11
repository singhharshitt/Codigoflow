export type NodeRunStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting_approval'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface WorkflowNodeConfig {
  id: string;
  kind: string;
  label?: string;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
}

export interface NodeExecutorContext {
  node: WorkflowNodeConfig;
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;
  isCancelled: () => boolean;
}

export interface NodeExecutorResult {
  status: NodeRunStatus;
  result?: unknown;
  message?: string;
  requiresApproval?: boolean;
}

export interface NodeExecutor {
  kind: string;
  validate(config: Record<string, unknown>): { valid: boolean; errors: string[] };
  preflight(ctx: NodeExecutorContext): Promise<void>;
  execute(ctx: NodeExecutorContext): Promise<NodeExecutorResult>;
  getStatus?(): Promise<NodeRunStatus>;
  getLogs?(): Promise<string[]>;
  cancel?(ctx: NodeExecutorContext): Promise<{ supported: boolean; message: string }>;
}
