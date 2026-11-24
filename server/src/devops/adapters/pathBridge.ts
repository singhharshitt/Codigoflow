/**
 * Translate Windows host paths for WSL execution.
 * Example: D:\Codigoflow\devops\aws -> /mnt/d/Codigoflow/devops/aws
 */
export function windowsPathToWsl(winPath: string): string {
  const normalized = winPath.trim();
  const match = normalized.match(/^([A-Za-z]):[/\\](.*)$/);
  if (!match) {
    return normalized.includes('\\') ? normalized.replace(/\\/g, '/') : normalized;
  }
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\/g, '/');
  return `/mnt/${drive}/${rest}`;
}

/** Translate cwd and absolute Windows path arguments for WSL. */
export function translateRequestPathsForWsl(input: {
  cwd?: string;
  args: string[];
}): { cwd?: string; args: string[] } {
  return {
    cwd: input.cwd ? windowsPathToWsl(input.cwd) : undefined,
    args: input.args.map(translateArgForWsl),
  };
}

function translateArgForWsl(arg: string): string {
  const eq = arg.indexOf('=');
  if (eq > 0) {
    const key = arg.slice(0, eq);
    const val = arg.slice(eq + 1);
    if (looksLikeWindowsAbsolutePath(val)) {
      return `${key}=${windowsPathToWsl(val)}`;
    }
  }
  if (looksLikeWindowsAbsolutePath(arg)) {
    return windowsPathToWsl(arg);
  }
  return arg;
}

function looksLikeWindowsAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(value);
}

/**
 * Map a host path under the local devops root to the same relative path under
 * a remote root (SSH control node). Paths outside the local root are returned
 * unchanged so the remote side reports an honest "not found".
 * Example: D:\Codigoflow\devops\ansible -> /home/ubuntu/Codigoflow/devops/ansible
 */
export function mapLocalPathToRemote(p: string, localRoot: string, remoteRoot: string): string {
  const norm = (v: string) => v.replace(/\\/g, '/').replace(/\/+$/, '');
  const local = norm(localRoot);
  const value = norm(p);
  const remote = remoteRoot.replace(/\/+$/, '');
  const caseInsensitive = /^[A-Za-z]:\//.test(local);
  const hay = caseInsensitive ? value.toLowerCase() : value;
  const needle = caseInsensitive ? local.toLowerCase() : local;
  if (hay === needle) return remote;
  if (hay.startsWith(`${needle}/`)) return `${remote}/${value.slice(local.length + 1)}`;
  return p;
}

/** Translate cwd and absolute path arguments for an SSH control node. */
export function translateRequestPathsForSsh(
  input: { cwd?: string; args: string[] },
  localRoot: string,
  remoteRoot: string | undefined,
): { cwd?: string; args: string[] } {
  if (!remoteRoot) return input;
  const mapValue = (v: string) =>
    looksLikeWindowsAbsolutePath(v) || v.startsWith('/') ? mapLocalPathToRemote(v, localRoot, remoteRoot) : v;
  return {
    cwd: input.cwd ? mapLocalPathToRemote(input.cwd, localRoot, remoteRoot) : undefined,
    args: input.args.map((arg) => {
      // key=value / --flag=value: translate only the value side.
      const eq = arg.indexOf('=');
      if (eq > 0) return `${arg.slice(0, eq)}=${mapValue(arg.slice(eq + 1))}`;
      return mapValue(arg);
    }),
  };
}

/**
 * OpenSSH joins remote argv into ONE string that the remote login shell parses.
 * Single-quote every element so "$1"/"$@", spaces and globs survive intact.
 */
export function quoteForRemoteShell(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}
