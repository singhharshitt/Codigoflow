import { apiRequest } from './http';

export const devopsApi = {
  status: () => apiRequest('/devops/status'),
  preflight: () => apiRequest('/devops/preflight'),
  pipeline: () => apiRequest('/devops/pipeline'),
  labStatus: () => apiRequest('/devops/lab/status'),

  terraform: {
    status: () => apiRequest('/devops/terraform/status'),
    projects: () => apiRequest('/devops/terraform/projects'),
    plans: () => apiRequest('/devops/terraform/plans'),
    getPlan: (planId: string) => apiRequest(`/devops/terraform/plans/${planId}`),
    fmt: (projectPath: string) =>
      apiRequest('/devops/terraform/fmt', { method: 'POST', data: { projectPath } }),
    init: (projectPath: string) =>
      apiRequest('/devops/terraform/init', { method: 'POST', data: { projectPath } }),
    validate: (projectPath: string) =>
      apiRequest('/devops/terraform/validate', { method: 'POST', data: { projectPath } }),
    plan: (projectPath: string, workspace?: string) =>
      apiRequest('/devops/terraform/plan', { method: 'POST', data: { projectPath, workspace } }),
    approve: (planId: string, approvedBy = 'operator') =>
      apiRequest(`/devops/terraform/plans/${planId}/approve`, {
        method: 'POST',
        data: { approvedBy },
      }),
    apply: (planId: string, approve: boolean, approvedBy = 'operator') =>
      apiRequest('/devops/terraform/apply', {
        method: 'POST',
        data: { planId, approve, approvedBy },
      }),
    workspaces: (projectPath: string) =>
      apiRequest('/devops/terraform/workspaces', { params: { projectPath } }),
    outputs: (projectPath: string) =>
      apiRequest('/devops/terraform/outputs', { params: { projectPath } }),
  },

  ansible: {
    status: () => apiRequest('/devops/ansible/status'),
    inventory: () => apiRequest('/devops/ansible/inventory'),
    validateInventory: (inventory: string) =>
      apiRequest('/devops/ansible/inventory/validate', { method: 'POST', data: { inventory } }),
    ping: (inventory: string, limit?: string) =>
      apiRequest('/devops/ansible/ping', { method: 'POST', data: { inventory, limit } }),
    facts: (inventory: string, limit?: string) =>
      apiRequest('/devops/ansible/facts', { method: 'POST', data: { inventory, limit } }),
    playbooks: () => apiRequest('/devops/ansible/playbooks'),
    roles: () => apiRequest('/devops/ansible/roles'),
    validatePlaybook: (playbook: string) =>
      apiRequest('/devops/ansible/playbooks/validate', { method: 'POST', data: { playbook } }),
    checkPlaybook: (playbook: string, inventory: string) =>
      apiRequest('/devops/ansible/playbooks/check', {
        method: 'POST',
        data: { playbook, inventory, approve: true },
      }),
    runPlaybook: (playbook: string, inventory: string, approve: boolean) =>
      apiRequest('/devops/ansible/playbooks/run', {
        method: 'POST',
        data: { playbook, inventory, approve },
      }),
  },

  puppet: {
    status: () => apiRequest('/devops/puppet/status'),
    certificates: () => apiRequest('/devops/puppet/certificates'),
    modules: () => apiRequest('/devops/puppet/modules'),
    facts: () => apiRequest('/devops/puppet/facts'),
    validate: (manifest: string) =>
      apiRequest('/devops/puppet/manifests/validate', { method: 'POST', data: { manifest } }),
    noop: () => apiRequest('/devops/puppet/agent/noop', { method: 'POST', data: {} }),
    agentRun: (approve: boolean) =>
      apiRequest('/devops/puppet/agent/run', { method: 'POST', data: { approve } }),
    apply: (manifest: string, approve: boolean, noop = false) =>
      apiRequest('/devops/puppet/apply', { method: 'POST', data: { manifest, approve, noop } }),
    signCert: (certname: string, approve: boolean) =>
      apiRequest(`/devops/puppet/certificates/${encodeURIComponent(certname)}/sign`, {
        method: 'POST',
        data: { approve },
      }),
    drift: (manifest: string) =>
      apiRequest('/devops/puppet/drift', { params: { manifest } }),
  },

  nagios: {
    status: () => apiRequest('/devops/nagios/status'),
    hosts: () => apiRequest('/devops/nagios/hosts'),
    services: () => apiRequest('/devops/nagios/services'),
    plugins: () => apiRequest('/devops/nagios/plugins'),
    acknowledge: (body: Record<string, unknown>) =>
      apiRequest('/devops/nagios/acknowledge', { method: 'POST', data: body }),
    comment: (body: Record<string, unknown>) =>
      apiRequest('/devops/nagios/comments', { method: 'POST', data: body }),
    downtime: (body: Record<string, unknown>) =>
      apiRequest('/devops/nagios/downtime', { method: 'POST', data: body }),
    reload: (approve: boolean) =>
      apiRequest('/devops/nagios/reload', { method: 'POST', data: { approve } }),
  },
};

export const workflowApi = {
  list: () => apiRequest('/workflows'),
  save: (workflow: unknown) => apiRequest('/workflows', { method: 'POST', data: workflow }),
  get: (id: string) => apiRequest(`/workflows/${id}`),
  validate: (id: string) => apiRequest(`/workflows/${id}/validate`, { method: 'POST' }),
  run: (id: string) => apiRequest(`/workflows/${id}/run`, { method: 'POST' }),
  nodeRuns: (id: string, jobId: string) =>
    apiRequest(`/workflows/${id}/runs/${jobId}/nodes`),
};
