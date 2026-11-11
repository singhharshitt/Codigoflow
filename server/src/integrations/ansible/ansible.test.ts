import fs from 'fs';
import path from 'path';
import { listInventories, listPlaybooks, listRoles } from './index';
import { getDevOpsWorkspaceRoot } from '../../devops/services/preflight';

describe('ansible integration', () => {
  it('discovers inventories under devops/ansible', () => {
    const root = path.join(getDevOpsWorkspaceRoot(), 'ansible', 'inventory');
    expect(fs.existsSync(root)).toBe(true);
    const inventories = listInventories();
    expect(inventories.some((i) => i.name.includes('lab'))).toBe(true);
  });

  it('lists required playbooks', () => {
    const names = listPlaybooks().map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'bootstrap.yml',
        'configure-server.yml',
        'deploy-app.yml',
        'docker-setup.yml',
        'webserver.yml',
        'health-check.yml',
      ]),
    );
  });

  it('lists required roles', () => {
    const names = listRoles().map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(['common', 'docker', 'webserver', 'application', 'monitoring']),
    );
  });
});
