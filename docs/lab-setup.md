# Lab Setup (Windows 11)

## Path A — Existing Ubuntu VM / WSL2

1. Enable WSL2 Ubuntu (or use an Ubuntu control VM).
2. Install tools per the individual guides (Terraform, Ansible, Puppet, Nagios).
3. Set backend env:

```env
DEVOPS_EXECUTION_MODE=wsl
# or
DEVOPS_EXECUTION_MODE=ssh
DEVOPS_SSH_HOST=192.168.56.10
DEVOPS_SSH_USER=vagrant
DEVOPS_SSH_KEY_PATH=C:/Users/you/.ssh/id_ed25519
```

4. Open **DevOps → Lab Environment** and run preflight.
5. Point Ansible inventory at your hosts (`devops/ansible/inventory/lab.ini` or `devops/lab/inventory/vagrant.ini`).

## Path B — Optional Vagrant lab

Prerequisites (install yourself): VirtualBox, Vagrant.

```bash
cd devops/lab
vagrant up
```

Default IPs: mgmt `192.168.56.10`, app `192.168.56.11`.

Memory/CPU overrides: `CF_MGMT_MEMORY`, `CF_APP_MEMORY`, `CF_MGMT_CPUS`, `CF_APP_CPUS`.

## Install tools in WSL Ubuntu (operator approved)

From Windows PowerShell (review the printed plan first):

```powershell
wsl -d Ubuntu -- bash -lc "cd /mnt/d/Codigoflow/devops/lab/setup && chmod +x *.sh && ./install-devops-tools.sh"
# After reviewing the plan:
wsl -d Ubuntu -- bash -lc "cd /mnt/d/Codigoflow/devops/lab/setup && CONFIRM=yes COMPONENTS=terraform,ansible,puppet-agent ./install-devops-tools.sh"
wsl -d Ubuntu -- bash -lc "cd /mnt/d/Codigoflow/devops/lab/setup && ./preflight.sh; ./verify-devops-tools.sh"
```

Nagios Core is optional in the default component list because package availability varies; add `nagios` to `COMPONENTS` only after reviewing apt packages for your Ubuntu release.

Vagrant/VirtualBox are **not** installed by these scripts. If WSL service limits block Puppet Server or Nagios, use a separate Ubuntu control VM (Path B).

## Checklist

- [ ] Control node reachable (WSL/SSH/native)
- [ ] `terraform version`
- [ ] `ansible --version`
- [ ] `puppet --version` (and server if using master/agent)
- [ ] Nagios status file / plugins configured
- [ ] SSH key auth working; host keys verified
- [ ] `DEVOPS_API_TOKEN` set for non-local or production use
- [ ] No production credentials in the repo
