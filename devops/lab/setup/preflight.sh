#!/usr/bin/env bash
# Control-node preflight — run inside WSL/Ubuntu or the management VM.
set -euo pipefail

check() {
  local name="$1"
  shift
  if command -v "$name" >/dev/null 2>&1; then
    echo "OK  $name: $($* 2>&1 | head -n 1)"
  else
    echo "MISS $name"
  fi
}

check terraform terraform version
check ansible ansible --version
check ansible-playbook ansible-playbook --version
check puppet puppet --version
check nagios nagios -V || true
echo "SSH agent: ${SSH_AUTH_SOCK:-not set}"
echo "Done. Missing tools must be installed with explicit operator approval."
