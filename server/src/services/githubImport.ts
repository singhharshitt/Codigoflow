import fs from 'fs';
import path from 'path';
import { createError } from '../middleware/errorHandler';
import { parseGitHubUrl, getRepoInfo } from '../integrations/github';
import { listRepositories, registerRepository } from './repositoryService';
import {
  isAllowedGitRemote,
  runGitCommand,
  sanitizeRemoteUrl,
} from '../integrations/git';
import { logger } from '../utils/logger';

const DEFAULT_MAX_MB = 500;
const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;

export function getReposStorageRoot(): string {
  const configured = process.env.REPOS_STORAGE_ROOT?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), 'data', 'repos');
}

function assertSafeBranch(branch: string): string {
  const trimmed = branch.trim();
  if (!BRANCH_RE.test(trimmed) || trimmed.includes('..')) {
    throw createError('Invalid branch name', 400, 'INVALID_BRANCH');
  }
  return trimmed;
}

export type GithubImportPreview = {
  url: string;
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  stars: number | null;
  sizeKb: number | null;
  importAllowed: boolean;
  authRequired: boolean;
  sizeLimitMb: number;
  oversized: boolean;
  note: string;
};

export async function previewGithubRepository(url: string): Promise<GithubImportPreview> {
  const { owner, repo } = parseGitHubUrl(url);
  const info = (await getRepoInfo(owner, repo)) as Record<string, unknown>;
  const isPrivate = Boolean(info.private);
  const sizeKb = typeof info.size === 'number' ? info.size : undefined;
  const maxMb = Number(process.env.GITHUB_IMPORT_MAX_MB || DEFAULT_MAX_MB);

  return {
    url: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    fullName: (info.full_name as string) || `${owner}/${repo}`,
    description: (info.description as string) || null,
    private: isPrivate,
    defaultBranch: (info.default_branch as string) || 'main',
    language: (info.language as string) || null,
    stars: typeof info.stargazers_count === 'number' ? info.stargazers_count : null,
    sizeKb: sizeKb ?? null,
    importAllowed: !isPrivate,
    authRequired: isPrivate,
    sizeLimitMb: maxMb,
    oversized: sizeKb != null ? sizeKb / 1024 > maxMb : false,
    note: isPrivate
      ? 'Private repositories require server-side authentication (GITHUB_TOKEN / Git credentials).'
      : 'Public repositories can be imported anonymously over HTTPS.',
  };
}

export async function importGithubRepository(input: {
  url: string;
  branch?: string;
  name?: string;
  description?: string;
}) {
  const preview = await previewGithubRepository(input.url);
  if (preview.private) {
    throw createError(
      'Private repository import requires authentication. Configure GITHUB_TOKEN or clone locally.',
      401,
      'GITHUB_AUTH_REQUIRED',
    );
  }
  if (preview.oversized) {
    throw createError(
      `Repository exceeds import size limit (${preview.sizeLimitMb} MB)`,
      400,
      'REPO_TOO_LARGE',
    );
  }

  const cloneUrl = `https://github.com/${preview.owner}/${preview.repo}.git`;
  if (!isAllowedGitRemote(cloneUrl)) {
    throw createError('Unsupported Git remote URL', 400, 'INVALID_REMOTE_URL');
  }

  const root = getReposStorageRoot();
  fs.mkdirSync(root, { recursive: true });
  const folder = `${preview.owner}__${preview.repo}`.replace(/[^A-Za-z0-9._-]/g, '_');
  const destination = path.join(root, folder);

  const existing = listRepositories().find(
    (r) => path.resolve(r.path) === path.resolve(destination),
  );
  if (existing) {
    return {
      repository: existing,
      alreadyPresent: true,
      destination,
      branch: input.branch?.trim() || preview.defaultBranch,
      message: 'Repository already imported and registered',
    };
  }

  if (fs.existsSync(destination)) {
    // Incomplete prior attempt — clean before retry
    fs.rmSync(destination, { recursive: true, force: true });
  }

  const branch = assertSafeBranch(input.branch?.trim() || preview.defaultBranch);
  logger.info(
    { url: sanitizeRemoteUrl(cloneUrl), destination, branch },
    'Starting managed GitHub import',
  );

  const parent = path.dirname(destination);
  const name = path.basename(destination);
  try {
    const result = await runGitCommand(
      parent,
      ['clone', '--depth', '1', '--branch', branch, '--', cloneUrl, name],
      { timeoutMs: 180_000, allowCwdFallback: true },
    );
    if (result.exitCode !== 0) {
      throw createError(
        `Clone failed: ${result.stderr || result.stdout}`,
        500,
        'CLONE_FAILED',
      );
    }

    const repository = await registerRepository({
      path: destination,
      name: input.name || preview.repo,
      description: input.description || preview.description || undefined,
    });

    return {
      repository,
      alreadyPresent: false,
      destination,
      branch,
      message: 'Repository imported and registered',
    };
  } catch (err) {
    if (fs.existsSync(destination)) {
      try {
        fs.rmSync(destination, { recursive: true, force: true });
      } catch {
        /* best-effort cleanup */
      }
    }
    throw err;
  }
}
