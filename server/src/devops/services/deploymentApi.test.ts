
import { checkDeploymentConnection, executeDeployment, resolveDeploymentTarget } from './deploymentApi';

const originalFetch = global.fetch;

describe('FastAPI deployment connector', () => {
  const originalToken = process.env.CODIGOFLOW_API_TOKEN;

  const originalBaseUrl = process.env.DEPLOYMENT_API_BASE_URL;

  beforeEach(() => {
    process.env.CODIGOFLOW_API_TOKEN = 'test-token';
    // Hermetic: never inherit a developer's tunnel URL from .env.local
    delete process.env.DEPLOYMENT_API_BASE_URL;
    delete process.env.FASTAPI_BASE_URL;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.DEPLOYMENT_API_BASE_URL;
    else process.env.DEPLOYMENT_API_BASE_URL = originalBaseUrl;

    if (originalToken === undefined) {
      delete process.env.CODIGOFLOW_API_TOKEN;
    } else {
      process.env.CODIGOFLOW_API_TOKEN = originalToken;
    }
  });

  it('rejects unsupported actions', async () => {
    await expect(
      executeDeployment('invalid' as never)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_DEPLOYMENT_ACTION',
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires a configured service token', async () => {
    delete process.env.CODIGOFLOW_API_TOKEN;

    await expect(
      executeDeployment('deploy-nginx')
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'DEPLOYMENT_NOT_CONFIGURED',
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls only the fixed localhost deployment endpoint', async () => {
    jest.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          action: 'deploy-nginx',
          success: true,
        }),
        { status: 200 }
      )
    );

    const result = await executeDeployment('deploy-nginx');

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/deploy/deploy-nginx',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'test-token',
        }),
      })
    );
  });

  it('rejects deployment conflicts', async () => {
    jest.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 409 })
    );

    await expect(
      executeDeployment('deploy-nginx')
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DEPLOYMENT_CONFLICT',
    });
  });

  it('rejects FastAPI authentication failures', async () => {
    jest.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 401 })
    );

    await expect(
      executeDeployment('deploy-nginx')
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'DEPLOYMENT_AUTH_FAILED',
    });
  });

  it('handles an unavailable deployment service', async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('Connection refused'));

    await expect(
      executeDeployment('deploy-nginx')
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'DEPLOYMENT_SERVICE_UNAVAILABLE',
    });
  });

  it('rejects invalid successful responses', async () => {
    jest.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          action: 'rollback-nginx',
          success: true,
        }),
        { status: 200 }
      )
    );

    await expect(
      executeDeployment('deploy-nginx')
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'DEPLOYMENT_INVALID_RESPONSE',
    });
  });

  it('handles deployment failures', async () => {
    jest.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 500 })
    );

    await expect(
      executeDeployment('deploy-nginx')
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'DEPLOYMENT_FAILED',
    });
  });

  it('reports a timeout distinctly: the outcome on EC2 is unknown', async () => {
    jest.mocked(fetch).mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));

    await expect(executeDeployment('rollback-nginx')).rejects.toMatchObject({
      statusCode: 504,
      code: 'DEPLOYMENT_TIMEOUT',
    });
  });

  it('maps a FastAPI 400 to DEPLOYMENT_REJECTED', async () => {
    jest.mocked(fetch).mockResolvedValue(new Response(null, { status: 400 }));

    await expect(executeDeployment('deploy-nginx')).rejects.toMatchObject({
      statusCode: 400,
      code: 'DEPLOYMENT_REJECTED',
    });
  });
});

