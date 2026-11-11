import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from '../app';
import { closeDatabase, resetDatabaseForTests } from '../database';

describe('privileged DevOps auth integration', () => {
  let dbPath: string;
  let app: ReturnType<typeof createApp>['app'];
  let httpServer: ReturnType<typeof createApp>['httpServer'];
  const prevToken = process.env.DEVOPS_API_TOKEN;
  const prevEnforce = process.env.DEVOPS_ENFORCE_TOKEN;

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `cf-auth-${Date.now()}.db`);
    process.env.DATABASE_PATH = dbPath;
    process.env.DEVOPS_API_TOKEN = 'phase10-test-token';
    process.env.DEVOPS_ENFORCE_TOKEN = 'true';
    process.env.DEVOPS_REQUIRE_LOOPBACK = 'true';
    resetDatabaseForTests(dbPath);
    const created = createApp();
    app = created.app;
    httpServer = created.httpServer;
  });

  afterAll(async () => {
    process.env.DEVOPS_API_TOKEN = prevToken;
    process.env.DEVOPS_ENFORCE_TOKEN = prevEnforce;
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it(
    'allows unauthenticated GET terraform projects',
    async () => {
      const res = await request(app).get('/api/devops/terraform/projects');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    },
    15_000,
  );

  it('rejects terraform mutation without bearer token', async () => {
    const res = await request(app).post('/api/devops/terraform/fmt').send({ projectPath: 'local-lab' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('DEVOPS_UNAUTHORIZED');
  });

  it('rejects workflow run without bearer token when enforced', async () => {
    const created = await request(app)
      .post('/api/workflows')
      .send({
        name: 'auth-gate',
        nodes: [{ id: 'start', data: { kind: 'start', config: {} } }],
        edges: [],
      });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const run = await request(app).post(`/api/workflows/${id}/run`);
    expect(run.status).toBe(401);
  });
});

