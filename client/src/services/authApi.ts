import { apiRequest } from './http';

export type AuthStatus = {
  authenticated: boolean;
  role: string | null;
  expiresAt: number | null;
  tokenConfigured: boolean;
  sessionConfigured: boolean;
  loopback: boolean;
  authMode: string;
};

export const authApi = {
  status: () => apiRequest<AuthStatus>('/auth/status'),
  login: (token: string) =>
    apiRequest<{ role: string; expiresInMs: number }>('/auth/login', {
      method: 'POST',
      data: { token },
    }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
};
