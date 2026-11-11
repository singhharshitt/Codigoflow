# CódigoFlow API Reference

All endpoints return JSON with this envelope:

```json
{ "success": true, "data": <payload> }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
```

---

## Health

### `GET /api/health`
Returns server status and integration availability.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "timestamp": "2026-10-22T10:00:00.000Z",
    "integrations": {
      "ai": { "configured": false },
      "github": { "configured": false },
      "docker": { "available": true, "version": "27.1.0" }
    }
  }
}
```

---

## Repositories

### `GET /api/repositories`
List all registered repositories.

### `POST /api/repositories`
Register a local Git repository.

**Body:**
```json
{ "path": "D:\\Projects\\my-app", "name": "my-app", "description": "Optional" }
```

### `DELETE /api/repositories/:id`
Remove a repository from CódigoFlow (files are not deleted).

### `GET /api/repositories/:id/status`
Get working tree status.

**Response data:**
```json
{ "branch": "main", "staged": [], "unstaged": ["src/index.ts"], "untracked": [], "ahead": 0, "behind": 0 }
```

### `GET /api/repositories/:id/branches`
List all local branches.

### `GET /api/repositories/:id/commits?limit=30`
Recent commit history (max 100).

### `GET /api/repositories/:id/diff?file=<path>`
Unified diff for a file or the full working tree.

### `POST /api/repositories/:id/stage`
Stage explicitly selected files.

**Body:** `{ "files": ["src/index.ts", "README.md"] }`

### `POST /api/repositories/:id/commit`
Commit staged changes.

**Body:** `{ "message": "feat: add new feature" }`

### `POST /api/repositories/:id/push`
Push to a remote branch.

**Body:** `{ "remote": "origin", "branch": "main" }`

---

## AI

### `GET /api/ai/status`
Reports whether AI is configured. **Never exposes the API key.**

### `POST /api/ai/commit-messages`
Generate 3 commit message suggestions.

**Body:** `{ "diff": "<unified diff>" }`

**Response data:** `{ "messages": ["feat: ...", "fix: ...", "chore: ..."] }`

### `POST /api/ai/explain-error`
Explain an error and suggest fixes.

**Body:** `{ "error": "<stack trace or error message>" }`

**Response data:** `{ "explanation": "...", "suggestions": ["...", "..."] }`

### `POST /api/ai/analyze-docker-logs`
Analyze container logs.

**Body:** `{ "logs": "<container log output>" }`

### `POST /api/ai/ask`
Ask a code question.

**Body:** `{ "question": "...", "codeContext": "// optional code" }`

---

## Docker

### `GET /api/docker/status`
Check Docker daemon availability.

### `GET /api/docker/containers?all=true`
List containers (all includes stopped).

### `GET /api/docker/images`
List local images.

### `GET /api/docker/containers/:id/logs?tail=100`
Retrieve container log output.

### `POST /api/docker/containers/:id/start`
Start a stopped container.

### `POST /api/docker/containers/:id/stop`
Stop a running container.

---

## GitHub

### `GET /api/github/repositories?url=<github-url>`
Fetch public repository metadata.

### `GET /api/github/repositories/:owner/:repo/commits`
Recent commits from GitHub.

### `GET /api/github/repositories/:owner/:repo/contributors`
Repository contributors.

---

## Jobs

### `GET /api/jobs?limit=50`
Retrieve recent jobs.

### `GET /api/history?limit=50`
Retrieve operation history.

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body (Zod) |
| `INVALID_PATH` | 400 | Bad repository path |
| `PATH_NOT_FOUND` | 400 | Directory does not exist |
| `NOT_A_GIT_REPO` | 400 | No `.git` directory found |
| `FORBIDDEN_COMMAND` | 403 | Git command not allowlisted |
| `REPO_NOT_FOUND` | 404 | Unknown repository ID |
| `NOT_FOUND` | 404 | Route not found |
| `GIT_NOT_FOUND` | 503 | Git not in PATH |
| `AI_NOT_CONFIGURED` | 503 | Missing AI_API_KEY |
| `RATE_LIMIT` | 429 | API rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
