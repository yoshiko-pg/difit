#!/usr/bin/env node
import { spawn } from 'child_process';

const rawArgs = process.argv.slice(2);
const CLI_SERVER_URL_PATTERN = /difit server started on (https?:\/\/\S+)/;

console.log('🚀 Starting CLI server...');

// Delegate argument and stdin interpretation to CLI to avoid divergent behavior.
const cliArgs = ['run', 'dev:cli', ...rawArgs, '--no-open'];

const cliProcess = spawn('pnpm', cliArgs, {
  // Keep stdin attached so CLI can decide stdin mode by itself.
  stdio: ['inherit', 'pipe', 'inherit'],
});

// Wait for CLI server to be ready, then start Vite
let cliStdoutBuffer = '';
let viteProcess = null;

cliProcess.stdout.on('data', (data) => {
  const output = data.toString();
  cliStdoutBuffer += output;

  // Wait for CLI server before starting Vite to prevent proxy connection errors
  // Uses stdout parsing to keep dev orchestration separate from main CLI logic.
  // Intentionally do not mirror CLI stdout to avoid showing internal API server URL.
  const cliServerUrlMatch = cliStdoutBuffer.match(CLI_SERVER_URL_PATTERN);
  if (!viteProcess && cliServerUrlMatch) {
    const cliServerUrl = cliServerUrlMatch[1];
    console.log('🎨 Starting Vite dev server...');
    viteProcess = spawn('pnpm', ['exec', 'vite', '--open'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DIFIT_API_URL: cliServerUrl,
      },
    });
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  cliProcess.kill('SIGINT');
  viteProcess?.kill('SIGINT');
  process.exit(0);
});

cliProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`CLI server exited with code ${code}`);
  }
  // Kill vite process when CLI exits
  viteProcess?.kill('SIGINT');
  process.exit(code || 0);
});
