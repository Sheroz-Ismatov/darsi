import { parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://darsi:darsi@localhost:5432/darsi',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'x'.repeat(32),
  BOT_TOKEN: '123456:TEST-token',
  BOT_USERNAME: 'darsi_test_bot',
};

describe('parseEnv', () => {
  it('applies defaults and parses lists', () => {
    const env = parseEnv({ ...valid, CORS_ORIGINS: 'http://a.test, http://b.test,' });

    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.AUTH_DEV_BYPASS).toBe(false);
  });

  it('lists every invalid variable in one error', () => {
    expect(() => parseEnv({ API_PORT: 'abc' })).toThrow(
      /API_PORT[\s\S]*DATABASE_URL[\s\S]*REDIS_URL[\s\S]*JWT_SECRET[\s\S]*BOT_TOKEN/,
    );
  });

  it('rejects a short JWT secret and a malformed bot token', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: 'short', BOT_TOKEN: 'nope' })).toThrow(
      /JWT_SECRET: must be at least 32 characters[\s\S]*BOT_TOKEN/,
    );
  });

  it('rejects the auth dev bypass in production', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production', AUTH_DEV_BYPASS: 'true' })).toThrow(
      /AUTH_DEV_BYPASS: must be false in production/,
    );
  });

  it('treats an empty TMA_URL as unset and requires https otherwise', () => {
    expect(parseEnv({ ...valid, TMA_URL: '' }).TMA_URL).toBeUndefined();
    expect(() => parseEnv({ ...valid, TMA_URL: 'http://localhost:5174' })).toThrow(
      /TMA_URL: must be an https:\/\/ URL/,
    );
  });

  it('allows the auth dev bypass in development', () => {
    expect(parseEnv({ ...valid, AUTH_DEV_BYPASS: 'true' }).AUTH_DEV_BYPASS).toBe(true);
  });
});
