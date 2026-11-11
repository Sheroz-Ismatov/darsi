import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { StaffListResponse, StaffMemberDto } from '@darsi/shared';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { hashToken, TokenService } from '../src/modules/auth/token.service';
import { createTestApp, hasTestDb } from './helpers/test-app';
import { describeSchoolIsolation } from './isolation/describe-school-isolation';
import {
  createTenantFixture,
  type TenantFixture,
  type TestMember,
} from './isolation/tenant-fixture';

const HOUR_MS = 60 * 60 * 1000;
const uniqueTelegramId = (): bigint => BigInt(7_000_000_000 + randomInt(0, 999_999_999));

const tokenOf = (url: string): string => {
  const match = /^https:\/\/t\.me\/darsi_test_bot\?start=inv_([\w-]+)$/.exec(url);
  if (!match?.[1]) throw new Error(`Unexpected invite url: ${url}`);
  return match[1];
};

describe.skipIf(!hasTestDb)('staff (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: TenantFixture;
  /** A record of school A for the isolation suite. */
  let teacherOfA: string;

  const api = (
    method: 'get' | 'post' | 'patch',
    path: string,
    auth: string,
    schoolId = fixture.schoolA.id,
  ) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', auth)
      .set('X-School-Id', schoolId);

  const owner = () => fixture.schoolA.owner.auth;

  const newUser = async (): Promise<TestMember> => {
    const user = await prisma.user.create({
      data: { telegramId: uniqueTelegramId(), firstName: 'Staff' },
    });
    const token = await app.get(TokenService).issueAccessToken(user.id);
    return { userId: user.id, auth: `Bearer ${token}` };
  };

  const createStaff = async (
    body: object,
    auth = owner(),
    schoolId = fixture.schoolA.id,
  ): Promise<StaffMemberDto> => {
    const res = await api('post', '/staff', auth, schoolId).send(body).expect(201);
    return res.body as StaffMemberDto;
  };

  /** Issues a link for the membership and accepts it as a new user. */
  const join = async (memberId: string, auth = owner(), schoolId = fixture.schoolA.id) => {
    const link = await api('post', `/staff/${memberId}/invite`, auth, schoolId).expect(201);
    const person = await newUser();
    await request(app.getHttpServer())
      .post('/api/v1/invites/accept')
      .set('Authorization', person.auth)
      .send({ token: tokenOf(link.body.url) })
      .expect(200);
    return person;
  };

  /** A school on its own plan with an active owner. */
  const schoolWithPlan = async (maxStaff: number) => {
    const plan = await prisma.plan.create({
      data: { name: `staff-${maxStaff}`, maxStudents: 10, maxStaff, maxStorageMb: 10 },
    });
    const ownerUser = await newUser();
    const school = await prisma.school.create({
      data: {
        name: 'Лимит',
        code: `staff-${uniqueTelegramId()}`,
        currency: 'TJS',
        timezone: 'Asia/Dushanbe',
        planId: plan.id,
        memberships: {
          create: {
            userId: ownerUser.userId,
            role: 'owner',
            displayName: 'Владелец',
            status: 'active',
          },
        },
      },
    });
    return { id: school.id, owner: ownerUser };
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    fixture = await createTenantFixture(app);
    teacherOfA = (await createStaff({ displayName: 'Учитель А', role: 'teacher' })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describeSchoolIsolation('staff', () => ({ app, fixture }), [
    { method: 'get', path: '/staff' },
    { method: 'post', path: '/staff', body: () => ({ displayName: 'Чужой', role: 'teacher' }) },
    {
      method: 'patch',
      path: () => `/staff/${teacherOfA}`,
      label: 'PATCH /staff/:id',
      body: () => ({ displayName: 'Чужой' }),
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/staff/${teacherOfA}/invite`,
      label: 'POST /staff/:id/invite',
      targetsSchoolARecord: true,
    },
  ]);

  describe('access', () => {
    it('lets the admin read the list but change nothing', async () => {
      const { admin } = fixture.schoolA;
      await api('get', '/staff', admin.auth).expect(200);
      const attempts = [
        api('post', '/staff', admin.auth).send({ displayName: 'Новый', role: 'teacher' }),
        api('patch', `/staff/${teacherOfA}`, admin.auth).send({ displayName: 'Другое' }),
        api('post', `/staff/${teacherOfA}/invite`, admin.auth),
      ];
      for (const res of await Promise.all(attempts)) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
      }
    });

    it.each(['teacher', 'parent'] as const)('closes every endpoint to a %s', async (role) => {
      const { auth } = fixture.schoolA[role];
      const attempts = [
        api('get', '/staff', auth),
        api('post', '/staff', auth).send({ displayName: 'Новый', role: 'teacher' }),
        api('patch', `/staff/${teacherOfA}`, auth).send({ displayName: 'Другое' }),
        api('post', `/staff/${teacherOfA}/invite`, auth),
      ];
      for (const res of await Promise.all(attempts)) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
      }
    });
  });

  describe('list', () => {
    it('shows staff roles only, the owner first, with the plan usage', async () => {
      const { schoolA } = fixture;
      const res = await api('get', '/staff', schoolA.owner.auth).expect(200);
      const body = res.body as StaffListResponse;

      expect(body.items[0]).toMatchObject({ role: 'owner', status: 'active', isSelf: true });
      expect(body.items.map((m) => m.role)).not.toContain('parent');
      const names = body.items.slice(1).map((m) => m.displayName);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ru')));
      expect(body.limit).toEqual({ used: body.items.length, max: 100 });
    });

    it('filters by role and status', async () => {
      const teachers = await api('get', '/staff?role=teacher', owner()).expect(200);
      expect((teachers.body as StaffListResponse).items.every((m) => m.role === 'teacher')).toBe(
        true,
      );
      const invited = await api('get', '/staff?status=invited', owner()).expect(200);
      expect((invited.body as StaffListResponse).items.map((m) => m.id)).toContain(teacherOfA);
      await api('get', '/staff?role=parent', owner()).expect(400);
    });
  });

  describe('create and join', () => {
    it('creates an invited member, issues a link and lets the person in', async () => {
      const created = await createStaff({
        displayName: '  Мадина Рахимова ',
        phone: '+992 93 000-00-01',
        role: 'admin',
      });
      expect(created).toMatchObject({
        displayName: 'Мадина Рахимова',
        phone: '+992 93 000-00-01',
        role: 'admin',
        status: 'invited',
        isSelf: false,
        inviteExpiresAt: null,
      });

      const link = await api('post', `/staff/${created.id}/invite`, owner()).expect(201);
      const ttl = new Date(link.body.expiresAt).getTime() - Date.now();
      expect(ttl).toBeGreaterThan(7 * 24 * HOUR_MS - HOUR_MS);
      expect(ttl).toBeLessThanOrEqual(7 * 24 * HOUR_MS);
      const listed = await api('get', '/staff', owner()).expect(200);
      const entry = (listed.body as StaffListResponse).items.find((m) => m.id === created.id);
      expect(entry?.inviteExpiresAt).toBe(link.body.expiresAt);

      const person = await newUser();
      await request(app.getHttpServer())
        .post('/api/v1/invites/accept')
        .set('Authorization', person.auth)
        .send({ token: tokenOf(link.body.url) })
        .expect(200);

      // The new admin passes @SchoolRoles('owner', 'admin').
      const asAdmin = await api('get', '/staff', person.auth).expect(200);
      const self = (asAdmin.body as StaffListResponse).items.find((m) => m.id === created.id);
      expect(self).toMatchObject({ status: 'active', isSelf: true, inviteExpiresAt: null });

      const again = await api('post', `/staff/${created.id}/invite`, owner()).expect(409);
      expect(again.body.error.code).toBe('STAFF_ALREADY_JOINED');
    });

    it('validates the input', async () => {
      await api('post', '/staff', owner()).send({ displayName: 'Я', role: 'teacher' }).expect(400);
      await api('post', '/staff', owner()).send({ displayName: 'Имя', role: 'owner' }).expect(400);
      await api('post', '/staff', owner()).send({ displayName: 'Имя', role: 'parent' }).expect(400);
      await api('post', '/staff', owner())
        .send({ displayName: 'Имя', role: 'teacher', phone: 'нет' })
        .expect(400);
      await api('patch', `/staff/${teacherOfA}`, owner()).send({}).expect(400);
      await api('patch', `/staff/${teacherOfA}`, owner()).send({ status: 'invited' }).expect(400);
    });

    it('renames and clears the phone, with an audit trail', async () => {
      const member = await createStaff({
        displayName: 'Имя',
        phone: '+992930000002',
        role: 'teacher',
      });
      const res = await api('patch', `/staff/${member.id}`, owner())
        .send({ displayName: 'Новое имя', phone: '' })
        .expect(200);
      expect(res.body).toMatchObject({ displayName: 'Новое имя', phone: null });

      const logs = await prisma.auditLog.findMany({
        where: { entity: 'Membership', entityId: member.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((log) => log.action)).toEqual(['create', 'update']);
      expect(logs[1]).toMatchObject({
        actorUserId: fixture.schoolA.owner.userId,
        before: { displayName: 'Имя', phone: '+992930000002' },
        after: { displayName: 'Новое имя', phone: null },
      });
    });
  });

  describe('deactivation', () => {
    it('cuts access on the next request, revokes links and keeps the record', async () => {
      const joined = await createStaff({ displayName: 'Бывший админ', role: 'admin' });
      const person = await join(joined.id);
      await api('get', '/staff', person.auth).expect(200);

      const pending = await createStaff({ displayName: 'Не успел', role: 'teacher' });
      await api('post', `/staff/${pending.id}/invite`, owner()).expect(201);

      await api('patch', `/staff/${joined.id}`, owner())
        .send({ status: 'deactivated' })
        .expect(200);
      const denied = await api('get', '/staff', person.auth).expect(404);
      expect(denied.body.error.code).toBe('SCHOOL_NOT_FOUND');

      const res = await api('patch', `/staff/${pending.id}`, owner())
        .send({ status: 'deactivated' })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'deactivated', inviteExpiresAt: null });
      const live = await prisma.inviteToken.count({
        where: { membershipId: pending.id, revokedAt: null, usedAt: null },
      });
      expect(live).toBe(0);
      const reissue = await api('post', `/staff/${pending.id}/invite`, owner()).expect(409);
      expect(reissue.body.error.code).toBe('STAFF_DEACTIVATED');

      const list = await api('get', '/staff?status=deactivated', owner()).expect(200);
      const ids = (list.body as StaffListResponse).items.map((m) => m.id);
      expect(ids).toEqual(expect.arrayContaining([joined.id, pending.id]));
    });

    it('returns a joined person as active and a never-joined one as invited', async () => {
      const joined = await createStaff({ displayName: 'Вернётся', role: 'teacher' });
      const person = await join(joined.id);
      const pending = await createStaff({ displayName: 'Так и не вошёл', role: 'teacher' });

      for (const id of [joined.id, pending.id]) {
        await api('patch', `/staff/${id}`, owner()).send({ status: 'deactivated' }).expect(200);
      }
      const back = await api('patch', `/staff/${joined.id}`, owner())
        .send({ status: 'active' })
        .expect(200);
      expect(back.body.status).toBe('active');
      const invited = await api('patch', `/staff/${pending.id}`, owner())
        .send({ status: 'active' })
        .expect(200);
      expect(invited.body.status).toBe('invited');

      const membership = await prisma.membership.findUniqueOrThrow({ where: { id: joined.id } });
      expect(membership.userId).toBe(person.userId);
    });

    it('never changes the owner status', async () => {
      const list = await api('get', '/staff?role=owner', owner()).expect(200);
      const ownerId = (list.body as StaffListResponse).items[0]!.id;
      const res = await api('patch', `/staff/${ownerId}`, owner())
        .send({ status: 'deactivated' })
        .expect(409);
      expect(res.body.error.code).toBe('OWNER_IMMUTABLE');
      // Renaming the owner is allowed.
      await api('patch', `/staff/${ownerId}`, owner()).send({ displayName: 'Хозяин' }).expect(200);
    });

    it('answers 404 for a parent membership', async () => {
      const parent = await prisma.membership.findFirstOrThrow({
        where: { schoolId: fixture.schoolA.id, role: 'parent' },
      });
      const res = await api('patch', `/staff/${parent.id}`, owner())
        .send({ status: 'deactivated' })
        .expect(404);
      expect(res.body.error.code).toBe('STAFF_NOT_FOUND');
      await api('post', `/staff/${parent.id}/invite`, owner()).expect(404);
    });
  });

  describe('plan limit', () => {
    it('counts invited staff and frees a seat on deactivation', async () => {
      const school = await schoolWithPlan(2);
      const auth = school.owner.auth;
      const first = await createStaff({ displayName: 'Первый', role: 'teacher' }, auth, school.id);

      const full = await api('post', '/staff', auth, school.id)
        .send({ displayName: 'Третий', role: 'admin' })
        .expect(422);
      expect(full.body.error).toMatchObject({
        code: 'PLAN_LIMIT_REACHED',
        details: { limit: 'staff', max: 2 },
      });
      const usage = await api('get', '/staff', auth, school.id).expect(200);
      expect((usage.body as StaffListResponse).limit).toEqual({ used: 2, max: 2 });

      await api('patch', `/staff/${first.id}`, auth, school.id)
        .send({ status: 'deactivated' })
        .expect(200);
      await createStaff({ displayName: 'Третий', role: 'admin' }, auth, school.id);

      const back = await api('patch', `/staff/${first.id}`, auth, school.id)
        .send({ status: 'active' })
        .expect(422);
      expect(back.body.error.code).toBe('PLAN_LIMIT_REACHED');
    });

    it('lets back a person who still holds a seat through another role', async () => {
      const school = await schoolWithPlan(2);
      const auth = school.owner.auth;
      const asTeacher = await createStaff(
        { displayName: 'Двое в одном', role: 'teacher' },
        auth,
        school.id,
      );
      const person = await join(asTeacher.id, auth, school.id);
      // The plan is full (owner + this person); the same person's second role, as if they had
      // accepted a second link before the plan shrank.
      const second = await prisma.membership.create({
        data: {
          schoolId: school.id,
          userId: person.userId,
          role: 'admin',
          displayName: 'Двое в одном',
          status: 'active',
        },
      });
      await api('patch', `/staff/${second.id}`, auth, school.id)
        .send({ status: 'deactivated' })
        .expect(200);
      await api('patch', `/staff/${second.id}`, auth, school.id)
        .send({ status: 'active' })
        .expect(200);
    });
  });

  it('stores only the hash of issued tokens', async () => {
    const member = await createStaff({ displayName: 'Хэш', role: 'teacher' });
    const link = await api('post', `/staff/${member.id}/invite`, owner()).expect(201);
    const token = tokenOf(link.body.url);
    const stored = await prisma.inviteToken.findMany({ where: { membershipId: member.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).toBe(hashToken(token));
  });
});
