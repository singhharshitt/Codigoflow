# Windows 11 Development Setup

## Prerequisites

- Node.js 18+ (22 recommended for `node:sqlite`)
- npm 9+
- Git
- Docker Desktop (optional)
- NVIDIA API key (optional for AI features)

## Install

```powershell
cd D:\Codigoflow
npm install
Copy-Item server\.env.example server\.env
# Edit server\.env — set NVIDIA_API_KEY (do not commit)
```

## Run

```powershell
# both apps
npm run dev

# or separately
npm run dev:server
npm run dev:client
```

- Frontend: http://localhost:5173  
- Backend: http://127.0.0.1:4000/api/health  

## Operator authentication (DevOps)

```dotenv
# server/.env
DEVOPS_API_TOKEN=change-me-to-a-long-random-value
# SESSION_SECRET=optional-separate-signing-secret
```

1. Start the apps.
2. Open **DevOps Control Center**.
3. In **Operator session**, paste the same token once — the server sets an HttpOnly `cf_session` cookie.
4. Do **not** put the token in `client/.env` or any `VITE_*` variable.

## Checks

```powershell
npm run typecheck --workspace=@codigoflow/server
npm run lint --workspace=@codigoflow/server
npm run test --workspace=@codigoflow/server
npm run typecheck --workspace=@codigoflow/client
npm run lint --workspace=@codigoflow/client
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| AI_NOT_CONFIGURED | Set `NVIDIA_API_KEY` in `server/.env` |
| Docker unavailable | Start Docker Desktop |
| Git not found | Install Git and restart the terminal |
| SQLite experimental warning | Expected on Node 22 with `--experimental-sqlite` |
