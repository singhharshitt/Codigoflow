import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createError } from '../../middleware/errorHandler';
import { DOCKER_DEFAULT_TIMEOUT_MS } from '../../config';
import { getRepository } from '../../services/repositoryService';

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

async function runDocker(
  args: string[],
  timeoutMs = DOCKER_DEFAULT_TIMEOUT_MS,
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args, {
      shell: false,
      cwd,
      windowsHide: true,
    });
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
    return {
      available: false,
      error: result.stderr.trim() || 'Docker daemon not running',
    };
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
      return {
        id: id ?? '',
        name: name ?? '',
        image: image ?? '',
        status: status ?? '',
        state: state ?? '',
        ports: ports ?? '',
        created: created ?? '',
      };
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
      return {
        id: id ?? '',
        repository: repository ?? '',
        tag: tag ?? '',
        size: size ?? '',
        created: created ?? '',
      };
    });
}

export async function inspectContainer(containerId: string): Promise<unknown> {
  assertContainerId(containerId);
  const result = await runDocker(['inspect', containerId]);
  if (result.exitCode !== 0) {
    throw createError(result.stderr || 'Inspect failed', 404, 'CONTAINER_NOT_FOUND');
  }
  try {
    return JSON.parse(result.stdout)[0];
  } catch {
    return { raw: result.stdout };
  }
}

const ALLOWED_CONTAINER_ACTIONS = new Set(['start', 'stop', 'restart']);

function assertContainerId(containerId: string): void {
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(containerId)) {
    throw createError('Invalid container identifier', 400, 'INVALID_CONTAINER_ID');
  }
}

export async function containerAction(
  containerId: string,
  action: string,
): Promise<{ success: boolean; output: string }> {
  if (!ALLOWED_CONTAINER_ACTIONS.has(action)) {
    return { success: false, output: `Action '${action}' is not permitted` };
  }
  assertContainerId(containerId);

  const known = await listContainers(true);
  if (!known.some((c) => c.id === containerId || c.name === containerId || c.id.startsWith(containerId))) {
    // Still attempt — Docker may know short IDs not in formatted list edge cases
  }

  const result = await runDocker([action, containerId]);
  return {
    success: result.exitCode === 0,
    output: (result.stdout + result.stderr).trim(),
  };
}

export async function getContainerLogs(containerId: string, tail = 100): Promise<string> {
  assertContainerId(containerId);
  const result = await runDocker(
    ['logs', '--tail', String(Math.min(tail, 500)), containerId],
    20_000,
  );
  return result.stdout + result.stderr;
}

export async function buildImage(input: {
  repositoryId: string;
  dockerfile?: string;
  context?: string;
  tag?: string;
}): Promise<{ success: boolean; output: string }> {
  const repo = getRepository(input.repositoryId);
  const contextDir = path.resolve(repo.path, input.context || '.');
  if (!contextDir.startsWith(path.resolve(repo.path))) {
    throw createError('Build context must stay inside the registered repository', 400, 'INVALID_CONTEXT');
  }
  const dockerfile = path.resolve(contextDir, input.dockerfile || 'Dockerfile');
  if (!dockerfile.startsWith(path.resolve(repo.path))) {
    throw createError('Dockerfile path must stay inside the registered repository', 400, 'INVALID_DOCKERFILE');
  }
  if (!fs.existsSync(dockerfile)) {
    throw createError('Dockerfile not found', 400, 'DOCKERFILE_NOT_FOUND');
  }

  const tag = input.tag || `codigoflow/${repo.name.toLowerCase()}:latest`;
  if (!/^[a-z0-9._\/:-]+$/i.test(tag)) {
    throw createError('Invalid image tag', 400, 'INVALID_TAG');
  }

  const result = await runDocker(
    ['build', '-f', dockerfile, '-t', tag, contextDir],
    300_000,
  );
  return {
    success: result.exitCode === 0,
    output: (result.stdout + result.stderr).trim(),
  };
}

export async function composeAction(input: {
  repositoryId: string;
  file?: string;
  action: 'up' | 'down' | 'ps';
}): Promise<{ success: boolean; output: string }> {
  const repo = getRepository(input.repositoryId);
  const file = path.resolve(repo.path, input.file || 'docker-compose.yml');
  if (!file.startsWith(path.resolve(repo.path))) {
    throw createError('Compose file must stay inside the registered repository', 400, 'INVALID_COMPOSE_FILE');
  }
  if (!fs.existsSync(file)) {
    throw createError('Compose file not found', 400, 'COMPOSE_NOT_FOUND');
  }

  const args =
    input.action === 'up'
      ? ['compose', '-f', file, 'up', '-d']
      : input.action === 'down'
        ? ['compose', '-f', file, 'down']
        : ['compose', '-f', file, 'ps'];

  const result = await runDocker(args, 180_000, repo.path);
  return {
    success: result.exitCode === 0,
    output: (result.stdout + result.stderr).trim(),
  };
}
