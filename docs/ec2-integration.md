# CódigoFlow ↔ EC2 integration

Run CódigoFlow on your Windows machine and use the EC2 control node as the remote DevOps execution environment. Development stays local; EC2 only executes Terraform/Ansible/Puppet and the Nginx deployment playbooks.

No IP addresses, keys or tokens belong in this repository. Hosts are SSH aliases defined in your own `~/.ssh/config`, and secrets live in `server/.env.local` (gitignored) or `backend/.env` on EC2.

## Architecture

```
Windows PC                                         AWS VPC
┌──────────────────────────────┐   SSH :22        ┌───────────────────────────────────┐
│ React (Vite :5173)           │   your IP only   │ codigoflow-control                │
│   no secrets, calls /api     │ ───────────────► │   FastAPI 127.0.0.1:8000 (private)│
│ Express :4000                │                  │   Terraform · Ansible · Puppet    │
│   deploy  → 127.0.0.1:18000 ═══ SSH tunnel ═════►   (FastAPI deploy/rollback)       │
│   DevOps  → ssh codigoflow-control (commands)    │        │ private SSH               │
│ SQLite (history, plans)      │                  │        ▼                          │
└──────────────────────────────┘                  │ codigoflow-managed (Nginx)        │
                                                  └───────────────────────────────────┘
```

Two channels, both over SSH:

| Channel | Used for | How |
|---|---|---|
| Tunnel `127.0.0.1:18000 → EC2 127.0.0.1:8000` | Nginx deploy/rollback via FastAPI | `DEPLOYMENT_API_BASE_URL` |
| SSH executor | Terraform/Ansible/Puppet commands from DevOps pages and workflows | `DEVOPS_EXECUTION_MODE=ssh` |

Security properties:
- FastAPI listens on `127.0.0.1:8000` on EC2. Port 8000 is never opened in the security group.
- `CODIGOFLOW_API_TOKEN` is sent only by Express, only to a loopback URL (a non-loopback URL is refused unless it is `https` and `DEPLOYMENT_API_ALLOW_REMOTE=true`). It never reaches the browser and is never returned by the status endpoint.
- Deploy and rollback always require an operator session (cookie from `DEVOPS_API_TOKEN` login) and a trusted origin. There is no loopback bypass for them.
- Every deploy/rollback is recorded in Execution History, success or failure.

## EC2 prerequisites

Control node (`codigoflow-control`):
- Ubuntu with `terraform`, `ansible-playbook`, `puppet` on `PATH`
- FastAPI app in `~/codigoflow/backend` with `CODIGOFLOW_API_TOKEN` in `backend/.env`, started as `uvicorn main:app --host 127.0.0.1 --port 8000`
- Playbooks referenced by `backend/config.py` (`deploy-auto-rollback.yml`, `rollback-nginx.yml`) and `ansible/inventory.ini` pointing at the managed node's **private** IP
- A checkout of this repository for the DevOps executor, e.g. `~/codigoflow-integration` (`DEVOPS_SSH_REMOTE_ROOT=/home/ubuntu/codigoflow-integration/devops`)

Managed node (`codigoflow-managed`): reachable from the control node over private SSH; Nginx installed.

## Firewall (security groups)

| Instance | Inbound | Source |
|---|---|---|
| codigoflow-control | TCP 22 | your public IP `/32` only |
| codigoflow-control | TCP 8000 | **none** (do not add) |
| codigoflow-managed | TCP 22 | control node's security group only |
| codigoflow-managed | TCP 80/443 | whoever should see the site |

Check from Windows that 8000 is closed (should time out):

```bash
curl -m 6 http://<control-public-ip>:8000/health || echo "closed (good)"
```

## Windows setup (Git Bash)

1. Keys: copy them into `~/.ssh` and restrict permissions (Windows OpenSSH rejects keys others can read).

```bash
cp <control-key>.pem ~/.ssh/codigoflow-control.pem
cp <managed-key>.pem ~/.ssh/codigoflow-managed.pem
for k in codigoflow-control codigoflow-managed; do
  icacls "$(cygpath -w ~/.ssh/$k.pem)" /inheritance:r /grant:r "$USERNAME:R"
done
```

2. Host aliases in `~/.ssh/config` (the only place the IPs live):

```
Host codigoflow-control
  HostName <control-public-ip>
  User ubuntu
  IdentityFile ~/.ssh/codigoflow-control.pem
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3

Host codigoflow-managed
  HostName <managed-private-ip>
  User ubuntu
  IdentityFile ~/.ssh/codigoflow-managed.pem
  IdentitiesOnly yes
  ProxyJump codigoflow-control
```

Test both (the first connection asks you to confirm the host key):

```bash
ssh codigoflow-control hostname
ssh codigoflow-managed hostname
```

3. `server/.env.local` (gitignored, loaded before `server/.env` and wins over it):

```
DEPLOYMENT_API_BASE_URL=http://127.0.0.1:18000
DEVOPS_EXECUTION_MODE=ssh
DEVOPS_SSH_HOST=codigoflow-control
DEVOPS_SSH_USER=ubuntu
DEVOPS_SSH_REMOTE_ROOT=/home/ubuntu/codigoflow-integration/devops
```

`DEVOPS_EXECUTION_MODE=ssh` is required: in `auto` mode Windows prefers WSL.

### Tokens

Run from the repository root. Neither command prints the secret.

