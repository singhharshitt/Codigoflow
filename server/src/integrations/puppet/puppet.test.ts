import fs from 'fs';
import path from 'path';
import { listModules } from './index';
import { getDevOpsWorkspaceRoot } from '../../devops/services/preflight';

describe('puppet integration', () => {
  it('has site manifest and hiera', () => {
    const root = path.join(getDevOpsWorkspaceRoot(), 'puppet');
    expect(fs.existsSync(path.join(root, 'manifests', 'site.pp'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'hiera.yaml'))).toBe(true);
  });

  it('lists codigoflow modules', () => {
    const names = listModules().map((m) => m.name);
    expect(names).toEqual(
      expect.arrayContaining(['codigoflow_base', 'codigoflow_web', 'codigoflow_app']),
    );
  });

  it('includes drift experiment class', () => {
    const drift = path.join(
      getDevOpsWorkspaceRoot(),
      'puppet',
      'modules',
      'codigoflow_app',
      'manifests',
      'drift.pp',
    );
    expect(fs.existsSync(drift)).toBe(true);
    expect(fs.readFileSync(drift, 'utf8')).toContain('codigoflow_app::drift');
  });
});
