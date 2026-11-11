# CódigoFlow

> **From Code to Cloud, Simplified.**

CódigoFlow is an AI-powered development automation platform that unifies Git/GitHub operations, Docker management, code troubleshooting, and repository visualization in a single professional dashboard.

**Course:** INT333 Advanced Configuration Management · Academic Session 2026–27

---

## Features

| Feature | Status |
|---|---|
| Repository registration and management | ✅ Working |
| Git status, branches, commits, diffs | ✅ Working |
| File staging and commit with confirmation | ✅ Working |
| AI commit message generation | ✅ (requires AI key) |
| AI error explanation | ✅ (requires AI key) |
| AI Docker log analysis | ✅ (requires AI key) |
| AI code assistant | ✅ (requires AI key) |
| Docker container list, start/stop, logs | ✅ Working |
| GitHub repository explorer | ✅ Working |
| Contribution and commit visualization | ✅ Working |
| Execution history and job tracking | ✅ Working |
| Live updates via Socket.IO | ✅ Working |
| Workflow Builder | 🔜 Phase 2 |
| Terraform / Ansible / Puppet / Nagios | 🔜 Phase 3 |

---

## Technology Stack

### Frontend
- React 18 + Vite + TypeScript
- Tailwind CSS 3
- React Router 6
- Zustand state management
- Recharts for visualization
- Lucide React icons
- Socket.IO client

### Backend
- Node.js + Express.js + TypeScript
- Socket.IO for live logs
- SQLite via better-sqlite3
- Zod request validation
- Pino structured logging
- OpenAI SDK (OpenAI-compatible adapter)

---

## Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **npm** 9+ (bundled with Node.js)
- **Git** — [git-scm.com](https://git-scm.com)
- **Docker Desktop** (optional) — for container management
- An AI API key (optional) — OpenAI, Groq, or any OpenAI-compatible provider

---

## Installation (Windows 11)

### 1. Clone or extract the project

```powershell
cd D:\
# If cloning:
git clone <your-repo-url> Codigoflow
cd Codigoflow
```

### 2. Install all dependencies

```powershell
npm install
```

This installs dependencies for the root, client, and server workspaces.

### 3. Configure the backend

```powershell
Copy-Item server\.env.example server\.env
notepad server\.env
```

Edit the values:

```dotenv
PORT=4000
HOST=127.0.0.1
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
DATABASE_PATH=./data/codigoflow.db
LOG_LEVEL=info

# AI — paste your key here (optional)
AI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# GitHub — optional, increases rate limits for public repos
GITHUB_TOKEN=ghp_...
```

### 4. Configure the frontend (optional)

The frontend defaults to `/api` which proxies to `http://localhost:4000`. No changes needed for development.

---

## Starting the Application

### Start both frontend and backend simultaneously

```powershell
npm run dev
```

This starts:
- **Backend** on `http://localhost:4000`
- **Frontend** on `http://localhost:5173`

### Start individually

```powershell
# Backend only
npm run dev:server

# Frontend only
npm run dev:client
```

---

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 4000) | Server port |
| `HOST` | No (default: 127.0.0.1) | Bind address |
| `NODE_ENV` | No | `development` or `production` |
| `CLIENT_ORIGIN` | No | Frontend origin for CORS |
| `DATABASE_PATH` | No | SQLite file path |
| `LOG_LEVEL` | No | Pino log level |
| `AI_API_KEY` | Optional | API key for AI features |
| `AI_BASE_URL` | Optional | OpenAI-compatible base URL |
| `AI_MODEL` | Optional | Model identifier |
| `GITHUB_TOKEN` | Optional | GitHub Personal Access Token |

### Client (`client/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Backend URL (use `/api` in dev, full URL in production) |

---

## Git Integration Setup

1. Register any local Git repository from the **Repositories** page.
2. Enter the absolute path (e.g. `D:\Projects\my-app`).
3. The backend validates the path, confirms Git is initialized, and extracts the remote URL.
4. Use **Git Studio** to inspect status, stage files, commit, and view diffs.

**Security:** Git commands run with `child_process.spawn()` using a fixed executable and separate arguments. User input is never concatenated into shell strings.

