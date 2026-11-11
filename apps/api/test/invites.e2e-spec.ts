import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  STAFF_INVITE_TTL_HOURS,
  type AcceptInviteResponse,
  type MeResponse,
  type PlanDto,
  type PlatformSchoolDto,
  type Role,
} from '@darsi/shared';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { hashToken, TokenService } from '../src/modules/auth/token.service';
import { InvitesService } from '../src/modules/invites/invites.service';
import { createTestApp, hasTestDb } from './helpers/test-app';
import {
  createTenantFixture,
  type TenantFixture,
  type TestMember,
} from './isolation/tenant-fixture';

const WEB_URL = 'http://localhost:5173';

const tokenOf = (url: string): string => {
  const match = /\?start=inv_([\w-]+)$/.exec(url);
  if (!match?.[1]) throw new Error(`Unexpected invite url: ${url}`);
  return match[1];
};

describe.skipIf(!hasTestDb)('invites and joining by code (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let invites: InvitesService;
  let fixture: TenantFixture;
  let plan: PlanDto;

  const http = () => request(app.getHttpServer());
  const accept = (token: string, member: TestMember) =>
    http().post('/api/v1/invites/accept').set('Authorization', member.auth).send({ token });
  const join = (code: string, member: TestMember) =>
    http().post(`/api/v1/schools/by-code/${code}/join`).set('Authorization', member.auth);
  const me = async (member: TestMember): Promise<MeResponse> =>
    (await http().get('/api/v1/me').set('Authorization', member.auth).expect(200)).body;

  const newUser = async (firstName = 'Гость', lastName?: string): Promise<TestMember> => {
    const user = await prisma.user.create({
      data: { telegramId: BigInt(8_000_000_000 + randomInt(0, 999_999_999)), firstName, lastName },
    });
    const token = await app.get(TokenService).issueAccessToken(user.id);
    return { userId: user.id, auth: `Bearer ${token}` };
  };

  const platform = (method: 'post' | 'patch', path: string) =>
    http()[method](`/api/v1/platform/${path}`).set('Authorization', fixture.superadmin.auth);

  /** A fresh school from the platform API with its owner invite link. */
  const schoolWithOwnerInvite = async () => {
    const created = await platform('post', 'schools')
      .send({
        name: 'Школа приглашений',
        currency: 'TJS',
        timezone: 'Asia/Dushanbe',
        planId: plan.id,
        ownerName: 'Мадина Каримова',
      })
      .expect(201);
    const school = created.body as PlatformSchoolDto;
    const invite = await platform('post', `schools/${school.id}/owner-invite`).expect(201);
    return { school, token: tokenOf(invite.body.url) };
  };

  /** Invited placeholder of the given role in a fixture school, with a fresh link. */
  const placeholderInvite = async (schoolId: string, role: Role) => {
    const placeholder = await prisma.membership.create({
      data: { schoolId, role, displayName: `Приглашённый ${role}` },
    });
    const link = await invites.issue({
      schoolId,
      membershipId: placeholder.id,
      ttlHours: STAFF_INVITE_TTL_HOURS,
      actorId: fixture.superadmin.userId,
    });
    return { placeholder, token: tokenOf(link.url) };
  };

  const codeOf = async (schoolId: string): Promise<string> =>
    (await prisma.school.findUniqueOrThrow({ where: { id: schoolId } })).code;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    invites = app.get(InvitesService);
    fixture = await createTenantFixture(app);
    const res = await platform('post', 'plans')
      .send({ name: 'T-12', maxStudents: 50, maxStaff: 10, maxStorageMb: 100 })
      .expect(201);
    plan = res.body as PlanDto;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /invites/accept', () => {
    it('makes a stranger the owner of a new school (UC-1 end to end)', async () => {
      const { school, token } = await schoolWithOwnerInvite();
      const owner = await newUser('Мадина');

      const res = await accept(token, owner).expect(200);
      const body = res.body as AcceptInviteResponse;
      expect(body).toEqual({
        membership: {
          id: expect.any(String),
          schoolId: school.id,
          schoolName: 'Школа приглашений',
          role: 'owner',
        },
        webUrl: WEB_URL,
      });

      const profile = await me(owner);
      expect(profile.memberships).toEqual([
        expect.objectContaining({ schoolId: school.id, role: 'owner', status: 'active' }),
      ]);

      // The owner keeps the name the superadmin typed; the platform sees the owner as joined.
      const stored = await prisma.membership.findUniqueOrThrow({
        where: { id: body.membership.id },
      });
      expect(stored).toMatchObject({ userId: owner.userId, displayName: 'Мадина Каримова' });
      const list = await http()
        .get('/api/v1/platform/schools')
        .set('Authorization', fixture.superadmin.auth)
        .expect(200);
      const listed = (list.body as PlatformSchoolDto[]).find((s) => s.id === school.id);
      expect(listed).toMatchObject({
        owner: { status: 'active' },
        ownerInviteExpiresAt: null,
      });

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: body.membership.id, action: 'accept_invite' },
      });
      expect(audit).toMatchObject({ actorUserId: owner.userId, after: { role: 'owner' } });
    });

    it('lets the same person open the link again but nobody else', async () => {
      const { token } = await schoolWithOwnerInvite();
      const owner = await newUser();

      const first = await accept(token, owner).expect(200);
      const again = await accept(token, owner).expect(200);
      expect(again.body).toEqual(first.body);

      const other = await accept(token, await newUser()).expect(409);
      expect(other.body.error.code).toBe('INVITE_USED');
    });

    it('rejects expired, replaced, unknown and malformed links', async () => {
      const { placeholder, token } = await placeholderInvite(fixture.schoolA.id, 'teacher');
      await prisma.inviteToken.update({
        where: { tokenHash: hashToken(token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const expired = await accept(token, await newUser()).expect(410);
      expect(expired.body.error.code).toBe('INVITE_EXPIRED');

      const first = await invites.issue({
        schoolId: fixture.schoolA.id,
        membershipId: placeholder.id,
        ttlHours: 1,
        actorId: fixture.superadmin.userId,
      });
      await invites.issue({
        schoolId: fixture.schoolA.id,
        membershipId: placeholder.id,
        ttlHours: 1,
        actorId: fixture.superadmin.userId,
      });
      const replaced = await accept(tokenOf(first.url), await newUser()).expect(409);
      expect(replaced.body.error.code).toBe('INVITE_USED');

      const unknown = await accept('x'.repeat(32), fixture.outsider).expect(404);
      expect(unknown.body.error.code).toBe('INVITE_NOT_FOUND');

      const malformed = await accept('short', fixture.outsider).expect(400);
      expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
      await accept('a/b'.repeat(10), fixture.outsider).expect(400);
    });

    it('lets exactly one of two simultaneous people through', async () => {
      const { token } = await placeholderInvite(fixture.schoolB.id, 'teacher');
      const [a, b] = await Promise.all([newUser(), newUser()]);

      const results = await Promise.all([accept(token, a), accept(token, b)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it('merges a second invite of the same role into the existing membership', async () => {
      const { schoolA } = fixture;
      const { placeholder, token } = await placeholderInvite(schoolA.id, 'admin');
      const existing = await prisma.membership.findFirstOrThrow({
        where: { schoolId: schoolA.id, userId: schoolA.admin.userId, role: 'admin' },
      });

      const res = await accept(token, schoolA.admin).expect(200);
      expect(res.body.membership.id).toBe(existing.id);

      expect(await prisma.membership.findUnique({ where: { id: placeholder.id } })).toBeNull();
      const admins = await prisma.membership.count({
        where: { schoolId: schoolA.id, userId: schoolA.admin.userId, role: 'admin' },
      });
      expect(admins).toBe(1);
      const moved = await prisma.inviteToken.findUniqueOrThrow({
        where: { tokenHash: hashToken(token) },
      });
      expect(moved.membershipId).toBe(existing.id);

      // Pressing the button again after the merge is still the harmless repeat.
      await accept(token, schoolA.admin).expect(200);
    });

    it('returns no panel address for teachers and parents', async () => {
      const teacher = await placeholderInvite(fixture.schoolB.id, 'teacher');
      const asTeacher = await accept(teacher.token, await newUser()).expect(200);
      expect(asTeacher.body).toMatchObject({ membership: { role: 'teacher' }, webUrl: null });

      const parent = await placeholderInvite(fixture.schoolB.id, 'parent');
      const asParent = await accept(parent.token, await newUser()).expect(200);
      expect(asParent.body).toMatchObject({ membership: { role: 'parent' }, webUrl: null });
    });

    it('refuses links of a blocked school and of a deactivated membership', async () => {
      const { school, token } = await schoolWithOwnerInvite();
      await platform('patch', `schools/${school.id}`).send({ status: 'blocked' }).expect(200);
      const blocked = await accept(token, await newUser()).expect(403);
      expect(blocked.body.error.code).toBe('SCHOOL_BLOCKED');

      const { placeholder, token: staffToken } = await placeholderInvite(
        fixture.schoolA.id,
        'teacher',
      );
      await prisma.membership.update({
        where: { id: placeholder.id },
        data: { status: 'deactivated' },
      });
      const deactivated = await accept(staffToken, await newUser()).expect(409);
      expect(deactivated.body.error.code).toBe('INVITE_USED');
    });

    it('requires a signed-in user', async () => {
      await http()
        .post('/api/v1/invites/accept')
        .send({ token: 'x'.repeat(32) })
        .expect(401);
    });
  });

  describe('POST /schools/by-code/:code/join', () => {
    it('makes the user a parent once, then answers with the same membership', async () => {
      const { schoolA } = fixture;
      const code = await codeOf(schoolA.id);
      const parent = await newUser('Нигина', 'Саидова');

      const first = await join(code, parent).expect(201);
      expect(first.body).toMatchObject({
        created: true,
        membership: { schoolId: schoolA.id, role: 'parent' },
      });
      const stored = await prisma.membership.findUniqueOrThrow({
        where: { id: first.body.membership.id },
      });
      expect(stored).toMatchObject({ status: 'active', displayName: 'Нигина Саидова' });

      const again = await join(code, parent).expect(200);
      expect(again.body).toEqual({ ...first.body, created: false });
      expect((await me(parent)).memberships).toHaveLength(1);
    });

    it('survives two simultaneous joins of the same person', async () => {
      const code = await codeOf(fixture.schoolB.id);
      const parent = await newUser();

      const results = await Promise.all([join(code, parent), join(code, parent)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
      const count = await prisma.membership.count({
        where: { schoolId: fixture.schoolB.id, userId: parent.userId, role: 'parent' },
      });
      expect(count).toBe(1);
    });

    it('answers 404 for an unknown code and 400 for a malformed one', async () => {
      const unknown = await join(`nope-${randomInt(0, 999_999)}`, fixture.outsider).expect(404);
      expect(unknown.body.error.code).toBe('SCHOOL_NOT_FOUND');
      await join('A_B', fixture.outsider).expect(400);
    });

    it('keeps out a parent the school has deactivated', async () => {
      const { schoolA } = fixture;
      const parent = await newUser();
      await prisma.membership.create({
        data: {
          schoolId: schoolA.id,
          userId: parent.userId,
          role: 'parent',
          displayName: 'Отключённый родитель',
          status: 'deactivated',
        },
      });
      const res = await join(await codeOf(schoolA.id), parent).expect(403);
      expect(res.body.error.code).toBe('MEMBERSHIP_DEACTIVATED');
    });

    it('refuses a blocked school', async () => {
      const { school } = await schoolWithOwnerInvite();
      await platform('patch', `schools/${school.id}`).send({ status: 'blocked' }).expect(200);
      const res = await join(school.code, await newUser()).expect(403);
      expect(res.body.error.code).toBe('SCHOOL_BLOCKED');
    });

    it('requires a signed-in user', async () => {
      await http().post('/api/v1/schools/by-code/demo/join').expect(401);
    });
  });
});
