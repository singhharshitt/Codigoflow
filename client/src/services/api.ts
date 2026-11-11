import type { ApiResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  const data = await res.json().catch(() => ({
    success: false,
    error: { code: 'PARSE_ERROR', message: 'Failed to parse server response' },
  }));

  return data as ApiResponse<T>;
}

// ── Health ────────────────────────────────────────────────────────────────────
export const healthApi = {
  get: () => request('/health'),
};

// ── Repositories ──────────────────────────────────────────────────────────────
export const repositoriesApi = {
  list: () => request('/repositories'),
  get: (id: string) => request(`/repositories/${id}`),
  register: (body: { path: string; name?: string; description?: string }) =>
    request('/repositories', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => request(`/repositories/${id}`, { method: 'DELETE' }),
  status: (id: string) => request(`/repositories/${id}/status`),
  branches: (id: string) => request(`/repositories/${id}/branches`),
  commits: (id: string, limit = 30) => request(`/repositories/${id}/commits?limit=${limit}`),
  diff: (id: string, file?: string) =>
    request(`/repositories/${id}/diff${file ? `?file=${encodeURIComponent(file)}` : ''}`),
  stage: (id: string, files: string[]) =>
    request(`/repositories/${id}/stage`, { method: 'POST', body: JSON.stringify({ files }) }),
  commit: (id: string, message: string) =>
    request(`/repositories/${id}/commit`, { method: 'POST', body: JSON.stringify({ message }) }),
  push: (id: string, remote = 'origin', branch?: string) =>
    request(`/repositories/${id}/push`, { method: 'POST', body: JSON.stringify({ remote, branch }) }),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  status: () => request('/ai/status'),
  commitMessages: (diff: string) =>
    request('/ai/commit-messages', { method: 'POST', body: JSON.stringify({ diff }) }),
  explainError: (error: string) =>
    request('/ai/explain-error', { method: 'POST', body: JSON.stringify({ error }) }),
  analyzeDockerLogs: (logs: string) =>
    request('/ai/analyze-docker-logs', { method: 'POST', body: JSON.stringify({ logs }) }),
  ask: (question: string, codeContext?: string) =>
    request('/ai/ask', { method: 'POST', body: JSON.stringify({ question, codeContext }) }),
};

// ── Docker ────────────────────────────────────────────────────────────────────
export const dockerApi = {
  status: () => request('/docker/status'),
  containers: (all = true) => request(`/docker/containers?all=${all}`),
  images: () => request('/docker/images'),
  logs: (id: string, tail = 100) => request(`/docker/containers/${id}/logs?tail=${tail}`),
  start: (id: string) => request(`/docker/containers/${id}/start`, { method: 'POST' }),
  stop: (id: string) => request(`/docker/containers/${id}/stop`, { method: 'POST' }),
};

// ── GitHub ────────────────────────────────────────────────────────────────────
export const githubApi = {
  repo: (url: string) => request(`/github/repositories?url=${encodeURIComponent(url)}`),
  commits: (owner: string, repo: string) =>
    request(`/github/repositories/${owner}/${repo}/commits`),
  contributors: (owner: string, repo: string) =>
    request(`/github/repositories/${owner}/${repo}/contributors`),
};

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (limit = 50) => request(`/jobs?limit=${limit}`),
  history: (limit = 50) => request(`/history?limit=${limit}`),
};
