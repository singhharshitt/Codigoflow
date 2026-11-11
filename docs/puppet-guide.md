# Puppet Guide

## Install overview

Install Puppet Agent on managed nodes and Puppet Server on the management node using current Puppet platform packages for Ubuntu LTS. Verify versions with:

```bash
puppet --version
puppetserver --version   # on server
```

## CódigoFlow modules

- `codigoflow_base` — packages, user, directories
- `codigoflow_web` — nginx baseline
- `codigoflow_app` — app markers + `codigoflow_app::drift` lab file

## Drift experiment

1. Apply `manifests/site_lab.pp` (or include `codigoflow_app::drift`).
2. Modify `/opt/codigoflow/lab/managed.conf` intentionally.
3. Run no-op / drift preview.
4. Approve apply to restore declared content.

## Certificates

List pending requests, verify node identity, then sign **one** certname via API with `approve: true`. Never auto-sign all.
