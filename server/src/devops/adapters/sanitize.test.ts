import {
  assertSafeExecutable,
  assertSafeArgs,
  redactSecrets,
  ALLOWED_EXECUTABLES,
} from './sanitize';

describe('devops sanitize', () => {
  it('allowlists known devops binaries', () => {
    expect(ALLOWED_EXECUTABLES.has('terraform')).toBe(true);
    expect(() => assertSafeExecutable('terraform')).not.toThrow();
  });

  it('rejects arbitrary executables', () => {
    expect(() => assertSafeExecutable('rm')).toThrow();
    expect(() => assertSafeExecutable('bash;rm')).toThrow();
  });

  it('rejects args with newlines', () => {
    expect(() => assertSafeArgs(['ok', 'bad\narg'])).toThrow();
  });

  it('redacts secrets from output', () => {
    const cleaned = redactSecrets('password=hunter2 token: abc AWS_SECRET_ACCESS_KEY=xyz');
    expect(cleaned).not.toContain('hunter2');
    expect(cleaned).toContain('[redacted]');
  });
});
