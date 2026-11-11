#!/usr/bin/env bash
# CódigoFlow — install DevOps tools on Ubuntu control node (WSL or VM).
# Idempotent. Requires explicit CONFIRM=yes. Never prints credentials.
#
# Usage:
#   ./install-devops-tools.sh                 # print plan only
#   CONFIRM=yes ./install-devops-tools.sh     # execute planned installs
#   CONFIRM=yes COMPONENTS=terraform,ansible ./install-devops-tools.sh
set -euo pipefail

COMPONENTS="${COMPONENTS:-terraform,ansible,puppet-agent}"
CONFIRM="${CONFIRM:-no}"

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

. /etc/os-release
CODENAME="${VERSION_CODENAME:-}"
echo "=== CódigoFlow DevOps installation plan ==="
echo "OS: ${PRETTY_NAME:-unknown} (${CODENAME})"
echo "Components: ${COMPONENTS}"
echo "Privileged executor: ${SUDO:-root}"
echo
echo "Planned actions:"
IFS=',' read -r -a PARTS <<< "${COMPONENTS}"
for c in "${PARTS[@]}"; do
  case "$c" in
    terraform)
      echo "  - Add HashiCorp apt repo (signed) and install package: terraform"
      ;;
    ansible)
      echo "  - apt install: ansible (distro package)"
      ;;
    puppet-agent)
      echo "  - Add Puppet platform apt repo for ${CODENAME} (if available) and install puppet-agent"
      echo "  - Puppet Server is NOT installed by default (heavy; see docs/puppet-guide.md)"
      ;;
    nagios)
      echo "  - apt install: nagios4 nagios-plugins-basic (if available on this release)"
      echo "  - Otherwise print manual source-build guidance (no auto compile)"
      ;;
    *)
      echo "  - UNKNOWN component: $c"
      exit 1
      ;;
  esac
done
echo
echo "This script does not install VirtualBox/Vagrant on Windows."
echo "This script does not fetch unsigned 'latest' installer scripts."
echo

if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Dry-run only. Re-run with CONFIRM=yes to apply."
  exit 0
fi

export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -y
$SUDO apt-get install -y ca-certificates curl gnupg unzip software-properties-common

install_terraform() {
  if command -v terraform >/dev/null 2>&1; then
    echo "terraform already present: $(terraform version | head -1)"
    return 0
  fi
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://apt.releases.hashicorp.com/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/hashicorp-archive-keyring.gpg
  $SUDO chmod a+r /etc/apt/keyrings/hashicorp-archive-keyring.gpg
  echo "deb [signed-by=/etc/apt/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com ${CODENAME} main" \
    | $SUDO tee /etc/apt/sources.list.d/hashicorp.list >/dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y terraform
  terraform version
}

install_ansible() {
  if command -v ansible >/dev/null 2>&1 && command -v ansible-playbook >/dev/null 2>&1; then
    echo "ansible already present: $(ansible --version | head -1)"
    return 0
  fi
  $SUDO apt-get install -y ansible
  ansible --version | head -1
}

install_puppet_agent() {
  if command -v puppet >/dev/null 2>&1; then
    echo "puppet already present: $(puppet --version)"
    return 0
  fi
  # Official Puppet 8 apt source for Ubuntu
  local deb="puppet8-release-${CODENAME}.deb"
  local url="https://apt.puppet.com/${deb}"
  local tmp
  tmp="$(mktemp -d)"
  echo "Downloading ${url}"
  if ! curl -fsSL -o "${tmp}/${deb}" "${url}"; then
    echo "ERROR: Puppet apt release package not available for ${CODENAME}."
    echo "Install puppet-agent manually per https://www.puppet.com/docs/puppet/latest/install_agents.html"
    rm -rf "${tmp}"
    return 1
  fi
  $SUDO dpkg -i "${tmp}/${deb}"
  $SUDO apt-get update -y
  $SUDO apt-get install -y puppet-agent
  # Ensure puppet on PATH for non-login shells
  if [[ -x /opt/puppetlabs/bin/puppet ]]; then
    $SUDO ln -sfn /opt/puppetlabs/bin/puppet /usr/local/bin/puppet
  fi
  puppet --version
  rm -rf "${tmp}"
}

install_nagios() {
  if command -v nagios >/dev/null 2>&1 || command -v nagios4 >/dev/null 2>&1; then
    echo "nagios already present"
    return 0
  fi
  if apt-cache show nagios4 >/dev/null 2>&1; then
    $SUDO apt-get install -y nagios4 nagios-plugins-basic || {
      echo "ERROR: nagios4 package install failed. See docs/nagios-guide.md for source build."
      return 1
    }
  else
    echo "ERROR: nagios4 package not in apt cache for this release."
    echo "Use source build instructions in docs/nagios-guide.md (verify checksums)."
    return 1
  fi
}

for c in "${PARTS[@]}"; do
  case "$c" in
    terraform) install_terraform ;;
    ansible) install_ansible ;;
    puppet-agent) install_puppet_agent ;;
    nagios) install_nagios ;;
  esac
done

echo
echo "Installation pass complete. Run verify-devops-tools.sh next."
