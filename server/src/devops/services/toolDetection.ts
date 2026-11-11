import { resolveExecutor, type ToolDetection } from '../adapters';

const TOOLS: {
  name: string;
  executable: string;
  versionArgs: string[];
  installHint: string;
}[] = [
  {
    name: 'terraform',
    executable: 'terraform',
    versionArgs: ['version'],
    installHint: 'Install Terraform CLI in WSL/Ubuntu: https://developer.hashicorp.com/terraform/install',
  },
  {
    name: 'ansible',
    executable: 'ansible',
    versionArgs: ['--version'],
    installHint: 'Install Ansible in WSL/Ubuntu: sudo apt update && sudo apt install -y ansible',
  },
  {
    name: 'ansible-playbook',
    executable: 'ansible-playbook',
    versionArgs: ['--version'],
    installHint: 'Provided by the ansible package',
  },
  {
    name: 'puppet',
    executable: 'puppet',
    versionArgs: ['--version'],
    installHint: 'Install Puppet agent/server on Ubuntu control node (see docs/puppet-guide.md)',
  },
  {
    name: 'nagios',
    executable: 'nagios',
    versionArgs: ['-V'],
    installHint: 'Install Nagios Core on Ubuntu (see docs/nagios-guide.md)',
  },
];

export async function detectDevOpsTools(force = false): Promise<ToolDetection[]> {
  const { executor } = await resolveExecutor(force);
  const results: ToolDetection[] = [];

  for (const tool of TOOLS) {
    try {
      const path = await executor.which(tool.executable);
      if (!path) {
        results.push({
          name: tool.name,
          available: false,
          mode: executor.mode,
          error: `${tool.executable} not found on control node`,
          installHint: tool.installHint,
        });
        continue;
      }

      const version = await executor.run({
        executable: tool.executable,
        args: tool.versionArgs,
        timeoutMs: 15_000,
      });

      results.push({
        name: tool.name,
        available: version.exitCode === 0,
        version: (version.stdout || version.stderr).trim().split(/\r?\n/)[0],
        path,
        mode: executor.mode,
        error: version.exitCode === 0 ? undefined : version.stderr || 'version check failed',
        installHint: tool.installHint,
      });
    } catch (err) {
      results.push({
        name: tool.name,
        available: false,
        mode: executor.mode,
        error: err instanceof Error ? err.message : String(err),
        installHint: tool.installHint,
      });
    }
  }

  return results;
}
