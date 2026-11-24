import http from 'node:http';

function request(method, path, body) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4000,
        path,
        method,
        headers: data
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data),
            }
          : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          resolve({ path, status: res.statusCode, body: raw.slice(0, 500), full: raw });
        });
      },
    );
    req.on('error', (e) => resolve({ path, status: 0, body: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

const calls = [
  ['GET', '/api/health'],
  ['GET', '/api/auth/status'],
  ['GET', '/api/repositories'],
  ['GET', '/api/jobs'],
  ['GET', '/api/workflows'],
  ['GET', '/api/docker/status'],
  ['GET', '/api/docker/containers?all=true'],
  ['GET', '/api/ai/status'],
  ['GET', '/api/devops/status'],
  ['GET', '/api/devops/preflight'],
  ['GET', '/api/devops/terraform/projects'],
  ['POST', '/api/devops/terraform/validate', { projectPath: 'local-lab' }],
  ['GET', '/api/devops/ansible/playbooks'],
  ['POST', '/api/devops/ansible/playbooks/validate', { playbook: 'playbooks/bootstrap.yml' }],
  ['GET', '/api/devops/ansible/inventory'],
  ['GET', '/api/devops/puppet/status'],
  ['GET', '/api/devops/nagios/status'],
  ['GET', '/api/devops/lab/status'],
  ['POST', '/api/ai/ask', { message: 'Say hello in one word' }],
];

// Create the labeled demo workflow only once, so repeated runs do not pile up duplicates.
const DEMO_WORKFLOW = '[demo] Smoke persistence check';
const existing = await request('GET', '/api/workflows');
if (!existing.full?.includes(DEMO_WORKFLOW)) {
  calls.push([
    'POST',
    '/api/workflows',
    {
      name: DEMO_WORKFLOW,
      description: 'Created by scripts/demo-api-smoke.mjs',
      nodes: [
        { id: 'start', type: 'cfNode', position: { x: 0, y: 0 }, data: { kind: 'start', label: 'Start', config: {} } },
        { id: 'end', type: 'cfNode', position: { x: 240, y: 0 }, data: { kind: 'end', label: 'End', config: {} } },
      ],
      edges: [{ id: 'e1', source: 'start', target: 'end' }],
    },
  ]);
}

const results = [];
for (const [method, path, body] of calls) {
  const { full: _full, ...r } = await request(method, path, body);
  results.push(r);
}
console.log(JSON.stringify(results, null, 2));
console.error(
  results.map((r) => `${String(r.status).padEnd(4)} ${r.path}`).join(String.fromCharCode(10)),
);
