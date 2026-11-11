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

## Checks

```powershell
npm run typecheck --workspace=@codigoflow/server
npm run lint --workspace=@codigoflow/server
npm run test --workspace=@codigoflow/server
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| AI_NOT_CONFIGURED | Set `NVIDIA_API_KEY` in `server/.env` |
| Docker unavailable | Start Docker Desktop |
| Git not found | Install Git and restart the terminal |
| SQLite experimental warning | Expected on Node 22 with `--experimental-sqlite` |
