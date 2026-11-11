# CódigoFlow DevOps Acceptance Report (Phase 10)

Generated during Phase 10. **Unexecuted real-infra steps are marked blocked, not passed.**

## Control node environment

| Item | Value |
|---|---|
| Host OS | Windows 11 |
| Control node | WSL2 Ubuntu |
| Distro | Ubuntu 24.04.4 LTS (noble) |
| Kernel | 6.6.87.2-microsoft-standard-WSL2 |
| systemd | running |
| Git | 2.43.0 |
| Python | 3.12.3 |
| OpenSSH | 9.6p1 |
| VirtualBox / Vagrant on Windows | Not detected |
| AWS credentials verified | No |

## Tool availability (preflight evidence)

| Tool | Status |
|---|---|
| terraform | MISSING |
| ansible / ansible-playbook | MISSING |
| puppet / puppetserver | MISSING |
| nagios | MISSING |

Installation requires **interactive operator approval** (sudo password in WSL):

```bash
cd devops/lab/setup
./install-devops-tools.sh                                    # prints plan
CONFIRM=yes COMPONENTS=terraform,ansible,puppet-agent ./install-devops-tools.sh
./verify-devops-tools.sh
```

Phase 10 attempt: plan printed successfully; privileged `apt`/`sudo` could not complete non-interactively (sudo password required). No packages were installed by the agent.

## Test matrix

| ID | Test | Environment | Result | Evidence / blocker |
|---|---|---|---|---|
| T-AUTO-01 | Server unit/integration suite | Windows Node | **PASS** | 53/53 tests after Phase 10 auth |
| T-AUTO-02 | DevOps mutation auth unit tests | Jest | **PASS** | `devopsAuth.test.ts` — non-loopback 403, bad token 401, good token allowed |
| T-AUTO-03 | Workflow run ≠ 501 | Jest + sample Nagios | **PASS** | `workflow-run.integration.test.ts` |
| T-AUTO-04 | WSL path bridge | Jest | **PASS** | `pathBridge.test.ts` |
| T-AUTO-05 | Pipeline readiness honesty | Jest + live WSL | **PASS** | Reports tools missing; `realInfrastructureExecutable=false` |
| T-WSL-01 | Preflight script | WSL Ubuntu | **PASS** | 4 ok / 6 missing (see above) |
| T-TF-01 | Terraform fmt/init/validate/plan | WSL | **BLOCKED** | terraform not installed |
| T-TF-02 | Saved-plan apply (local-lab null provider) | WSL | **BLOCKED** | terraform not installed |
| T-TF-03 | AWS apply | AWS | **BLOCKED** | No credentials; no operator apply approval |
| T-AN-01 | Inventory + SSH deploy | Managed Ubuntu | **BLOCKED** | ansible missing; no managed VM (no Vagrant) |
| T-PU-01 | Puppet drift / cert sign | WSL/VM | **BLOCKED** | puppet missing |
| T-NA-01 | Live Nagios outage/recovery | Nagios Core | **BLOCKED** | nagios missing; sample status ≠ live |
| T-WF-01 | Full TF→Ansible→Puppet→Nagios workflow | CódigoFlow | **BLOCKED** | Upstream tools missing; cannot claim E2E success |
| T-SEC-01 | Privileged mutation protection | Code + tests | **PASS** | Loopback + session cookie or Bearer `DEVOPS_API_TOKEN` |

## Security improvements (Phase 10)

- `requireDevOpsMutationAuth` on DevOps POST/PUT/PATCH/DELETE and workflow `/run`
- Default loopback restriction (`DEVOPS_REQUIRE_LOOPBACK=true`)
- Session cookie or Bearer required when `DEVOPS_API_TOKEN` is set or in production
- Frontend must not embed `DEVOPS_API_TOKEN` (no `VITE_DEVOPS_API_TOKEN`)
- Docs updated in `docs/devops-security-audit.md` residual risk note

## Local Terraform lab (ready after install)

`devops/terraform/local-lab` uses `null` + `local` providers only — no cloud cost.
After Terraform is installed, `verify-devops-tools.sh` runs fmt/init/validate/plan there.

## Remaining production-readiness blockers

1. Operator-approved install of terraform/ansible/puppet (and nagios if required) in WSL.
2. Managed node (Vagrant lab or existing Ubuntu VM) for Ansible/Puppet agent.
3. Explicit approval + credentials for any AWS apply/destroy.
4. Live Nagios Core status/command file configuration.
5. Set `DEVOPS_API_TOKEN` before exposing the API beyond loopback.
