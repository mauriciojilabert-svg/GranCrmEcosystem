import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const outDir = env.VITE_MF_OUT_DIR
    ? path.resolve(env.VITE_MF_OUT_DIR)
    : path.resolve('/home/admincrm/staticfiles/mf/incitrack');

  return {
    plugins: [
      react(),
      federation({
        name: 'incitrack',
        filename: 'remoteEntry.js',
        exposes: { './App': './src/App.tsx' },
        shared: {
          react: { singleton: true, requiredVersion: '^18.0.0' },
          'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
          'react-router-dom': { singleton: true, requiredVersion: '^6.0.0' },
        },
      }),
    ],
    build: {
      target: 'esnext',
      outDir,
      emptyOutDir: true,
    },
    server: {
      port: 8010,
      watch: { usePolling: true, interval: 500 },
      proxy: {
        '/incitrack': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          // No rewrite: keep /incitrack prefix (backend routes are all under incitrack/)
        },
      },
    },
  };
});
