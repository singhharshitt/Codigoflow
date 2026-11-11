import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { devopsApi } from '../../services/devopsApi';
import { PageBackground } from '../../components/shared';
import { PageHeader, Button, Alert, Card, Badge, LoadingSpinner } from '../../components/ui';

export function AnsiblePage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [inventories, setInventories] = useState<Array<{ relativePath: string; name: string }>>([]);
  const [playbooks, setPlaybooks] = useState<Array<{ relativePath: string; name: string }>>([]);
  const [roles, setRoles] = useState<Array<{ name: string }>>([]);
  const [inventory, setInventory] = useState('inventory/lab.ini');
  const [playbook, setPlaybook] = useState('playbooks/health-check.yml');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [st, inv, pb, rl] = await Promise.all([
      devopsApi.ansible.status(),
      devopsApi.ansible.inventory(),
      devopsApi.ansible.playbooks(),
      devopsApi.ansible.roles(),
    ]);
    if (st.success) setStatus(st.data as Record<string, unknown>);
    if (inv.success) {
      const list = (inv.data as Array<{ relativePath: string; name: string }>) ?? [];
      setInventories(list);
      if (list[0]) setInventory(list[0].relativePath);
    }
    if (pb.success) {
      const list = (pb.data as Array<{ relativePath: string; name: string }>) ?? [];
      setPlaybooks(list);
      if (list[0]) setPlaybook(list[0].relativePath);
    }
    if (rl.success) setRoles((rl.data as Array<{ name: string }>) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(label: string, fn: () => ReturnType<typeof devopsApi.ansible.ping>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) {
      toast.error(res.error?.message ?? `${label} failed`);
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
        title="Ansible"
        description="Inventory validation, connectivity, check mode, and approved playbook runs."
      />
      <Alert variant="info" className="relative z-10">
        Check mode is an estimate. Changing playbooks require explicit approval.
      </Alert>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="relative z-10 space-y-4">
          <Card className="flex flex-wrap gap-3 items-center">
            <Badge variant={status?.available ? 'success' : 'warning'}>
              {status?.available ? String(status.version ?? 'ansible') : 'unavailable'}
            </Badge>
            <select className="input text-sm" value={inventory} onChange={(e) => setInventory(e.target.value)}>
              {inventories.map((i) => (
                <option key={i.relativePath} value={i.relativePath}>
                  {i.name}
                </option>
              ))}
            </select>
            <select className="input text-sm" value={playbook} onChange={(e) => setPlaybook(e.target.value)}>
              {playbooks.map((p) => (
                <option key={p.relativePath} value={p.relativePath}>
                  {p.name}
                </option>
              ))}
            </select>
          </Card>

          <Card>
            <div className="section-title mb-2">Roles</div>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <Badge key={r.name} variant="info">
                  {r.name}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => void run('Validate inventory', () => devopsApi.ansible.validateInventory(inventory))}
              >
                Validate inventory
              </Button>
              <Button disabled={busy} onClick={() => void run('Ping', () => devopsApi.ansible.ping(inventory))}>
                Ping
              </Button>
              <Button disabled={busy} onClick={() => void run('Facts', () => devopsApi.ansible.facts(inventory))}>
                Facts
              </Button>
              <Button
                disabled={busy}
                onClick={() => void run('Syntax check', () => devopsApi.ansible.validatePlaybook(playbook))}
              >
                Syntax check
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => void run('Check mode', () => devopsApi.ansible.checkPlaybook(playbook, inventory))}
              >
                Check mode
              </Button>
              <Button
                disabled={busy}
                variant="danger"
                onClick={() =>
                  void run('Run playbook', () => devopsApi.ansible.runPlaybook(playbook, inventory, true))
                }
              >
                Run (approve)
              </Button>
            </div>
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
