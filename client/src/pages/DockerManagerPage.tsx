import { useCallback, useEffect, useState } from 'react';
import {
  Container,
  RefreshCw,
  Play,
  Square,
  ScrollText,
  Server,
  RotateCcw,
  Info,
  Layers,
  Hammer,
  Plug,
  PlugZap,
} from 'lucide-react';
import { toast } from 'sonner';
import { dockerApi } from '../services/api';
import { PageBackground } from '../components/shared';
import {
  StatCard,
  Tabs,
  Table,
  Button,
  Alert,
  EmptyState,
  PageHeader,
  Badge,
  Modal,
  LoadingSpinner,
  Card,
  Input,
} from '../components/ui';
import type { ContainerInfo, ImageInfo, DockerStatus } from '../types';

type MainTab = 'containers' | 'images' | 'compose' | 'build';
type DetailTab = 'info' | 'logs';

const HAS_COMPOSE_API = false;
const HAS_BUILD_API = false;

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: 'containers', label: 'Containers' },
  { id: 'images', label: 'Images' },
  { id: 'compose', label: 'Compose' },
  { id: 'build', label: 'Build' },
];

function shortId(id: string) {
  return id.replace(/^sha256:/, '').slice(0, 12);
}

function containerBadgeVariant(state: string): 'info' | 'muted' | 'error' {
  if (state === 'running') return 'info';
  if (state === 'exited' || state === 'dead') return 'muted';
  return 'muted';
}

