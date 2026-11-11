# End-to-End Deployment Pipeline

## Goal

Provision (or target lab hosts) → deploy sample app → enforce Puppet baseline → verify with Nagios.

## Pipeline stages

1. **Preflight** — `GET /api/devops/preflight`
2. **Terraform** — init/validate/plan/approve/apply (AWS or skip when using local lab hosts)
3. **Ansible** — update inventory from outputs or lab IPs → ping → check → approve run `deploy-app.yml`
4. **Puppet** — validate → noop → approve apply / agent run; optional cert sign
5. **Nagios** — ensure host/service objects → validate config → confirm HTTP/APP OK
6. **Report** — job id, node runs, durations, errors

## Workflow builder

Create nodes:

`start → terraform.* → ansible.* → puppet.* → nagios.* → end`

Set node Config JSON (examples):

```json
{ "projectPath": "aws" }
```

```json
{ "inventory": "inventory/lab.ini", "playbook": "playbooks/deploy-app.yml", "approve": true }
```

```json
{ "manifest": "manifests/site_lab.pp", "approve": true }
```

Save → Validate → Run. Approval-gated nodes fail with `waiting_approval` / clear errors if `approve` is missing.

## Acceptance tests status

| Test | Requirement | Notes |
|---|---|---|
| A Terraform provisioning | Real AWS creds + Linux control node | Blocked until configured |
| B Ansible deployment | Reachable managed host | Blocked until SSH lab ready |
| C Puppet enforcement | Puppet installed | Blocked until Puppet available |
| D Nagios monitoring | Nagios Core + command file | Sample status works for UI; live checks need install |
| E Full pipeline | A–D | Blocked until lab tools installed |

Automated unit/integration tests cover adapters, parsers, workflow ordering, and sample Nagios status without claiming cloud provisioning success.
