import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const normalizeDevRoute = (url) => {
  const [pathname, query = ''] = url.split('?', 2);
  const suffix = query ? `?${query}` : '';

  if (pathname === '/') {
    return `/site/${suffix}`;
  }

  if (pathname === '/site') {
    return `/site/${suffix}`;
  }

  if (pathname === '/app-static') {
    return `/app-static/${suffix}`;
  }

  return null;
};

export default defineConfig({
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
    },
  ],
  root: 'src/site',
  publicDir: '../../public',
  build: {
    outDir: '../../dist/site',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        site: resolve(__dirname, 'src/site/site/index.html'),
        'app-static': resolve(__dirname, 'src/site/app-static/index.html'),
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
    port: 5174,
  },
});