export function DockerManagerPage() {
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('containers');
  const [detailContainer, setDetailContainer] = useState<ContainerInfo | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const [detailLogs, setDetailLogs] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  const running = containers.filter((c) => c.state === 'running').length;
  const stopped = containers.length - running;

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    const res = await dockerApi.status();
    if (res.success && res.data) {
      setDockerStatus(res.data as DockerStatus);
    } else {
      setDockerStatus({
        available: false,
        error: res.error?.message ?? 'Docker status check failed',
      });
    }
    setStatusLoading(false);
  }, []);

  const loadResources = useCallback(async () => {
    setLoading(true);
    const [containersRes, imagesRes] = await Promise.allSettled([
      dockerApi.containers(true),
      dockerApi.images(),
    ]);
    if (containersRes.status === 'fulfilled' && containersRes.value.success) {
      setContainers((containersRes.value.data as ContainerInfo[]) ?? []);
    } else {
      setContainers([]);
    }
    if (imagesRes.status === 'fulfilled' && imagesRes.value.success) {
      setImages((imagesRes.value.data as ImageInfo[]) ?? []);
    } else {
      setImages([]);
    }
    setLoading(false);
  }, []);

  const loadAll = useCallback(async () => {
    await loadStatus();
    await loadResources();
  }, [loadStatus, loadResources]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function runContainerAction(
    id: string,
    name: string,
    action: 'start' | 'stop' | 'restart',
  ) {
    setActionId(id);
    const res =
      action === 'start'
        ? await dockerApi.start(id)
        : action === 'stop'
          ? await dockerApi.stop(id)
          : await dockerApi.restart(id);

    setActionId(null);

    if (!res.success) {
      toast.error(res.error?.message ?? `${action} failed for ${name}`);
      return;
    }

    toast.success(
      action === 'start' ? `Started ${name}` : action === 'stop' ? `Stopped ${name}` : `Restarted ${name}`,
    );
    await loadResources();
  }

  async function openDetail(container: ContainerInfo, tab: DetailTab) {
    setDetailContainer(container);
    setDetailTab(tab);
    setDetailLogs('');
    if (tab === 'logs') {
      await fetchLogs(container.id);
    }
  }

  async function fetchLogs(id: string) {
    setLogsLoading(true);
    setDetailLogs('');
    const res = await dockerApi.logs(id, 300);
    setLogsLoading(false);
    if (res.success && res.data) {
      setDetailLogs((res.data as { logs: string }).logs || '(no log output)');
    } else {
      setDetailLogs(res.error?.message ?? 'Failed to load logs');
      toast.error(res.error?.message ?? 'Failed to load logs');
    }
  }

  function closeDetail() {
    setDetailContainer(null);
    setDetailLogs('');
    setDetailTab('info');
  }

  const dockerAvailable = dockerStatus?.available === true;
  const dockerUnavailable = dockerStatus !== null && !dockerStatus.available;

  return (
    <div className="page-shell relative">
      <PageBackground showGlow />

      <PageHeader
        title="Docker Manager"
        description="Manage containers, images, and workloads on your local Docker daemon"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void loadAll();
              toast.message('Refreshing Docker data…');
            }}
            loading={loading || statusLoading}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        }
      />

      {/* Connection status — always from dockerApi.status */}
      <Card className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {statusLoading ? (
              <LoadingSpinner size="md" />
            ) : dockerAvailable ? (
              <div className="w-10 h-10 rounded-xl border border-cf-cyan/30 bg-cf-cyan/10 flex items-center justify-center">
                <PlugZap className="w-5 h-5 text-cf-cyan" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl border border-cf-error/30 bg-cf-error/10 flex items-center justify-center">
                <Plug className="w-5 h-5 text-cf-error" />
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-cf-text">Docker connection</div>
              {statusLoading ? (
                <p className="text-xs text-cf-faint mt-0.5">Checking daemon status…</p>
              ) : dockerAvailable ? (
                <p className="text-xs text-cf-muted mt-0.5">
                  Connected
                  {dockerStatus?.version ? (
                    <>
                      {' '}
                      · Engine <span className="font-mono text-cf-cyan">{dockerStatus.version}</span>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-xs text-cf-faint mt-0.5">
                  {dockerStatus?.error ?? 'Docker daemon is not reachable.'}
                </p>
              )}
            </div>
          </div>
          {!statusLoading && (
            <Badge variant={dockerAvailable ? 'info' : 'error'}>
              {dockerAvailable ? 'Online' : 'Offline'}
            </Badge>
          )}
        </div>
      </Card>

      {dockerUnavailable && (
        <Alert variant="warning" title="Docker unavailable" className="relative z-10">
          {dockerStatus?.error ??
            'Start Docker Desktop (or your Docker daemon) and refresh. Container data may be empty until the daemon is running.'}
        </Alert>
      )}

      {/* Overview stats — only when API reports available */}
      {dockerAvailable && (
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total containers" value={containers.length} icon={Container} color="royal" />
          <StatCard label="Running" value={running} icon={Play} color="cyan" />
          <StatCard label="Stopped" value={stopped} icon={Square} color="red" />
          <StatCard label="Images" value={images.length} icon={Server} color="violet" />
        </div>
      )}

      <div className="relative z-10">
        <Tabs tabs={MAIN_TABS} value={mainTab} onChange={setMainTab} />
      </div>

      {loading && mainTab !== 'compose' && mainTab !== 'build' ? (
        <div className="relative z-10 flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="relative z-10 space-y-4">
          {mainTab === 'containers' && (
            <>
              {containers.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={Container}
                    title="No containers"
                    description={
                      dockerAvailable
                        ? 'No Docker containers on this host. Create one with docker run or compose.'
                        : 'Connect to Docker to list containers.'
                    }
                  />
                </Card>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>ID</th>
                      <th>Image</th>
                      <th>Status</th>
                      <th>Ports</th>
                      <th>Created</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map((c) => {
                      const isRunning = c.state === 'running';
                      const busy = actionId === c.id;
                      return (
                        <tr key={c.id}>
                          <td className="font-medium text-cf-text">{c.name}</td>
                          <td className="font-mono text-xs text-cf-faint">{shortId(c.id)}</td>
                          <td className="font-mono text-xs max-w-[10rem] truncate" title={c.image}>
                            {c.image}
                          </td>
                          <td>
                            <div className="flex flex-col gap-1">
                              <Badge variant={containerBadgeVariant(c.state)}>{c.state}</Badge>
                              <span className="text-[10px] text-cf-faint">{c.status}</span>
                            </div>
                          </td>
                          <td className="text-xs max-w-[8rem] truncate" title={c.ports}>
                            {c.ports || '—'}
                          </td>
                          <td className="text-xs whitespace-nowrap">{c.created}</td>
                          <td>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {isRunning ? (
                                <>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    disabled={busy || !dockerAvailable}
                                    loading={busy}
                                    onClick={() => void runContainerAction(c.id, c.name, 'stop')}
                                  >
                                    <Square className="w-3.5 h-3.5" />
                                    Stop
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={busy || !dockerAvailable}
                                    loading={busy}
                                    onClick={() => void runContainerAction(c.id, c.name, 'restart')}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Restart
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="cyan"
                                  size="sm"
                                  disabled={busy || !dockerAvailable}
                                  loading={busy}
                                  onClick={() => void runContainerAction(c.id, c.name, 'start')}
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  Start
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void openDetail(c, 'info')}
                              >
                                <Info className="w-3.5 h-3.5" />
                                Inspect
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!dockerAvailable}
                                onClick={() => void openDetail(c, 'logs')}
                              >
                                <ScrollText className="w-3.5 h-3.5" />
                                Logs
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </>
          )}

          {mainTab === 'images' && (
            <>
              {images.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={Server}
                    title="No images"
                    description={
                      dockerAvailable
                        ? 'No local images found. Pull or build an image to see it here.'
                        : 'Connect to Docker to list images.'
                    }
                  />
                </Card>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Repository</th>
                      <th>Tag</th>
                      <th>Size</th>
                      <th>Created</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {images.map((img) => (
                      <tr key={img.id}>
                        <td className="font-medium text-cf-text">{img.repository}</td>
                        <td>
                          <Badge variant="muted">{img.tag}</Badge>
                        </td>
                        <td className="text-xs">{img.size}</td>
                        <td className="text-xs whitespace-nowrap">{img.created}</td>
                        <td className="font-mono text-xs text-cf-faint">{shortId(img.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}

          {mainTab === 'compose' && (
            <Card>
              <div className="flex items-start gap-3 mb-4">
                <SectionIcon icon={Layers} />
                <div>
                  <div className="text-sm font-semibold text-cf-text">Docker Compose</div>
                  <p className="text-xs text-cf-faint mt-1">
                    Orchestrate multi-container stacks from compose files.
                  </p>
                </div>
              </div>
              {HAS_COMPOSE_API ? null : (
                <Alert variant="info" title="Planned — API not available">
                  Compose up/down and stack management are not exposed by the CódigoFlow server yet. This
                  section will connect when <code className="font-mono text-cf-cyan">/api/docker/compose</code>{' '}
                  endpoints are added.
                </Alert>
              )}
            </Card>
          )}

          {mainTab === 'build' && (
            <Card>
              <div className="flex items-start gap-3 mb-4">
                <SectionIcon icon={Hammer} />
                <div>
                  <div className="text-sm font-semibold text-cf-text">Build image</div>
                  <p className="text-xs text-cf-faint mt-1">
                    Build a new image from a Dockerfile on disk.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 opacity-60 pointer-events-none">
                <Input label="Dockerfile path" placeholder="./Dockerfile" disabled value="" readOnly />
                <Input label="Build context" placeholder="." disabled value="" readOnly />
                <Input
                  label="Image tag"
                  placeholder="my-app:latest"
                  disabled
                  value=""
                  readOnly
                  className="md:col-span-2"
                />
              </div>

              {HAS_BUILD_API ? null : (
                <Alert variant="warning" title="Backend endpoint unavailable">
                  Image build is not wired to the server API yet. The form above shows the intended fields;
                  builds will stay disabled until a <code className="font-mono">POST /api/docker/build</code>{' '}
                  route exists.
                </Alert>
              )}

              <div className="mt-4 flex gap-2">
                <Button variant="primary" disabled>
                  <Hammer className="w-4 h-4" />
                  Build (unavailable)
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Container detail modal */}
      <Modal
        open={detailContainer !== null}
        onClose={closeDetail}
        title={detailContainer ? detailContainer.name : 'Container'}
        size="lg"
      >
        {detailContainer && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={detailTab === 'info' ? 'cyan' : 'ghost'}
                size="sm"
                onClick={() => setDetailTab('info')}
              >
                <Info className="w-3.5 h-3.5" />
                Info
              </Button>
              <Button
                variant={detailTab === 'logs' ? 'cyan' : 'ghost'}
                size="sm"
                onClick={() => {
                  setDetailTab('logs');
                  if (!detailLogs && !logsLoading) void fetchLogs(detailContainer.id);
                }}
              >
                <ScrollText className="w-3.5 h-3.5" />
                Logs
              </Button>
            </div>

            {detailTab === 'info' ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {(
                  [
                    ['ID', detailContainer.id],
                    ['Name', detailContainer.name],
                    ['Image', detailContainer.image],
                    ['State', detailContainer.state],
                    ['Status', detailContainer.status],
                    ['Ports', detailContainer.ports || '—'],
                    ['Created', detailContainer.created],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-cf-border bg-cf-navy/50 p-3">
                    <dt className="text-[10px] uppercase tracking-wider text-cf-faint mb-1">{label}</dt>
                    <dd className="font-mono text-xs text-cf-muted break-all">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="relative">
                {logsLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <pre className="code-block text-[11px] max-h-[min(24rem,50vh)] overflow-auto text-cf-ice">
                    {detailLogs || '(empty)'}
                  </pre>
                )}
                <LogsReloadButton
                  onClick={() => void fetchLogs(detailContainer.id)}
                  loading={logsLoading}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function SectionIcon({ icon: Icon }: { icon: typeof Layers }) {
  return (
    <div className="w-10 h-10 rounded-xl border border-cf-border bg-cf-elevated flex items-center justify-center">
      <Icon className="w-5 h-5 text-cf-cyan" />
    </div>
  );
}

function LogsReloadButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <div className="absolute top-2 right-2">
      <Button variant="ghost" size="sm" onClick={onClick} loading={loading}>
        <RefreshCw className="w-3.5 h-3.5" />
        Reload
      </Button>
    </div>
  );
}
