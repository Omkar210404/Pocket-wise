import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * The mock service worker sits in `public/`, so Vite copies it into every
 * build. A normal build has no use for it: this removes it again, so only a
 * demo build ships any demo code.
 */
function dropMockWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'drop-mock-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      rmSync(resolve(outDir, 'mockServiceWorker.js'), { force: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isDemo = loadEnv(mode, process.cwd(), 'VITE_').VITE_DEMO === 'true';

  return {
    plugins: [react(), ...(isDemo ? [] : [dropMockWorker()])],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Tests never read a developer's .env files: the API base is fixed here.
      env: {
        VITE_API_URL: 'http://api.test',
        VITE_DEMO: 'false',
        VITE_CURRENCY: 'INR',
      },
      restoreMocks: true,
    },
  };
});
