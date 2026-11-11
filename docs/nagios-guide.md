# Nagios Guide

## Install options

1. **Package** (distribution dependent) — verify package name for your Ubuntu release.
2. **Source compilation** — common in coursework; follow official Nagios Core docs, verify release checksums, and do not pipe unverified scripts to bash.

## CódigoFlow integration

- Sample objects: `devops/nagios/objects/`
- Plugins: `check_codigoflow_http.py`, `check_codigoflow_app.sh`
- Status parsing reads `NAGIOS_STATUS_FILE` or falls back to `status.dat.sample` for UI/dev.

## External commands

Configure `NAGIOS_COMMAND_FILE` for acknowledgements, comments, and downtime. Only allowlisted command names are written.

## Plugin exit codes

| Code | State |
|---|---|
| 0 | OK |
| 1 | WARNING |
| 2 | CRITICAL |
| 3 | UNKNOWN |
