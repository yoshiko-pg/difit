import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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
    port: 5174,
  },
});
