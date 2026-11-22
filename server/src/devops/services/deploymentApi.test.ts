
import { executeDeployment } from './deploymentApi';

const originalFetch = global.fetch;

describe('FastAPI deployment connector', () => {
  const originalToken = process.env.CODIGOFLOW_API_TOKEN;

  beforeEach(() => {
    process.env.CODIGOFLOW_API_TOKEN = 'test-token';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;

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
});
