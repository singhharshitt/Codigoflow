import { useEffect, useState } from 'react';
import { Container, RefreshCw, Play, Square, ScrollText, Server } from 'lucide-react';
import { dockerApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { LoadingSpinner, EmptyState, Alert, PageHeader, StatCard } from '../components/ui';
import type { ContainerInfo, ImageInfo, DockerStatus } from '../types';

export function DockerManagerPage() {
  const { health } = useAppStore();
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [logs, setLogs] = useState<string>('');
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'containers' | 'images'>('containers');
  const [error, setError] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [statusRes, containersRes, imagesRes] = await Promise.allSettled([
      dockerApi.status(),
      dockerApi.containers(true),
      dockerApi.images(),
    ]);
    if (statusRes.status === 'fulfilled' && statusRes.value.success)
      setDockerStatus(statusRes.value.data as DockerStatus);
    if (containersRes.status === 'fulfilled' && containersRes.value.success)
      setContainers((containersRes.value.data as ContainerInfo[]) ?? []);
    if (imagesRes.status === 'fulfilled' && imagesRes.value.success)
      setImages((imagesRes.value.data as ImageInfo[]) ?? []);
    setLoading(false);
  }

  async function handleAction(id: string, action: 'start' | 'stop') {
    setActionId(id); setError('');
    const res = action === 'start' ? await dockerApi.start(id) : await dockerApi.stop(id);
    setActionId(null);
    if (!res.success) setError(res.error?.message ?? `${action} failed`);
    else loadAll();
  }

  async function loadLogs(id: string, name: string) {
    setLogsFor(name); setLogs('');
    const res = await dockerApi.logs(id, 200);
    if (res.success && res.data) setLogs((res.data as { logs: string }).logs);
  }

  const running = containers.filter((c) => c.state === 'running').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Docker Manager"
        description="Manage containers and images on your local Docker daemon"
        action={
          <button onClick={loadAll} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {dockerStatus && !dockerStatus.available && (
        <Alert variant="warning" title="Docker not available">
          {dockerStatus.error ?? 'Docker daemon is not running. Start Docker Desktop and refresh.'}
        </Alert>
      )}

      {dockerStatus?.available && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Containers" value={containers.length} icon={Container} color="brand" />
          <StatCard label="Running" value={running} icon={Play} color="green" />
          <StatCard label="Stopped" value={containers.length - running} icon={Square} color="red" />
          <StatCard label="Images" value={images.length} icon={Server} color="cyan" />
        </div>
      )}

      <div className="flex gap-1 bg-surface-2 p-1 rounded-lg w-fit">
        {(['containers', 'images'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-surface-4 text-gray-100 font-medium' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : activeTab === 'containers' ? (
        containers.length === 0 ? (
          <div className="card"><EmptyState icon={Container} title="No containers found" description={dockerStatus?.available ? 'No Docker containers exist on this system.' : 'Docker is unavailable.'} /></div>
        ) : (
          <div className="space-y-3">
            {containers.map((c) => (
              <div key={c.id} className="card flex items-center gap-4">
                <span className={c.state === 'running' ? 'status-dot-online' : 'status-dot-offline'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-100">{c.name}</span>
                    <span className={c.state === 'running' ? 'badge-success' : 'badge-muted'}>{c.state}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <span className="font-mono">{c.image}</span>
                    {c.ports && <span className="ml-3">{c.ports}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => loadLogs(c.id, c.name)}
                    className="btn-ghost text-xs"
                    title="View logs"
                  >
                    <ScrollText className="w-3.5 h-3.5" />
                  </button>
                  {c.state === 'running' ? (
                    <button
                      onClick={() => handleAction(c.id, 'stop')}
                      className="btn-danger text-xs"
                      disabled={actionId === c.id}
                    >
                      {actionId === c.id ? <LoadingSpinner size="sm" /> : <Square className="w-3.5 h-3.5" />}
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(c.id, 'start')}
                      className="btn-primary text-xs"
                      disabled={actionId === c.id}
                    >
                      {actionId === c.id ? <LoadingSpinner size="sm" /> : <Play className="w-3.5 h-3.5" />}
                      Start
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        images.length === 0 ? (
          <div className="card"><EmptyState icon={Server} title="No images found" /></div>
        ) : (
          <div className="space-y-3">
            {images.map((img) => (
              <div key={img.id} className="card flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-100">
                    {img.repository}:{img.tag}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 font-mono">{img.id.slice(0, 12)}</div>
                </div>
                <div className="text-xs text-gray-400">{img.size}</div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Log viewer */}
      {logsFor && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-200">Logs: {logsFor}</div>
            <button onClick={() => { setLogsFor(null); setLogs(''); }} className="text-xs text-gray-500 hover:text-gray-300">
              Close
            </button>
          </div>
          <pre className="code-block text-[11px] max-h-80 overflow-auto">
            {logs || 'No log output'}
          </pre>
        </div>
      )}
    </div>
  );
}
