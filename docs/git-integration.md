# Git Integration

## Execution model

- Binary: `git` from PATH
- API: `child_process.spawn` with `shell: false`
- Working directory: registered repository absolute path only
- Allowlisted subcommands only (`status`, `diff`, `add`, `commit`, `push`, `checkout`, …)
- Per-repo mutex prevents concurrent mutating operations

## Safety

- No path traversal (`..`)
- Explicit file lists for stage/unstage (never stage-all by default)
- Commit/push confirmation is expected from the UI before the request is sent
- Remote URLs are sanitized before logging
- Sensitive filenames are detected and logged as warnings

## Testing

Unit/integration tests create temporary repositories under the OS temp directory and never touch the CódigoFlow working tree.
