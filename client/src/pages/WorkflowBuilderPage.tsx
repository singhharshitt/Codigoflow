import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Node,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Save, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowNode } from '../features/workflows/WorkflowNode';
import { useWorkflowStore, type WorkflowNodeData } from '../stores/workflowStore';
import { workflowService } from '../services/api';
import { PageHeader, Button, Input, Alert, Badge } from '../components/ui';
import { PageBackground } from '../components/shared';

const LIBRARY: { kind: string; label: string; planned?: boolean }[] = [
  { kind: 'start', label: 'Start' },
  { kind: 'git-validation', label: 'Git Validation' },
  { kind: 'run-tests', label: 'Run Tests' },
  { kind: 'docker-build', label: 'Docker Build' },
  { kind: 'docker-health', label: 'Docker Health Check' },
  { kind: 'ai-analysis', label: 'AI Analysis' },
  { kind: 'commit', label: 'Commit' },
  { kind: 'push', label: 'Push' },
  { kind: 'end', label: 'End' },
  { kind: 'future-terraform', label: 'Terraform Provisioning', planned: true },
  { kind: 'future-ansible', label: 'Ansible Deployment', planned: true },
  { kind: 'future-puppet', label: 'Puppet Configuration', planned: true },
  { kind: 'future-nagios', label: 'Nagios Monitoring', planned: true },
];

const nodeTypes = { cfNode: WorkflowNode };

export function WorkflowBuilderPage() {
  const {
    name,
    nodes: storedNodes,
    edges: storedEdges,
    selectedNodeId,
    setName,
    setNodes: persistNodes,
    setEdges: persistEdges,
    selectNode,
    updateNodeData,
    reset,
  } = useWorkflowStore();

  const [nodes, setNodes, onNodesChange] = useNodesState(storedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storedEdges);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) as Node<WorkflowNodeData> | undefined,
    [nodes, selectedNodeId],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          { ...connection, style: { stroke: '#38DFFF', strokeWidth: 1.5 } },
          eds,
        );
        persistEdges(next);
        return next;
      });
    },
    [persistEdges, setEdges],
  );

  function addLibraryNode(item: (typeof LIBRARY)[number]) {
    const id = `${item.kind}-${crypto.randomUUID().slice(0, 8)}`;
    const node: Node<WorkflowNodeData> = {
      id,
      type: 'cfNode',
      position: { x: 180 + Math.random() * 220, y: 80 + Math.random() * 220 },
      data: {
        label: item.label,
        kind: item.kind,
        status: item.planned ? 'planned' : 'idle',
        config: {},
      },
    };
    setNodes((ns) => {
      const next = [...ns, node];
      persistNodes(next);
      return next;
    });
  }

  function deleteSelected() {
    if (!selectedNodeId) return;
    if (selectedNodeId === 'start' || selectedNodeId === 'end') {
      toast.error('Start/End nodes cannot be removed');
      return;
    }
    setNodes((ns) => {
      const next = ns.filter((n) => n.id !== selectedNodeId);
      persistNodes(next);
      return next;
    });
    setEdges((eds) => {
      const next = eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId);
      persistEdges(next);
      return next;
    });
    selectNode(null);
  }

  async function handleSave() {
    persistNodes(nodes);
    persistEdges(edges);
    const res = await workflowService.save({ name, nodes, edges });
    if (!res.success) {
      toast.message('Saved locally', {
        description:
          res.error?.message ??
          'Workflow backend is not available yet. Canvas state is stored in this browser.',
      });
      return;
    }
    toast.success('Workflow saved');
  }

  function validateGraph() {
    const orphan = nodes.filter(
      (n) =>
        n.id !== 'start' &&
        n.id !== 'end' &&
        !edges.some((e) => e.source === n.id || e.target === n.id),
    );
    if (orphan.length) {
      toast.warning(`${orphan.length} unconnected node(s)`);
    } else {
      toast.success('All nodes are connected');
    }
  }

  return (
    <div className="page-shell relative !space-y-4">
      <PageBackground showWeb={false} />
      <PageHeader
        title="Visual Workflow Builder"
        description="Compose Git → test → Docker → AI pipelines. Future infra nodes are marked planned and are not executable."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={validateGraph}>
              Validate
            </Button>
            <Button variant="secondary" onClick={() => { reset(); setNodes(useWorkflowStore.getState().nodes); setEdges([]); }}>
              Reset
            </Button>
            <Button onClick={() => void handleSave()}>
              <Save className="w-4 h-4" /> Save
            </Button>
          </div>
        }
      />

      <Alert variant="info" className="relative z-10">
        Execution is disabled until matching backend job runners exist. Saving persists the canvas locally;
        server sync is attempted when `/api/workflows` is available.
      </Alert>

      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[220px_1fr_260px] gap-3 min-h-[640px]">
        <aside className="card !p-3 space-y-2 overflow-y-auto max-h-[640px]">
          <div className="section-title">Node library</div>
          {LIBRARY.map((item) => (
            <button
              key={item.kind}
              type="button"
              onClick={() => addLibraryNode(item)}
              className="w-full flex items-center justify-between gap-2 rounded-lg border border-cf-border bg-cf-navy/50 px-2.5 py-2 text-left text-xs hover:border-cf-cyan/40"
            >
              <span className="text-cf-text">{item.label}</span>
              {item.planned ? <Badge variant="warning">Planned</Badge> : <Plus className="w-3.5 h-3.5 text-cf-cyan" />}
            </button>
          ))}
        </aside>

        <div className="rounded-xl border border-cf-border overflow-hidden bg-cf-navy/80 min-h-[520px]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-cf-border bg-cf-sidebar/80">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="!py-1.5 text-sm"
              aria-label="Workflow name"
            />
          </div>
          <div className="h-[560px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={(changes) => {
                onNodesChange(changes);
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes);
              }}
              onNodeDragStop={() => persistNodes(nodes)}
              onConnect={onConnect}
              onSelectionChange={({ nodes: sel }) => selectNode(sel[0]?.id ?? null)}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Lines} gap={22} color="#263968" />
              <Controls />
              <MiniMap
                nodeColor={() => '#1476D4'}
                maskColor="rgba(8,13,43,0.7)"
                style={{ background: '#0C173D' }}
              />
            </ReactFlow>
          </div>
        </div>

        <aside className="card !p-3 space-y-3">
          <div className="section-title">Node configuration</div>
          {!selected ? (
            <p className="text-xs text-cf-faint">Select a node to configure it.</p>
          ) : (
            <>
              <Input
                label="Label"
                value={selected.data.label}
                onChange={(e) => {
                  updateNodeData(selected.id, { label: e.target.value });
                  setNodes((ns) =>
                    ns.map((n) =>
                      n.id === selected.id
                        ? { ...n, data: { ...n.data, label: e.target.value } }
                        : n,
                    ),
                  );
                }}
              />
              <div className="text-xs text-cf-muted">
                Kind: <span className="font-mono text-cf-cyan">{selected.data.kind}</span>
              </div>
              {String(selected.data.kind).startsWith('future') && (
                <div className="flex gap-2 text-xs text-cf-warning">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Planned integration — not executable in this release.
                </div>
              )}
              <Button variant="danger" onClick={deleteSelected}>
                <Trash2 className="w-4 h-4" /> Delete node
              </Button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
