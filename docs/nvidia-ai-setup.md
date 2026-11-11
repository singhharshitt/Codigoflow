# NVIDIA AI Setup

CódigoFlow uses the OpenAI-compatible NVIDIA NIM API.

## Required environment (server only)

```env
NVIDIA_API_KEY=your_key_here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=qwen/qwen2.5-coder-32b-instruct
NVIDIA_MAX_TOKENS=2048
NVIDIA_TEMPERATURE=0.3
```

Fallback (only if `NVIDIA_API_KEY` is unset):

```env
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=
```

## Rules

- Never put the key in `client/.env` or any `VITE_*` variable.
- Never commit `.env`.
- `/api/ai/status` returns model/base URL only — never the key.
- Change models by editing `NVIDIA_MODEL` to a model available on your NVIDIA account.

## Verify

```powershell
cd D:\Codigoflow
npm run dev:server
# then
Invoke-RestMethod http://127.0.0.1:4000/api/ai/status
Invoke-RestMethod http://127.0.0.1:4000/api/ai/connection
```
