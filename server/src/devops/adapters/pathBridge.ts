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
