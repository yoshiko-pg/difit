import { rmSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const apiTarget = process.env.VITE_DIFIT_API_URL || 'http://localhost:4966';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'remove-site-data-from-client-build',
      closeBundle() {
        rmSync(resolve(__dirname, 'dist/client/site-data'), { recursive: true, force: true });
      },
    },
  ],
  root: 'src/client',
  publicDir: '../../public',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
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
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