---

## Docker Integration Setup

1. Start **Docker Desktop** on Windows.
2. Open **Docker Manager** in CódigoFlow.
3. Container status, start/stop, and log viewing are available immediately.

If Docker Desktop is not running, the Docker Manager shows a clear unavailable state.

---

## AI API Configuration

CódigoFlow uses an OpenAI-compatible chat-completions API. You can use:

- **OpenAI** — `AI_BASE_URL=https://api.openai.com/v1`
- **Groq** — `AI_BASE_URL=https://api.groq.com/openai/v1`
- **Ollama (local)** — `AI_BASE_URL=http://localhost:11434/v1`
- Any other OpenAI-compatible provider

Set `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` in `server/.env`. The key is **never** sent to the browser.

---

## Database Initialization

The SQLite database is created automatically on first server start at the path defined by `DATABASE_PATH` (default: `./data/codigoflow.db`). No manual initialization is required.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health and integration status |
| GET | `/api/repositories` | List registered repositories |
| POST | `/api/repositories` | Register a repository |
| DELETE | `/api/repositories/:id` | Remove a repository |
| GET | `/api/repositories/:id/status` | Git status |
| GET | `/api/repositories/:id/branches` | Branch list |
| GET | `/api/repositories/:id/commits` | Commit history |
| GET | `/api/repositories/:id/diff` | File diffs |
| POST | `/api/repositories/:id/stage` | Stage files |
| POST | `/api/repositories/:id/commit` | Commit staged changes |
| POST | `/api/repositories/:id/push` | Push to remote |
| GET | `/api/ai/status` | AI configuration status |
| POST | `/api/ai/commit-messages` | Generate commit messages |
| POST | `/api/ai/explain-error` | Explain errors |
| POST | `/api/ai/analyze-docker-logs` | Analyze Docker logs |
| POST | `/api/ai/ask` | Ask the code assistant |
| GET | `/api/docker/status` | Docker availability |
| GET | `/api/docker/containers` | List containers |
| GET | `/api/docker/images` | List images |
| GET | `/api/docker/containers/:id/logs` | Container logs |
| POST | `/api/docker/containers/:id/start` | Start container |
| POST | `/api/docker/containers/:id/stop` | Stop container |
| GET | `/api/github/repositories?url=` | GitHub repo info |
| GET | `/api/github/repositories/:owner/:repo/commits` | GitHub commits |
| GET | `/api/github/repositories/:owner/:repo/contributors` | GitHub contributors |
| GET | `/api/jobs` | Job history |
| GET | `/api/history` | Operation history |

---

## Running Tests

```powershell
npm run test
```

Tests cover:
- Git path validation and path traversal prevention
- Sensitive file detection (`.env`, `.pem`, private keys)
- Git status parsing
- AI status endpoint (no key leakage)

---

## Security Considerations

- Git commands use `spawn()` with `shell: false` — no injection possible
- Only allowlisted Git and Docker operations are permitted
- API keys are stored only in server environment variables
- CORS is restricted to the configured frontend origin
- Request size is capped at 2 MB
- Rate limiting is applied to all API routes
- Sensitive file patterns are detected before staging
- The Docker socket is never exposed over the network

---

## Planned Future Integrations (Phase 3)

```
Validate Code
     │
Git and Docker Operations
     │
Terraform ── Provision Infrastructure
     │
Ansible ─── Deploy Application
     │
Puppet ──── Enforce Configuration
     │
Nagios ──── Verify Application Health
```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `npm install` fails | Ensure Node.js 18+ is installed: `node --version` |
| Backend won't start | Check `server/.env` exists; check port 4000 is free |
| Frontend shows offline | Confirm backend is running; check browser console |
| Git ops fail | Ensure Git is in PATH: `git --version` |
| Docker shows unavailable | Start Docker Desktop and click Refresh |
| AI returns 503 | Set `AI_API_KEY` in `server/.env` |
| GitHub rate limit | Add `GITHUB_TOKEN` to `server/.env` |
| Database locked error | Only one server instance should run at a time |
