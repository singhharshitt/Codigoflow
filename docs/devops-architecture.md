# DevOps Architecture

## Control plane

```text
React DevOps UI
    → Express /api/devops/*
    → DevOps Execution Adapter (native | WSL | SSH)
    → Terraform / Ansible / Puppet / Nagios
```

## Execution modes

| Mode | When |
|---|---|
| `native` | Backend runs on Linux |
| `wsl` | Windows 11 with Ubuntu WSL2 |
| `ssh` | Remote Ubuntu control VM (`DEVOPS_SSH_*`) |
| `auto` | Prefer native → WSL → SSH |

## Security contract

- Allowlisted executables only
- `spawn(..., { shell: false })`
- Argument arrays (no browser shell strings)
- Approved workspace roots under `devops/`
- Secret redaction in logs
- Job engine for long-running ops + Socket.IO events

## Workflow engine

Node executors replace the previous `501 WORKFLOW_EXECUTION_UNAVAILABLE` response for supported DevOps node kinds.
