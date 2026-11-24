import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Save, Trash2, Play, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowNode } from '../features/workflows/WorkflowNode';
import { useWorkflowStore, type WorkflowNodeData } from '../stores/workflowStore';
import { workflowApi } from '../services/devopsApi';
import { PageHeader, Button, Input, Alert, Badge, Select } from '../components/ui';

const LIBRARY: { kind: string; label: string; planned?: boolean }[] = [
  { kind: 'start', label: 'Start' },
  { kind: 'end', label: 'End' },
  { kind: 'terraform.init', label: 'Terraform Init' },
  { kind: 'terraform.fmt', label: 'Terraform Fmt' },
  { kind: 'terraform.validate', label: 'Terraform Validate' },
  { kind: 'terraform.plan', label: 'Terraform Plan' },
  { kind: 'terraform.apply', label: 'Terraform Apply' },
  { kind: 'ansible.inventory.validate', label: 'Ansible Inventory Validate' },
  { kind: 'ansible.ping', label: 'Ansible Ping' },
  { kind: 'ansible.facts', label: 'Ansible Facts' },
  { kind: 'ansible.playbook.validate', label: 'Ansible Playbook Validate' },
  { kind: 'ansible.playbook.check', label: 'Ansible Playbook Check' },
  { kind: 'ansible.playbook.run', label: 'Ansible Playbook Run' },
  { kind: 'puppet.status', label: 'Puppet Status' },
  { kind: 'puppet.manifest.validate', label: 'Puppet Manifest Validate' },
  { kind: 'puppet.agent.noop', label: 'Puppet Agent No-op' },
  { kind: 'puppet.agent.run', label: 'Puppet Agent Run' },
  { kind: 'puppet.apply', label: 'Puppet Apply' },
  { kind: 'nagios.status', label: 'Nagios Status' },
  { kind: 'nagios.check.host', label: 'Nagios Check Host' },
  { kind: 'nagios.check.service', label: 'Nagios Check Service' },
  { kind: 'nagios.verify.application', label: 'Nagios Verify App' },
  { kind: 'nagios.schedule.downtime', label: 'Nagios Downtime' },
];

const nodeTypes = { cfNode: WorkflowNode };

type NodeRunSummary = {
  id: string;
  node_id: string;
  node_kind: string;
  status: string;
  error_message: string | null;
};

const RUN_DOT: Record<string, string> = {
  succeeded: 'bg-cf-success',
  failed: 'bg-cf-error',
  running: 'bg-cf-cyan',
  skipped: 'bg-cf-faint/60',
};

function toNodeStatus(status?: string): WorkflowNodeData['status'] {
  if (status === 'succeeded' || status === 'failed' || status === 'running') return status;
  if (status === 'skipped') return 'skipped';
  return 'idle';
}

/**
 * Proposals arrive as one long horizontal line, which fitView shrinks until the
 * labels are unreadable. Re-flow such graphs into rows of four (snake order).
 */
