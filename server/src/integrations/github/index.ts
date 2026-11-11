import { config, isGitHubConfigured } from '../../config';
import { createError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const GITHUB_API = 'https://api.github.com';

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'CódigoFlow/1.0',
  };
  if (isGitHubConfigured()) {
    headers['Authorization'] = `Bearer ${config.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubFetch(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: buildHeaders() });

  if (res.status === 403) {
    const remaining = res.headers.get('X-RateLimit-Remaining');
    if (remaining === '0') {
      const reset = res.headers.get('X-RateLimit-Reset');
      const resetDate = reset ? new Date(parseInt(reset, 10) * 1000).toISOString() : 'unknown';
      throw createError(`GitHub API rate limit exceeded. Resets at ${resetDate}`, 429, 'RATE_LIMIT');
    }
    throw createError('GitHub API access forbidden', 403, 'GITHUB_FORBIDDEN');
  }

  if (!res.ok) {
    throw createError(`GitHub API error: ${res.status} ${res.statusText}`, res.status, 'GITHUB_API_ERROR');
  }

  return res.json();
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const patterns = [
    /github\.com\/([^/]+)\/([^/.\s]+)/,
    /github\.com:([^/]+)\/([^/.\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
  }

  throw createError('Could not parse GitHub owner and repository from URL', 400, 'INVALID_GITHUB_URL');
}

export async function getRepoInfo(owner: string, repo: string): Promise<unknown> {
  return githubFetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

export async function getRepoCommits(owner: string, repo: string, perPage = 30): Promise<unknown> {
  return githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${Math.min(perPage, 100)}`,
  );
}

export async function getRepoContributors(owner: string, repo: string): Promise<unknown> {
  return githubFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=30`,
  );
}
