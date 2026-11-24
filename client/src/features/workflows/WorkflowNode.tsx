import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import type { WorkflowNodeData } from '../../stores/workflowStore';

const KIND_COLOR: Record<string, string> = {
  start: 'border-cf-success/50',
  end: 'border-cf-faint/50',
  git: 'border-cf-cyan/50',
  test: 'border-cf-royal/50',
  docker: 'border-cf-cyan/40',
  ai: 'border-cf-faint/50',
  commit: 'border-cf-red/40',
  push: 'border-cf-red/50',
  planned: 'border-cf-warning/40 border-dashed',
};

function WorkflowNodeComponent({ data, selected }: NodeProps & { data: WorkflowNodeData }) {
  const kindKey = data.kind.startsWith('future') ? 'planned' : data.kind.split('-')[0];
  return (
    <div
      className={clsx(
        'min-w-[160px] rounded-xl border bg-cf-card px-3 py-2.5 transition-colors',
        KIND_COLOR[kindKey] ?? 'border-cf-border',
        selected && 'ring-2 ring-cf-cyan/50',
        data.status === 'failed' && 'border-cf-error/70',
        data.status === 'succeeded' && 'border-cf-success/60',
        data.status === 'skipped' && 'opacity-60',
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-cf-faint" />
      <div className="font-mono text-[11px] text-cf-faint">{data.kind}</div>
      <div className="text-sm font-medium text-cf-text mt-0.5">{data.label}</div>
      {data.status && data.status !== 'idle' && (
        <div className={clsx('mt-1 font-mono text-[11px]', data.status === 'failed' ? 'text-cf-error' : data.status === 'succeeded' ? 'text-cf-success' : 'text-cf-muted')}>{data.status}</div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-cf-red !w-2 !h-2 !border-0" />
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
