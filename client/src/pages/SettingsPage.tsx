import { useEffect, useState } from 'react';
import { Plug, Settings2, Shield, Sparkles } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useRepoStore } from '../stores/repoStore';
import { aiApi, dockerApi } from '../services/api';
import {
  PageHeader,
  Tabs,
  Card,
  Alert,
  Badge,
  Select,
  Button,
} from '../components/ui';
import { PageBackground, SpiderEmblem } from '../components/shared';
import type { AIStatus, DockerStatus } from '../types';

type SettingsTab = 'general' | 'integrations';

const FUTURE = [
  { name: 'Terraform', desc: 'Infrastructure provisioning' },
  { name: 'Ansible', desc: 'Configuration deployment' },
  { name: 'Puppet', desc: 'Desired-state configuration' },
  { name: 'Nagios', desc: 'Monitoring and alerts' },
];

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>(
    window.location.hash === '#integrations' ? 'integrations' : 'general',
  );
  const { health, fetchHealth } = useAppStore();
  const { repositories, selectedId, selectRepository } = useRepoStore();
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [denseDashboard, setDenseDashboard] = useState(
    () => localStorage.getItem('cf-dense-dashboard') === '1',
  );

  useEffect(() => {
    void fetchHealth();
    aiApi.status().then((res) => {
      if (res.success && res.data) setAiStatus(res.data);
    });
    dockerApi.status().then((res) => {
      if (res.success && res.data) setDockerStatus(res.data);
    });
  }, [fetchHealth]);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#integrations') setTab('integrations');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function toggleDense(next: boolean) {
    setDenseDashboard(next);
    localStorage.setItem('cf-dense-dashboard', next ? '1' : '0');
  }

  return (
    <div className="page-shell relative">
      <PageBackground />
      <PageHeader
        title="Settings & Integrations"
        description="Preferences stay in the browser. Secrets and provider keys remain on the server."
      />

      <div className="relative z-10">
        <Tabs
          tabs={[
            { id: 'general', label: 'General' },
            { id: 'integrations', label: 'Integrations' },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id);
            window.location.hash = id === 'integrations' ? 'integrations' : '';
          }}
        />
      </div>

      {tab === 'general' && (
        <div className="relative z-10 grid gap-4 max-w-2xl">
          <Card title="Appearance">
            <div className="space-y-3 text-sm text-cf-muted">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-cf-text font-medium">Theme</div>
                  <div className="text-xs text-cf-faint">
                    CódigoFlow uses the Spider-Man-inspired navy / red / cyan system.
                  </div>
                </div>
                <Badge variant="info">Midnight Navy</Badge>
              </div>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span>Compact dashboard spacing</span>
                <input
                  type="checkbox"
                  checked={denseDashboard}
                  onChange={(e) => toggleDense(e.target.checked)}
                  className="accent-cf-cyan w-4 h-4"
                />
              </label>
            </div>
          </Card>

          <Card title="Defaults">
            <Select
              label="Default repository"
              value={selectedId ?? ''}
              onChange={(e) => selectRepository(e.target.value || null)}
            >
              <option value="">None</option>
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-cf-faint mt-2">
              API base URL is set via <code className="font-mono">VITE_API_BASE_URL</code> (
              <code className="font-mono">{import.meta.env.VITE_API_BASE_URL ?? '/api'}</code>).
            </p>
          </Card>
        </div>
      )}

      {tab === 'integrations' && (
        <div className="relative z-10 space-y-4">
          <Alert variant="info" title="Secrets policy">
            Never store API keys in browser storage or <code className="font-mono">client/.env</code>.
            Configure providers only in <code className="font-mono">server/.env</code>.
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <IntegrationCard
              title="Git"
              icon={<Settings2 className="w-4 h-4 text-cf-cyan" />}
              status={health ? 'connected' : 'unavailable'}
              detail="Local Git CLI used by the server for repository operations."
            />
            <IntegrationCard
              title="GitHub"
              icon={<Plug className="w-4 h-4 text-cf-royal" />}
              status={
                health?.integrations.github.configured
                  ? 'connected'
                  : 'unconfigured'
              }
              detail="Optional token increases rate limits for public repository exploration."
            />
            <IntegrationCard
              title="Docker"
              icon={<Shield className="w-4 h-4 text-cf-cyan" />}
              status={
                dockerStatus?.available || health?.integrations.docker.available
                  ? 'connected'
                  : 'unavailable'
              }
              detail={
                dockerStatus?.version || health?.integrations.docker.version
                  ? `Daemon version ${dockerStatus?.version ?? health?.integrations.docker.version}`
                  : dockerStatus?.error ?? 'Docker Desktop / daemon not reachable'
              }
            />
            <IntegrationCard
              title="AI provider"
              icon={<Sparkles className="w-4 h-4 text-cf-violet" />}
              status={aiStatus?.configured || health?.integrations.ai.configured ? 'connected' : 'unconfigured'}
              detail={
                aiStatus
                  ? `${aiStatus.model} · ${aiStatus.baseUrl}`
                  : 'Configure AI_API_KEY, AI_BASE_URL, and AI_MODEL on the server'
              }
            />
          </div>

          <Card title="Future integrations">
            <div className="grid gap-2 sm:grid-cols-2">
              {FUTURE.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg border border-dashed border-cf-border bg-cf-navy/40 px-3 py-2"
                >
                  <div>
                    <div className="text-sm text-cf-text">{item.name}</div>
                    <div className="text-[11px] text-cf-faint">{item.desc}</div>
                  </div>
                  <Badge variant="warning">Planned</Badge>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex items-center gap-3 text-xs text-cf-faint">
            <SpiderEmblem size={18} />
            <Button variant="secondary" size="sm" onClick={() => void fetchHealth()}>
              Refresh status
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationCard({
  title,
  icon,
  status,
  detail,
}: {
  title: string;
  icon: React.ReactNode;
  status: 'connected' | 'unconfigured' | 'unavailable';
  detail: string;
}) {
  const badge =
    status === 'connected' ? (
      <Badge variant="success">Connected</Badge>
    ) : status === 'unconfigured' ? (
      <Badge variant="warning">Not configured</Badge>
    ) : (
      <Badge variant="error">Unavailable</Badge>
    );

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-cf-text">
          {icon}
          {title}
        </div>
        {badge}
      </div>
      <p className="text-xs text-cf-muted">{detail}</p>
    </Card>
  );
}
