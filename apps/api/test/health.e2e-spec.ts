import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { REDIS } from '../src/common/redis/redis.module';
import { applyTestEnv } from './helpers/test-env';

// Database and Redis are replaced with fakes: this suite checks the HTTP contract, not the services.
describe('GET /api/v1/health', () => {
  let app: INestApplication;
  const prisma = { $queryRaw: vi.fn(), $disconnect: vi.fn() };
  const redis = { ping: vi.fn(), status: 'end', disconnect: vi.fn() };

  beforeAll(async () => {
    applyTestEnv();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(REDIS)
      .useValue(redis)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, []);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 when database and Redis respond', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');

    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 503 and names the failing dependency', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    redis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ database: 'up', redis: 'down' });
  });

  it('answers unknown routes in the common error format', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
