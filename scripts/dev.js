#!/usr/bin/env node
import { spawn } from 'child_process';

import { createCliStdoutProxy } from './dev-stdout.js';

const rawArgs = process.argv.slice(2);

console.log('🚀 Starting CLI server...');

// Delegate argument and stdin interpretation to CLI to avoid divergent behavior.
const cliArgs = ['run', 'dev:cli', ...rawArgs, '--no-open'];

const cliProcess = spawn('pnpm', cliArgs, {
  // Keep stdin attached so CLI can decide stdin mode by itself.
  stdio: ['inherit', 'pipe', 'inherit'],
});

// Wait for CLI server to be ready, then start Vite
let viteProcess = null;
let isShuttingDown = false;

const cliStdoutProxy = createCliStdoutProxy({
  onServerUrl: (cliServerUrl) => {
    if (viteProcess) {
      return;
    }

    console.log('🎨 Starting Vite dev server...');
    viteProcess = spawn('pnpm', ['exec', 'vite', '--open'], {
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

cliProcess.stdout.on('data', (data) => {
  // Wait for CLI server before starting Vite to prevent proxy connection errors.
  // Suppress dev-only startup lines but continue mirroring shutdown output such as review comments.
  cliStdoutProxy.push(data.toString());
});

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log('\n👋 Shutting down...');
  cliProcess.kill(signal);
  viteProcess?.kill(signal);
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
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
