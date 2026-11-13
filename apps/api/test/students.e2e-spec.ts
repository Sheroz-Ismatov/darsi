import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type {
  CourseDto,
  EnrollmentDto,
  GroupDto,
  MeResponse,
  StudentDetailDto,
  StudentGuardianChangeResponse,
  StudentListResponse,
} from '@darsi/shared';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/token.service';
import { createTestApp, hasTestDb } from './helpers/test-app';
import { describeSchoolIsolation } from './isolation/describe-school-isolation';
import {
  createTenantFixture,
  type TenantFixture,
  type TestMember,
} from './isolation/tenant-fixture';

type Method = 'get' | 'post' | 'patch' | 'delete';

/** FR-19 asks for 300 ms; the cloud test database adds its own latency (T-18, decision 10). */
const SEARCH_SOFT_LIMIT_MS = 1_500;

const uniqueTelegramId = (): bigint => BigInt(7_000_000_000 + randomInt(0, 999_999_999));
/** A phone nobody else in the test database has, as `+992…` digits. */
const uniquePhone = (): string => `+99290${randomInt(1_000_000, 9_999_999)}`;

const tokenOf = (url: string): string => {
  const match = /\?start=inv_([\w-]+)$/.exec(url);
  if (!match?.[1]) throw new Error(`Unexpected invite url: ${url}`);
  return match[1];
};

