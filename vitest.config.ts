import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'vitest/config';

const resolveFromRoot = (relativePath: string) => path.resolve(process.cwd(), relativePath);
const virtualViteEnvModuleId = '\0virtual:@vite/env';
const viteEnvStubPath = resolveFromRoot('vitest.env.stub.ts');
const viteEnvClientPathPattern = /\/vite\/dist\/client\/env\.mjs$/;

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    pool: 'forks',
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolveFromRoot('src') },
      { find: '@/types', replacement: resolveFromRoot('src/types') },
    ],
  },
  server: {
    fs: {
      strict: false,
      allow: [resolveFromRoot('.'), resolveFromRoot('node_modules')],
    },
  },
  plugins: [
    {
      name: 'vitest-virtual-vite-env',
      enforce: 'pre',
      resolveId(id) {
        if (id === '/@vite/env' || id === '@vite/env') {
          return virtualViteEnvModuleId;
        }
        return null;
      },
      load(id) {
        if (id === virtualViteEnvModuleId || viteEnvClientPathPattern.test(id)) {
          return fs.readFileSync(viteEnvStubPath, 'utf8');
        }
        return null;
      },
    },
  ],
});
