import { validateRepoPath, hasSensitiveFiles, parseGitStatus } from '../../integrations/git';
import path from 'path';
import os from 'os';

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
