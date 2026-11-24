# CódigoFlow — Product Demo Guide

A 15–20 minute walkthrough for faculty, evaluators, interviewers, developers and prospective users. Every step lists what to click, what to expect, and whether the result is live, blocked or sample data. Verified results are in `docs/CODIGOFLOW_DEMO_REPORT.md`.

---

## 1. What CódigoFlow is

CódigoFlow takes a Git repository to running infrastructure from one desk. You import a repository, it inspects the stack without executing anything, proposes a deployment workflow (Terraform → Ansible → Puppet → Nagios), and runs that workflow through an approval-gated job engine. Every step leaves a log you can inspect later.

**One-line pitch:** from a Git repository to running infrastructure, with every step logged.

## 2. Architecture

```
Browser (React + Vite, :5173)
   │  /api, /socket.io (Vite proxy)
   ▼
Express API (:4000) ── auth (loopback dev / operator session cookie)
   ├── SQLite (repositories, workflows, workflow runs, jobs, logs)
   ├── Git / GitHub (clone, status, commits, public metadata)
   ├── Docker Engine (containers, images, logs, actions)
   ├── Workflow engine ── DevOps executor
   │        ├── WSL Ubuntu    (wsl --exec)
   │        ├── SSH control node (EC2)
   │        └── native Linux
   │              └── terraform · ansible · puppet · nagios
   ├── AI provider (OpenAI-compatible / NVIDIA NIM, server-side keys only)
   └── Deployment connector (FastAPI → Nginx, operator-only)
```

Safety model: allowlisted executables, no shell string concatenation, destructive steps need `approve: true` plus an operator session, Terraform apply only from an approved, hash-checked saved plan.

## 3. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind, React Flow, Recharts, Zustand |
| Backend | Express, TypeScript, Zod, Pino, Socket.IO |
| Data | SQLite (Node 22 built-in) |
| DevOps | Terraform, Ansible, Puppet, Nagios, Docker |
| Deployment | FastAPI connector, Nginx |
| AI | OpenAI-compatible API or NVIDIA NIM, key failover |

## 4. Before the demo

```bash
npm install
npm run dev            # server :4000 + client :5173
```

- Open `http://localhost:5173`. The top bar should read **API online**.
- Start Docker Desktop if you want the live Docker section.
- Optional: `node scripts/demo-api-smoke.mjs` prints one status line per endpoint.
- Optional live DevOps: follow section 9 of the report to point the executor at the EC2 control node.

What is live vs not, today:

| Capability | State |
|---|---|
| Dashboard, repos, GitHub public import, analysis | Live |
| Workflow builder: save, reload, validate, run, logs | Live (engine); tools blocked without a control node |
| Execution history | Live |
| Docker | Live when Docker Desktop runs |
| Terraform / Ansible / Puppet commands | Blocked locally (not installed in WSL); live via EC2 once configured |
| Nagios | Sample data, labeled in the UI |
| AI Copilot | Blocked until an LLM key is set; the unavailable state is real |
| Nginx deploy/rollback | Gated, not fired during demos |

## 5. Walkthrough

### Step 1: Overview (1 min)
- **Click:** Overview in the sidebar.
- **Show:** the headline, the four-stage pipeline track (it ticks as real work completes), stat cards, integration status in the sidebar footer.
- **Say:** “Every number here comes from the API. Nothing is placeholder data.”

### Step 2: Import a repository (2 min)
- **Click:** Import repository → paste `https://github.com/singhharshitt/Codigoflow` → Preview metadata → Import.
- **Expect:** description, language, default branch, then a new row in Repositories. The sidebar and top bar now show the active repository.
- **Say:** public repositories need no token; the clone lives in server-managed storage.

### Step 3: Analyse (1 min)
- **Click:** the scan icon (“Analyse repository stack”) on the row.
- **Expect:** stack `node`, build/start commands, Docker Compose detected, Terraform/Ansible/Puppet hints true.
- **Say:** analysis is static. Nothing from the repository is executed and `.env` values are never read.

### Step 4: Propose and review the workflow (2 min)
- **Click:** the workflow icon (“Propose guided deployment workflow”).
- **Expect:** the Workflow builder opens with Start → Terraform Init/Validate/Plan → Ansible inventory validate → playbook check → Puppet no-op → Nagios status → End.
- **Show:** click a node to see its configuration; add a node from the library; connect nodes.
- **Say:** the proposal never includes apply or destructive steps. Those require `approve: true` and an operator.

### Step 5: Save, validate, run (2 min)
- **Click:** Save → Validate (toast “Workflow is executable”) → Run.
- **Expect without a control node:** Start succeeds, Terraform Init fails with *terraform is not installed on the wsl control node*, the rest are skipped. Nodes are colored and the Last run panel lists each one.
- **Say:** failure handling is part of the product. The engine stops at the first failure, marks downstream steps skipped, and records why.
- **With EC2 configured:** Terraform validate/plan and Ansible checks run for real; show their output.

