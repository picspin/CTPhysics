import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['utils/**/*.test.ts', 'utils/**/*.spec.ts', 'tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
