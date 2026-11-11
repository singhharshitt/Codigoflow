import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Edge, Node } from '@xyflow/react';

export type WorkflowNodeData = {
  label: string;
  kind: string;
  config?: Record<string, string>;
  status?: 'idle' | 'running' | 'succeeded' | 'failed' | 'planned';
};

interface WorkflowStore {
  name: string;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  setName: (name: string) => void;
  setNodes: (nodes: Node<WorkflowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  selectNode: (id: string | null) => void;
  updateNodeData: (id: string, data: Partial<WorkflowNodeData>) => void;
  reset: () => void;
}

const defaultNodes: Node<WorkflowNodeData>[] = [
  {
    id: 'start',
    type: 'cfNode',
    position: { x: 80, y: 160 },
    data: { label: 'Start', kind: 'start', status: 'idle' },
  },
  {
    id: 'end',
    type: 'cfNode',
    position: { x: 520, y: 160 },
    data: { label: 'End', kind: 'end', status: 'idle' },
  },
];

const defaultEdges: Edge[] = [];

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set) => ({
      name: 'Untitled workflow',
      nodes: defaultNodes,
      edges: defaultEdges,
      selectedNodeId: null,
      setName: (name) => set({ name }),
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      selectNode: (id) => set({ selectedNodeId: id }),
      updateNodeData: (id, data) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
          ),
        })),
      reset: () =>
        set({
          name: 'Untitled workflow',
          nodes: defaultNodes,
          edges: defaultEdges,
          selectedNodeId: null,
        }),
    }),
    { name: 'cf-workflow-editor' },
  ),
);
