import { EventEmitter } from 'events';

// Capture what WslExecutor hands to child_process.spawn without running wsl.exe.
const spawnCalls: Array<{ cmd: string; args: string[] }> = [];
let nextExit = { code: 0, stdout: '', stderr: '' };

jest.mock('child_process', () => ({
  spawn: (cmd: string, args: string[]) => {
    spawnCalls.push({ cmd, args });
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = () => undefined;
    setImmediate(() => {
      if (nextExit.stdout) proc.stdout.emit('data', Buffer.from(nextExit.stdout));
      if (nextExit.stderr) proc.stderr.emit('data', Buffer.from(nextExit.stderr));
      proc.emit('close', nextExit.code);
    });
    return proc;
  },
}));

import { WslExecutor } from './wslExecutor';

describe('WslExecutor argv', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    nextExit = { code: 0, stdout: 'ok', stderr: '' };
  });

  it('uses --exec so "$1"/"$@" reach bash intact (not expanded by the default shell)', async () => {
    const exec = new WslExecutor('Ubuntu');
    await exec.run({ executable: 'terraform', args: ['validate'], cwd: '/tmp' });

    const { cmd, args } = spawnCalls[0];
    expect(cmd).toBe('wsl');
    expect(args.slice(0, 3)).toEqual(['-d', 'Ubuntu', '--exec']);
    expect(args).not.toContain('--');
    expect(args).toEqual(
      expect.arrayContaining(['bash', '-lc', 'cd "$1" && shift && exec "$@"', '_', '/tmp', 'terraform', 'validate']),
    );
  });
});

describe('runDevOps', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    jest.resetModules();
  });

  it('turns exit 127 "not found" into a typed TOOL_NOT_INSTALLED error', async () => {
    const original = process.env.DEVOPS_EXECUTION_MODE;
    process.env.DEVOPS_EXECUTION_MODE = 'native';
    try {
      const { runDevOps } = await import('./index');
      const nativeMod = await import('./nativeExecutor');
      jest
        .spyOn(nativeMod.NativeExecutor.prototype, 'probe')
        .mockResolvedValue({ mode: 'native', available: true, detail: 'test' });
      jest.spyOn(nativeMod.NativeExecutor.prototype, 'run').mockResolvedValue({
        exitCode: 127,
        stdout: '',
        stderr: 'bash: line 1: ansible-playbook: command not found',
        durationMs: 1,
        timedOut: false,
        mode: 'native',
        commandSummary: 'ansible-playbook --syntax-check',
      });

      await expect(runDevOps({ executable: 'ansible-playbook', args: ['--syntax-check', 'x.yml'] })).rejects.toMatchObject({
        code: 'TOOL_NOT_INSTALLED',
        statusCode: 503,
      });
    } finally {
      process.env.DEVOPS_EXECUTION_MODE = original;
    }
  });
});
