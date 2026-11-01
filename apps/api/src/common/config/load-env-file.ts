import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Repository root `.env`; the same depth from `src/` and `dist/`. Already-set variables win. */
const ROOT_ENV_FILE = resolve(__dirname, '../../../../../.env');

export function loadEnvFile(file = ROOT_ENV_FILE): void {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}
