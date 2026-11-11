#!/usr/bin/env bash
# Management VM bootstrap — installs tooling with explicit apt packages.
# Review before running. Does not download unverified "latest" installers.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg software-properties-common python3 python3-pip unzip

# Terraform — HashiCorp apt repo (pinned major channel)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /etc/apt/keyrings/hashicorp-archive-keyring.gpg
chmod a+r /etc/apt/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(. /etc/os-release && echo "$VERSION_CODENAME") main" \
  > /etc/apt/sources.list.d/hashicorp.list
apt-get update
apt-get install -y terraform

# Ansible
apt-get install -y ansible

# Puppet agent (server optional — install separately when resources allow)
if ! command -v puppet >/dev/null 2>&1; then
  echo "Install Puppet Agent/Server from official Puppet apt repositories when ready."
  echo "See docs/puppet-guide.md — do not auto-sign certificates."
fi

# Nagios Core is typically compiled from source for course coverage.
echo "Nagios Core: follow docs/nagios-guide.md (package or source build)."

terraform version
ansible --version | head -n 1
echo "mgmt bootstrap complete"
