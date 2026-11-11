#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl python3 nginx
mkdir -p /opt/codigoflow/app /opt/codigoflow/lab
echo "codigoflow-ok" > /opt/codigoflow/app/health.txt
cat >/opt/codigoflow/app/index.html <<'HTML'
<!DOCTYPE html><html><head><title>CódigoFlow Lab App</title></head>
<body><h1>CódigoFlow Lab App</h1><p>Provisioned by lab bootstrap.</p></body></html>
HTML
echo "desired_state=enforced" > /opt/codigoflow/lab/managed.conf
echo "app bootstrap complete"
