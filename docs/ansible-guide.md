# Ansible Guide

## Install

```bash
sudo apt-get update
sudo apt-get install -y ansible
ansible --version
```

## Project layout

`devops/ansible` contains inventory, playbooks, roles, and `ansible.cfg`.

Recommended sequence:

1. Validate inventory
2. Ping / facts
3. Playbook syntax check
4. Check mode (`--check --diff`)
5. Approve and run deploy playbooks

## Safe ad-hoc modules

Allowlisted: `ping`, `setup`, and shell commands `uptime`, `df -h`, `whoami`, `uname -a`.

Arbitrary remote shell from the browser is blocked.
