import {
  windowsPathToWsl,
  translateRequestPathsForWsl,
  mapLocalPathToRemote,
  translateRequestPathsForSsh,
  quoteForRemoteShell,
} from './pathBridge';

describe('pathBridge', () => {
  it('converts Windows drive paths to /mnt/<drive>/…', () => {
    expect(windowsPathToWsl('D:\\Codigoflow\\devops\\terraform\\aws')).toBe(
      '/mnt/d/Codigoflow/devops/terraform/aws',
    );
    expect(windowsPathToWsl('C:/tmp/plan.tfplan')).toBe('/mnt/c/tmp/plan.tfplan');
  });

  it('translates -out= Windows paths for terraform', () => {
    const translated = translateRequestPathsForWsl({
      cwd: 'D:\\Codigoflow\\devops\\terraform\\aws',
      args: ['plan', '-out=D:\\Codigoflow\\devops\\.plans\\abc.tfplan'],
    });
    expect(translated.cwd).toBe('/mnt/d/Codigoflow/devops/terraform/aws');
    expect(translated.args[1]).toBe('-out=/mnt/d/Codigoflow/devops/.plans/abc.tfplan');
  });

  it('leaves unix paths unchanged', () => {
    expect(windowsPathToWsl('/opt/codigoflow')).toBe('/opt/codigoflow');
  });
});

describe('SSH path mapping', () => {
  const localRoot = 'D:/Codigoflow/devops';
  const remoteRoot = '/home/ubuntu/Codigoflow/devops';

  it('maps paths under the local devops root onto the remote root (case-insensitive on Windows)', () => {
    expect(mapLocalPathToRemote('d:/codigoflow/devops/ansible', localRoot, remoteRoot)).toBe(
      '/home/ubuntu/Codigoflow/devops/ansible',
    );
    expect(mapLocalPathToRemote('D:/Codigoflow/devops', localRoot, remoteRoot)).toBe(remoteRoot);
  });

  it('leaves paths outside the devops root untouched', () => {
    expect(mapLocalPathToRemote('C:/Windows/system32', localRoot, remoteRoot)).toBe('C:/Windows/system32');
  });

  it('translates cwd and absolute path args, keeping flags intact', () => {
    const out = translateRequestPathsForSsh(
      { cwd: 'D:/Codigoflow/devops/ansible', args: ['--syntax-check', 'D:/Codigoflow/devops/ansible/playbooks/site.yml'] },
      localRoot,
      remoteRoot,
    );
    expect(out.cwd).toBe('/home/ubuntu/Codigoflow/devops/ansible');
    expect(out.args).toEqual(['--syntax-check', '/home/ubuntu/Codigoflow/devops/ansible/playbooks/site.yml']);
  });

  it('is a no-op when no remote root is configured', () => {
    const input = { cwd: 'D:/x', args: ['a'] };
    expect(translateRequestPathsForSsh(input, localRoot, undefined)).toBe(input);
  });

  it('single-quotes args for the remote shell so $1 and spaces survive', () => {
    expect(quoteForRemoteShell('cd "$1" && shift')).toBe(`'cd "$1" && shift'`);
    expect(quoteForRemoteShell("it's")).toBe(`'it'\\''s'`);
  });
});
