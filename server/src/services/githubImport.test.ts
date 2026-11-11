import { previewGithubRepository } from './githubImport';
import * as github from '../integrations/github';

jest.mock('../integrations/github', () => {
  const actual = jest.requireActual('../integrations/github');
  return {
    ...actual,
    getRepoInfo: jest.fn(),
  };
});

describe('githubImport preview', () => {
  it('marks public repos as importable', async () => {
    (github.getRepoInfo as jest.Mock).mockResolvedValue({
      full_name: 'octocat/Hello-World',
      description: 'demo',
      private: false,
      default_branch: 'master',
      language: 'C',
      stargazers_count: 1,
      size: 100,
    });

    const preview = await previewGithubRepository('https://github.com/octocat/Hello-World');
    expect(preview.importAllowed).toBe(true);
    expect(preview.authRequired).toBe(false);
    expect(preview.defaultBranch).toBe('master');
    expect(preview.private).toBe(false);
  });

  it('requires auth for private repos', async () => {
    (github.getRepoInfo as jest.Mock).mockResolvedValue({
      full_name: 'owner/secret',
      private: true,
      default_branch: 'main',
      size: 10,
    });

    const preview = await previewGithubRepository('https://github.com/owner/secret');
    expect(preview.importAllowed).toBe(false);
    expect(preview.authRequired).toBe(true);
  });

  it('rejects invalid github urls', async () => {
    await expect(previewGithubRepository('https://evil.example/repo')).rejects.toMatchObject({
      code: 'INVALID_GITHUB_URL',
    });
  });
});
