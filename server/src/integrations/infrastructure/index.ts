/**
 * Common integration interface — each infrastructure adapter implements this.
 * Concrete adapters: Terraform, Ansible, Puppet, Nagios.
 */
export interface IntegrationAdapter {
  readonly name: string;
  /** Check if the underlying tool is available in the current environment */
  checkAvailability(): Promise<{ available: boolean; version?: string; error?: string }>;
  /** Execute a pre-approved, validated operation */
  execute(operation: string, params: Record<string, unknown>): Promise<{
    success: boolean;
    output: string;
    exitCode: number;
  }>;
}

export class AdapterNotImplemented implements IntegrationAdapter {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async checkAvailability() {
    return { available: false, error: `${this.name} adapter is not yet implemented` };
  }

  async execute(_operation: string, _params: Record<string, unknown>) {
    return {
      success: false,
      output: `${this.name} adapter is not yet implemented`,
      exitCode: 1,
    };
  }
}

// Future adapters — replace with real implementations in Phase 2+
export const terraformAdapter = new AdapterNotImplemented('Terraform');
export const ansibleAdapter = new AdapterNotImplemented('Ansible');
export const puppetAdapter = new AdapterNotImplemented('Puppet');
export const nagiosAdapter = new AdapterNotImplemented('Nagios');
