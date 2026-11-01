import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { REDIS } from '../../src/common/redis/redis.module';
import { applyTestEnv } from './test-env';

/** Database-backed suites run only when DATABASE_URL_TEST is configured. */
export const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

/**
 * Full application on the test database with a fake Redis.
 * `controllers` lets a suite mount probe endpoints next to the real ones.
 */
export async function createTestApp(
  options: { env?: Record<string, string>; controllers?: Type[] } = {},
): Promise<INestApplication> {
  applyTestEnv(options.env);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(REDIS)
    .useValue({ ping: vi.fn(), status: 'end', disconnect: vi.fn() })
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, []);
  await app.init();
  return app;
}
