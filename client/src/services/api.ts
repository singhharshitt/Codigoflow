import { apiRequest } from './http';
import type {
  AIStatus,
  BranchInfo,
  CommitEntry,
  ContainerInfo,
  DockerStatus,
  GitHubCommit,
  GitHubContributor,
  HealthStatus,
  ImageInfo,
  Job,
  Repository,
  RepoStatus,
} from '../types';

export const healthApi = {
  get: () => apiRequest<HealthStatus>('/health'),
};

export type LocalRepoInspect = {
  path: string;
  exists: boolean;
  isGit: boolean;
  alreadyRegistered: boolean;
  registeredId?: string;
  nameHint: string;
  branch?: string;
  remoteUrl?: string;
  status?: { staged: number; unstaged: number; untracked: number };
};

export const repositoriesApi = {
  list: () => apiRequest<Repository[]>('/repositories'),
  get: (id: string) => apiRequest<Repository>(`/repositories/${id}`),
  register: (body: { path: string; name?: string; description?: string }) =>
    apiRequest<Repository>('/repositories', { method: 'POST', data: body }),
  clone: (body: { url: string; destination: string; name?: string; description?: string }) =>
    apiRequest<Repository>('/repositories/clone', {
      method: 'POST',
      data: body,
      timeout: 180_000,
    }),
  inspect: (path: string) =>
    apiRequest<LocalRepoInspect>('/repositories/inspect', {
      method: 'POST',
      data: { path },
    }),
  remove: (id: string) => apiRequest<void>(`/repositories/${id}`, { method: 'DELETE' }),
  status: (id: string) => apiRequest<RepoStatus>(`/repositories/${id}/status`),
  branches: (id: string) => apiRequest<BranchInfo[]>(`/repositories/${id}/branches`),
  commits: (id: string, limit = 30) =>
    apiRequest<CommitEntry[]>(`/repositories/${id}/commits`, { params: { limit } }),
  diff: (id: string, file?: string) =>
    apiRequest<{ diff: string }>(`/repositories/${id}/diff`, {
      params: file ? { file } : undefined,
    }),
  stage: (id: string, files: string[]) =>
    apiRequest(`/repositories/${id}/stage`, { method: 'POST', data: { files } }),
  unstage: (id: string, files: string[]) =>
    apiRequest(`/repositories/${id}/unstage`, { method: 'POST', data: { files } }),
  commit: (id: string, message: string) =>
    apiRequest(`/repositories/${id}/commit`, { method: 'POST', data: { message } }),
  push: (id: string, remote = 'origin', branch?: string) =>
    apiRequest(`/repositories/${id}/push`, { method: 'POST', data: { remote, branch } }),
  checkout: (id: string, branch: string) =>
    apiRequest(`/repositories/${id}/checkout`, { method: 'POST', data: { branch } }),
};

export const aiApi = {
  status: () => apiRequest<AIStatus>('/ai/status'),
  commitMessages: (diff: string) =>
    apiRequest<{ messages: string[] }>('/ai/commit-messages', { method: 'POST', data: { diff } }),
  explainError: (error: string) =>
    apiRequest<{ explanation: string; suggestions: string[] }>('/ai/explain-error', {
      method: 'POST',
      data: { error },
    }),
  analyzeDockerLogs: (logs: string) =>
    apiRequest<{ summary: string; cause?: string; suggestions?: string[] }>(
      '/ai/analyze-docker-logs',
      { method: 'POST', data: { logs } },
    ),
  ask: (question: string, codeContext?: string) =>
    apiRequest<{ answer: string }>('/ai/ask', {
      method: 'POST',
      data: { question, codeContext },
    }),
};

export const dockerApi = {
  status: () => apiRequest<DockerStatus>('/docker/status'),
  containers: (all = true) =>
    apiRequest<ContainerInfo[]>('/docker/containers', { params: { all } }),
  images: () => apiRequest<ImageInfo[]>('/docker/images'),
  logs: (id: string, tail = 100) =>
    apiRequest<{ logs: string }>(`/docker/containers/${id}/logs`, { params: { tail } }),
  start: (id: string) => apiRequest(`/docker/containers/${id}/start`, { method: 'POST' }),
  stop: (id: string) => apiRequest(`/docker/containers/${id}/stop`, { method: 'POST' }),
  restart: (id: string) => apiRequest(`/docker/containers/${id}/restart`, { method: 'POST' }),
};

export const githubApi = {
  repo: (url: string) =>
    apiRequest<Record<string, unknown>>('/github/repositories', { params: { url } }),
  commits: (owner: string, repo: string) =>
    apiRequest<GitHubCommit[]>(`/github/repositories/${owner}/${repo}/commits`),
  contributors: (owner: string, repo: string) =>
    apiRequest<GitHubContributor[]>(`/github/repositories/${owner}/${repo}/contributors`),
};

export const jobsApi = {
  list: (limit = 50) => apiRequest<Job[]>('/jobs', { params: { limit } }),
  history: (limit = 50) => apiRequest<Job[]>('/history', { params: { limit } }),
  get: (id: string) => apiRequest<Job>(`/jobs/${id}`),
};

// Named service aliases for feature modules
export const repositoryService = repositoriesApi;
export const gitService = repositoriesApi;
export const dockerService = dockerApi;
export const aiService = aiApi;
export const githubService = githubApi;
export const historyService = jobsApi;
export const integrationService = healthApi;
export { workflowApi as workflowService, devopsApi } from './devopsApi';
