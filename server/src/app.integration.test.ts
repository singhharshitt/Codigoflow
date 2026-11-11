/**
 * Integration tests — no live NVIDIA, GitHub, or Docker required.
 */
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from './app';
import { closeDatabase, resetDatabaseForTests } from './database';

describe('API foundation', () => {
  let dbPath: string;
  let app: ReturnType<typeof createApp>['app'];
  let httpServer: ReturnType<typeof createApp>['httpServer'];

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `cf-test-${Date.now()}.db`);
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

  it('GET /api/health returns success envelope', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.integrations).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/sk-|nvapi-/i);
  });

  it('GET /api/repositories returns an array', async () => {
    const res = await request(app).get('/api/repositories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/ai/status never exposes keys', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('apiKey');
    expect(JSON.stringify(res.body)).not.toMatch(/sk-|nvapi-/i);
  });

  it('POST /api/workflows persists a workflow', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .send({
        name: 'Test flow',
        nodes: [{ id: 'start', data: { kind: 'start' } }],
        edges: [],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();

    const list = await request(app).get('/api/workflows');
    expect(list.body.data.some((w: { id: string }) => w.id === res.body.data.id)).toBe(true);
  });

  it('GET unknown route returns NOT_FOUND', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
