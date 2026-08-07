import { spawn, type ChildProcess } from 'child_process';

export interface BackgroundServerInfo {
  port: number;
  url: string;
  pid: number;
}

export const BACKGROUND_CHILD_ENV = 'DIFIT_BACKGROUND_CHILD';

export function parseBackgroundHandshakeMessage(message: unknown): BackgroundServerInfo | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const parsed = message as Partial<BackgroundServerInfo>;
  if (
    typeof parsed.port === 'number' &&
    typeof parsed.url === 'string' &&
    typeof parsed.pid === 'number'
  ) {
    return { port: parsed.port, url: parsed.url, pid: parsed.pid };
  }

  return null;
}

export function emitBackgroundHandshake(info: BackgroundServerInfo): void {
  process.send?.(info);
  process.disconnect?.();
}

export function releaseBackgroundChild(child: ChildProcess): void {
  if (child.connected) {
    child.disconnect();
  }
  child.stderr?.destroy();
  child.unref();
}

export function ignoreStdioErrorsForBackgroundDaemon(): void {
  process.stdout?.on?.('error', () => {});
  process.stderr?.on?.('error', () => {});
}

export async function startBackgroundProcess(spawnProcess: typeof spawn = spawn): Promise<void> {
  const scriptPath = process.argv[1];
  if (!scriptPath) {
    throw new Error('Unable to determine difit entrypoint for background process');
  }

  const childArgs = process.argv.slice(2).filter((arg) => arg !== '--background');
  if (!childArgs.includes('--keep-alive')) {
    childArgs.push('--keep-alive');
  }
  if (!childArgs.includes('--no-open')) {
    childArgs.push('--no-open');
  }

  const child = spawnProcess(process.execPath, [scriptPath, ...childArgs], {
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    env: {
      ...process.env,
      [BACKGROUND_CHILD_ENV]: '1',
    },
  });

  child.stderr?.setEncoding('utf8');

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let stderr = '';

    const cleanupListeners = (): void => {
      child.removeListener('message', onMessage);
      child.removeListener('error', onError);
      child.removeListener('close', onClose);
      child.stderr?.removeListener('data', onStderr);
    };

    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      cleanupListeners();
      callback();
    };

    const onStderr = (chunk: string): void => {
      stderr += chunk;
    };

    const onMessage = (message: unknown): void => {
      const handshake = parseBackgroundHandshakeMessage(message);
      if (!handshake) {
        return;
      }

      finish(() => {
        console.log(JSON.stringify(handshake));
        releaseBackgroundChild(child);
        resolve();
      });
    };

    const onError = (error: Error): void => {
      finish(() => {
        releaseBackgroundChild(child);
        reject(error);
      });
    };

    const onClose = (code: number | null): void => {
      finish(() => {
        releaseBackgroundChild(child);
        const startupError = stderr.trim();
        reject(
          new Error(
            startupError || `Background difit server exited early (code ${code ?? 'unknown'})`,
          ),
        );
      });
    };

    const timeout = setTimeout(() => {
      finish(() => {
        child.kill();
        child.stderr?.destroy();
        reject(new Error('Timed out while starting background difit server'));
      });
    }, 10_000);

    child.stderr?.on('data', onStderr);
    child.on('message', onMessage);
    child.once('error', onError);
    child.once('close', onClose);
  });
}
