# CódigoFlow DevOps Workspace

This directory holds Terraform, Ansible, Puppet, and Nagios project files executed by the backend DevOps Control Center.

## Layout

- `terraform/` — IaC modules (AWS primary, Azure/GCP samples)
- `ansible/` — inventories, playbooks, roles
- `puppet/` — manifests, modules, Hiera
- `nagios/` — object configs and custom plugins
- `lab/` — optional Vagrant lab and setup scripts

Execution is mediated by `server/src/devops` (native / WSL / SSH). Tools are never invoked as unrestricted shell strings from the browser.
