import fs from 'fs';
import path from 'path';
import { listPlugins, parseStatusDat, readNagiosStatus } from './index';
import { getDevOpsWorkspaceRoot } from '../../devops/services/preflight';

describe('nagios integration', () => {
  it('parses sample status.dat host and service states', () => {
    const sample = fs.readFileSync(
      path.join(getDevOpsWorkspaceRoot(), 'nagios', 'config', 'status.dat.sample'),
      'utf8',
    );
    const parsed = parseStatusDat(sample);
    expect(parsed.hosts.length).toBeGreaterThanOrEqual(1);
    expect(parsed.services.length).toBeGreaterThanOrEqual(1);
    expect(parsed.hosts[0].current_state).toBe('0');
  });

  it('reads sample status when NAGIOS_STATUS_FILE unset', () => {
    const data = readNagiosStatus();
    expect(data.hosts[0].stateLabel).toBe('UP');
    expect(data.services.some((s) => s.stateLabel === 'OK')).toBe(true);
  });

  it('lists custom plugins', () => {
    const names = listPlugins().map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['check_codigoflow_http.py', 'check_codigoflow_app.sh']),
    );
  });
});
