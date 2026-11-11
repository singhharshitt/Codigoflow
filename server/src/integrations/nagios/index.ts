import fs from 'fs';
import path from 'path';
import { runDevOps } from '../../devops/adapters';
import { getDevOpsWorkspaceRoot } from '../../devops/services/preflight';
import { detectDevOpsTools } from '../../devops/services/toolDetection';
import { createError } from '../../middleware/errorHandler';

function nagiosRoot() {
  return path.join(getDevOpsWorkspaceRoot(), 'nagios');
}

/** Parse a subset of Nagios status.dat / object-style define blocks into hosts/services. */
export function parseStatusDat(content: string) {
  const hosts: Record<string, string>[] = [];
  const services: Record<string, string>[] = [];
  const re =
    /(?:^|\n)\s*(?:define\s+)?(host|service)(?:status)?\s*\{([\s\S]*?)\}/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    const fields: Record<string, string> = {};
    for (const line of match[2].split('\n')) {
      const m = line.trim().match(/^([a-zA-Z0-9_]+)\s+(.+)$/);
      if (m) fields[m[1]] = m[2].trim();
    }
    if (type === 'host') hosts.push(fields);
    if (type === 'service') services.push(fields);
  }
  return { hosts, services };
}

function mapHostState(code: string | undefined) {
  switch (code) {
    case '0':
      return 'UP';
    case '1':
      return 'DOWN';
    case '2':
      return 'UNREACHABLE';
    default:
      return 'UNKNOWN';
  }
}

function mapServiceState(code: string | undefined) {
  switch (code) {
    case '0':
      return 'OK';
    case '1':
      return 'WARNING';
    case '2':
      return 'CRITICAL';
    case '3':
      return 'UNKNOWN';
    default:
      return 'UNKNOWN';
  }
}

export async function getNagiosStatus() {
  const tools = await detectDevOpsTools();
  const nagios = tools.find((t) => t.name === 'nagios');
  const statusFile =
    process.env.NAGIOS_STATUS_FILE ||
    path.join(nagiosRoot(), 'config', 'status.dat.sample');

  return {
    available: Boolean(nagios?.available) || fs.existsSync(statusFile),
    version: nagios?.version,
    mode: nagios?.mode,
    error: nagios?.error,
    installHint: nagios?.installHint,
    statusFile,
    statusFileExists: fs.existsSync(statusFile),
  };
}

export function readNagiosStatus() {
  const statusFile =
    process.env.NAGIOS_STATUS_FILE ||
    path.join(nagiosRoot(), 'config', 'status.dat.sample');
  if (!fs.existsSync(statusFile)) {
    throw createError(
      'Nagios status file not found. Set NAGIOS_STATUS_FILE or install Nagios Core.',
      503,
      'NAGIOS_STATUS_MISSING',
    );
  }
  const raw = fs.readFileSync(statusFile, 'utf8');
  const parsed = parseStatusDat(raw);
  return {
    statusFile,
    hosts: parsed.hosts.map((h) => ({
      ...h,
      stateLabel: mapHostState(h.current_state),
      soft: h.state_type === '0',
      hard: h.state_type === '1',
    })),
    services: parsed.services.map((s) => ({
      ...s,
      stateLabel: mapServiceState(s.current_state),
      soft: s.state_type === '0',
      hard: s.state_type === '1',
    })),
  };
}

export function listPlugins() {
  const dir = path.join(nagiosRoot(), 'plugins');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('.'))
    .map((f) => ({ name: f, path: path.join(dir, f) }));
}

export async function runPlugin(name: string, args: string[] = []) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw createError('Invalid plugin name', 400, 'INVALID_PLUGIN');
  }
  const pluginPath = path.join(nagiosRoot(), 'plugins', name);
  if (!pluginPath.startsWith(path.resolve(nagiosRoot(), 'plugins'))) {
    throw createError('Plugin path forbidden', 403, 'PLUGIN_FORBIDDEN');
  }
  if (!fs.existsSync(pluginPath)) {
    throw createError('Plugin not found', 404, 'PLUGIN_NOT_FOUND');
  }
  // Execute via bash for .sh/.py using allowlisted bash - only fixed plugin path
  const result = await runDevOps({
    executable: 'bash',
    args: [pluginPath, ...args.filter((a) => !/[\0\r\n]/.test(a) && a.length < 200)],
    cwd: path.join(nagiosRoot(), 'plugins'),
    timeoutMs: 30_000,
  });
  return {
    exitCode: result.exitCode,
    state:
      result.exitCode === 0
        ? 'OK'
        : result.exitCode === 1
          ? 'WARNING'
          : result.exitCode === 2
            ? 'CRITICAL'
            : 'UNKNOWN',
    output: result.stdout || result.stderr,
  };
}

const ALLOWED_EXT_CMDS = new Set([
  'ACKNOWLEDGE_HOST_PROBLEM',
  'ACKNOWLEDGE_SVC_PROBLEM',
  'ADD_HOST_COMMENT',
  'ADD_SVC_COMMENT',
  'SCHEDULE_HOST_DOWNTIME',
  'SCHEDULE_SVC_DOWNTIME',
]);

export function writeExternalCommand(command: string, approve: boolean) {
  if (!approve) {
    throw createError('External commands require approve: true', 400, 'CONFIRMATION_REQUIRED');
  }
  const cmdName = command.split(';')[0];
  if (!ALLOWED_EXT_CMDS.has(cmdName)) {
    throw createError('External command not allowlisted', 403, 'NAGIOS_CMD_FORBIDDEN');
  }
  const cmdFile = process.env.NAGIOS_COMMAND_FILE;
  if (!cmdFile) {
    throw createError(
      'NAGIOS_COMMAND_FILE is not configured on the server',
      503,
      'NAGIOS_CMDFILE_MISSING',
    );
  }
  const line = `[${Math.floor(Date.now() / 1000)}] ${command}\n`;
  fs.appendFileSync(cmdFile, line, { encoding: 'utf8' });
  return { written: true, command: cmdName };
}

export async function reloadNagios(approve: boolean) {
  if (!approve) {
    throw createError('Nagios reload requires approve: true', 400, 'CONFIRMATION_REQUIRED');
  }
  const result = await runDevOps({
    executable: 'nagios',
    args: ['-v', process.env.NAGIOS_CFG || '/usr/local/nagios/etc/nagios.cfg'],
    timeoutMs: 30_000,
  });
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'nagios config validation failed', 400, 'NAGIOS_CFG_INVALID');
  }
  return {
    validated: true,
    output: result.stdout || result.stderr,
    note: 'Configuration validated. Service reload must be performed by an approved host operation/script.',
  };
}
