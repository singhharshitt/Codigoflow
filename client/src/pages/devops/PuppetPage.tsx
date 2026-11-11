import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { devopsApi } from '../../services/devopsApi';
import { PageBackground } from '../../components/shared';
import { PageHeader, Button, Alert, Card, Badge, LoadingSpinner, Input } from '../../components/ui';

export function PuppetPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [modules, setModules] = useState<Array<{ name: string }>>([]);
  const [certs, setCerts] = useState<Record<string, unknown> | null>(null);
  const [manifest, setManifest] = useState('manifests/site_lab.pp');
  const [certname, setCertname] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [st, mods, certificates] = await Promise.all([
      devopsApi.puppet.status(),
      devopsApi.puppet.modules(),
      devopsApi.puppet.certificates(),
    ]);
    if (st.success) setStatus(st.data as Record<string, unknown>);
    if (mods.success) setModules((mods.data as Array<{ name: string }>) ?? []);
    if (certificates.success) setCerts(certificates.data as Record<string, unknown>);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(label: string, fn: () => ReturnType<typeof devopsApi.puppet.status>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) {
      toast.error(res.error?.message ?? label);
      setOutput(res.error?.message ?? 'failed');
      return;
    }
    toast.success(label);
    setOutput(JSON.stringify(res.data, null, 2));
  }

  return (
    <div className="page-shell relative">
      <PageBackground />
      <PageHeader
        title="Puppet"
        description="Manifest validation, no-op drift preview, approved apply, and individual certificate signing."
      />
      <Alert variant="warning" className="relative z-10">
        Certificates are never auto-signed. Drift experiments target isolated lab files only.
      </Alert>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="relative z-10 space-y-4">
          <Card className="flex flex-wrap gap-3 items-center">
            <Badge variant={status?.available ? 'success' : 'warning'}>
              {status?.available ? String(status.version ?? 'puppet') : 'unavailable'}
            </Badge>
            <Input value={manifest} onChange={(e) => setManifest(e.target.value)} className="max-w-md" />
          </Card>

          <Card>
            <div className="section-title mb-2">Modules</div>
            <div className="flex flex-wrap gap-2">
              {modules.map((m) => (
                <Badge key={m.name} variant="info">
                  {m.name}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void run('Validate', () => devopsApi.puppet.validate(manifest))}>
                Validate manifest
              </Button>
              <Button disabled={busy} onClick={() => void run('No-op', () => devopsApi.puppet.noop())}>
                Agent no-op
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => void run('Drift', () => devopsApi.puppet.drift(manifest))}
              >
                Drift preview
              </Button>
              <Button
                disabled={busy}
                variant="danger"
                onClick={() => void run('Apply', () => devopsApi.puppet.apply(manifest, true, false))}
              >
                Apply (approve)
              </Button>
            </div>
          </Card>

          <Card>
            <div className="section-title mb-2">Certificate signing</div>
            <div className="flex flex-wrap gap-2 items-end">
              <Input
                label="Certname"
                value={certname}
                onChange={(e) => setCertname(e.target.value)}
                className="max-w-sm"
              />
              <Button
                disabled={busy || !certname}
                variant="danger"
                onClick={() => void run('Sign cert', () => devopsApi.puppet.signCert(certname, true))}
              >
                Sign after approval
              </Button>
            </div>
            <pre className="mt-3 text-xs font-mono text-cf-muted whitespace-pre-wrap max-h-40 overflow-auto">
              {certs ? JSON.stringify(certs, null, 2) : 'Certificate list unavailable until puppetserver is installed.'}
            </pre>
          </Card>

          <Card>
            <pre className="text-xs font-mono text-cf-muted whitespace-pre-wrap max-h-96 overflow-auto">
              {output || 'Results appear here.'}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
}
