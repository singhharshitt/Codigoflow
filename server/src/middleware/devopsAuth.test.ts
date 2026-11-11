import type { Request, Response } from 'express';
import { requireDevOpsMutationAuth, isLoopbackAddress } from './devopsAuth';

function mockReq(overrides: Partial<Request> & { headers?: Record<string, string>; ip?: string }): Request {
  const headers = overrides.headers ?? {};
  return {
    header: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? undefined,
    socket: { remoteAddress: overrides.ip ?? '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

describe('devopsAuth', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('detects loopback addresses', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('10.0.0.5')).toBe(false);
  });

  it('rejects non-loopback clients by default', () => {
    process.env.DEVOPS_REQUIRE_LOOPBACK = 'true';
    process.env.DEVOPS_API_TOKEN = '';
    process.env.DEVOPS_ENFORCE_TOKEN = 'false';
    process.env.NODE_ENV = 'test';

    const next = jest.fn();
    requireDevOpsMutationAuth(mockReq({ ip: '10.1.2.3' }), {} as Response, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode || err.status).toBe(403);
  });

  it('rejects missing bearer token when token enforcement is enabled', () => {
    process.env.DEVOPS_REQUIRE_LOOPBACK = 'true';
    process.env.DEVOPS_API_TOKEN = 'secret-token-value';
    process.env.DEVOPS_ENFORCE_TOKEN = 'true';

    const next = jest.fn();
    requireDevOpsMutationAuth(mockReq({ ip: '127.0.0.1', headers: {} }), {} as Response, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode || err.status).toBe(401);
  });

  it('allows authorized loopback bearer token', () => {
    process.env.DEVOPS_REQUIRE_LOOPBACK = 'true';
    process.env.DEVOPS_API_TOKEN = 'secret-token-value';
    process.env.DEVOPS_ENFORCE_TOKEN = 'true';

    const next = jest.fn();
    requireDevOpsMutationAuth(
      mockReq({
        ip: '127.0.0.1',
        headers: { authorization: 'Bearer secret-token-value' },
      }),
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });
});
