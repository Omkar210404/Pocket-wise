import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
});
