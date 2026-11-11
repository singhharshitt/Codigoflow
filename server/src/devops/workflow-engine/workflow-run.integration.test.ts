import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from '../../app';
import { closeDatabase, resetDatabaseForTests } from '../../database';

describe('workflow run replaces 501', () => {
  let dbPath: string;
  let app: ReturnType<typeof createApp>['app'];
  let httpServer: ReturnType<typeof createApp>['httpServer'];

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `cf-wf-test-${Date.now()}.db`);
    process.env.DATABASE_PATH = dbPath;
    resetDatabaseForTests(dbPath);
    const created = createApp();
    app = created.app;
    httpServer = created.httpServer;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('executes start → nagios.check.host → end and returns a job', async () => {
    const created = await request(app)
      .post('/api/workflows')
      .send({
        name: 'nagios-smoke',
        nodes: [
          { id: 'start', data: { kind: 'start', label: 'Start', config: {} } },
          { id: 'n1', data: { kind: 'nagios.check.host', label: 'Hosts', config: {} } },
          { id: 'end', data: { kind: 'end', label: 'End', config: {} } },
        ],
        edges: [
          { source: 'start', target: 'n1' },
          { source: 'n1', target: 'end' },
        ],
      });

    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const run = await request(app).post(`/api/workflows/${id}/run`);
    expect(run.status).not.toBe(501);
    expect(run.status).toBe(200);
    expect(run.body.success).toBe(true);
    expect(run.body.data.job.id).toBeTruthy();
    expect(run.body.data.nodeRuns.length).toBeGreaterThanOrEqual(3);
  });
});
