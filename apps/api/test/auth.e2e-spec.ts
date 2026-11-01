import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { REDIS } from '../src/common/redis/redis.module';
import { nowSeconds, signInitData, signLoginWidget } from './helpers/telegram-signing';
import { applyTestEnv } from './helpers/test-env';

// Real test database (DATABASE_URL_TEST), fake Redis. Prepare: pnpm --filter @darsi/api db:test:prepare
const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

async function createApp(envOverrides: Record<string, string> = {}): Promise<INestApplication> {
  applyTestEnv(envOverrides);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(REDIS)
    .useValue({ ping: vi.fn(), status: 'end', disconnect: vi.fn() })
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, []);
  await app.init();
  return app;
}

/** Unique per run so suites never collide with leftovers from previous runs. */
const telegramId = (): number => 7_000_000_000 + randomInt(0, 999_999_999);

function refreshCookie(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((c) => c.startsWith('darsi_rt='));
  if (!cookie) throw new Error('darsi_rt cookie was not set');
  return cookie.split(';')[0] ?? '';
}

describe.skipIf(!hasTestDb)('auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Mini App: POST /auth/tma', () => {
    it('creates the user from initData and returns an access token that opens /me', async () => {
      const id = telegramId();
      const initData = signInitData({
        user: { id, first_name: 'Фарзона', username: 'farzona', language_code: 'tg' },
        auth_date: nowSeconds(),
        start_param: 'demo',
      });

      const login = await http.post('/api/v1/auth/tma').send({ initData }).expect(200);
      expect(login.body).toMatchObject({ expiresIn: 3600, startParam: 'demo' });

      const me = await http
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);
      expect(me.body.user).toMatchObject({
        telegramId: String(id),
        firstName: 'Фарзона',
        locale: 'tg',
        isSuperadmin: false,
      });
      expect(me.body.memberships).toEqual([]);
    });

    it('rejects tampered initData', async () => {
      const initData = signInitData({
        user: { id: telegramId(), first_name: 'A' },
        auth_date: nowSeconds(),
      }).replace('first_name', 'first_namf');

      const res = await http.post('/api/v1/auth/tma').send({ initData }).expect(401);
      expect(res.body.error.code).toBe('TELEGRAM_AUTH_INVALID');
    });

    it('rejects initData older than 24 hours', async () => {
      const initData = signInitData({
        user: { id: telegramId(), first_name: 'A' },
        auth_date: nowSeconds() - 25 * 3600,
      });

      const res = await http.post('/api/v1/auth/tma').send({ initData }).expect(401);
      expect(res.body.error.code).toBe('TELEGRAM_AUTH_EXPIRED');
    });

    it('validates the request body', async () => {
      const res = await http.post('/api/v1/auth/tma').send({}).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('access token guard', () => {
    it('requires a bearer token', async () => {
      const res = await http.get('/api/v1/me').expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects a forged token', async () => {
      const res = await http
        .get('/api/v1/me')
        .set('Authorization', 'Bearer not.a.jwt')
        .expect(401);
      expect(res.body.error.code).toBe('ACCESS_TOKEN_INVALID');
    });
  });

  describe('web panel: POST /auth/telegram-login and refresh rotation', () => {
    async function staffUser(role: 'admin' | 'teacher'): Promise<number> {
      const id = telegramId();
      const plan = await prisma.plan.create({
        data: { name: 'e2e', maxStudents: 10, maxStaff: 10, maxStorageMb: 10 },
      });
      const school = await prisma.school.create({
        data: {
          name: 'E2E школа',
          code: `e2e-${id}`,
          currency: 'TJS',
          timezone: 'Asia/Dushanbe',
          planId: plan.id,
        },
      });
      const user = await prisma.user.create({ data: { telegramId: BigInt(id), firstName: 'Admin' } });
      await prisma.membership.create({
        data: { schoolId: school.id, userId: user.id, role, displayName: 'Admin', status: 'active' },
      });
      return id;
    }

    const widget = (id: number) =>
      signLoginWidget({ id, first_name: 'Admin', auth_date: nowSeconds() });

    it('denies accounts without an owner/admin role', async () => {
      const teacher = await staffUser('teacher');
      const res = await http.post('/api/v1/auth/telegram-login').send(widget(teacher)).expect(403);
      expect(res.body.error.code).toBe('NO_WEB_ACCESS');

      await http.post('/api/v1/auth/telegram-login').send(widget(telegramId())).expect(403);
    });

    it('signs in an admin, rotates the refresh token and detects reuse', async () => {
      const admin = await staffUser('admin');

      const login = await http.post('/api/v1/auth/telegram-login').send(widget(admin)).expect(200);
      expect(login.body.accessToken).toEqual(expect.any(String));
      const setCookie = (login.headers['set-cookie'] as unknown as string[])[0] ?? '';
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/Path=\/api\/v1\/auth/);
      expect(setCookie).toMatch(/SameSite=Strict/i);
      const first = refreshCookie(login);

      const rotated = await http.post('/api/v1/auth/refresh').set('Cookie', first).expect(200);
      const second = refreshCookie(rotated);
      expect(second).not.toBe(first);

      const reuse = await http.post('/api/v1/auth/refresh').set('Cookie', first).expect(401);
      expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

      // Reuse revoked the whole family, including the newest token.
      await http.post('/api/v1/auth/refresh').set('Cookie', second).expect(401);
    });

    it('logout revokes the session', async () => {
      const admin = await staffUser('admin');
      const login = await http.post('/api/v1/auth/telegram-login').send(widget(admin)).expect(200);
      const cookie = refreshCookie(login);

      await http.post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
      await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    });
  });

  it('hides the dev login when AUTH_DEV_BYPASS is off', async () => {
    await http.post('/api/v1/auth/dev-login').send({ telegramId: telegramId() }).expect(404);
  });
});

describe.skipIf(!hasTestDb)('auth dev login (e2e, AUTH_DEV_BYPASS=true)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp({ NODE_ENV: 'development', AUTH_DEV_BYPASS: 'true' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs in any Telegram id without a signature', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/dev-login')
      .send({ telegramId: telegramId(), firstName: 'Dev' })
      .expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toMatch(/^darsi_rt=/);
  });
});
