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

## Checklist

- [ ] Control node reachable (WSL/SSH/native)
- [ ] `terraform version`
- [ ] `ansible --version`
- [ ] `puppet --version` (and server if using master/agent)
- [ ] Nagios status file / plugins configured
- [ ] SSH key auth working; host keys verified
- [ ] No production credentials in the repo
