#!/usr/bin/env node
import { spawn } from 'child_process';

import { getCompileCloseExitCode } from '../dev/dev-lifecycle.js';
import { createCliStdoutProxy } from '../dev/dev-stdout.js';

const rawArgs = process.argv.slice(2);
const cliArgs = [...rawArgs, '--no-open'];

// Wait for CLI server to be ready, then start Vite
let cliProcess = null;
let compileProcess = null;
let viteProcess = null;
let isShuttingDown = false;

const cliStdoutProxy = createCliStdoutProxy({
  onServerUrl: (cliServerUrl) => {
    if (viteProcess) {
      return;
    }

    console.log('🚀 Starting Vite dev server...');
    viteProcess = spawn('pnpm', ['exec', 'vite', '--open', '--clearScreen=false'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DIFIT_API_URL: cliServerUrl,
      },
    });
  },
  onOutput: (output) => {
    process.stdout.write(output);
  },
});

function startCliProcess() {
  cliProcess = spawn(process.execPath, ['dist/cli/index.js', ...cliArgs], {
    // Keep stdin attached so CLI can decide stdin mode by itself.
    stdio: ['inherit', 'pipe', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  cliProcess.stdout.on('data', (data) => {
    // Wait for CLI server before starting Vite to prevent proxy connection errors.
    // Suppress dev-only startup lines but continue mirroring shutdown output such as review comments.
    cliStdoutProxy.push(data.toString());
  });

  cliProcess.on('close', (code) => {
    cliStdoutProxy.flush();

    if (code !== 0 && code !== null && !isShuttingDown) {
      console.error(`CLI server exited with code ${code}`);
    }

    if (viteProcess && !viteProcess.killed) {
      viteProcess.kill('SIGINT');
    }

    process.exit(code || 0);
  });
}

function startCompileProcess() {
  compileProcess = spawn('pnpm', ['exec', 'tsc', '--project', 'tsconfig.cli.json'], {
    stdio: 'inherit',
  });

  compileProcess.on('close', (code) => {
    compileProcess = null;

    const exitCode = getCompileCloseExitCode(code, isShuttingDown);

    if (exitCode !== null) {
      process.exit(exitCode);
      return;
    }

    startCliProcess();
  });
}

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  compileProcess?.kill(signal);
  cliProcess?.kill(signal);
  viteProcess?.kill(signal);
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

startCompileProcess();
