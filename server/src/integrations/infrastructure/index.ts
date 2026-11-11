/**
 * Future infrastructure adapters for Advanced Configuration Management.
 * Operational execution is intentionally not simulated.
 */

export type IntegrationState =
  | 'connected'
  | 'disconnected'
  | 'not_configured'
  | 'unavailable'
  | 'planned'
  | 'error';

export interface IntegrationAdapter {
  readonly name: string;
  checkAvailability(): Promise<{
    available: boolean;
    version?: string;
    error?: string;
    state: IntegrationState;
  }>;
  execute?(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<{ success: boolean; output: string; exitCode: number }>;
}

export class PlannedAdapter implements IntegrationAdapter {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async checkAvailability() {
    return {
      available: false,
      state: 'planned' as const,
      error: `${this.name} adapter is planned for a later phase`,
    };
  }
}

async function detectCli(
  bin: string,
  versionArgs: string[],
): Promise<{ available: boolean; version?: string; state: IntegrationState; error?: string }> {
  const { spawn } = await import('child_process');
  return new Promise((resolve) => {
    const proc = spawn(bin, versionArgs, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', () =>
      resolve({ available: false, state: 'unavailable', error: `${bin} not found in PATH` }),
    );
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({
          available: true,
          version: (stdout || stderr).trim().split('\n')[0],
          state: 'not_configured',
        });
      } else {
        resolve({
          available: false,
          state: 'unavailable',
          error: stderr.trim() || `${bin} exited with ${code}`,
        });
      }
    });
  });
}

export class TerraformAdapter implements IntegrationAdapter {
  readonly name = 'Terraform';
  async checkAvailability() {
    const detected = await detectCli('terraform', ['version']);
    return detected;
  }
}

export class AnsibleAdapter implements IntegrationAdapter {
  readonly name = 'Ansible';
  async checkAvailability() {
    const detected = await detectCli('ansible', ['--version']);
    return detected;
  }
}

export class PuppetAdapter implements IntegrationAdapter {
  readonly name = 'Puppet';
  async checkAvailability() {
    const detected = await detectCli('puppet', ['--version']);
    return detected;
  }
}

export class NagiosAdapter implements IntegrationAdapter {
  readonly name = 'Nagios';
  async checkAvailability() {
    return {
      available: false,
      state: 'planned' as const,
      error: 'Nagios monitoring adapter is planned',
    };
  }
}

export const terraformAdapter = new TerraformAdapter();
export const ansibleAdapter = new AnsibleAdapter();
export const puppetAdapter = new PuppetAdapter();
export const nagiosAdapter = new NagiosAdapter();
