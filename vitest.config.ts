import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      'tests/e2e/**',
      'tests/e2e-account-real/**',
    ],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/lib/supabase/database.types.ts', 'src/app/sw.ts'],
      reporter: ['text-summary', 'json-summary', 'json', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
