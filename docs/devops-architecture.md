# CódigoFlow DevOps Architecture

## Execution path

```text
React DevOps Control Center
        |
Express /api/devops/* and /api/workflows/:id/run
        |
DevOps Execution Adapter (native | WSL2 | SSH)
        |
Terraform / Ansible / Puppet / Nagios
```

## Ownership boundaries

| Tool | Owns |
|---|---|
| Terraform | Cloud/lab infrastructure, networks, VMs, outputs |
| Ansible | Deployment sequencing and application releases |
| Puppet | OS baseline packages, users, declared config, drift correction |
| Nagios | Monitoring checks, acknowledgements, downtime |

## Safety model

- Allowlisted executables only (`shell: false` / fixed WSL-SSH helpers).
- Terraform apply uses a hashed saved plan after human approval.
- Ansible changing runs and Puppet apply require `approve: true`.
- Puppet certificates are signed individually.
- Nagios external commands are allowlisted.
- Secrets and Terraform state are never stored in SQLite.
