# CódigoFlow — Final Engineering Audit (Phases 11–21)

**Date:** 2026-11-12  
**Scope:** Full-repository readiness for remote AWS control-node integration  
**Constraint:** No AWS EC2 start/modify; no live AWS provisioning; preserve Git history

---

## Executive verdict

CódigoFlow is substantially complete for local/lab DevOps orchestration. The highest-risk defect addressed in this milestone is **frontend exposure of privileged API tokens via `VITE_DEVOPS_API_TOKEN`**. That path is removed in favor of **server-side `DEVOPS_API_TOKEN` + HttpOnly session cookies**. Public GitHub repositories can now be imported without a manual local path. Remaining blockers for real AWS E2E are environmental (WSL/tool install, IAM role on control node, EC2 stopped by design), not core application architecture.

---

## Findings

### Critical

| ID | Finding | Status |
|---|---|---|
| C-01 | `VITE_DEVOPS_API_TOKEN` shipped privileged secrets into the browser bundle | **Fixed** — removed; operator login → `cf_session` HttpOnly cookie; Bearer retained for CLI only |
| C-02 | Privileged DevOps mutations could be called without browser-safe auth once a Vite token was set | **Fixed** — session + Origin check + loopback + rate-limited login |

### High

| ID | Finding | Status |
|---|---|---|
| H-01 | GitHub onboarding required a local destination path even for public repos | **Fixed** — `POST /api/repositories/github/preview` + `/import` with managed storage |
| H-02 | Nagios UI could be read as “live” while serving `status.dat.sample` | **Fixed** — `dataSource` / `isSampleData` / explicit notes in API + UI |
| H-03 | Real TF/Ansible/Puppet/Nagios binaries often unavailable on Windows without WSL | **Open (env)** — adapters + preflight ready; operator must install tools |

### Medium

| ID | Finding | Status |
|---|---|---|
| M-01 | Terraform apply could auto-approve from `created` when `approve:true` | **Accepted with mitigation** — plan hash re-checked; concurrency lock; prefer separate approve call in UI |
| M-02 | Workflow infra nodes require `approve:true` but have no automatic retry of destructive steps | **Verified** — failure skips downstream; no unsafe auto-retry loop |
| M-03 | SSH executor requires known_hosts when `StrictHostKeyChecking=yes` (default) | **By design** — connection failures surface accurately |
| M-04 | Unbounded job log growth possible over long lab use | **Open** — monitor; optional retention later |

### Low

| ID | Finding | Status |
|---|---|---|
| L-01 | Sample Nagios host/service groups are static placeholders | Documented |
| L-02 | Private GitHub import still needs `GITHUB_TOKEN` / local clone | Documented in UI |
| L-03 | Frontend tool badges previously said “available” without distinguishing installed vs connected | Improved labels on DevOps overview |

---

## Area verification

| Area | Result |
|---|---|
| Frontend architecture | React/Vite; credentials include cookies; no Vite privilege secrets |
| Backend architecture | Express routers; DevOps adapters native/wsl/ssh |
| AuthZ | Loopback + session cookie or Bearer; Origin validation for cookies |
| Git / GitHub | Allowlisted commands; managed import; local register retained |
| Terraform | Plan hash, approval rows, apply lock, sensitive output filter |
| Ansible / Puppet / Nagios | Approval gates; allowlisted paths; sample vs live Nagios |
| Workflow | Topological order, cycle check, skip-on-failure, concurrency guard |
| SSH | Fixed argv, `shell:false`, host key checking default on |
| Database | SQLite FK/migrations intact; no unnecessary schema churn this pass |
| Tests | Server suite + auth/session + github preview + DevOps auth integration |

---

## AWS readiness (assessment only — not connected)

| Item | Ready? |
|---|---|
| Control/managed EC2 exist (stopped) | External — leave stopped |
| CódigoFlow SSH adapter | Yes (keys not committed; host key checking on) |
| IAM instance-role auth for Terraform AWS provider | Prepared conceptually — prefer role on control node; no permanent access keys required in app |
| Live apply/destroy against AWS | **Blocked** until tools + role + explicit operator start of EC2 |
| Spend credits this milestone | **Forbidden / not done** |

---

## Residual blockers before first genuine remote integration

1. Operator installs DevOps toolchain (WSL Ubuntu or Linux control node).
2. Configure `DEVOPS_SSH_*` or WSL mode; populate known_hosts.
3. Attach IAM instance role (or temporary credentials) on the control node — not in the Vite client.
4. Set `DEVOPS_API_TOKEN` (+ optional `SESSION_SECRET`); sign in via DevOps → Operator session.
5. Start EC2 only when ready; keep instances stopped until then.
