import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // Worker threads instead of child processes: forked workers crash on some Windows setups.
    pool: 'threads',
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.spec.ts', 'src/domain/index.ts'],
      reporter: ['text'],
      // Domain rules decide what parents see and what they pay (ARCHITECTURE.md §3.2).
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
});
