# CódigoFlow — Demonstration & Verification Report

**Date:** 2026-11-22
**Branch:** `feat/product-orchestration-evolution` (changes uncommitted at time of writing)
**Environment:** Windows 11 · Node.js 22 · Express on `127.0.0.1:4000` · Vite on `localhost:5173` · SQLite `server/data/codigoflow.db` · WSL Ubuntu control node · Docker Desktop 29.8.1
**UI reference:** [heydamir/unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky, CC BY 4.0

Every status below was observed in this session against the running app, not inferred from code. This report replaces an earlier draft that had several wrong statuses (see “Corrections to the earlier draft”).

Status key: **PASS** verified working · **FAIL** tested and failed · **BLOCKED** missing dependency/credential/infrastructure · **MOCKED** simulated data, labeled as such · **NOT TESTED** not verified

---

## 1. Startup and health

| Layer | Status | Evidence |
|---|---|---|
| Express backend | PASS | Log: `CódigoFlow server running at http://127.0.0.1:4000`, `CORS origin : http://localhost:5173` |
| SQLite | PASS | `Database initialized dbPath: D:\Codigoflow\server\data\codigoflow.db`; existing rows preserved, no reset |
| Vite frontend | PASS | Serves on 5173, `/api` proxied to 4000 |
| `GET /api/health` | PASS | `status: ok`, integration flags for AI/GitHub/Docker |
| Browser console | PASS | No errors after fixes; React Router v7 warnings removed |
| Server tests | PASS | `npm test --workspace=server -- --runInBand` → **22 suites, 89 tests passed** |
| Client typecheck / lint / build | PASS | `tsc --noEmit` clean · `eslint --max-warnings 0` clean · `vite build` succeeds |

Note: the earlier dev servers on 4000/5173/5174 exited mid-session; both were restarted with `npm run dev --workspace=server|client` on the same database.

## 2. API smoke (`scripts/demo-api-smoke.mjs`, output in `docs/_demo_api_smoke.json`)

| Endpoint | HTTP | Status | Notes |
|---|---|---|---|
| `GET /api/health`, `/api/auth/status`, `/api/repositories`, `/api/jobs`, `/api/workflows` | 200 | PASS | |
| `GET /api/docker/status`, `/api/docker/containers?all=true` | 200 | PASS | Live engine 29.8.1, real container list |
| `GET /api/ai/status` | 200 | PASS | `configured: false` |
| `GET /api/devops/status`, `/preflight`, `/terraform/projects`, `/ansible/playbooks`, `/ansible/inventory`, `/puppet/status`, `/lab/status` | 200 | PASS | Discovery from `devops/` |
| `GET /api/devops/nagios/status` | 200 | MOCKED | Bundled `status.dat.sample`, response says `isSampleData: true` |
| `POST /api/devops/terraform/validate` | 503 | BLOCKED | `TOOL_NOT_INSTALLED: terraform is not installed on the wsl control node` |
| `POST /api/devops/ansible/playbooks/validate` | 503 | BLOCKED | `TOOL_NOT_INSTALLED: ansible-playbook is not installed on the wsl control node` |
| `POST /api/ai/ask` | 503 | PASS (expected) | `AI_NOT_CONFIGURED` with an actionable message |

## 3. Module results

### A. Overview dashboard — PASS
- Stats, repository overview, commits, Docker overview, recent operations and integration status all render from live API data.
- Pipeline track (Import → Analyse → Review workflow → Observe) ticks steps from real state (repos present, analysis available, jobs recorded).
- Fixed: crash when AI is configured (`Sparkles` used but not imported), full-page blanking on repo switch, single-point chart, empty “Working tree” card, wrong env var name in the AI hint.

### B. GitHub & repositories — PASS
- `POST /api/repositories/github/preview` for `singhharshitt/Codigoflow` returned live metadata anonymously (no token needed for public repos).
- Import cloned into `server/data/repos/` and registered (visible in table, sidebar and top bar).
- Analysis (`GET /api/repositories/:id/analyze`) runs static detection only; nothing from the repo is executed.
- Fixed: Terraform/Ansible/Puppet under `devops/` were reported as absent. Now `terraformHints=true, ansibleHints=true, puppetHints=true` for this repo (`server/src/services/repositoryAnalysis.ts`, tests added).
- Fixed: action buttons clipped off the table at 1440px.
- Private repos / higher rate limits: BLOCKED until `GITHUB_TOKEN` is set.

### C. Workflow builder — PASS (engine) / BLOCKED (tool execution)
- Propose → builder loads graph · Save (`POST /api/workflows`) · reload from list · Validate (“Workflow is executable”) · Run.
- Run result (job `05f15fbe…`): `start` succeeded, `terraform.init` failed with `terraform is not installed on the wsl control node`, every downstream node `skipped`. Correct failure handling.
- Fixed: **page went blank** after Propose. Infinite render loop between React Flow `onSelectionChange` and the zustand store (`WorkflowBuilderPage.tsx`, `workflowStore.ts`).
- Fixed: keyboard-deleted edges were not persisted; drag persisted a stale snapshot.
- Fixed: long proposals rendered as one unreadable line, now wrapped into rows and re-fitted on load.
- Added: per-node run results on the canvas and in a “Last run” panel (raw JSON behind a disclosure).

### D. Docker manager — PASS
- Status, containers, images, inspect and logs against the live daemon.
- Start/stop/restart tested **only** on a disposable container `codigoflow-demo-redis` (from the already-local `redis:7-alpine`, label `codigoflow.demo=true`, no published ports). State confirmed with `docker inspect` after each action.
- Error path: stopping a nonexistent container returns `DOCKER_STOP_FAILED: No such container`.
- Your existing `cedcolens-*` containers were not modified.
- Added: confirm dialog before stop/restart. Fixed duplicated daemon error text.
- Compose / Build tabs: NOT TESTED. Server routes exist (`POST /api/docker/compose|build`) but the client has no API methods for them yet (`HAS_COMPOSE_API = false`).
- Volumes / networks: no API routes.

### E. Terraform — PASS (discovery) / BLOCKED (validate, plan)
- Projects `aws`, `azure`, `gcp`, `local-lab` discovered.
- Validate/plan need the Terraform CLI on the control node. Apply/destroy were **not** run.
- Fixed (root cause): every WSL command with a working directory failed with `exec: : not found` because `wsl -- …` hands argv to the default shell, which expanded `"$1"`/`"$@"` to empty strings. Now `wsl --exec` (`server/src/devops/adapters/wslExecutor.ts`). This also removes an unintended shell-parsing step.
- Added: exit code 127 surfaces as `503 TOOL_NOT_INSTALLED` (`server/src/devops/adapters/index.ts`).

### F. Ansible — PASS (discovery) / BLOCKED (syntax check, runs)
- Playbooks and inventory (`lab.ini`, `aws_ec2.example.yml`) listed.
- Syntax check now fails with a clear `TOOL_NOT_INSTALLED` instead of shell noise. No playbooks were run.

### G. Puppet — BLOCKED
- Status API works and reports `puppet not found on control node`.

### H. Nagios — MOCKED
- Hosts, services and plugins render from the bundled sample file; the page shows a banner that it is not live monitoring. Set `NAGIOS_STATUS_FILE` for real data.

### I. Nginx deployment — PASS (controls) / BLOCKED (live)
- Deploy/Rollback buttons stay disabled until an operator session exists; the page warns that `DEVOPS_API_TOKEN` is unset. Gating is covered by `devopsAuth*.test.ts` and `deploymentApi.test.ts`. No real deploy or rollback was performed.

### J. AI Copilot — PASS (unavailable handling) / BLOCKED (live)
- No LLM key in `server/.env`. `POST /api/ai/ask` returns `503 AI_NOT_CONFIGURED`; UI shows the correct setup hint. Keys never reach the Vite bundle (`security/secretExposure.test.ts`).

### K. Execution history — PASS
- Both workflow runs listed with status, start time, duration (9.6s / 8.8s), error message and persisted per-node logs.

### L. Auth & settings — PASS (loopback dev)
- `authMode: loopback-dev`. Operator login/session paths covered by tests. Settings reflect live health.

## 4. Fixes made in this session

| Area | Fix | Files |
|---|---|---|
| DevOps execution | `wsl --exec` instead of `wsl --` (args were expanded away) | `server/src/devops/adapters/wslExecutor.ts` |
| DevOps execution | `TOOL_NOT_INSTALLED` for exit 127 | `server/src/devops/adapters/index.ts` |
| SSH / EC2 | Quote remote argv (same expansion bug over SSH) and map local `devops/` paths to `DEVOPS_SSH_REMOTE_ROOT` | `sshExecutor.ts`, `pathBridge.ts` |
| Analysis | Detect IaC under `devops/`, `deploy/`, `ops/`, `infra/` | `repositoryAnalysis.ts` |
| Workflow builder | Infinite render loop, edge persistence, layout, run results | `WorkflowBuilderPage.tsx`, `workflowStore.ts`, `WorkflowNode.tsx` |
| App shell | Error boundary per page; mobile drawer closes on navigation | `RouteErrorBoundary.tsx`, `AppShell.tsx` |
| Health | No false “Online” after API loss; “Checking” before first probe | `appStore.ts`, `TopBar.tsx` |
| Top bar | Titles for DevOps pages; working Ctrl/⌘+K; removed dead bell button and duplicate repo select | `TopBar.tsx`, `RepositoriesPage.tsx` |
| Sidebar | One scroll area (nav was cut off); hash-aware active state | `Sidebar.tsx` |
| Overview | `Sparkles` crash, repo-switch blanking, empty states, AI hint | `OverviewPage.tsx` |
| Docker | Stop/restart confirmation; deduped error | `DockerManagerPage.tsx` |
| Smoke script | Wrong Terraform body field; no more duplicate workflows per run | `scripts/demo-api-smoke.mjs` |

Tests added: `executors.test.ts` (WSL argv, TOOL_NOT_INSTALLED), SSH mapping/quoting cases in `pathBridge.test.ts`, `detectIacMarkers` cases in `repositoryAnalysis.test.ts`.

## 5. Visual pass (unslop) and logo

Audit found: radial color washes on body and hero, cyan glows on active nav/tabs/status dots, uppercase tracked labels, four differently colored stat-card icon tiles, violet accents, a pixel display font, spider-web/mask decorations (“Spider-Man mask-inspired” per the component comment), five buttons in the hero, `transition-all`.

Direction:
- **Product:** takes a repository from Git to running infrastructure for developers, with every step logged.
- **Character:** exact, nocturnal, a little bold.
- **World:** a night-shift operations desk.
- **Moments:** the Git activity chart and the workflow canvas.
- **Signature:** the pipeline track, four numbered stages on one flow line that tick as real work completes.

Changes: neutral ink ramp for surfaces; red kept as the single brand accent; cyan toned down and kept for focus/data; glows, washes and decorative SVGs removed; sentence-case labels; 400/500 weights; stat cards as numbers; one easing curve; a visible focus ring.

Logo: a new flat mark, a pipeline bending into a “C” from a hollow source node into a solid red destination node. Files: `client/src/components/shared/CodigoMark.tsx`, `client/public/favicon.svg`, `client/public/logo.svg`. The untracked `codigoflow-logo.jpg` files (gradient C with `</>` and an arrow) are not used by the app.

## 6. Corrections to the earlier draft

- GitHub import was marked BLOCKED; public import works without a token (PASS).
- Terraform validate was marked BLOCKED because of a missing CLI, but the smoke script was sending the wrong field (`projectId`), and every WSL cwd command was broken by the `wsl --` bug regardless of installs.
- Docker was marked BLOCKED; with Docker Desktop running it is PASS.
- Workflow builder was marked PASS; the Propose → builder path crashed to a blank page.
- No demo guide existed despite being referenced.

## 7. Demo data created

| Item | Where | Cleanup |
|---|---|---|
| Repository `Codigoflow` (public clone) | `server/data/repos/`, `repositories` table | Remove via UI (registration only) |
| Workflow `Deploy: Codigoflow` and 2 runs | `workflows`, jobs tables | Keep for the demo |
| Workflow `[demo] Smoke persistence check` (2 rows; one from a buggy run before the fix) and 3× `Demo validate workflow` (from earlier smoke runs) | `workflows` table | Can be deleted on request |
| Container `codigoflow-demo-redis` (stopped) | Docker | `docker rm codigoflow-demo-redis` |

## 8. Missing configuration

- `LLM_API_KEY` (or `NVIDIA_API_KEY`) in `server/.env` for AI Copilot
- `GITHUB_TOKEN` for private repos / rate limits
- `DEVOPS_API_TOKEN` for operator login and non-loopback privileged actions
- Control node with Terraform/Ansible/Puppet: either install them in WSL Ubuntu, or point at EC2 (section 9)
- `NAGIOS_STATUS_FILE` for live Nagios data
- `DEPLOYMENT_API_BASE_URL` + FastAPI connector for real Nginx deploys

## 9. Using the EC2 control node (not performed, needs your go-ahead)

Tools are installed on EC2, so DevOps execution can run there over SSH. **Why EC2:** the local WSL distro has no Terraform/Ansible/Puppet. **Operations:** `terraform validate/plan`, `ansible-playbook --syntax-check`/`--check`, `puppet parser validate`, all read-only. Apply, real playbook runs and deploys remain gated and were not run.

1. On EC2, put a copy of this repo’s `devops/` folder somewhere stable:
   ```bash
   ssh -i ~/.ssh/<key>.pem ubuntu@<ec2-host> 'git clone https://github.com/singhharshitt/Codigoflow.git ~/Codigoflow'
   ```
2. From Git Bash, confirm the key works non-interactively and the tools are on the path:
   ```bash
   ssh -o BatchMode=yes -i ~/.ssh/<key>.pem ubuntu@<ec2-host> 'terraform version; ansible --version | head -1; puppet --version'
   ```
3. In `server/.env`:
   ```
   DEVOPS_EXECUTION_MODE=ssh
   DEVOPS_SSH_HOST=<ec2-host>
   DEVOPS_SSH_USER=ubuntu
   DEVOPS_SSH_KEY_PATH=C:/Users/<you>/.ssh/<key>.pem
   DEVOPS_SSH_REMOTE_ROOT=/home/ubuntu/Codigoflow/devops
   ```
4. Restart the server, then open DevOps → Overview (control node should read `SSH control node ubuntu@<host> reachable`) and run Terraform → Validate on `local-lab`.

`DEVOPS_EXECUTION_MODE=ssh` is required: in `auto` mode Windows prefers WSL whenever it is available.

## 10. Remaining work

1. Run the EC2 steps above and re-test Terraform validate/plan, Ansible syntax check and Puppet validation.
2. Wire Docker Compose/Build tabs to the existing server routes and test with a disposable compose file.
3. Add AI key and re-test Copilot with a live completion.
4. Decide whether to delete the duplicate demo workflows.
5. Commit the changes (nothing has been committed).

## 11. Acceptance

| Criterion | Result |
|---|---|
| Frontend / backend / database / API | PASS |
| Authentication (loopback dev) | PASS |
| Repository management incl. GitHub public import | PASS |
| Workflow create/save/reload/validate/run, failure handling | PASS |
| Execution history | PASS |
| Docker | PASS (disposable container only) |
| Terraform / Ansible / Puppet execution | BLOCKED (tools not on local control node) |
| Nagios | MOCKED (labeled sample) |
| AI | BLOCKED (no key), unavailable handling PASS |
| Deployment controls secure | PASS (gated, not fired) |
| No critical console/backend errors | PASS |
| Documentation | PASS (this file + `CODIGOFLOW_PRODUCT_DEMO_GUIDE.md`) |

**Verdict:** ready for an honest demo of the platform, repository flow, workflow engine, history, Docker and security model. DevOps tool execution should be shown as BLOCKED, or switched to the EC2 control node first.
