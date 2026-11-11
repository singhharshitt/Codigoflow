export type ExecutionMode = 'native' | 'wsl' | 'ssh';

export interface ExecRequest {
  /** Fixed executable name (no path separators from user input). */
  executable: string;
  /** Argument array — never shell-concatenated. */
  args: string[];
  /** Absolute working directory on the execution host. */
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  /** Max captured output characters (stdout+stderr). */
  maxOutputChars?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
  mode: ExecutionMode;
  commandSummary: string;
}

export interface ControlNodeInfo {
  mode: ExecutionMode;
  available: boolean;
  detail: string;
  distro?: string;
  host?: string;
}

export interface ToolDetection {
  name: string;
  available: boolean;
  version?: string;
  path?: string;
  mode?: ExecutionMode;
  error?: string;
  installHint?: string;
}

export interface DevOpsExecutor {
  readonly mode: ExecutionMode;
  probe(): Promise<ControlNodeInfo>;
  run(req: ExecRequest): Promise<ExecResult>;
  which(executable: string): Promise<string | null>;
}
