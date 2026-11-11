#!/usr/bin/env bash
# Validate Nagios configuration when nagios binary is available.
set -euo pipefail
CFG="${NAGIOS_CFG:-/usr/local/nagios/etc/nagios.cfg}"
if ! command -v nagios >/dev/null 2>&1; then
  echo "nagios binary not found on PATH"
  exit 1
fi
nagios -v "$CFG"
