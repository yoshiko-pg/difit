// Builds the VS Code extension: bundles the extension host code and the difit
// server (from the monorepo source) with esbuild, then copies the prebuilt
// client assets into dist/.
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const distDir = path.join(here, 'dist');

rmSync(distDir, { recursive: true, force: true });

const commonOptions = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'info',
};

// 1. Extension host bundle.
await build({
  ...commonOptions,
  entryPoints: [path.join(here, 'src/extension.ts')],
  outfile: path.join(distDir, 'extension.js'),
  external: ['vscode'],
});

// 2. difit server bundle, built straight from the monorepo source.
await build({
  ...commonOptions,
  entryPoints: [path.join(here, 'src/server-entry.ts')],
  outfile: path.join(distDir, 'server/index.js'),
  alias: {
    '@': path.join(repoRoot, 'src'),
    // The server never opens a browser from inside the extension.
    open: path.join(here, 'src/open-stub.ts'),
  },
  // server.ts derives __dirname from import.meta.url; emulate it in CJS.
  define: { 'import.meta.url': '__difitImportMetaUrl' },
  banner: {
    js: "const __difitImportMetaUrl = require('node:url').pathToFileURL(__filename).href;",
  },
});

// 3. Prebuilt difit client (built by `pnpm --dir ../.. run build`).
const clientSource = path.join(repoRoot, 'dist', 'client');
if (!existsSync(path.join(clientSource, 'index.html'))) {
  console.error('error: dist/client is missing. Run `pnpm --dir ../.. run build` first.');
  process.exit(1);
}
cpSync(clientSource, path.join(distDir, 'client'), { recursive: true });
