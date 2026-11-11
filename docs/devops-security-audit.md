# DevOps Security Audit (Phase 9)

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-01 | High (mitigated) | Unauthenticated DevOps APIs can mutate infrastructure if exposed | Loopback restriction + optional/required Bearer `DEVOPS_API_TOKEN` on mutations; still keep `HOST=127.0.0.1` |
| SEC-02 | Medium (fixed) | WSL execution used raw Windows cwd/args | Path bridge translates to `/mnt/<drive>/…` |
| SEC-03 | Medium (fixed) | SSH used `StrictHostKeyChecking=accept-new` | Default is now `yes`; lab override via `DEVOPS_SSH_STRICT_HOST_KEY` |
| SEC-04 | Medium (mitigated) | Terraform apply concurrency | Per project/workspace in-memory lock |
| SEC-05 | Low (mitigated) | Log leakage of secrets | `redactSecrets` on executor output; AI keys never returned |
| SEC-06 | Info | No browser shell node | Workflow registry rejects unknown/`shell` kinds |
| SEC-07 | Info | Nagios command file | Allowlisted external commands only; requires `approve: true` |

## Controls verified in code

- Allowlisted executables (`shell: false` spawn)
- Zod validation on DevOps routes
- Terraform saved-plan hash check before apply
- Explicit approval gates for apply / playbook run / puppet apply / cert sign / Nagios commands
- `.tfstate`, plans, `.tfvars` gitignored
- Rate limiting + helmet + CORS origin restriction

## Residual risk

- Set `DEVOPS_API_TOKEN` (and matching `VITE_DEVOPS_API_TOKEN`) before any non-loopback exposure.
- WSL/SSH control nodes inherit OS user privileges — treat the control node as a privileged plane.
- Sample Nagios status must not be mistaken for live monitoring evidence.
- See `docs/devops-acceptance-report.md` for Phase 10 blocked real-infra tests.
