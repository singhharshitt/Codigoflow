import {
  validateRepoPath,
  hasSensitiveFiles,
  parseGitStatus,
  sanitizeRemoteUrl,
  isAllowedGitRemote,
  runGitCommand,
  isGitRepository,
} from '../../integrations/git';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('validateRepoPath', () => {
  it('throws on empty string', () => {
    expect(() => validateRepoPath('')).toThrow();
  });

  it('throws on path traversal', () => {
    expect(() => validateRepoPath('../../etc/passwd')).toThrow();
  });

  it('throws on non-existent path', () => {
    expect(() => validateRepoPath('/definitely/does/not/exist/xyz')).toThrow();
  });

  it('accepts a real directory', () => {
    expect(() => validateRepoPath(os.tmpdir())).not.toThrow();
  });
});

describe('hasSensitiveFiles', () => {
  it('detects .env files', () => {
    const result = hasSensitiveFiles(['.env', 'src/index.ts']);
    expect(result).toContain('.env');
    expect(result).not.toContain('src/index.ts');
  });

  it('detects .pem files', () => {
    expect(hasSensitiveFiles(['cert.pem'])).toContain('cert.pem');
  });

  it('detects private key files', () => {
    expect(hasSensitiveFiles(['id_rsa'])).toContain('id_rsa');
  });

  it('returns empty for clean files', () => {
    expect(hasSensitiveFiles(['src/index.ts', 'package.json'])).toHaveLength(0);
  });
});

describe('parseGitStatus', () => {
  it('parses staged and unstaged files', () => {
    const raw = 'M  staged-file.ts\n M unstaged-file.ts\n?? new-file.ts\n';
    const result = parseGitStatus(raw);
    expect(result.staged).toContain('staged-file.ts');
    expect(result.unstaged).toContain('unstaged-file.ts');
    expect(result.untracked).toContain('new-file.ts');
  });

  it('handles empty status', () => {
    const result = parseGitStatus('');
    expect(result.staged).toHaveLength(0);
    expect(result.unstaged).toHaveLength(0);
    expect(result.untracked).toHaveLength(0);
  });
});

describe('sanitizeRemoteUrl', () => {
  it('redacts credentials embedded in HTTPS URLs', () => {
    const cleaned = sanitizeRemoteUrl('https://user:token@github.com/org/repo.git');
    expect(cleaned).not.toContain('token');
    expect(cleaned).toContain('github.com');
  });
});

describe('isAllowedGitRemote', () => {
  it('accepts github https urls', () => {
    expect(isAllowedGitRemote('https://github.com/owner/repo.git')).toBe(true);
  });

  it('rejects arbitrary shell-like strings', () => {
    expect(isAllowedGitRemote('https://evil.com; rm -rf /')).toBe(false);
  });
});

describe('temporary git repository', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-git-'));
    spawnSync('git', ['init'], { cwd: tmp, shell: false });
    spawnSync('git', ['config', 'user.email', 'test@codigoflow.local'], {
      cwd: tmp,
      shell: false,
    });
    spawnSync('git', ['config', 'user.name', 'CódigoFlow Test'], {
      cwd: tmp,
      shell: false,
    });
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('detects a git repository', async () => {
    const ok = await isGitRepository(tmp);
    expect(ok).toBe(true);
  });

  it('returns porcelain status for empty repo', async () => {
    const status = await runGitCommand(tmp, ['status', '--porcelain=v1']);
    expect(status.exitCode).toBe(0);
  });

  it('rejects forbidden git commands', async () => {
    await expect(runGitCommand(tmp, ['rebase', 'main'])).rejects.toMatchObject({
      code: 'FORBIDDEN_COMMAND',
    });
  });
});
