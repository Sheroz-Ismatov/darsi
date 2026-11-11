import type { INestApplication } from '@nestjs/common';
import type { SchoolDto } from '@darsi/shared';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { SchoolsService } from '../src/modules/schools/schools.service';
import { createTestApp, hasTestDb } from './helpers/test-app';
import { describeSchoolIsolation } from './isolation/describe-school-isolation';
import { createTenantFixture, type TenantFixture } from './isolation/tenant-fixture';

describe.skipIf(!hasTestDb)('school settings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: TenantFixture;

  const api = (method: 'get' | 'patch', auth: string, schoolId = fixture.schoolA.id) =>
    request(app.getHttpServer())
      [method]('/api/v1/school')
      .set('Authorization', auth)
      .set('X-School-Id', schoolId);
  const patch = (body: object, auth = fixture.schoolA.owner.auth) => api('patch', auth).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    fixture = await createTenantFixture(app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describeSchoolIsolation('school', () => ({ app, fixture }), [
    { method: 'get', path: '/school' },
    { method: 'patch', path: '/school', body: () => ({ name: 'Чужая школа' }) },
  ]);

  describe('access', () => {
    it('lets the owner and the admin read the settings', async () => {
      const { schoolA } = fixture;
      const owner = await api('get', schoolA.owner.auth).expect(200);
      const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolA.id } });
      expect(owner.body).toEqual({
        id: school.id,
        name: school.name,
        code: school.code,
        currency: 'TJS',
        timezone: 'Asia/Dushanbe',
        defaultLocale: 'ru',
        address: null,
        phone: null,
        description: null,
        chargeAbsent: true,
        chargeExcused: false,
        reminderHoursBefore: 3,
        debtRemindersEnabled: true,
        currencyLocked: false,
        joinUrl: `https://t.me/darsi_test_bot?start=${school.code}`,
      } satisfies SchoolDto);

      const admin = await api('get', schoolA.admin.auth).expect(200);
      expect(admin.body).toEqual(owner.body);
    });

    it('lets only the owner change them', async () => {
      const { schoolA } = fixture;
      const admin = await patch({ name: 'Админ меняет' }, schoolA.admin.auth).expect(403);
      expect(admin.body.error.code).toBe('FORBIDDEN_ROLE');
      const current = await prisma.school.findUniqueOrThrow({ where: { id: schoolA.id } });
      expect(current.name).not.toBe('Админ меняет');
    });

    it.each(['teacher', 'parent'] as const)('closes both endpoints to a %s', async (role) => {
      const { auth } = fixture.schoolA[role];
      const read = await api('get', auth).expect(403);
      expect(read.body.error.code).toBe('FORBIDDEN_ROLE');
      const write = await patch({ name: 'Нельзя' }, auth).expect(403);
      expect(write.body.error.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('update', () => {
    it('changes the profile and the rules', async () => {
      const res = await patch({
        name: '  Школа «Зиё»  ',
        address: 'Душанбе, ул. Рудаки, 10',
        phone: '+992 (93) 123-45-67',
        description: 'Английский и математика',
        timezone: 'Asia/Samarkand',
        defaultLocale: 'tg',
        chargeAbsent: false,
        chargeExcused: true,
        reminderHoursBefore: 24,
        debtRemindersEnabled: false,
      }).expect(200);

      expect(res.body).toMatchObject({
        name: 'Школа «Зиё»',
        address: 'Душанбе, ул. Рудаки, 10',
        phone: '+992 (93) 123-45-67',
        description: 'Английский и математика',
        timezone: 'Asia/Samarkand',
        defaultLocale: 'tg',
        chargeAbsent: false,
        chargeExcused: true,
        reminderHoursBefore: 24,
        debtRemindersEnabled: false,
      });
      const read = await api('get', fixture.schoolA.admin.auth).expect(200);
      expect(read.body).toEqual(res.body);
    });

    it('stores empty strings as null', async () => {
      await patch({ address: 'Худжанд', phone: '+992931234567', description: 'Текст' }).expect(200);
      const res = await patch({ address: '', phone: '  ', description: '' }).expect(200);
      expect(res.body).toMatchObject({ address: null, phone: null, description: null });
    });

    it.each([
      ['an unknown time zone', { timezone: 'Mars/Olympus' }],
      ['a malformed phone', { phone: 'позвоните мне' }],
      ['zero reminder hours', { reminderHoursBefore: 0 }],
      ['too many reminder hours', { reminderHoursBefore: 49 }],
      ['fractional reminder hours', { reminderHoursBefore: 2.5 }],
      ['a short name', { name: 'Я' }],
      ['an unknown currency', { currency: 'USD' }],
      ['an unknown locale', { defaultLocale: 'en' }],
      ['an empty body', {}],
    ])('rejects %s', async (_, body) => {
      const res = await patch(body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('records only the changed fields in the audit log', async () => {
      const { schoolA } = fixture;
      const current = await prisma.school.findUniqueOrThrow({ where: { id: schoolA.id } });
      const where = { schoolId: schoolA.id, entity: 'School', action: 'update' };
      const earlier = await prisma.auditLog.findMany({ where, select: { id: true } });

      await patch({
        name: current.name,
        reminderHoursBefore: current.reminderHoursBefore + 1,
        chargeAbsent: !current.chargeAbsent,
      }).expect(200);

      const logs = await prisma.auditLog.findMany({
        where: { ...where, id: { notIn: earlier.map((log) => log.id) } },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        actorUserId: schoolA.owner.userId,
        entityId: schoolA.id,
        before: {
          reminderHoursBefore: current.reminderHoursBefore,
          chargeAbsent: current.chargeAbsent,
        },
        after: {
          reminderHoursBefore: current.reminderHoursBefore + 1,
          chargeAbsent: !current.chargeAbsent,
        },
      });
      expect(Object.keys(logs[0]!.after as object).sort()).toEqual([
        'chargeAbsent',
        'reminderHoursBefore',
      ]);
    });

    it('writes no audit entry when nothing actually changes', async () => {
      const { schoolA } = fixture;
      const current = await prisma.school.findUniqueOrThrow({ where: { id: schoolA.id } });
      const where = { schoolId: schoolA.id, entity: 'School' };
      const before = await prisma.auditLog.count({ where });
      await patch({ name: current.name, currency: current.currency }).expect(200);
      expect(await prisma.auditLog.count({ where })).toBe(before);
    });
  });

  describe('currency', () => {
    it('changes while the school has no payments', async () => {
      const { schoolB } = fixture;
      const res = await api('patch', schoolB.owner.auth, schoolB.id)
        .send({ currency: 'RUB' })
        .expect(200);
      expect(res.body).toMatchObject({ currency: 'RUB', currencyLocked: false });
    });

    it('is locked after the first payment, but the same value still passes', async () => {
      vi.spyOn(app.get(SchoolsService), 'isCurrencyLocked').mockResolvedValue(true);
      const { schoolA } = fixture;

      const read = await api('get', schoolA.owner.auth).expect(200);
      expect(read.body.currencyLocked).toBe(true);

      const other = read.body.currency === 'TJS' ? 'RUB' : 'TJS';
      const locked = await patch({ currency: other }).expect(409);
      expect(locked.body.error.code).toBe('CURRENCY_LOCKED');

      const same = await patch({ currency: read.body.currency, chargeExcused: true }).expect(200);
      expect(same.body).toMatchObject({ currency: read.body.currency, currencyLocked: true });
    });
  });
});
