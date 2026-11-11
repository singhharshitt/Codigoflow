# CódigoFlow Backend Architecture

## Overview

The backend is an Express + TypeScript service bound to `127.0.0.1:4000` by default. It orchestrates local Git repositories, optional GitHub analytics, Docker CLI operations, NVIDIA NIM AI completions, workflow persistence, and job history.

## Layers

| Layer | Responsibility |
|---|---|
| `routes/` | HTTP validation (Zod) and response envelopes |
| `services/` | Domain orchestration (repositories, integrations status) |
| `integrations/` | External systems: Git, GitHub, Docker, NVIDIA AI, future infra |
| `jobs/` | Background job lifecycle + Socket.IO events |
| `database/` | SQLite access, migrations, repositories |
| `middleware/` | Logging, errors, security |

## Security principles

- Bind to localhost in development.
- No unrestricted shell or Docker execution endpoints.
- Git uses `spawn` with `shell: false` and an allowlisted command set.
- Docker build/compose contexts are restricted to registered repositories.
- AI keys never leave the server environment or appear in API responses/logs.
- Secrets in diffs/logs are redacted before NVIDIA requests.

## Real-time

Socket.IO emits `job:queued`, `job:started`, `job:log`, `job:succeeded`, `job:failed`, and `job:cancelled`.