// Scenarios here chain a dozen round trips to the remote test database; 30 s is not enough.
describe.skipIf(!hasTestDb)('students and enrollments (e2e)', { timeout: 90_000 }, () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: TenantFixture;
  let teacherOfA: string;
  let courseOfA: CourseDto;
  let groupOfA: GroupDto;
  let studentOfA: StudentDetailDto;
  let enrollmentOfA: EnrollmentDto;

  const http = () => request(app.getHttpServer());
  const api = (method: Method, path: string, auth: string, schoolId = fixture.schoolA.id) =>
    http()[method](`/api/v1${path}`).set('Authorization', auth).set('X-School-Id', schoolId);
  const owner = () => fixture.schoolA.owner.auth;

  const studentBody = (overrides: object = {}, guardian: object = {}) => ({
    firstName: 'Алишер',
    lastName: 'Каримов',
    guardian: { name: 'Мадина Каримова', phone: uniquePhone(), relation: 'mother', ...guardian },
    ...overrides,
  });

  const createStudent = async (
    overrides: object = {},
    guardian: object = {},
    auth = owner(),
    schoolId = fixture.schoolA.id,
  ): Promise<StudentGuardianChangeResponse> => {
    const res = await api('post', '/students', auth, schoolId)
      .send(studentBody(overrides, guardian))
      .expect(201);
    return res.body as StudentGuardianChangeResponse;
  };

  const createGroup = async (
    overrides: object = {},
    courseId = courseOfA.id,
  ): Promise<GroupDto> => {
    const res = await api('post', '/groups', owner())
      .send({
        courseId,
        name: 'Группа',
        teacherMembershipId: teacherOfA,
        capacity: 8,
        ...overrides,
      })
      .expect(201);
    return res.body as GroupDto;
  };

  const enroll = (studentId: string, body: object) =>
    api('post', `/students/${studentId}/enrollments`, owner()).send(body);

  const getStudent = async (id: string): Promise<StudentDetailDto> =>
    (await api('get', `/students/${id}`, owner()).expect(200)).body as StudentDetailDto;

  const list = async (query: string, auth = owner(), schoolId = fixture.schoolA.id) =>
    (await api('get', `/students${query}`, auth, schoolId).expect(200)).body as StudentListResponse;

  const newUser = async (): Promise<TestMember> => {
    const user = await prisma.user.create({
      data: { telegramId: uniqueTelegramId(), firstName: 'Родитель' },
    });
    const token = await app.get(TokenService).issueAccessToken(user.id);
    return { userId: user.id, auth: `Bearer ${token}` };
  };

  const accept = (token: string, member: TestMember) =>
    http().post('/api/v1/invites/accept').set('Authorization', member.auth).send({ token });

  /** A school on its own plan with an active owner. */
  const schoolWithPlan = async (maxStudents: number) => {
    const plan = await prisma.plan.create({
      data: { name: `students-${maxStudents}`, maxStudents, maxStaff: 10, maxStorageMb: 10 },
    });
    const ownerUser = await newUser();
    const school = await prisma.school.create({
      data: {
        name: 'Лимит учеников',
        code: `students-${uniqueTelegramId()}`,
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
    teacherOfA = (
      await prisma.membership.findFirstOrThrow({
        where: { schoolId: fixture.schoolA.id, role: 'teacher' },
      })
    ).id;
    courseOfA = (
      await api('post', '/courses', owner())
        .send({
          name: 'Робототехника',
          format: 'offline',
          kind: 'group',
          color: 'lime',
          icon: 'bot',
        })
        .expect(201)
    ).body as CourseDto;
    groupOfA = await createGroup({ name: 'Группа А' });
    studentOfA = (await createStudent({ firstName: 'Изоляция' })).student;
    enrollmentOfA = (await enroll(studentOfA.id, { groupId: groupOfA.id }).expect(201))
      .body as EnrollmentDto;
  });

  afterAll(async () => {
    await app.close();
  });

  const guardianBody = () => ({ name: 'Отец', phone: uniquePhone(), relation: 'father' });

  describeSchoolIsolation('students', () => ({ app, fixture }), [
    { method: 'get', path: '/students' },
    { method: 'post', path: '/students', body: () => studentBody() },
    {
      method: 'get',
      path: () => `/students/${studentOfA.id}`,
      label: 'GET /students/:id',
      targetsSchoolARecord: true,
    },
    {
      method: 'patch',
      path: () => `/students/${studentOfA.id}`,
      label: 'PATCH /students/:id',
      body: () => ({ comment: 'Чужой' }),
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/students/${studentOfA.id}/archive`,
      label: 'POST /students/:id/archive',
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/students/${studentOfA.id}/unarchive`,
      label: 'POST /students/:id/unarchive',
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/students/${studentOfA.id}/guardians`,
      label: 'POST /students/:id/guardians',
      body: guardianBody,
      targetsSchoolARecord: true,
    },
    {
      method: 'delete',
      path: () => `/students/${studentOfA.id}/guardians/${studentOfA.guardians[0]!.id}`,
      label: 'DELETE /students/:id/guardians/:guardianId',
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/students/${studentOfA.id}/invite`,
      label: 'POST /students/:id/invite',
      body: () => ({ guardianId: studentOfA.guardians[0]!.id }),
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/students/${studentOfA.id}/enrollments`,
      label: 'POST /students/:id/enrollments',
      body: () => ({ groupId: groupOfA.id }),
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/enrollments/${enrollmentOfA.id}/leave`,
      label: 'POST /enrollments/:id/leave',
      body: () => ({}),
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/enrollments/${enrollmentOfA.id}/transfer`,
      label: 'POST /enrollments/:id/transfer',
      body: () => ({ groupId: groupOfA.id }),
      targetsSchoolARecord: true,
    },
  ]);

  it('hides school A students from school B', async () => {
    const { schoolB } = fixture;
    const res = await list('', schoolB.owner.auth, schoolB.id);
    expect(res.items.map((s) => s.id)).not.toContain(studentOfA.id);
  });

  describe('access', () => {
    it('lets the admin manage students', async () => {
      const { admin } = fixture.schoolA;
      const created = await createStudent({ firstName: 'Админский' }, {}, admin.auth);
      const id = created.student.id;
      await api('get', '/students', admin.auth).expect(200);
      await api('get', `/students/${id}`, admin.auth).expect(200);
      await api('patch', `/students/${id}`, admin.auth).send({ comment: 'Ок' }).expect(200);
      await api('post', `/students/${id}/guardians`, admin.auth).send(guardianBody()).expect(201);
      await api('post', `/students/${id}/invite`, admin.auth)
        .send({ guardianId: created.student.guardians[0]!.id })
        .expect(201);
      const enrolled = await api('post', `/students/${id}/enrollments`, admin.auth)
        .send({ groupId: groupOfA.id })
        .expect(201);
      await api('post', `/enrollments/${enrolled.body.id}/leave`, admin.auth).send({}).expect(200);
      await api('post', `/students/${id}/archive`, admin.auth).expect(200);
      await api('post', `/students/${id}/unarchive`, admin.auth).expect(200);
    });

    it.each(['teacher', 'parent'] as const)('closes every endpoint to a %s', async (role) => {
      const { auth } = fixture.schoolA[role];
      const id = studentOfA.id;
      const attempts = [
        api('get', '/students', auth),
        api('post', '/students', auth).send(studentBody()),
        api('get', `/students/${id}`, auth),
        api('patch', `/students/${id}`, auth).send({ comment: 'x' }),
        api('post', `/students/${id}/archive`, auth),
        api('post', `/students/${id}/unarchive`, auth),
        api('post', `/students/${id}/guardians`, auth).send(guardianBody()),
        api('delete', `/students/${id}/guardians/${studentOfA.guardians[0]!.id}`, auth),
        api('post', `/students/${id}/invite`, auth).send({
          guardianId: studentOfA.guardians[0]!.id,
        }),
        api('post', `/students/${id}/enrollments`, auth).send({ groupId: groupOfA.id }),
        api('post', `/enrollments/${enrollmentOfA.id}/leave`, auth).send({}),
        api('post', `/enrollments/${enrollmentOfA.id}/transfer`, auth).send({
          groupId: groupOfA.id,
        }),
      ];
      for (const res of await Promise.all(attempts)) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
      }
    });
  });

  describe('create', () => {
    it('creates a student with a placeholder parent and an audit trail', async () => {
      const phone = `+992 90 ${randomInt(100, 999)}-${randomInt(10, 99)}-${randomInt(10, 99)}`;
      const { student, guardianReused } = await createStudent(
        { lastName: ' Саидов ', birthDate: '2015-04-01', comment: 'Аллергия на орехи' },
        { phone },
      );
      expect(guardianReused).toBe(false);
      expect(student).toMatchObject({
        firstName: 'Алишер',
        lastName: 'Саидов',
        birthDate: '2015-04-01',
        comment: 'Аллергия на орехи',
        createdBy: 'admin',
        archived: false,
        groups: [],
        enrollments: [],
      });
      expect(student.guardians).toHaveLength(1);
      expect(student.guardians[0]).toMatchObject({
        name: 'Мадина Каримова',
        phone: `+${phone.replace(/\D/g, '')}`,
        relation: 'mother',
        joined: false,
        inviteExpiresAt: null,
      });
      const membership = await prisma.membership.findUniqueOrThrow({
        where: { id: student.guardians[0]!.membershipId },
      });
      expect(membership).toMatchObject({ role: 'parent', status: 'invited', userId: null });

      const logs = await prisma.auditLog.findMany({
        where: { schoolId: fixture.schoolA.id, entity: 'Student', entityId: student.id },
      });
      expect(logs.map((log) => log.action)).toEqual(['create']);
      const links = await prisma.auditLog.count({
        where: { entity: 'StudentGuardian', entityId: student.guardians[0]!.id, action: 'create' },
      });
      expect(links).toBe(1);
    });

    it('reuses a parent whose phone is written differently', async () => {
      const digits = `99290${randomInt(1_000_000, 9_999_999)}`;
      const spaced = `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
      const first = await createStudent({ firstName: 'Старший' }, { phone: spaced });
      const second = await createStudent({ firstName: 'Младший' }, { phone: digits });
      expect(first.guardianReused).toBe(false);
      expect(second.guardianReused).toBe(true);
      expect(second.student.guardians[0]!.membershipId).toBe(
        first.student.guardians[0]!.membershipId,
      );
      const parents = await prisma.membership.count({
        where: { schoolId: fixture.schoolA.id, role: 'parent', phone: `+${digits}` },
      });
      expect(parents).toBe(1);
    });

    it('validates names, dates, comment and phone', async () => {
      const bad = [
        studentBody({ firstName: '' }),
        studentBody({ lastName: 'Я'.repeat(61) }),
        studentBody({ birthDate: '1899-12-31' }),
        studentBody({ birthDate: '2999-01-01' }),
        studentBody({ birthDate: '2015-02-30' }),
        studentBody({ comment: 'x'.repeat(1001) }),
        studentBody({}, { phone: '12-34-56' }),
        studentBody({}, { phone: '1'.repeat(16) }),
        studentBody({}, { phone: 'abc1234567' }),
        studentBody({}, { relation: 'uncle' }),
        studentBody({}, { name: '' }),
      ];
      for (const body of bad) {
        const res = await api('post', '/students', owner()).send(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('edits the student and clears optional fields', async () => {
      const { student } = await createStudent({ birthDate: '2014-01-01', comment: 'Старый' });
      const res = await api('patch', `/students/${student.id}`, owner())
        .send({ firstName: 'Новое', birthDate: '', comment: '' })
        .expect(200);
      expect(res.body).toMatchObject({ firstName: 'Новое', birthDate: null, comment: null });
      const log = await prisma.auditLog.findFirstOrThrow({
        where: { entity: 'Student', entityId: student.id, action: 'update' },
      });
      expect(log.before).toEqual({
        firstName: 'Алишер',
        birthDate: '2014-01-01',
        comment: 'Старый',
      });
    });
  });

  describe('guardians and links', () => {
    it('lets a parent accept the link and see the school in /me', async () => {
      const { student } = await createStudent();
      const guardian = student.guardians[0]!;
      const link = await api('post', `/students/${student.id}/invite`, owner())
        .send({ guardianId: guardian.id })
        .expect(201);
      const expiresIn = Date.parse(link.body.expiresAt) - Date.now();
      expect(expiresIn).toBeGreaterThan(29 * 24 * 3600_000);
      expect(expiresIn).toBeLessThanOrEqual(30 * 24 * 3600_000);
      const pending = await getStudent(student.id);
      expect(pending.guardians[0]!.inviteExpiresAt).toBe(link.body.expiresAt);

      const parent = await newUser();
      await accept(tokenOf(link.body.url), parent).expect(200);
      const joined = await getStudent(student.id);
      expect(joined.guardians[0]).toMatchObject({ joined: true, inviteExpiresAt: null });
      const me = (await http().get('/api/v1/me').set('Authorization', parent.auth).expect(200))
        .body as MeResponse;
      expect(me.memberships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ schoolId: fixture.schoolA.id, role: 'parent' }),
        ]),
      );

      const again = await api('post', `/students/${student.id}/invite`, owner())
        .send({ guardianId: guardian.id })
        .expect(409);
      expect(again.body.error.code).toBe('GUARDIAN_ALREADY_JOINED');
    });

    it('merges a placeholder into a parent who joined by the school code', async () => {
      const school = await prisma.school.findUniqueOrThrow({ where: { id: fixture.schoolA.id } });
      const parent = await newUser();
      const joined = await http()
        .post(`/api/v1/schools/by-code/${school.code}/join`)
        .set('Authorization', parent.auth)
        .expect(201);
      const kept = joined.body.membership.id as string;
      // A child already linked to the kept membership, and a placeholder holding it and a sibling.
      const linked = await createStudent({ firstName: 'Первый' });
      await prisma.studentGuardian.create({
        data: {
          schoolId: fixture.schoolA.id,
          studentId: linked.student.id,
          membershipId: kept,
          relation: 'father',
        },
      });
      const phone = uniquePhone();
      const sibling = await createStudent({ firstName: 'Второй' }, { phone });
      const placeholderId = sibling.student.guardians[0]!.membershipId;
      await prisma.studentGuardian.create({
        data: {
          schoolId: fixture.schoolA.id,
          studentId: linked.student.id,
          membershipId: placeholderId,
          relation: 'father',
        },
      });

      const link = await api('post', `/students/${sibling.student.id}/invite`, owner())
        .send({ guardianId: sibling.student.guardians[0]!.id })
        .expect(201);
      await accept(tokenOf(link.body.url), parent).expect(200);

      const memberships = await prisma.membership.findMany({
        where: { schoolId: fixture.schoolA.id, userId: parent.userId },
      });
      expect(memberships.map((m) => m.id)).toEqual([kept]);
      expect(await prisma.membership.findUnique({ where: { id: placeholderId } })).toBeNull();
      const links = await prisma.studentGuardian.findMany({ where: { membershipId: kept } });
      expect(links.map((l) => l.studentId).sort()).toEqual(
        [linked.student.id, sibling.student.id].sort(),
      );

      // The phone typed for the placeholder survives the merge, so a third child finds the parent.
      const keptMembership = await prisma.membership.findUniqueOrThrow({ where: { id: kept } });
      expect(keptMembership.phone).toBe(phone);
      const third = await createStudent({ firstName: 'Третий' }, { phone });
      expect(third.guardianReused).toBe(true);
      expect(third.student.guardians[0]).toMatchObject({ membershipId: kept, phone, joined: true });
      const found = await list(`?search=${phone.slice(-7)}`);
      expect(found.items.map((s) => s.id)).toEqual(
        expect.arrayContaining([sibling.student.id, third.student.id]),
      );
    });

    it('adds a second parent, refuses a duplicate and unlinks', async () => {
      const { student } = await createStudent();
      const body = guardianBody();
      const added = await api('post', `/students/${student.id}/guardians`, owner())
        .send(body)
        .expect(201);
      expect(added.body.guardianReused).toBe(false);
      expect((added.body.student as StudentDetailDto).guardians).toHaveLength(2);

      const duplicate = await api('post', `/students/${student.id}/guardians`, owner())
        .send({ ...body, name: 'Тот же' })
        .expect(409);
      expect(duplicate.body.error.code).toBe('GUARDIAN_ALREADY_LINKED');

      const second = (added.body.student as StudentDetailDto).guardians[1]!;
      const after = await api(
        'delete',
        `/students/${student.id}/guardians/${second.id}`,
        owner(),
      ).expect(200);
      expect((after.body as StudentDetailDto).guardians.map((g) => g.id)).not.toContain(second.id);
      const audit = await prisma.auditLog.count({
        where: { entity: 'StudentGuardian', entityId: second.id, action: 'delete' },
      });
      expect(audit).toBe(1);

      const gone = await api(
        'delete',
        `/students/${student.id}/guardians/${second.id}`,
        owner(),
      ).expect(404);
      expect(gone.body.error.code).toBe('GUARDIAN_NOT_FOUND');
      // A link of another student does not work through this one.
      await api('post', `/students/${student.id}/invite`, owner())
        .send({ guardianId: studentOfA.guardians[0]!.id })
        .expect(404);
    });
  });

  describe('enrollments', () => {
    it('enrolls, refuses a repeat and counts the seat', async () => {
      const group = await createGroup({ capacity: 5 });
      const { student } = await createStudent();
      const res = await enroll(student.id, { groupId: group.id }).expect(201);
      expect(res.body).toMatchObject({
        studentId: student.id,
        status: 'active',
        leftOn: null,
        group: { id: group.id },
        course: { id: courseOfA.id, color: 'lime' },
      });
      expect(res.body.enrolledOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const repeat = await enroll(student.id, { groupId: group.id }).expect(409);
      expect(repeat.body.error.code).toBe('ALREADY_ENROLLED');

      const busy = await api('get', `/groups/${group.id}`, owner()).expect(200);
      expect(busy.body).toMatchObject({ enrolledCount: 1, freeSeats: 4 });
      const courses = await api('get', '/courses', owner()).expect(200);
      const summary = (courses.body as CourseDto[])
        .find((c) => c.id === courseOfA.id)!
        .groups.find((g) => g.id === group.id)!;
      expect(summary).toMatchObject({ enrolledCount: 1, freeSeats: 4 });

      await api('post', `/enrollments/${res.body.id}/leave`, owner())
        .send({ leftOn: res.body.enrolledOn })
        .expect(200);
      const free = await api('get', `/groups/${group.id}`, owner()).expect(200);
      expect(free.body).toMatchObject({ enrolledCount: 0, freeSeats: 5 });

      // The history stays and the student can come back.
      await enroll(student.id, { groupId: group.id }).expect(201);
      const detail = await getStudent(student.id);
      expect(detail.enrollments.map((e) => e.status)).toEqual(['active', 'left']);
    });

    it('warns about a full group and lets force through', async () => {
      const group = await createGroup({ capacity: 1 });
      const [a, b] = await Promise.all([createStudent(), createStudent()]);
      await enroll(a.student.id, { groupId: group.id }).expect(201);
      const full = await enroll(b.student.id, { groupId: group.id }).expect(409);
      expect(full.body.error).toMatchObject({
        code: 'GROUP_FULL',
        details: { capacity: 1, enrolled: 1 },
      });
      await enroll(b.student.id, { groupId: group.id, force: true }).expect(201);
      const over = await api('get', `/groups/${group.id}`, owner()).expect(200);
      expect(over.body).toMatchObject({ enrolledCount: 2, freeSeats: -1 });
    });

    it('refuses an archived group and a group of another school', async () => {
      const group = await createGroup();
      await api('post', `/groups/${group.id}/archive`, owner()).expect(200);
      const { student } = await createStudent();
      const archived = await enroll(student.id, { groupId: group.id }).expect(409);
      expect(archived.body.error.code).toBe('GROUP_ARCHIVED');

      const teacherOfB = await prisma.membership.findFirstOrThrow({
        where: { schoolId: fixture.schoolB.id, role: 'teacher' },
      });
      const courseOfB = await api(
        'post',
        '/courses',
        fixture.schoolB.owner.auth,
        fixture.schoolB.id,
      )
        .send({ name: 'Чужой', format: 'offline', kind: 'group', color: 'mint', icon: 'bot' })
        .expect(201);
      const groupOfB = await api('post', '/groups', fixture.schoolB.owner.auth, fixture.schoolB.id)
        .send({
          courseId: courseOfB.body.id,
          name: 'Чужая',
          teacherMembershipId: teacherOfB.id,
          capacity: 5,
        })
        .expect(201);
      const foreign = await enroll(student.id, { groupId: groupOfB.body.id }).expect(404);
      expect(foreign.body.error.code).toBe('GROUP_NOT_FOUND');
    });

    it('transfers in one step and keeps the history', async () => {
      const [from, to] = await Promise.all([createGroup(), createGroup({ name: 'Новая' })]);
      const { student } = await createStudent();
      const first = await enroll(student.id, { groupId: from.id, enrolledOn: '2026-09-01' }).expect(
        201,
      );
      const moved = await api('post', `/enrollments/${first.body.id}/transfer`, owner())
        .send({ groupId: to.id, date: '2026-10-15' })
        .expect(200);
      expect(moved.body).toMatchObject({
        status: 'active',
        enrolledOn: '2026-10-15',
        group: { id: to.id },
      });
      const detail = await getStudent(student.id);
      expect(detail.enrollments).toEqual([
        expect.objectContaining({ id: moved.body.id, status: 'active' }),
        expect.objectContaining({
          id: first.body.id,
          status: 'left',
          enrolledOn: '2026-09-01',
          leftOn: '2026-10-15',
        }),
      ]);
      expect(detail.groups.map((g) => g.id)).toEqual([to.id]);
      const actions = await prisma.auditLog.findMany({
        where: { entity: 'Enrollment', entityId: first.body.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(actions.map((a) => a.action)).toEqual(['create', 'transfer']);

      const again = await api('post', `/enrollments/${first.body.id}/transfer`, owner())
        .send({ groupId: from.id })
        .expect(409);
      expect(again.body.error.code).toBe('ENROLLMENT_NOT_ACTIVE');
      const early = await api('post', `/enrollments/${moved.body.id}/leave`, owner())
        .send({ leftOn: '2026-10-01' })
        .expect(400);
      expect(early.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('archive', () => {
    it('closes enrollments, hides the student and blocks enrolling until restored', async () => {
      const group = await createGroup();
      const later = await createGroup({ name: 'С будущей даты' });
      const { student } = await createStudent({ lastName: 'Архивов' });
      const current = await enroll(student.id, { groupId: group.id }).expect(201);
      const future = await enroll(student.id, {
        groupId: later.id,
        enrolledOn: '2099-01-10',
      }).expect(201);

      const archived = await api('post', `/students/${student.id}/archive`, owner()).expect(200);
      expect(archived.body).toMatchObject({ archived: true, groups: [] });
      const closed = (archived.body as StudentDetailDto).enrollments;
      const byId = (id: string) => closed.find((e) => e.id === id)!;
      expect(byId(current.body.id)).toMatchObject({ status: 'left' });
      expect(byId(current.body.id).leftOn).toMatch(/^\d{4}-/);
      // A future enrollment does not end before it starts.
      expect(byId(future.body.id)).toMatchObject({ status: 'left', leftOn: '2099-01-10' });

      expect((await list('?search=Архивов')).items.map((s) => s.id)).not.toContain(student.id);
      expect((await list('?search=Архивов&archived=true')).items.map((s) => s.id)).toContain(
        student.id,
      );
      const blocked = await enroll(student.id, { groupId: group.id }).expect(409);
      expect(blocked.body.error.code).toBe('STUDENT_ARCHIVED');

      const restored = await api('post', `/students/${student.id}/unarchive`, owner()).expect(200);
      expect(restored.body).toMatchObject({ archived: false, groups: [] });
      await enroll(student.id, { groupId: group.id }).expect(201);
      const logs = await prisma.auditLog.findMany({
        where: { entity: 'Student', entityId: student.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((l) => l.action)).toEqual(['create', 'archive', 'unarchive']);
    });
  });

  describe('plan limit', () => {
    it('stops at the plan maximum and frees a seat on archive', async () => {
      const school = await schoolWithPlan(2);
      const auth = school.owner.auth;
      const first = await createStudent({}, {}, auth, school.id);
      await createStudent({}, {}, auth, school.id);
      const full = await api('post', '/students', auth, school.id).send(studentBody()).expect(422);
      expect(full.body.error).toMatchObject({
        code: 'PLAN_LIMIT_REACHED',
        details: { limit: 'students', max: 2 },
      });
      await api('post', `/students/${first.student.id}/archive`, auth, school.id).expect(200);
      await createStudent({}, {}, auth, school.id);
      const back = await api(
        'post',
        `/students/${first.student.id}/unarchive`,
        auth,
        school.id,
      ).expect(422);
      expect(back.body.error.code).toBe('PLAN_LIMIT_REACHED');
    });
  });

  describe('search', () => {
    it('finds by a part of the name, by phone digits and by course or group', async () => {
      const marker = `Зз${randomInt(100_000, 999_999)}`;
      const phone = uniquePhone();
      const [a, b] = await Promise.all([
        createStudent({ lastName: `${marker}ова`, firstName: 'Нигина' }, { phone }),
        createStudent({ lastName: `${marker}ов`, firstName: 'Фарход' }),
      ]);
      const group = await createGroup();
      await enroll(b.student.id, { groupId: group.id }).expect(201);

      const byLast = await list(`?search=${encodeURIComponent(marker.toLowerCase())}`);
      expect(byLast.items.map((s) => s.id).sort()).toEqual([a.student.id, b.student.id].sort());
      const byBoth = await list(`?search=${encodeURIComponent(`нигина ${marker}`)}`);
      expect(byBoth.items.map((s) => s.id)).toEqual([a.student.id]);
      const byPhone = await list(`?search=${phone.slice(-7)}`);
      expect(byPhone.items.map((s) => s.id)).toEqual([a.student.id]);
      const byGroup = await list(`?search=${encodeURIComponent(marker)}&groupId=${group.id}`);
      expect(byGroup.items.map((s) => s.id)).toEqual([b.student.id]);
      expect(byGroup.items[0]!.groups).toEqual([
        expect.objectContaining({ id: group.id, courseColor: 'lime' }),
      ]);
      const byCourse = await list(`?search=${encodeURIComponent(marker)}&courseId=${courseOfA.id}`);
      expect(byCourse.items.map((s) => s.id)).toEqual([b.student.id]);
      expect(byCourse.items[0]!.guardians[0]).toMatchObject({ joined: false });
    });

    it('pages 500 students and answers a search within the soft limit', async ({ annotate }) => {
      const school = await schoolWithPlan(1000);
      const auth = school.owner.auth;
      await prisma.student.createMany({
        data: Array.from({ length: 500 }, (_, i) => ({
          schoolId: school.id,
          firstName: `Имя${i}`,
          lastName: `Фамилия${String(i).padStart(3, '0')}`,
          createdBy: 'admin' as const,
        })),
      });
      const first = await list('', auth, school.id);
      expect(first).toMatchObject({ total: 500, page: 1, pageSize: 50 });
      expect(first.items).toHaveLength(50);
      expect(first.items[0]!.lastName).toBe('Фамилия000');
      const last = await list('?page=10', auth, school.id);
      expect(last.items[49]!.lastName).toBe('Фамилия499');
      expect((await list('?page=11', auth, school.id)).items).toHaveLength(0);

      const started = performance.now();
      const found = await list('?search=фамилия12', auth, school.id);
      const elapsed = performance.now() - started;
      // Фамилия120…Фамилия129 and nothing else.
      expect(found.total).toBe(10);
      // The report of the task quotes the real figure (T-18, decision 10).
      await annotate(`search over 500 students: ${Math.round(elapsed)} ms`);
      expect(elapsed).toBeLessThan(SEARCH_SOFT_LIMIT_MS);
    });
  });
});
