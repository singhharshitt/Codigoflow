import type { Request } from 'express';
import {
  createSessionToken,
  verifySessionToken,
  readSession,
  COOKIE_NAME,
} from './session';

describe('session tokens', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.DEVOPS_API_TOKEN = 'test-session-secret-value';
    process.env.SESSION_SECRET = 'test-session-secret-value';
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it('creates and verifies operator session tokens', () => {
    const token = createSessionToken('operator');
    const payload = verifySessionToken(token);
    expect(payload?.role).toBe('operator');
    expect(payload?.jti).toBeTruthy();
    expect(payload!.exp).toBeGreaterThan(Date.now());
  });

  it('rejects tampered tokens', () => {
    const token = createSessionToken('operator');
    const [payload] = token.split('.');
    expect(verifySessionToken(`${payload}.tampered`)).toBeNull();
  });

  it('reads session from HttpOnly cookie header', () => {
    const token = createSessionToken('operator');
    const req = {
      header: (name: string) =>
        name.toLowerCase() === 'cookie' ? `${COOKIE_NAME}=${encodeURIComponent(token)}` : undefined,
    } as unknown as Request;
    expect(readSession(req)?.role).toBe('operator');
  });
});
