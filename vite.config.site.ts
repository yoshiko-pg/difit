import { writeFileSync } from 'fs';
import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const siteBasePath =
  process.env.SITE_BASE_PATH ?? (process.env.GITHUB_PAGES === 'true' ? '/difit/' : '/');

const normalizeDevRoute = (url: string): string | null => {
  const [pathname, query = ''] = url.split('?', 2);
  const suffix = query ? `?${query}` : '';

  if (pathname === '/site') {
    return `/${suffix}`;
  }

  if (pathname === '/preview') {
    return `/preview/${suffix}`;
  }

  return null;
};

export default defineConfig({
  base: siteBasePath,
  plugins: [
    react(),
    {
      name: 'site-dev-route-normalizer',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url) {
            const normalized = normalizeDevRoute(req.url);
            if (normalized) {
              req.url = normalized;
            }
          }
          next();
        });
      },
      closeBundle() {
        writeFileSync(resolve(__dirname, 'dist/site/.nojekyll'), '', 'utf8');
      },
    },
  ],
  root: 'src/site',
  publicDir: '../../public',
  build: {
    outDir: '../../dist/site',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        site: resolve(__dirname, 'src/site/index.html'),
        preview: resolve(__dirname, 'src/site/preview/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
});
