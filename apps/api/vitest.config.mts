import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests read DATABASE_URL_TEST from the repository root .env (CI passes it directly).
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

// SWC instead of esbuild: NestJS DI needs emitted decorator metadata.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts', 'test/**/*.int-spec.ts'],
    // Worker threads instead of child processes: forked workers crash on some Windows setups.
    pool: 'threads',
    // Remote test database (Neon) can be slow to wake up; fixtures make dozens of round trips.
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // One file at a time keeps the number of connections to the remote test database low.
    fileParallelism: false,
  },
});
