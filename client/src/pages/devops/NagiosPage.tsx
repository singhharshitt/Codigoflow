import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { devopsApi } from '../../services/devopsApi';
import { PageBackground } from '../../components/shared';
import { PageHeader, Button, Alert, Card, Badge, LoadingSpinner } from '../../components/ui';

function stateVariant(label: string): 'success' | 'warning' | 'error' | 'muted' {
  if (label === 'UP' || label === 'OK') return 'success';
  if (label === 'WARNING') return 'warning';
  if (label === 'DOWN' || label === 'CRITICAL' || label === 'UNREACHABLE') return 'error';
  return 'muted';
}

export function NagiosPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [hosts, setHosts] = useState<Array<Record<string, unknown>>>([]);
  const [services, setServices] = useState<Array<Record<string, unknown>>>([]);
  const [plugins, setPlugins] = useState<Array<{ name: string }>>([]);
  const [output, setOutput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [st, h, s, p] = await Promise.all([
      devopsApi.nagios.status(),
      devopsApi.nagios.hosts(),
      devopsApi.nagios.services(),
      devopsApi.nagios.plugins(),
    ]);
    if (st.success) setStatus(st.data as Record<string, unknown>);
    if (h.success) setHosts((h.data as Array<Record<string, unknown>>) ?? []);
    else setHosts([]);
    if (s.success) setServices((s.data as Array<Record<string, unknown>>) ?? []);
    else setServices([]);
    if (p.success) setPlugins((p.data as Array<{ name: string }>) ?? []);
    if (!h.success) setOutput(h.error?.message ?? '');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page-shell relative">
      <PageBackground />
      <PageHeader
        title="Nagios"
        description="Host and service status from Nagios status data, plus allowlisted external commands."
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      <Alert
        variant={status?.isSampleData === false ? 'info' : 'warning'}
        className="relative z-10"
      >
        {status?.isSampleData === false
          ? String(status?.note ?? 'Live / configured Nagios status file.')
          : String(
              status?.note ??
                'Sample monitoring data only — not live Nagios. Set NAGIOS_STATUS_FILE for real status.',
            )}
      </Alert>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="relative z-10 space-y-4">
          <Card className="flex flex-wrap gap-3 items-center">
            <Badge variant={status?.isSampleData ? 'warning' : 'success'}>
              {status?.isSampleData ? 'sample data' : 'configured source'}
            </Badge>
            <Badge variant={status?.available || status?.statusFileExists ? 'success' : 'warning'}>
              {status?.version ? String(status.version) : 'status source'}
            </Badge>
            <span className="text-xs font-mono text-cf-faint">{String(status?.statusFile ?? '')}</span>
            <Button
              variant="secondary"
              onClick={async () => {
                const res = await devopsApi.nagios.reload(true);
                toast[res.success ? 'success' : 'error'](
                  res.success ? 'Config validated' : res.error?.message ?? 'reload failed',
                );
                setOutput(JSON.stringify(res.data ?? res.error, null, 2));
              }}
            >
              Validate / reload gate
            </Button>
          </Card>

          <Card>
            <div className="section-title mb-3">Hosts</div>
            <div className="space-y-2">
              {hosts.map((h, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="font-mono text-cf-text">
                    {String(h.host_name ?? h.alias ?? 'host')}
                  </span>
                  <Badge variant={stateVariant(String(h.stateLabel))}>{String(h.stateLabel)}</Badge>
                </div>
              ))}
              {hosts.length === 0 && <p className="text-sm text-cf-faint">No hosts parsed.</p>}
            </div>
          </Card>

          <Card>
            <div className="section-title mb-3">Services</div>
            <div className="space-y-2">
              {services.map((s, i) => (
                <div key={i} className="flex justify-between gap-3 text-sm">
                  <div>
                    <div className="font-mono text-cf-text">
                      {String(s.host_name)} / {String(s.service_description)}
                    </div>
                    <div className="text-xs text-cf-faint">{String(s.plugin_output ?? '')}</div>
                  </div>
                  <Badge variant={stateVariant(String(s.stateLabel))}>{String(s.stateLabel)}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="section-title mb-2">Plugins</div>
            <div className="flex flex-wrap gap-2">
              {plugins.map((p) => (
                <Badge key={p.name} variant="info">
                  {p.name}
                </Badge>
              ))}
            </div>
            {output && (
              <pre className="mt-3 text-xs font-mono text-cf-muted whitespace-pre-wrap">{output}</pre>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
