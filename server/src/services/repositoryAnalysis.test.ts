import fs from 'fs';
import os from 'os';
import path from 'path';
import { proposeDeploymentWorkflow } from './repositoryAnalysis';

describe('repositoryAnalysis proposal', () => {
  it('builds a review-only workflow without destructive approve flags', () => {
    const proposal = proposeDeploymentWorkflow({
      repositoryId: '00000000-0000-0000-0000-000000000001',
      repositoryName: 'demo-app',
      path: '/tmp/demo',
      stack: { name: 'node', confidence: 'detected' },
      findings: [
        { key: 'dockerfile', value: true, confidence: 'detected' },
        { key: 'runtime', value: 'Node.js', confidence: 'detected' },
      ],
      recommendations: [],
      limitations: [],
    });

    expect(proposal.reviewRequired).toBe(true);
    expect(proposal.autoExecute).toBe(false);
    expect(proposal.nodes.some((n) => n.data.kind === 'terraform.plan')).toBe(true);
    expect(proposal.nodes.some((n) => n.data.kind === 'terraform.apply')).toBe(false);
    expect(proposal.nodes.some((n) => n.data.config?.approve === true)).toBe(false);
    expect(proposal.edges.length).toBe(proposal.nodes.length - 1);
  });
});

describe('static analysis helpers (filesystem)', () => {
  it('detects package.json and Dockerfile markers without executing scripts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-analyze-'));
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'sample',
        scripts: { start: 'node server.js', build: 'tsc' },
        dependencies: { express: '^4.0.0' },
      }),
    );
    fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM node:20\nEXPOSE 4000\n');
    fs.writeFileSync(path.join(dir, '.env.example'), 'PORT=4000\nAPI_KEY=\n');

    expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'Dockerfile'), 'utf8')).toContain('EXPOSE 4000');
    // Cleanup
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
