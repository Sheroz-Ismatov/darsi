import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { PlanDto, PlatformSchoolDto } from '@darsi/shared';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { hashToken } from '../src/modules/auth/token.service';
import { PlanLimitsService } from '../src/modules/platform/plan-limits.service';
import { createTestApp, hasTestDb } from './helpers/test-app';
import { createTenantFixture, type TenantFixture } from './isolation/tenant-fixture';

const HOUR_MS = 60 * 60 * 1000;
const uniqueCode = (): string => `t11-${randomInt(0, 999_999_999)}`;

describe.skipIf(!hasTestDb)('platform: schools and plans (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: TenantFixture;
  let plan: PlanDto;

  const api = (method: 'get' | 'post' | 'patch', path: string, auth = fixture.superadmin.auth) =>
    request(app.getHttpServer())[method](`/api/v1/platform/${path}`).set('Authorization', auth);

  const createSchool = async (overrides: Record<string, unknown> = {}) => {
    const res = await api('post', 'schools')
      .send({
        name: 'Школа «Зиё»',
        currency: 'TJS',
        timezone: 'Asia/Dushanbe',
        planId: plan.id,
        ownerName: 'Фаррух Назаров',
        ...overrides,
      })
      .expect(201);
    return res.body as PlatformSchoolDto;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    fixture = await createTenantFixture(app);
    const res = await api('post', 'plans')
      .send({ name: 'T-11', maxStudents: 50, maxStaff: 3, maxStorageMb: 100 })
      .expect(201);
    plan = res.body as PlanDto;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/platform/schools').expect(401);
    });

    it.each([
      ['get', 'schools'],
      ['post', 'schools'],
      ['get', 'plans'],
      ['post', 'plans'],
    ] as const)('closes %s /platform/%s to owners and outsiders', async (method, path) => {
      const owner = await api(method, path, fixture.schoolA.owner.auth).send({}).expect(403);
      expect(owner.body.error.code).toBe('FORBIDDEN');
      await api(method, path, fixture.outsider.auth).send({}).expect(403);
    });
  });

  describe('plans', () => {
    it('lists plans with the number of schools on each', async () => {
      const res = await api('get', 'plans').expect(200);
      const listed = (res.body as PlanDto[]).find((p) => p.id === plan.id);
      expect(listed).toEqual({ ...plan, schoolsCount: expect.any(Number) });
    });

    it('changes limits and records the change in the audit log', async () => {
      const res = await api('patch', `plans/${plan.id}`).send({ maxStudents: 80 }).expect(200);
      expect(res.body).toMatchObject({ maxStudents: 80, maxStaff: 3 });

      const log = await prisma.auditLog.findFirst({
        where: { entity: 'Plan', entityId: plan.id, action: 'update' },
      });
      expect(log?.actorUserId).toBe(fixture.superadmin.userId);
      expect(log?.before).toMatchObject({ maxStudents: 50 });
      expect(log?.after).toMatchObject({ maxStudents: 80 });
    });

    it('rejects invalid limits and unknown plans', async () => {
      const invalid = await api('patch', `plans/${plan.id}`).send({ maxStaff: 0 }).expect(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
      await api('patch', `plans/${plan.id}`).send({}).expect(400);
      await api('patch', 'plans/not-a-uuid').send({ maxStaff: 5 }).expect(400);
      const missing = await api('patch', `plans/${fixture.schoolA.id}`)
        .send({ maxStaff: 5 })
        .expect(404);
      expect(missing.body.error.code).toBe('PLAN_NOT_FOUND');
    });
  });

  describe('schools', () => {
    it('creates a school with a branch and an invited owner', async () => {
      const code = uniqueCode();
      const school = await createSchool({ code, currency: 'RUB', timezone: 'Europe/Moscow' });

      expect(school).toMatchObject({
        name: 'Школа «Зиё»',
        code,
        currency: 'RUB',
        timezone: 'Europe/Moscow',
        defaultLocale: 'ru',
        status: 'active',
        plan: { id: plan.id, name: 'T-11' },
        staffCount: 1,
        owner: { displayName: 'Фаррух Назаров', status: 'invited' },
        ownerInviteExpiresAt: null,
      });
      expect(await prisma.branch.count({ where: { schoolId: school.id } })).toBe(1);

      const list = await api('get', 'schools').expect(200);
      expect((list.body as PlatformSchoolDto[]).map((s) => s.id)).toContain(school.id);
    });

    it('generates a code when none is given', async () => {
      const school = await createSchool();
      expect(school.code).toMatch(/^s-[a-z0-9]{6}$/);
    });

    it('rejects a taken code, an unknown plan and an unknown time zone', async () => {
      const { code } = await createSchool({ code: uniqueCode() });
      const body = {
        name: 'Вторая школа',
        currency: 'TJS',
        timezone: 'Asia/Dushanbe',
        planId: plan.id,
        ownerName: 'Владелец',
      };

      const taken = await api('post', 'schools')
        .send({ ...body, code })
        .expect(409);
      expect(taken.body.error.code).toBe('SCHOOL_CODE_TAKEN');

      const noPlan = await api('post', 'schools')
        .send({ ...body, planId: fixture.schoolA.id })
        .expect(404);
      expect(noPlan.body.error.code).toBe('PLAN_NOT_FOUND');

      await api('post', 'schools')
        .send({ ...body, timezone: 'Mars/Olympus' })
        .expect(400);
      await api('post', 'schools')
        .send({ ...body, code: 'inv_token' })
        .expect(400);
    });

    it('blocks and unblocks a school, with an audit trail', async () => {
      const school = await createSchool();

      const blocked = await api('patch', `schools/${school.id}`)
        .send({ status: 'blocked' })
        .expect(200);
      expect(blocked.body.status).toBe('blocked');
      const active = await api('patch', `schools/${school.id}`)
        .send({ status: 'active' })
        .expect(200);
      expect(active.body.status).toBe('active');

      const actions = await prisma.auditLog.findMany({
        where: { schoolId: school.id, entity: 'School' },
        orderBy: { createdAt: 'asc' },
        select: { action: true },
      });
      expect(actions.map((a) => a.action)).toEqual(['create', 'block', 'unblock']);
    });

    it('moves a school to another plan', async () => {
      const school = await createSchool();
      const other = await api('post', 'plans')
        .send({ name: 'T-11 большой', maxStudents: 900, maxStaff: 60, maxStorageMb: 5000 })
        .expect(201);

      const res = await api('patch', `schools/${school.id}`)
        .send({ planId: other.body.id })
        .expect(200);
      expect(res.body.plan).toMatchObject({ id: other.body.id, maxStudents: 900 });

      const missing = await api('patch', `schools/${plan.id}`).send({ name: 'Нет' }).expect(404);
      expect(missing.body.error.code).toBe('SCHOOL_NOT_FOUND');
    });
  });

  describe('owner invite', () => {
    const tokenOf = (url: string): string => {
      const match = /^https:\/\/t\.me\/darsi_test_bot\?start=inv_([\w-]+)$/.exec(url);
      if (!match?.[1]) throw new Error(`Unexpected invite url: ${url}`);
      return match[1];
    };

    it('issues a 72-hour link and stores only the hash of the token', async () => {
      const school = await createSchool();
      const res = await api('post', `schools/${school.id}/owner-invite`).expect(201);

      const token = tokenOf(res.body.url);
      // Telegram limits the /start payload to 64 characters.
      expect(`inv_${token}`.length).toBeLessThanOrEqual(64);
      const ttl = new Date(res.body.expiresAt).getTime() - Date.now();
      expect(ttl).toBeGreaterThan(71 * HOUR_MS);
      expect(ttl).toBeLessThanOrEqual(72 * HOUR_MS);

      const stored = await prisma.inviteToken.findMany({ where: { schoolId: school.id } });
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        tokenHash: hashToken(token),
        usedAt: null,
        revokedAt: null,
        createdByUserId: fixture.superadmin.userId,
      });
      expect(JSON.stringify(stored)).not.toContain(token);

      const list = await api('get', 'schools').expect(200);
      const listed = (list.body as PlatformSchoolDto[]).find((s) => s.id === school.id);
      expect(listed?.ownerInviteExpiresAt).toBe(res.body.expiresAt);
    });

    it('revokes the previous link when a new one is issued', async () => {
      const school = await createSchool();
      const first = await api('post', `schools/${school.id}/owner-invite`).expect(201);
      const second = await api('post', `schools/${school.id}/owner-invite`).expect(201);
      expect(second.body.url).not.toBe(first.body.url);

      const old = await prisma.inviteToken.findUnique({
        where: { tokenHash: hashToken(tokenOf(first.body.url)) },
      });
      expect(old?.revokedAt).not.toBeNull();
      const live = await prisma.inviteToken.count({
        where: { schoolId: school.id, revokedAt: null },
      });
      expect(live).toBe(1);
    });

    it('refuses when the school already has an active owner', async () => {
      const res = await api('post', `schools/${fixture.schoolA.id}/owner-invite`).expect(409);
      expect(res.body.error.code).toBe('OWNER_ALREADY_JOINED');
    });

    it('answers 404 for an unknown school and 403 for a school owner', async () => {
      await api('post', `schools/${plan.id}/owner-invite`).expect(404);
      await api(
        'post',
        `schools/${fixture.schoolB.id}/owner-invite`,
        fixture.schoolB.owner.auth,
      ).expect(403);
    });
  });

  describe('plan limits', () => {
    it('stops new staff at the plan limit until the superadmin raises it', async () => {
      const limits = app.get(PlanLimitsService);
      const small = await api('post', 'plans')
        .send({ name: 'T-11 один', maxStudents: 10, maxStaff: 1, maxStorageMb: 10 })
        .expect(201);
      // The invited owner already takes the only seat.
      const school = await createSchool({ planId: small.body.id });

      await expect(limits.assertCanAddStaff(school.id)).rejects.toMatchObject({
        code: 'PLAN_LIMIT_REACHED',
        status: 422,
        details: { limit: 'staff', max: 1 },
      });

      await api('patch', `plans/${small.body.id}`).send({ maxStaff: 2 }).expect(200);
      await expect(limits.assertCanAddStaff(school.id)).resolves.toBeUndefined();
    });

    it('counts a person with several staff roles once', async () => {
      const limits = app.get(PlanLimitsService);
      const { schoolA } = fixture;
      // Fixture school A: owner, admin, teacher (3 people) on a plan with 100 seats.
      const three = await api('post', 'plans')
        .send({ name: 'T-11 три', maxStudents: 10, maxStaff: 4, maxStorageMb: 10 })
        .expect(201);
      await api('patch', `schools/${schoolA.id}`).send({ planId: three.body.id }).expect(200);
      await prisma.membership.create({
        data: {
          schoolId: schoolA.id,
          userId: schoolA.owner.userId,
          role: 'teacher',
          displayName: 'owner+teacher',
          status: 'active',
        },
      });

      await expect(limits.assertCanAddStaff(schoolA.id)).resolves.toBeUndefined();
    });
  });
});