function wrapLinearLayout(nodes: Node<WorkflowNodeData>[]): Node<WorkflowNodeData>[] {
  if (nodes.length <= 4) return nodes;
  const ys = new Set(nodes.map((n) => Math.round(n.position.y)));
  if (ys.size > 2) return nodes; // already laid out by a human
  const perRow = 4;
  const ordered = [...nodes].sort((a, b) => a.position.x - b.position.x);
  return ordered.map((n, i) => {
    const row = Math.floor(i / perRow);
    const col = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow);
    return { ...n, position: { x: 40 + col * 230, y: 40 + row * 130 } };
  });
}

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

  // Persist every graph change (drag, keyboard delete, edge removal) to the local draft.
  useEffect(() => {
    persistNodes(nodes);
  }, [nodes, persistNodes]);
  useEffect(() => {
    persistEdges(edges);
  }, [edges, persistEdges]);

  const onSelectionChange = useCallback(
    ({ nodes: sel }: { nodes: Node[] }) => selectNode(sel[0]?.id ?? null),
    [selectNode],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          { ...connection, style: { stroke: '#7D8598', strokeWidth: 1.5 } },
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

  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [graphKey, setGraphKey] = useState(0);
  const [runOutput, setRunOutput] = useState('');
  const [runNodes, setRunNodes] = useState<NodeRunSummary[]>([]);
  const [runSummary, setRunSummary] = useState<{ ok: boolean; message: string; jobId?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [savedList, setSavedList] = useState<Array<{ id: string; name: string }>>([]);

  function applyGraph(
    nextName: string,
    rawNodes: Node<WorkflowNodeData>[],
    nextEdges: Edge[],
    id?: string | null,
  ) {
    const nextNodes = wrapLinearLayout(rawNodes);
    setGraphKey((k) => k + 1); // remount the canvas so fitView frames the new graph
    setName(nextName);
    setNodes(nextNodes);
    setEdges(nextEdges);
    persistNodes(nextNodes);
    persistEdges(nextEdges);
    setWorkflowId(id ?? null);
  }

  async function refreshSaved() {
    const res = await workflowApi.list();
    if (res.success && Array.isArray(res.data)) {
      setSavedList(
        (res.data as Array<{ id: string; name: string }>).map((w) => ({
          id: w.id,
          name: w.name,
        })),
      );
    }
  }

  useEffect(() => {
    void refreshSaved();
    const raw = sessionStorage.getItem('cf-deploy-proposal');
    if (!raw) return;
    try {
      const proposal = JSON.parse(raw) as {
        name?: string;
        nodes?: Node<WorkflowNodeData>[];
        edges?: Edge[];
      };
      if (proposal.nodes?.length) {
        applyGraph(
          proposal.name || 'Proposed deployment',
          proposal.nodes,
          proposal.edges ?? [],
          null,
        );
        toast.message('Loaded deploy proposal', {
          description: 'Review the graph. Nothing was executed automatically.',
        });
      }
    } catch {
      /* ignore malformed */
    } finally {
      sessionStorage.removeItem('cf-deploy-proposal');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSaved(id: string) {
    if (!id) return;
    const res = await workflowApi.get(id);
    if (!res.success || !res.data) {
      toast.error(res.error?.message ?? 'Failed to load workflow');
      return;
    }
    const row = res.data as { id: string; name: string; workflow_json: string };
    try {
      const parsed = JSON.parse(row.workflow_json) as {
        name?: string;
        nodes?: Node<WorkflowNodeData>[];
        edges?: Edge[];
      };
      applyGraph(parsed.name || row.name, parsed.nodes ?? [], parsed.edges ?? [], row.id);
      toast.success('Workflow loaded');
    } catch {
      toast.error('Saved workflow JSON is invalid');
    }
  }

  async function handleSave() {
    persistNodes(nodes);
    persistEdges(edges);
    const res = await workflowApi.save({ name, nodes, edges });
    if (!res.success) {
      toast.message('Saved locally', {
        description: res.error?.message ?? 'Workflow backend is not available.',
      });
      return;
    }
    const id = (res.data as { id?: string } | undefined)?.id;
    if (id) setWorkflowId(id);
    toast.success('Workflow saved');
  }

  async function validateGraph() {
    persistNodes(nodes);
    persistEdges(edges);
    if (!workflowId) {
      toast.warning('Save the workflow before server validation');
      return;
    }
    const res = await workflowApi.validate(workflowId);
    if (!res.success) {
      toast.error(res.error?.message ?? 'Validation failed');
      return;
    }
    const data = res.data as { valid?: boolean; errors?: string[] };
    if (data.valid) toast.success('Workflow is executable');
    else toast.error((data.errors ?? ['invalid']).join('; '));
  }

  async function handleRun() {
    if (!workflowId) {
      toast.warning('Save the workflow before running');
      return;
    }
    setRunning(true);
    setRunNodes([]);
    setRunSummary(null);
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, status: 'running' } })));
    const res = await workflowApi.run(workflowId);
    setRunning(false);
    setRunOutput(JSON.stringify(res.data ?? res.error, null, 2));

    const payload = (res.success ? res.data : res.error) as Record<string, unknown> | undefined;
    const details = (payload?.details ?? payload) as Record<string, unknown> | undefined;
    const nodeRuns = (Array.isArray(details?.nodeRuns) ? details?.nodeRuns : []) as NodeRunSummary[];
    const order = new Map(nodes.map((n, i) => [n.id, i]));
    setRunNodes([...nodeRuns].sort((x, y) => (order.get(x.node_id) ?? 999) - (order.get(y.node_id) ?? 999)));
    const byNode = new Map(nodeRuns.map((r) => [r.node_id, r.status]));
    setNodes((ns) =>
      ns.map((n) => ({
        ...n,
        data: { ...n.data, status: toNodeStatus(byNode.get(n.id)) },
      })),
    );
    setRunSummary({
      ok: res.success,
      message: res.success ? 'Workflow run finished' : (res.error?.message ?? 'Workflow run failed'),
      jobId: (details?.jobId as string | undefined) ?? undefined,
    });

    if (!res.success) {
      toast.error(res.error?.message ?? 'Workflow run failed');
      return;
    }
    toast.success('Workflow run finished');
  }

  return (
    <div className="page-shell relative !space-y-4">
      <PageHeader
        title="Workflow builder"
        description="Compose Terraform → Ansible → Puppet → Nagios pipelines with approval-gated executors."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void validateGraph()}>
              Validate
            </Button>
            <Button variant="cyan" onClick={() => void handleRun()} loading={running}>
              {!running && <Play className="w-4 h-4" />} Run
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
        DevOps nodes execute through the backend job engine. Destructive steps require approve: true in node config.
        {workflowId ? ` Saved id: ${workflowId}` : ' Save before validate/run.'}
      </Alert>

      <div className="relative z-10 flex flex-wrap gap-2 items-end">
        <div className="min-w-[16rem] flex-1">
          <Select
            label="Load saved workflow"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) void loadSaved(id);
            }}
          >
            <option value="">Select a saved workflow…</option>
            {savedList.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="secondary" onClick={() => void refreshSaved()}>
          <FolderOpen className="w-4 h-4" /> Refresh list
        </Button>
      </div>

      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[220px_1fr_260px] gap-3 min-h-[640px]">
        <aside className="card !p-3 space-y-0.5 overflow-y-auto max-h-[640px]">
          <div className="section-title">Node library</div>
          {LIBRARY.map((item) => (
            <button
              key={item.kind}
              type="button"
              onClick={() => addLibraryNode(item)}
              aria-label={`Add ${item.label} node`}
              className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm leading-5 transition-colors hover:border-cf-border hover:bg-cf-elevated"
            >
              <span className="text-cf-text">{item.label}</span>
              {item.planned ? <Badge variant="warning">Planned</Badge> : <Plus className="h-3.5 w-3.5 text-cf-faint" />}
            </button>
          ))}
        </aside>

        <div className="min-h-[520px] overflow-hidden rounded-xl border border-cf-border bg-cf-bg">
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
              key={graphKey}
              nodes={nodes}
              edges={edges}
              onNodesChange={(changes) => {
                onNodesChange(changes);
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes);
              }}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              nodeTypes={nodeTypes}
              colorMode="dark"
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
              style={{ background: '#0B0E15' }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2A3040" />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={() => '#3A4152'}
                maskColor="rgba(11, 14, 21, 0.72)"
                style={{ background: '#0A0D13', border: '1px solid #232937', borderRadius: 8 }}
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
              <Input
                label="Config JSON"
                value={JSON.stringify(selected.data.config ?? {})}
                onChange={(e) => {
                  try {
                    const config = JSON.parse(e.target.value) as Record<string, unknown>;
                    updateNodeData(selected.id, { config });
                    setNodes((ns) =>
                      ns.map((n) =>
                        n.id === selected.id ? { ...n, data: { ...n.data, config } } : n,
                      ),
                    );
                  } catch {
                    /* keep typing until JSON is valid */
                  }
                }}
              />
              <Button variant="danger" onClick={deleteSelected}>
                <Trash2 className="w-4 h-4" /> Delete node
              </Button>
            </>
          )}
          {runSummary && (
            <div className="space-y-3 border-t border-cf-border pt-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-cf-text">Last run</h3>
                <span className={runSummary.ok ? 'badge-success' : 'badge-error'}>
                  {runSummary.ok ? 'succeeded' : 'failed'}
                </span>
              </div>
              <p className="break-words text-xs text-cf-muted">{runSummary.message}</p>
              {runNodes.length > 0 && (
                <ol className="space-y-1.5">
                  {runNodes.map((r) => (
                    <li key={r.id} className="flex items-start gap-2 text-xs">
                      <span className={clsx('mt-1 h-2 w-2 shrink-0 rounded-full', RUN_DOT[r.status] ?? 'bg-cf-faint')} />
                      <span className="min-w-0">
                        <span className="font-mono text-cf-text">{r.node_kind}</span>
                        <span className="text-cf-faint"> · {r.status}</span>
                        {r.error_message && r.status === 'failed' && (
                          <span className="block break-words text-cf-error">{r.error_message}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {runSummary.jobId && (
                <a href="/history" className="block text-xs text-cf-muted underline-offset-2 hover:text-cf-text hover:underline">
                  Open in execution history
                </a>
              )}
              <details>
                <summary className="cursor-pointer text-xs text-cf-faint hover:text-cf-muted">Raw response</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-cf-faint">
                  {runOutput}
                </pre>
              </details>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
