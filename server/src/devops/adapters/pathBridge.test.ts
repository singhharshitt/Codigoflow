import { windowsPathToWsl, translateRequestPathsForWsl } from './pathBridge';

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
