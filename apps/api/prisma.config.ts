import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// The Prisma CLI skips its own .env lookup when this file exists; use the repository root .env
// (absent in CI, where variables come from the environment). Already-set variables win,
// which is how scripts/prisma-test.mjs points the CLI at the test database.
const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
