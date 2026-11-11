// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  message?: string;
}

// Repository types
export interface Repository {
  id: string;
  name: string;
  path: string;
  description?: string;
  remote_url?: string;
  github_owner?: string;
  github_repo?: string;
  created_at: number;
  updated_at: number;
}

export interface RepoStatus {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface CommitEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  insertions: number;
  deletions: number;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  tracking?: string;
}

// Docker types
export interface DockerStatus {
  available: boolean;
  version?: string;
  error?: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
}

export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

// AI types
export interface AIStatus {
  configured: boolean;
  model: string;
  baseUrl: string;
}

// Job types
export interface Job {
  id: string;
  operation: string;
  repo_id?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  summary?: string;
  log_ref?: string;
  error_message?: string;
  started_at?: number;
  finished_at?: number;
  created_at: number;
}

// Health
export interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
  integrations: {
    ai: { configured: boolean };
    github: { configured: boolean };
    docker: DockerStatus;
  };
}

// GitHub types
export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  html_url: string;
  author?: { login: string; avatar_url: string };
}

export interface GitHubContributor {
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}
