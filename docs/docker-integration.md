# Docker Integration

Uses the Docker CLI (`docker` on PATH). If the daemon is unavailable, endpoints return honest disconnected states without crashing the API server.

## Supported operations

- Status / version
- List containers & images
- Inspect / logs
- Start / stop / restart
- Build (Dockerfile + context inside a registered repository)
- Compose up/down/ps (compose file inside a registered repository)

## Safety

- Container IDs validated
- Actions allowlisted
- Build/compose paths must resolve inside the registered repo root
- Logs are sanitized before AI analysis
