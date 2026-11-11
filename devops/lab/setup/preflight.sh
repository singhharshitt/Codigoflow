#!/usr/bin/env bash
# Control-node preflight — run inside WSL/Ubuntu or the management VM.
set -euo pipefail

ok=0
miss=0

check_cmd() {
  local name="$1"
  shift
  if command -v "$name" >/dev/null 2>&1; then
    local out
    out="$("$@" 2>&1 | head -n 1 | tr -d '\0')"
    echo "OK   ${name}: ${out}"
    ok=$((ok + 1))
  else
    echo "MISS ${name}"
    miss=$((miss + 1))
  fi
}

echo "=== CódigoFlow DevOps preflight ==="
if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "OS: ${PRETTY_NAME:-unknown}"
fi
echo "Kernel: $(uname -r)"
echo -n "systemd: "
systemctl is-system-running 2>&1 | head -n 1 || true
echo

check_cmd git git --version
check_cmd python3 python3 --version
check_cmd ssh ssh -V
check_cmd curl curl --version
check_cmd terraform terraform version
check_cmd ansible ansible --version
check_cmd ansible-playbook ansible-playbook --version
check_cmd puppet puppet --version
if command -v puppetserver >/dev/null 2>&1; then
  check_cmd puppetserver puppetserver --version
else
  echo "MISS puppetserver (optional for master/agent lab)"
  miss=$((miss + 1))
fi
if command -v nagios >/dev/null 2>&1; then
  check_cmd nagios nagios -V
elif command -v nagios4 >/dev/null 2>&1; then
  check_cmd nagios4 nagios4 -V
else
  echo "MISS nagios"
  miss=$((miss + 1))
fi

echo
echo "SSH agent: ${SSH_AUTH_SOCK:-not set}"
echo "Summary: ${ok} ok, ${miss} missing"
echo "Missing tools must be installed with explicit operator approval (install-devops-tools.sh)."
[[ "${miss}" -eq 0 ]]
