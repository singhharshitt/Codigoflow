#!/usr/bin/env bash
# Nagios plugin: verify CódigoFlow sample app marker/process.
set -euo pipefail

APP_ROOT="${CODIGOFLOW_APP_ROOT:-/opt/codigoflow/app}"
MARKER="${APP_ROOT}/health.txt"
PORT="${CODIGOFLOW_APP_PORT:-8080}"

if [[ ! -d "$APP_ROOT" ]]; then
  echo "CRITICAL - app root missing: $APP_ROOT"
  exit 2
fi

if [[ ! -f "$MARKER" ]]; then
  echo "WARNING - health marker missing: $MARKER"
  exit 1
fi

CONTENT="$(tr -d '\r\n' < "$MARKER" || true)"
if [[ "$CONTENT" != "codigoflow-ok" ]]; then
  echo "WARNING - unexpected marker content: $CONTENT"
  exit 1
fi

if command -v curl >/dev/null 2>&1; then
  if ! curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/health.txt" >/dev/null 2>&1; then
    # Marker exists but HTTP may be down — still useful signal
    echo "WARNING - marker ok but HTTP :${PORT} unreachable"
    exit 1
  fi
fi

echo "OK - codigoflow app marker present and reachable"
exit 0
