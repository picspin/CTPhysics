import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['utils/**/*.test.ts', 'utils/**/*.spec.ts', 'tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
