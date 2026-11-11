# CódigoFlow Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser                                   │
│   React + Vite + TypeScript + Tailwind + Zustand + React Router  │
│                         :5173                                     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTP / WebSocket (Socket.IO)
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Express API Server                             │
│                Node.js + TypeScript · :4000                      │
│                                                                  │
│  Middleware: Helmet · CORS · Rate Limit · Zod · Error Handler    │
│                                                                  │
│  Routes:                                                         │
│   /api/repositories   /api/ai   /api/docker                     │
│   /api/github         /api/jobs /api/health                     │
└──────────────────────────────────────────────────────────────────┘
          │          │           │           │           │
          ▼          ▼           ▼           ▼           ▼
    ┌─────────┐ ┌──────────┐ ┌──────┐ ┌────────┐ ┌──────────┐
    │  SQLite │ │ Git CLI  │ │Docker│ │GitHub  │ │  AI API  │
    │  (WAL)  │ │ (spawn)  │ │  CLI │ │  REST  │ │(OpenAI)  │
    └─────────┘ └──────────┘ └──────┘ └────────┘ └──────────┘
```

## Directory Structure

```
codigo-flow/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # AppShell, Sidebar, TopBar
│   │   │   └── ui/            # Shared primitives
│   │   ├── pages/             # Route-level page components
│   │   ├── services/          # API client
│   │   ├── stores/            # Zustand stores
│   │   └── types/             # Shared TypeScript types
│   └── ...
├── server/
│   ├── src/
│   │   ├── config/            # Env validation (Zod)
│   │   ├── database/          # SQLite init and schema
│   │   ├── integrations/
│   │   │   ├── git/           # Git CLI wrapper
│   │   │   ├── docker/        # Docker CLI wrapper
│   │   │   ├── github/        # GitHub REST API client
│   │   │   ├── ai/            # OpenAI-compatible adapter
│   │   │   └── infrastructure/# Stubs: Terraform, Ansible, Puppet, Nagios
│   │   ├── middleware/        # errorHandler, requestLogger
│   │   ├── routes/            # Express routers
│   │   ├── services/          # Business logic (repositoryService)
│   │   └── utils/             # logger
│   └── ...
└── docs/                      # This documentation
```

## Security Architecture

### Git Security
- `child_process.spawn()` with `shell: false` — no injection
- Allowlist of permitted Git sub-commands
- Path validation prevents traversal
- Sensitive file detection before staging
- No auto-commit or auto-push

### Docker Security
- Allowlisted operations: `start`, `stop`, `ps`, `images`, `logs`
- Container ID validated against `/^[a-zA-Z0-9_.-]{1,64}$/`
- No arbitrary command passthrough
- Backend binds to `127.0.0.1` by default

### API Security
- AI API key stored only in server environment
- Never returned in API responses or logs
- CORS restricted to configured origin
- Rate limiting: 200 req/min per IP
- Request size capped at 2 MB
- Zod validates all inputs

## Database Schema

```sql
repositories (id, name, path, description, remote_url, github_owner, github_repo, created_at, updated_at)
jobs         (id, operation, repo_id, status, summary, log_ref, error_message, started_at, finished_at, created_at)
operation_history (id, repo_id, operation, details, success, error, executed_at)
```

## Future Integration Pipeline (Phase 3)

```
Validate Code → Git/Docker → Terraform → Ansible → Puppet → Nagios
```

Each infrastructure tool will implement the `IntegrationAdapter` interface:
```typescript
interface IntegrationAdapter {
  checkAvailability(): Promise<{ available: boolean; version?: string }>;
  execute(operation: string, params: Record<string, unknown>): Promise<{ success: boolean; output: string; exitCode: number }>;
}
```