describe('deployment target guard', () => {
  const keys = ['DEPLOYMENT_API_BASE_URL', 'FASTAPI_BASE_URL', 'DEPLOYMENT_API_ALLOW_REMOTE', 'CODIGOFLOW_API_TOKEN'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) saved[k] = process.env[k];
    for (const k of keys) delete process.env[k];
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('uses the tunnel endpoint from DEPLOYMENT_API_BASE_URL', async () => {
    process.env.DEPLOYMENT_API_BASE_URL = 'http://127.0.0.1:18000/';
    process.env.CODIGOFLOW_API_TOKEN = 'test-token';
    jest
      .mocked(fetch)
      .mockResolvedValue(new Response(JSON.stringify({ action: 'deploy-nginx', success: true }), { status: 200 }));

    await executeDeployment('deploy-nginx');

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:18000/api/deploy/deploy-nginx', expect.anything());
  });

  it('refuses a public http URL so the API key never travels unencrypted', async () => {
    process.env.DEPLOYMENT_API_BASE_URL = 'http://203.0.113.10:8000';
    process.env.CODIGOFLOW_API_TOKEN = 'test-token';

    await expect(executeDeployment('deploy-nginx')).rejects.toMatchObject({
      statusCode: 503,
      code: 'DEPLOYMENT_URL_NOT_ALLOWED',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows a remote URL only with https and an explicit opt-in', () => {
    process.env.DEPLOYMENT_API_BASE_URL = 'https://deploy.example.com';
    expect(() => resolveDeploymentTarget()).toThrow();
    process.env.DEPLOYMENT_API_ALLOW_REMOTE = 'true';
    expect(resolveDeploymentTarget().baseUrl).toBe('https://deploy.example.com');
  });

  it('rejects URLs with embedded credentials', () => {
    process.env.DEPLOYMENT_API_BASE_URL = 'http://user:pass@127.0.0.1:18000';
    expect(() => resolveDeploymentTarget()).toThrow(/credentials/);
  });
});

describe('checkDeploymentConnection', () => {
  const saved = { url: process.env.DEPLOYMENT_API_BASE_URL, token: process.env.CODIGOFLOW_API_TOKEN };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  beforeEach(() => {
    process.env.DEPLOYMENT_API_BASE_URL = 'http://127.0.0.1:18000';
    process.env.CODIGOFLOW_API_TOKEN = 'secret-service-token';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (saved.url === undefined) delete process.env.DEPLOYMENT_API_BASE_URL;
    else process.env.DEPLOYMENT_API_BASE_URL = saved.url;
    if (saved.token === undefined) delete process.env.CODIGOFLOW_API_TOKEN;
    else process.env.CODIGOFLOW_API_TOKEN = saved.token;
  });

  it('is ready when /health is healthy and /api/auth-check accepts the key', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(json({ status: 'healthy' }))
      .mockResolvedValueOnce(json({ authenticated: true }));

    const status = await checkDeploymentConnection();

    expect(status).toMatchObject({ state: 'ready', reachable: true, authenticated: true, target: '127.0.0.1:18000' });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:18000/api/auth-check',
      expect.objectContaining({ headers: { 'X-API-Key': 'secret-service-token' } }),
    );
    // The token must never be echoed back to callers.
    expect(JSON.stringify(status)).not.toContain('secret-service-token');
  });

  it('reports the tunnel as down when the connection is refused', async () => {
    jest.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));
    await expect(checkDeploymentConnection()).resolves.toMatchObject({ state: 'unreachable', reachable: false });
  });

  it('reports a timeout separately from a refused connection', async () => {
    jest.mocked(fetch).mockRejectedValue(Object.assign(new Error('slow'), { name: 'TimeoutError' }));
    await expect(checkDeploymentConnection()).resolves.toMatchObject({ state: 'timeout' });
  });

  it('reports auth_failed when FastAPI rejects the key', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(json({ status: 'healthy' }))
      .mockResolvedValueOnce(json({ detail: 'Invalid or missing API key' }, 401));
    await expect(checkDeploymentConnection()).resolves.toMatchObject({ state: 'auth_failed', authenticated: false });
  });

  it('reports not_configured (without calling auth-check) when no token is set', async () => {
    delete process.env.CODIGOFLOW_API_TOKEN;
    jest.mocked(fetch).mockResolvedValueOnce(json({ status: 'healthy' }));
    await expect(checkDeploymentConnection()).resolves.toMatchObject({ state: 'not_configured', reachable: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports unhealthy for a non-healthy /health answer', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(json({ status: 'degraded' }, 503));
    await expect(checkDeploymentConnection()).resolves.toMatchObject({ state: 'unhealthy' });
  });

  it('flags a disallowed URL without making any request', async () => {
    process.env.DEPLOYMENT_API_BASE_URL = 'http://13.0.0.1:8000';
    await expect(checkDeploymentConnection()).resolves.toMatchObject({ state: 'url_not_allowed' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
