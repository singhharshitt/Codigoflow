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
  ai: 'border-cf-violet/50',
  commit: 'border-cf-red/40',
  push: 'border-cf-red/50',
  planned: 'border-cf-warning/40 border-dashed',
};

function WorkflowNodeComponent({ data, selected }: NodeProps & { data: WorkflowNodeData }) {
  const kindKey = data.kind.startsWith('future') ? 'planned' : data.kind.split('-')[0];
  return (
    <div
      className={clsx(
        'min-w-[150px] rounded-xl border bg-cf-card px-3 py-2 shadow-panel',
        KIND_COLOR[kindKey] ?? 'border-cf-border',
        selected && 'ring-2 ring-cf-cyan/60 shadow-glow-cyan',
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-cf-cyan !w-2 !h-2 !border-0" />
      <div className="text-[10px] uppercase tracking-wider text-cf-faint">{data.kind}</div>
      <div className="text-sm font-medium text-cf-text mt-0.5">{data.label}</div>
      {data.status && data.status !== 'idle' && (
        <div className="text-[10px] mt-1 text-cf-cyan">{data.status}</div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-cf-red !w-2 !h-2 !border-0" />
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
