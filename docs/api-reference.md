# CódigoFlow API Reference

Base URL: `http://127.0.0.1:4000/api`

Envelope:

```json
{ "success": true, "data": {} }
{ "success": false, "error": { "code": "CODE", "message": "..." } }
```

## Core

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server + integration snapshot |
| GET | `/integrations/status` | Detailed integration states (cached ~15s) |

## Repositories & Git

| Method | Path | Description |
|---|---|---|
| GET/POST | `/repositories` | List / register local repo |
| POST | `/repositories/clone` | Clone remote into destination + register |
| GET/DELETE | `/repositories/:id` | Details / unregister (files kept) |
| GET | `/repositories/:id/status\|branches\|commits\|diff` | Git reads |
| POST | `/repositories/:id/stage\|unstage\|commit\|push\|checkout` | Git writes |

## AI (NVIDIA)

| Method | Path | Description |
|---|---|---|
| GET | `/ai/status` | Configured model/base URL (no keys) |
| GET | `/ai/connection` | Optional live connectivity probe |
| POST | `/ai/commit-messages` | `{ diff }` → `{ messages }` |
| POST | `/ai/explain-error` | `{ error }` → explanation |
| POST | `/ai/analyze-docker-logs` | `{ logs \| containerId }` |
| POST | `/ai/ask` or `/ai/chat` | General assistant |

## Docker / GitHub / Jobs / Workflows

See route modules under `server/src/routes/` for Docker, GitHub, jobs, and workflows endpoints including build, compose, cancel, validate, and run (run returns `501` until node executors ship).
