#!/usr/bin/env bash
# Verify installed DevOps tools with non-destructive checks.
set -euo pipefail

# devops/lab/setup -> devops/
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_LOCAL="${ROOT}/terraform/local-lab"
ANS="${ROOT}/ansible"

fail=0

pass() { echo "PASS  $*"; }
fail_msg() { echo "FAIL  $*"; fail=$((fail + 1)); }

echo "=== CódigoFlow DevOps verification ==="
echo "Repo devops root: ${ROOT}"

if command -v terraform >/dev/null 2>&1; then
  pass "terraform $(terraform version | head -1)"
  if [[ -d "${TF_LOCAL}" ]]; then
    (
      cd "${TF_LOCAL}"
      terraform fmt -check -recursive >/dev/null && pass "terraform fmt (local-lab)" || fail_msg "terraform fmt"
      terraform init -backend=false -input=false >/dev/null && pass "terraform init (local-lab)" || fail_msg "terraform init"
      terraform validate >/dev/null && pass "terraform validate (local-lab)" || fail_msg "terraform validate"
      terraform plan -input=false -no-color >/tmp/cf-tf-plan.txt && pass "terraform plan (local-lab)" || fail_msg "terraform plan"
    )
  else
    fail_msg "local-lab terraform project missing"
  fi
else
  fail_msg "terraform not installed"
fi

if command -v ansible-playbook >/dev/null 2>&1; then
  pass "ansible-playbook $(ansible-playbook --version | head -1)"
  if [[ -f "${ANS}/playbooks/health-check.yml" ]]; then
    ansible-playbook --syntax-check "${ANS}/playbooks/health-check.yml" >/dev/null \
      && pass "ansible syntax-check health-check.yml" \
      || fail_msg "ansible syntax-check"
  fi
  if [[ -f "${ANS}/inventory/lab.ini" ]]; then
    ansible-inventory -i "${ANS}/inventory/lab.ini" --list >/dev/null \
      && pass "ansible-inventory lab.ini" \
      || fail_msg "ansible-inventory"
  fi
else
  fail_msg "ansible-playbook not installed"
fi

if command -v puppet >/dev/null 2>&1; then
  pass "puppet $(puppet --version)"
  if [[ -f "${ROOT}/puppet/manifests/site_lab.pp" ]]; then
    # MODULEPATH so classes resolve when validating includes
    puppet parser validate "${ROOT}/puppet/manifests/site_lab.pp" \
      && pass "puppet parser validate site_lab.pp" \
      || fail_msg "puppet parser validate"
  fi
else
  fail_msg "puppet not installed"
fi

if command -v nagios >/dev/null 2>&1 || command -v nagios4 >/dev/null 2>&1; then
  pass "nagios binary present"
else
  fail_msg "nagios binary not installed (sample status parsing may still work in CódigoFlow)"
fi

echo
if [[ "${fail}" -eq 0 ]]; then
  echo "All verification checks passed."
  exit 0
fi
echo "${fail} verification check(s) failed."
exit 1