### Step 6: Execution history (1 min)
- **Click:** Open in execution history (or Execution History in the sidebar) → select the run.
- **Expect:** status, start/finish time, duration, error and persisted per-node logs. “AI diagnose” is available when AI is configured.

### Step 7: Docker manager (2 min, needs Docker Desktop)
- **Click:** Docker Manager.
- **Expect:** engine version, container/image counts, live container table.
- **Do:** on `codigoflow-demo-redis` only, click Stop → confirm → watch the state change; then Start; open Logs.
- **Say:** stop and restart ask for confirmation because they interrupt workloads.

### Step 8: Terraform (1 min)
- **Click:** DevOps control → Terraform.
- **Expect:** discovered projects (`aws`, `azure`, `gcp`, `local-lab`), Format/Init/Validate/Plan, Approve plan and Apply approved plan disabled until a plan exists.
- **Say:** apply only accepts a saved plan that was approved and whose hash still matches.

### Step 9: Ansible and Puppet (1 min)
- **Click:** Ansible, then Puppet.
- **Expect:** playbooks and inventory files listed; tool status. Without a control node, validation returns a clear *not installed* message.

### Step 10: Nagios (1 min)
- **Click:** Nagios.
- **Expect:** hosts and services, with a banner saying it is the bundled sample file.
- **Say:** this is sample data, clearly labeled. Live monitoring needs `NAGIOS_STATUS_FILE`.

### Step 11: Protected deployment controls (1 min)
- **Click:** DevOps control → Overview.
- **Expect:** operator session panel, “Deploy Nginx” and “Rollback Nginx” disabled until signed in.
- **Say:** the operator token stays server-side in an httpOnly cookie and never ships in the browser bundle. Real deploys are not part of this demo.

### Step 12: AI Copilot (1 min)
- **Click:** AI Copilot.
- **Expect without a key:** a clear “not configured” notice; requests return `AI_NOT_CONFIGURED`.
- **With a key:** ask “Explain a failing Docker health check” or generate a commit message from staged changes in Git Studio.

### Step 13: Close on platform health (30 s)
- Back to Overview: pipeline track ticked, recent operations listed, integrations in the sidebar.

## 6. Module reference

| Module | What it does | Backed by |
|---|---|---|
| Overview | Live summary of repos, commits, containers, jobs | `/api/repositories`, `/api/jobs`, `/api/docker` |
| Repositories | Import, register, analyse, propose | `/api/repositories/*` |
| Git Studio | Status, diff, stage, commit, push | `/api/repositories/:id/*` |
| Contribution Explorer | Commit and author activity | `/api/github/*` |
| Workflow builder | Graph editor and job engine | `/api/workflows/*` |
| Execution history | Jobs, logs, durations | `/api/jobs/*` |
| Docker manager | Containers, images, logs, actions | `/api/docker/*` |
| Terraform / Ansible / Puppet / Nagios | Tool operations via the control node | `/api/devops/*` |
| Lab environment | Local lab status and pipeline readiness | `/api/devops/lab/*` |
| AI Copilot | Commit messages, error explanation, log analysis | `/api/ai/*` |
| Settings | Integration status, operator session | `/api/health`, `/api/auth/*` |

## 7. Likely questions

- **Is any of this faked?** No. Unavailable integrations return real errors, and the Nagios sample is labeled in both the API (`isSampleData`) and the UI.
- **What stops someone running `terraform destroy`?** Destroy is disabled by default (`DEVOPS_TF_DESTROY_ENABLED`), apply needs an approved plan, and privileged routes need an operator session.
- **Where do secrets live?** Only in `server/.env`. Nothing is exposed through `VITE_*`, and a test checks the bundle.
- **Why WSL or SSH?** Terraform/Ansible/Puppet are Linux tools. The executor runs them in WSL on Windows or on a remote control node such as EC2, never by concatenating shell strings.

## 8. Current limitations

- Terraform/Ansible/Puppet execution needs a configured control node (EC2 steps in the report).
- Docker Compose/Build tabs are not wired to the existing server routes yet; Docker volumes/networks have no API.
- Nagios uses sample data until pointed at a real `status.dat`.
- AI requires an LLM key.
- GitHub imports are shallow clones, so Git activity starts with one commit.

## 9. Future improvements

- Live streaming of node logs over Socket.IO in the workflow canvas.
- Compose and image build from the Docker tabs.
- Live Nagios via the Nagios Core API.
- Role-based operator accounts instead of a single token.
- Plan diff view for Terraform before approval.

---

UI polish follows [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky (CC BY 4.0).