```bash
# Service token: copy the value FastAPI expects into .env.local
ssh codigoflow-control "grep '^CODIGOFLOW_API_TOKEN=' ~/codigoflow/backend/.env" >> server/.env.local

# Operator token: a new random value you will paste into the operator sign-in box
echo "DEVOPS_API_TOKEN=$(openssl rand -hex 32)" >> server/.env.local
```

To read the operator token when you need to sign in: `grep DEVOPS_API_TOKEN server/.env.local`.

Restart the CódigoFlow server after editing `.env.local` (env files are read at startup).

Once `DEVOPS_API_TOKEN` is set, auth mode becomes `session-or-bearer`: **every** privileged DevOps action (Terraform/Ansible/Puppet commands, workflow runs, deploy/rollback) requires signing in as operator on DevOps → Overview. Read-only pages and the connection status keep working without a session.

## Tunnel: start and stop

Start (foreground, leave the terminal open):

```bash
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18000:127.0.0.1:8000 codigoflow-control
```

Stop: `Ctrl+C` in that terminal.

Background variant:

```bash
ssh -f -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18000:127.0.0.1:8000 codigoflow-control
# stop it later: kill only the process holding local port 18000
PID=$(netstat -ano | grep '127.0.0.1:18000 .*LISTENING' | awk '{print $NF}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F
```

Check it:

```bash
curl -s http://127.0.0.1:18000/health          # {"status":"healthy"}
curl -s http://127.0.0.1:4000/api/devops/deployment/status
```

## Connection states (`GET /api/devops/deployment/status`)

| `state` | Meaning | Fix |
|---|---|---|
| `ready` | `/health` healthy and `/api/auth-check` accepted the key | — |
| `unreachable` | Connection refused | Start the tunnel |
| `timeout` | No answer within 5 s | Check the tunnel / FastAPI process |
| `unhealthy` | FastAPI answered but not healthy | Check uvicorn on EC2 |
| `not_configured` | Reachable, `CODIGOFLOW_API_TOKEN` missing locally | Add it to `.env.local`, restart |
| `auth_failed` | Reachable, key rejected | Token differs from `backend/.env` |
| `url_not_allowed` | Base URL is not loopback (or remote without https + opt-in) | Use the tunnel URL |

Deploy/rollback errors:

| Code | HTTP | Meaning |
|---|---|---|
| `OPERATOR_AUTH_REQUIRED` | 401 | Sign in as operator |
| `DEPLOYMENT_CONFLICT` | 409 | A deployment is already running (FastAPI file lock) |
| `DEPLOYMENT_TIMEOUT` | 504 | No answer in 190 s; the playbook may still be running on EC2, check before retrying |
| `DEPLOYMENT_SERVICE_UNAVAILABLE` | 503 | Tunnel down |
| `DEPLOYMENT_AUTH_FAILED` | 502 | FastAPI rejected the key |
| `DEPLOYMENT_FAILED` | 502 | Playbook failed; see logs on EC2 |
| `DEPLOYMENT_NOT_CONFIGURED` | 503 | `CODIGOFLOW_API_TOKEN` not set |

## EC2-side commands (run on the control node)

Read-only checks:

```bash
ss -ltn | grep 8000                  # must show 127.0.0.1:8000
ps -o pid,etime,args -C uvicorn
which terraform ansible-playbook puppet
```

**Recommended change (needs your approval, not applied):** uvicorn currently runs as a manually started process and will not come back after a reboot. A systemd unit keeps it bound to localhost and restarts it:

```ini
# /etc/systemd/system/codigoflow-api.service
[Unit]
Description=CodigoFlow FastAPI (localhost only)
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/codigoflow/backend
ExecStart=/home/ubuntu/codigoflow/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# only after stopping the manual uvicorn process
sudo systemctl daemon-reload && sudo systemctl enable --now codigoflow-api
```

Keep the DevOps checkout current (read-only for infrastructure):

```bash
cd ~/codigoflow-integration && git pull --ff-only
```

## Going back to plain local development

Rename or delete `server/.env.local` and restart the server. The executor returns to WSL and deploy calls go to the default `127.0.0.1:8000`.

## Verified on 2026-11-22

| Check | Result |
|---|---|
| Control node alias, key, hostname | PASS (`ip-172-31-9-30`) |
| Managed node via ProxyJump | PASS (`ip-172-31-1-68`); Nginx was `inactive` at the time |
| FastAPI bound to `127.0.0.1:8000` | PASS |
| Port 8000 from the internet | Closed (timeout) |
| Tunnel `/health` | PASS |
| FastAPI rejects missing key | PASS (401) |
| Express status through tunnel | PASS (`not_configured` until the token is added) |
| SSH executor detects tools | PASS (Terraform 1.17.2, Ansible core 2.16.3, Puppet 8.4.0; Nagios not installed) |
| Ansible `--syntax-check` on EC2 | PASS |
| Terraform `init` / `validate` / `plan` (`local-lab`) on EC2 | PASS (plan saved and hashed remotely; **not applied**) |
| Workflow run on EC2 | Terraform ×3 and Ansible ×2 PASS; `puppet agent --noop` FAIL: no Puppet server (`puppet:8140` unresolvable) |
| Deploy / rollback | Not executed (needs your approval) |
| Authenticated status (`ready`) | Pending: add `CODIGOFLOW_API_TOKEN` |
