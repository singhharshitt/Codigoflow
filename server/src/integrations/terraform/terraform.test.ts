import fs from 'fs';
import path from 'path';
import { listTerraformProjects, resolveTerraformProject } from './index';
import { getDevOpsWorkspaceRoot } from '../../devops/services/preflight';

describe('terraform integration', () => {
  it('lists provider project directories', () => {
    const aws = path.join(getDevOpsWorkspaceRoot(), 'terraform', 'aws');
    expect(fs.existsSync(aws)).toBe(true);
    const projects = listTerraformProjects();
    const ids = projects.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['aws', 'azure', 'gcp']));
  });

  it('resolves projects under devops/terraform', () => {
    const resolved = resolveTerraformProject('aws');
    expect(resolved.replace(/\\/g, '/')).toMatch(/devops\/terraform\/aws$/);
  });

  it('rejects paths outside devops/terraform', () => {
    expect(() => resolveTerraformProject('../../server')).toThrow();
  });
});
