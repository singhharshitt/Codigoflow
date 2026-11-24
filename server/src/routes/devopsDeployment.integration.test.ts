import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from '../app';
import { closeDatabase, resetDatabaseForTests } from '../database';

/**
 * Express <-> FastAPI deployment routes with FastAPI mocked at the fetch layer.
 * Nothing here reaches EC2.
 */
describe('deployment routes (mocked FastAPI)', () => {
  let dbPath: string;
  let app: ReturnType<typeof createApp>['app'];
  let httpServer: ReturnType<typeof createApp>['httpServer'];
  const originalFetch = global.fetch;
  const envKeys = ['DEVOPS_API_TOKEN', 'CODIGOFLOW_API_TOKEN', 'DEPLOYMENT_API_BASE_URL'] as const;
  const savedEnv: Record<string, string | undefined> = {};
  let fastapi: jest.Mock;

  beforeAll(() => {
    for (const k of envKeys) savedEnv[k] = process.env[k];
    dbPath = path.join(os.tmpdir(), `cf-deploy-${Date.now()}.db`);
    process.env.DATABASE_PATH = dbPath;
    process.env.DEVOPS_API_TOKEN = 'operator-test-token';
    process.env.CODIGOFLOW_API_TOKEN = 'service-test-token';
    process.env.DEPLOYMENT_API_BASE_URL = 'http://127.0.0.1:18000';
    resetDatabaseForTests(dbPath);
    const created = createApp();
    app = created.app;
    httpServer = created.httpServer;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  beforeEach(() => {
    // Only intercept calls to the mocked FastAPI; supertest itself does not use fetch.
    fastapi = jest.fn();
    global.fetch = fastapi as unknown as typeof fetch;
  });

  async function operatorCookie(): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ token: 'operator-test-token' });
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'];
    return Array.isArray(cookie) ? cookie[0] : String(cookie);
  }

  it('requires an operator session for deploy and rollback', async () => {
    for (const p of ['/api/devops/deployment/deploy', '/api/devops/deployment/rollback']) {
      const res = await request(app).post(p).send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('OPERATOR_AUTH_REQUIRED');
    }
    expect(fastapi).not.toHaveBeenCalled();
  });

  it('rejects a cross-site origin even with a valid session', async () => {
    const cookie = await operatorCookie();
    const res = await request(app)
      .post('/api/devops/deployment/deploy')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({});
    expect(res.status).toBe(403);
    expect(fastapi).not.toHaveBeenCalled();
  });

  it('deploys through the tunnel with the service key and records a job', async () => {
    fastapi.mockResolvedValue(
      new Response(JSON.stringify({ action: 'deploy-nginx', success: true }), { status: 200 }),
    );
    const cookie = await operatorCookie();

    const res = await request(app).post('/api/devops/deployment/deploy').set('Cookie', cookie).send({});

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ action: 'deploy-nginx', success: true });
    expect(fastapi).toHaveBeenCalledWith(
      'http://127.0.0.1:18000/api/deploy/deploy-nginx',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-API-Key': 'service-test-token' }) }),
    );

    const job = await request(app).get(`/api/jobs/${res.body.data.jobId}`);
    expect(job.body.data).toMatchObject({ operation: 'deployment.deploy-nginx', status: 'succeeded' });
  });

  it('passes a deployment conflict through and records the failed job', async () => {
    fastapi.mockResolvedValue(new Response(null, { status: 409 }));
    const cookie = await operatorCookie();

    const res = await request(app).post('/api/devops/deployment/rollback').set('Cookie', cookie).send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEPLOYMENT_CONFLICT');
    const jobs = await request(app).get('/api/jobs');
    const latest = (jobs.body.data as Array<{ operation: string; status: string }>).find(
      (j) => j.operation === 'deployment.rollback-nginx',
    );
    expect(latest?.status).toBe('failed');
  });

  it('surfaces a tunnel outage as DEPLOYMENT_SERVICE_UNAVAILABLE with a readable message', async () => {
    fastapi.mockRejectedValue(new TypeError('fetch failed'));
    const cookie = await operatorCookie();

    const res = await request(app).post('/api/devops/deployment/deploy').set('Cookie', cookie).send({});

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DEPLOYMENT_SERVICE_UNAVAILABLE');
    expect(res.body.error.message).toMatch(/SSH tunnel/);
  });

  it('exposes a read-only status that never includes the service token', async () => {
    fastapi
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'healthy' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true }), { status: 200 }));

    const res = await request(app).get('/api/devops/deployment/status');

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('ready');
    expect(JSON.stringify(res.body)).not.toContain('service-test-token');
  });
});
