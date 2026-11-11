# CódigoFlow — Product & Engineering Audit

**Date:** 2026-11-12  
**Baseline HEAD:** `a66a5e49af332fc6d175c6eac07eb15b9186e914`  
**Baseline tests:** 66/66 server tests passed (re-run before this milestone)  
**Branch policy:** Additive improvements only; no rebuild; AWS instances untouched

---

## Product vision check

CódigoFlow already integrates GitHub, Docker, Terraform, Ansible, Puppet, Nagios, AI, and a workflow engine. The gap is **orchestration UX**: users still stitch steps manually. Priority is connecting existing pieces into a guided deploy path, not replacing tools.

---

## Feature matrix

| Feature | Existing status | Verified status | Required action |
|---|---|---|---|
| GitHub metadata API | Working | Verified (tests + code) | Keep |
| Public GitHub import | Working (managed clone) | Verified (unit tests + routes) | Keep; polish progress UX only if needed |
| Local repo registration | Working | Verified | Keep unchanged |
| Git Studio ops | Working | Verified (git tests) | Keep |
| Docker manager | Working | Verified (integration surface) | Wire into deploy recommendations; no duplicate module |
| AI Copilot | Working (generic + docker logs) | Verified (ai tests) | Add job/workflow grounded troubleshooting |
| Terraform | Working (plan/approve/apply) | Verified (terraform tests + auth) | Pass outputs into workflows; no rewrite |
| Ansible | Working | Verified | Inventory-from-outputs later; no rewrite |
| Puppet | Working | Verified | Keep approval-gated signing |
| Nagios | Working + sample labeling | Verified | Keep sample ≠ live |
| Workflow engine | Working executors + runner | Verified (workflow tests) | Load saved graphs; propose template from analysis |
| Job history | Persisted | Verified | Surface logs in UI (API already exists) |
| Socket.IO live logs | Server emits | Partial | Prefer persisted logs first; optional client subscribe |
| Operator auth (session) | Working | Verified (auth tests) | Preserve; no second auth system |
| Lab / pipeline readiness | Working | Verified | Keep readiness separate from “executed” |
| Guided deploy wizard | Missing | N/A | Add analysis → recommend → review (execute stays approval-gated) |
| AWS remote execution | Adapter ready | Not live-tested | Prepare only; do not start EC2 |

---

## What works correctly

- Repository import/register/clone/inspect
- DevOps tool pages with approval gates
- Workflow validation, cycle detection, skip-on-failure
- HttpOnly operator sessions (no `VITE_DEVOPS_API_TOKEN`)
- Job persistence and job log API

## Insufficiently integrated

- Analysis of imported repos (stack detection) not exposed as a product step
- Workflow Builder does not load saved workflows
- Execution History does not show log content (only job metadata)
- AI Copilot does not pull failed job/workflow logs automatically
- Overview does not lead with “import → analyse → deploy”

## Incomplete / half-wired

- Socket.IO client unused
- `operation_history` table unread/unwritten for inserts
- `workflow_runs` table unused (runs map to `jobs`)
- Dual pipeline endpoints (`/devops/pipeline` and `/devops/lab/pipeline`) — same readiness function

## Security posture (current)

- Privileged mutations: loopback + session or Bearer
- SSH host-key checking default on
- Git spawn allowlist, plan hash integrity
- Remaining: keep localhost bind until remote auth is production-ready

## Prioritized improvements for this milestone

1. **P1** Repository analysis API (detected vs inferred vs recommended) — **done**
2. **P1** Deployment workflow proposal using existing node schema — **done**
3. **P1** Overview entry points (Import / Analyse / Workflows / History) — **done**
4. **P1** Workflow Builder: list & load saved workflows — **done**
5. **P2** AI: analyse failed job from persisted logs — **done** (`POST /api/ai/analyze-job`)
6. **P2** Execution History: show job logs — **done**
7. **P0** Preserve all existing APIs and tests

Out of scope this milestone: starting AWS EC2, automatic infra apply, executing imported repo scripts.

## New APIs (additive)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/repositories/:id/analyze` | Static stack/config detection |
| POST | `/api/repositories/:id/deploy-proposal` | Analysis + reviewable workflow graph |
| POST | `/api/ai/analyze-job` | Grounded troubleshooting from `jobs` + `job_logs` |
