import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  BACKGROUND_CHILD_ENV,
  parseBackgroundHandshakeMessage,
  releaseBackgroundChild,
  startBackgroundProcess,
} = await import('./background.js');

interface MockChildProcess extends EventEmitter {
  connected: boolean;
  stderr: PassThrough;
  disconnect: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  unref: ReturnType<typeof vi.fn>;
}

function createMockChild(): MockChildProcess {
  const child = Object.assign(new EventEmitter(), {
    connected: true,
    stderr: new PassThrough(),
    disconnect: vi.fn(),
    kill: vi.fn(() => true),
    unref: vi.fn(),
  });
  child.disconnect.mockImplementation(() => {
    child.connected = false;
  });
  return child;
}

describe('background process lifecycle', () => {
  const originalArgv = process.argv;
  let child: MockChildProcess;
  let spawnProcess: typeof import('child_process').spawn;

  beforeEach(() => {
    child = createMockChild();
    spawnProcess = vi.fn(() => child as unknown as ChildProcess) as unknown as typeof spawnProcess;
    process.argv = [originalArgv[0], '/tmp/difit-entry.js', 'HEAD', '--background'];
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('accepts only complete background handshake messages', () => {
    expect(
      parseBackgroundHandshakeMessage({
        port: 4966,
        url: 'http://localhost:4966',
        pid: 12345,
      }),
    ).toEqual({
      port: 4966,
      url: 'http://localhost:4966',
      pid: 12345,
    });
    expect(parseBackgroundHandshakeMessage({ port: 4966 })).toBeNull();
    expect(parseBackgroundHandshakeMessage('not an object')).toBeNull();
  });

  it('prints the handshake and releases the detached child', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stderrDestroy = vi.spyOn(child.stderr, 'destroy');

    const result = startBackgroundProcess(spawnProcess);
    child.emit('message', { port: 4967, url: 'http://localhost:4967', pid: 42 });
    await result;

    expect(spawnProcess).toHaveBeenCalledWith(
      process.execPath,
      ['/tmp/difit-entry.js', 'HEAD', '--keep-alive', '--no-open'],
      expect.objectContaining({
        detached: true,
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        env: expect.objectContaining({ [BACKGROUND_CHILD_ENV]: '1' }),
      }),
    );
    expect(consoleLog).toHaveBeenCalledWith(
      JSON.stringify({ port: 4967, url: 'http://localhost:4967', pid: 42 }),
    );
    expect(child.disconnect).toHaveBeenCalledOnce();
    expect(stderrDestroy).toHaveBeenCalledOnce();
    expect(child.unref).toHaveBeenCalledOnce();
    expect(child.listenerCount('message')).toBe(0);
    expect(child.listenerCount('error')).toBe(0);
    expect(child.listenerCount('close')).toBe(0);
  });

  it('preserves stderr when the child exits before the handshake', async () => {
    const result = startBackgroundProcess(spawnProcess);
    child.stderr.write('Error: Invalid or non-existent commit: bad-ref\n');
    child.connected = false;
    child.emit('close', 1);

    await expect(result).rejects.toThrow('Error: Invalid or non-existent commit: bad-ref');
    expect(child.disconnect).not.toHaveBeenCalled();
    expect(child.unref).toHaveBeenCalledOnce();
  });

  it('does not disconnect an IPC channel that is already closed', () => {
    child.connected = false;

    releaseBackgroundChild(child as unknown as ChildProcess);

    expect(child.disconnect).not.toHaveBeenCalled();
    expect(child.unref).toHaveBeenCalledOnce();
  });

  it('kills a child that times out instead of orphaning it', async () => {
    vi.useFakeTimers();

    const result = startBackgroundProcess(spawnProcess);
    const rejection = expect(result).rejects.toThrow(
      'Timed out while starting background difit server',
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;

    expect(child.kill).toHaveBeenCalledOnce();
    expect(child.unref).not.toHaveBeenCalled();
    expect(child.listenerCount('message')).toBe(0);
    expect(child.listenerCount('error')).toBe(0);
    expect(child.listenerCount('close')).toBe(0);
  });
});
