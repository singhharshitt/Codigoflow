import path from 'path';
import fs from 'fs';
import { getControlNodeStatus } from '../adapters';
import { detectDevOpsTools } from './toolDetection';

export async function runDevOpsPreflight() {
  const control = await getControlNodeStatus(true);
  const tools = await detectDevOpsTools(true);

  const devopsRoot = path.resolve(process.cwd(), process.env.DEVOPS_ROOT || '../devops');
  // When cwd is server/, ../devops is repo/devops
  const altRoot = path.resolve(__dirname, '../../../../devops');
  const root = fs.existsSync(devopsRoot) ? devopsRoot : altRoot;

  const workspace = {
    root,
    exists: fs.existsSync(root),
    terraform: fs.existsSync(path.join(root, 'terraform')),
    ansible: fs.existsSync(path.join(root, 'ansible')),
    puppet: fs.existsSync(path.join(root, 'puppet')),
    nagios: fs.existsSync(path.join(root, 'nagios')),
    lab: fs.existsSync(path.join(root, 'lab')),
  };

  const required = ['terraform', 'ansible', 'puppet', 'nagios'];
  const missing = required.filter((name) => !tools.find((t) => t.name === name)?.available);

  return {
    control,
    tools,
    workspace,
    ready: control.available && missing.length === 0,
    missing,
    notes: [
      'CódigoFlow never auto-installs packages; approve setup scripts manually.',
      'On Windows 11, prefer WSL2 Ubuntu as the DevOps control node.',
      'Set DEVOPS_EXECUTION_MODE=auto|wsl|ssh|native and optional DEVOPS_WSL_DISTRO / DEVOPS_SSH_* vars.',
    ],
  };
}

export function getDevOpsWorkspaceRoot(): string {
  const devopsRoot = path.resolve(process.cwd(), process.env.DEVOPS_ROOT || '../devops');
  const altRoot = path.resolve(__dirname, '../../../../devops');
  return fs.existsSync(devopsRoot) ? devopsRoot : altRoot;
}
