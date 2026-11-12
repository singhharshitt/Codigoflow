# Terraform Guide

## Install (Ubuntu / WSL2)

Follow HashiCorp's current install docs, or use the management bootstrap script after review:

```bash
# Example Ubuntu apt channel (verify key/fingerprint before use)
sudo apt-get update && sudo apt-get install -y terraform
terraform version
```

## CódigoFlow AWS lab module

Path: `devops/terraform/aws`

1. Copy `terraform.tfvars.example` to a local ignored `terraform.tfvars`.
2. Set AMI, VPC, subnet, key pair, and a **non-global** SSH CIDR.
3. From the UI or API: fmt → init → validate → plan → approve → apply saved plan.
4. Read outputs for Ansible inventory (sensitive values are filtered).

## API

- `GET /api/devops/terraform/status`
- `POST /api/devops/terraform/plan`
- `POST /api/devops/terraform/plans/:id/approve`
- `POST /api/devops/terraform/apply` with `{ "planId", "approve": true }`

Destroy is disabled unless `DEVOPS_TF_DESTROY_ENABLED=true` and requires a separate explicit approval path — do not treat apply approval as destroy approval.

## AWS authentication (control node)

Prefer an **IAM instance role** on the Linux control node (or short-lived credentials injected into that environment). CódigoFlow does not require permanent AWS access keys in the app or browser. Provider credentials remain outside the frontend.

## Troubleshooting

- On Windows, Terraform must run via WSL/SSH control node (`DEVOPS_EXECUTION_MODE=wsl|ssh`).
- Missing credentials → plan/apply fail honestly; never fabricate resources.
