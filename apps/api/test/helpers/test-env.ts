import { TEST_BOT_TOKEN } from './telegram-signing';

/**
 * Deterministic environment for e2e suites. DATABASE_URL points at the test database when it is
 * configured; suites that only use fakes still need a syntactically valid URL.
 */
export function applyTestEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL:
      process.env.DATABASE_URL_TEST ?? 'postgresql://darsi:darsi@localhost:5432/darsi_test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-with-at-least-32-characters',
    BOT_TOKEN: TEST_BOT_TOKEN,
    BOT_USERNAME: 'darsi_test_bot',
    // Never poll Telegram from tests, even if the developer's .env enables it.
    BOT_MODE: 'off',
    AUTH_DEV_BYPASS: 'false',
    WEB_URL: 'http://localhost:5173',
    ...overrides,
  });
}
