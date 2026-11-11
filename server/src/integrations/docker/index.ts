import { spawn } from 'child_process';
import { logger } from '../../utils/logger';

export interface DockerStatus {
  available: boolean;
  version?: string;
  error?: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
}

export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

async function runDocker(args: string[], timeoutMs = 15000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args, { shell: false });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr, exitCode: 1 });
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        resolve({ stdout: '', stderr: 'Docker not found', exitCode: 1 });
      } else {
        reject(err);
      }
    });
  });
}

export async function getDockerStatus(): Promise<DockerStatus> {
  try {
    const result = await runDocker(['version', '--format', '{{.Server.Version}}']);
    if (result.exitCode === 0) {
      return { available: true, version: result.stdout.trim() };
    }
    return { available: false, error: result.stderr.trim() || 'Docker daemon not running' };
  } catch (err) {
    return { available: false, error: String(err) };
  }
}

export async function listContainers(all = true): Promise<ContainerInfo[]> {
  const args = [
    'ps',
    '--format',
    '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}|{{.CreatedAt}}',
  ];
  if (all) args.push('--all');

  const result = await runDocker(args);
  if (result.exitCode !== 0) return [];

  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, name, image, status, state, ports, created] = line.split('|');
      return { id: id ?? '', name: name ?? '', image: image ?? '', status: status ?? '', state: state ?? '', ports: ports ?? '', created: created ?? '' };
    });
}

export async function listImages(): Promise<ImageInfo[]> {
  const result = await runDocker([
    'images',
    '--format',
    '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}',
  ]);
  if (result.exitCode !== 0) return [];

  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, repository, tag, size, created] = line.split('|');
      return { id: id ?? '', repository: repository ?? '', tag: tag ?? '', size: size ?? '', created: created ?? '' };
    });
}

const ALLOWED_CONTAINER_ACTIONS = new Set(['start', 'stop']);

export async function containerAction(
  containerId: string,
  action: string,
): Promise<{ success: boolean; output: string }> {
  if (!ALLOWED_CONTAINER_ACTIONS.has(action)) {
    return { success: false, output: `Action '${action}' is not permitted` };
  }

  // Validate container ID format (hex chars or names)
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(containerId)) {
    return { success: false, output: 'Invalid container identifier' };
  }

  const result = await runDocker([action, containerId]);
  return {
    success: result.exitCode === 0,
    output: (result.stdout + result.stderr).trim(),
  };
}

export async function getContainerLogs(containerId: string, tail = 100): Promise<string> {
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(containerId)) {
    throw new Error('Invalid container identifier');
  }

  const result = await runDocker(['logs', '--tail', String(Math.min(tail, 500)), containerId], 20000);
  return result.stdout + result.stderr;
}
