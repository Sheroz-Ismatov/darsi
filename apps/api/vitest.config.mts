import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC instead of esbuild: NestJS DI needs emitted decorator metadata.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // Worker threads instead of child processes: forked workers crash on some Windows setups.
    pool: 'threads',
  },
});
