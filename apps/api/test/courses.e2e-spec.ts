import type { INestApplication } from '@nestjs/common';
import type { CourseDto, GroupDto } from '@darsi/shared';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp, hasTestDb } from './helpers/test-app';
import { describeSchoolIsolation } from './isolation/describe-school-isolation';
import { createTenantFixture, type TenantFixture } from './isolation/tenant-fixture';

type Method = 'get' | 'post' | 'patch' | 'delete';

const courseBody = (overrides: object = {}) => ({
  name: 'Робототехника',
  format: 'offline',
  kind: 'group',
  color: 'lime',
  icon: 'bot',
  ...overrides,
});

describe.skipIf(!hasTestDb)('courses and groups (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: TenantFixture;
  /** Records of school A for the isolation suite. */
  let courseOfA: CourseDto;
  let groupOfA: GroupDto;
  /** Membership ids of the fixture teachers. */
  let teacherOfA: string;
  let teacherOfB: string;

  const api = (method: Method, path: string, auth: string, schoolId = fixture.schoolA.id) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', auth)
      .set('X-School-Id', schoolId);

  const owner = () => fixture.schoolA.owner.auth;

  const createCourse = async (overrides: object = {}, auth = owner()): Promise<CourseDto> => {
    const res = await api('post', '/courses', auth).send(courseBody(overrides)).expect(201);
    return res.body as CourseDto;
  };

  const createGroup = async (courseId: string, overrides: object = {}): Promise<GroupDto> => {
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

  const teacherMembership = (schoolId: string, userId: string) =>
    prisma.membership
      .findFirstOrThrow({ where: { schoolId, userId, role: 'teacher' } })
      .then((m) => m.id);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    fixture = await createTenantFixture(app);
    [teacherOfA, teacherOfB] = await Promise.all([
      teacherMembership(fixture.schoolA.id, fixture.schoolA.teacher.userId),
      teacherMembership(fixture.schoolB.id, fixture.schoolB.teacher.userId),
    ]);
    courseOfA = await createCourse({ name: 'Курс А' });
    groupOfA = await createGroup(courseOfA.id, { name: 'Группа А' });
  });

  afterAll(async () => {
    await app.close();
  });

  describeSchoolIsolation('courses', () => ({ app, fixture }), [
    { method: 'get', path: '/courses' },
    { method: 'post', path: '/courses', body: () => courseBody({ name: 'Чужой' }) },
    {
      method: 'patch',
      path: () => `/courses/${courseOfA.id}`,
      label: 'PATCH /courses/:id',
      body: () => ({ name: 'Чужой' }),
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/courses/${courseOfA.id}/archive`,
      label: 'POST /courses/:id/archive',
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/courses/${courseOfA.id}/unarchive`,
      label: 'POST /courses/:id/unarchive',
      targetsSchoolARecord: true,
    },
    {
      method: 'delete',
      path: () => `/courses/${courseOfA.id}`,
      label: 'DELETE /courses/:id',
      targetsSchoolARecord: true,
    },
    { method: 'get', path: '/groups' },
    {
      method: 'get',
      path: () => `/groups/${groupOfA.id}`,
      label: 'GET /groups/:id',
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: '/groups',
      body: () => ({
        courseId: courseOfA.id,
        name: 'Чужая',
        teacherMembershipId: teacherOfA,
        capacity: 5,
      }),
    },
    {
      method: 'patch',
      path: () => `/groups/${groupOfA.id}`,
      label: 'PATCH /groups/:id',
      body: () => ({ name: 'Чужая' }),
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/groups/${groupOfA.id}/archive`,
      label: 'POST /groups/:id/archive',
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/groups/${groupOfA.id}/unarchive`,
      label: 'POST /groups/:id/unarchive',
      targetsSchoolARecord: true,
    },
  ]);

  it('hides school A records from school B lists', async () => {
    const { schoolB } = fixture;
    const courses = await api('get', '/courses', schoolB.owner.auth, schoolB.id).expect(200);
    expect((courses.body as CourseDto[]).map((c) => c.id)).not.toContain(courseOfA.id);
    const groups = await api('get', '/groups', schoolB.owner.auth, schoolB.id).expect(200);
    expect((groups.body as GroupDto[]).map((g) => g.id)).not.toContain(groupOfA.id);
  });

  describe('access', () => {
    it('lets the admin manage courses and groups', async () => {
      const { admin } = fixture.schoolA;
      const course = await createCourse({ name: 'Курс админа' }, admin.auth);
      await api('patch', `/courses/${course.id}`, admin.auth).send({ name: 'Изменён' }).expect(200);
      const group = await api('post', '/groups', admin.auth)
        .send({ courseId: course.id, name: 'Г', teacherMembershipId: teacherOfA, capacity: 3 })
        .expect(201);
      await api('get', `/groups/${group.body.id}`, admin.auth).expect(200);
      await api('post', `/groups/${group.body.id}/archive`, admin.auth).expect(200);
      await api('post', `/courses/${course.id}/archive`, admin.auth).expect(200);
      const empty = await createCourse({ name: 'Пустой админа' }, admin.auth);
      await api('delete', `/courses/${empty.id}`, admin.auth).expect(204);
    });

    it.each(['teacher', 'parent'] as const)('closes every endpoint to a %s', async (role) => {
      const { auth } = fixture.schoolA[role];
      const attempts = [
        api('get', '/courses', auth),
        api('post', '/courses', auth).send(courseBody()),
        api('patch', `/courses/${courseOfA.id}`, auth).send({ name: 'Другое' }),
        api('post', `/courses/${courseOfA.id}/archive`, auth),
        api('post', `/courses/${courseOfA.id}/unarchive`, auth),
        api('delete', `/courses/${courseOfA.id}`, auth),
        api('get', '/groups', auth),
        api('get', `/groups/${groupOfA.id}`, auth),
        api('post', '/groups', auth).send({
          courseId: courseOfA.id,
          name: 'Г',
          teacherMembershipId: teacherOfA,
          capacity: 3,
        }),
        api('patch', `/groups/${groupOfA.id}`, auth).send({ name: 'Другое' }),
        api('post', `/groups/${groupOfA.id}/archive`, auth),
        api('post', `/groups/${groupOfA.id}/unarchive`, auth),
      ];
      for (const res of await Promise.all(attempts)) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
      }
    });
  });

  describe('courses', () => {
    it('creates, edits, archives and restores a course with an audit trail', async () => {
      const created = await createCourse({
        name: '  Рисование ',
        description: 'Акварель',
        format: 'online',
        ageFrom: 6,
        ageTo: 10,
        color: 'peach',
        icon: 'palette',
      });
      expect(created).toMatchObject({
        name: 'Рисование',
        description: 'Акварель',
        format: 'online',
        kind: 'group',
        ageFrom: 6,
        ageTo: 10,
        showInCatalog: true,
        color: 'peach',
        icon: 'palette',
        archived: false,
        groups: [],
      });

      const edited = await api('patch', `/courses/${created.id}`, owner())
        .send({ description: '', showInCatalog: false, ageTo: 12 })
        .expect(200);
      expect(edited.body).toMatchObject({ description: null, showInCatalog: false, ageTo: 12 });

      const archived = await api('post', `/courses/${created.id}/archive`, owner()).expect(200);
      expect(archived.body.archived).toBe(true);
      const active = await api('get', '/courses', owner()).expect(200);
      expect((active.body as CourseDto[]).map((c) => c.id)).not.toContain(created.id);
      const inArchive = await api('get', '/courses?archived=true', owner()).expect(200);
      const ids = (inArchive.body as CourseDto[]).map((c) => c.id);
      expect(ids).toContain(created.id);
      expect(ids).not.toContain(courseOfA.id);

      const restored = await api('post', `/courses/${created.id}/unarchive`, owner()).expect(200);
      expect(restored.body.archived).toBe(false);

      const logs = await prisma.auditLog.findMany({
        where: { entity: 'Course', entityId: created.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((log) => log.action)).toEqual(['create', 'update', 'archive', 'unarchive']);
      expect(logs[1]).toMatchObject({
        actorUserId: fixture.schoolA.owner.userId,
        before: { description: 'Акварель', showInCatalog: true, ageTo: 10 },
        after: { description: null, showInCatalog: false, ageTo: 12 },
      });
    });

    it('validates ages, color and icon', async () => {
      const bad = [
        courseBody({ ageFrom: 10, ageTo: 5 }),
        courseBody({ ageFrom: -1 }),
        courseBody({ ageTo: 100 }),
        courseBody({ ageFrom: 5.5 }),
        courseBody({ color: 'red' }),
        courseBody({ icon: 'rocket' }),
        courseBody({ name: 'Я' }),
        courseBody({ format: 'hybrid' }),
      ];
      for (const body of bad) {
        await api('post', '/courses', owner()).send(body).expect(400);
      }
      const course = await createCourse({ ageFrom: 7, ageTo: 9 });
      // The new lower bound is checked against the stored upper one.
      const res = await api('patch', `/courses/${course.id}`, owner())
        .send({ ageFrom: 12 })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      await api('patch', `/courses/${course.id}`, owner()).send({}).expect(400);
    });

    it('deletes an empty course and keeps one with groups, archived ones included', async () => {
      const empty = await createCourse({ name: 'Пустой' });
      await api('delete', `/courses/${empty.id}`, owner()).expect(204);
      await api('patch', `/courses/${empty.id}`, owner()).send({ name: 'Нет' }).expect(404);
      const log = await prisma.auditLog.findFirst({
        where: { entity: 'Course', entityId: empty.id, action: 'delete' },
      });
      expect(log?.before).toMatchObject({ name: 'Пустой' });

      const res = await api('delete', `/courses/${courseOfA.id}`, owner()).expect(409);
      expect(res.body.error.code).toBe('COURSE_HAS_GROUPS');

      const withArchived = await createCourse({ name: 'С архивной группой' });
      const group = await createGroup(withArchived.id);
      await api('post', `/groups/${group.id}/archive`, owner()).expect(200);
      const again = await api('delete', `/courses/${withArchived.id}`, owner()).expect(409);
      expect(again.body.error.code).toBe('COURSE_HAS_GROUPS');
    });

    it('locks the kind once the course has groups', async () => {
      const course = await createCourse({ name: 'Тип' });
      await api('patch', `/courses/${course.id}`, owner()).send({ kind: 'individual' }).expect(200);
      await api('patch', `/courses/${course.id}`, owner()).send({ kind: 'group' }).expect(200);
      await createGroup(course.id);
      const res = await api('patch', `/courses/${course.id}`, owner())
        .send({ kind: 'individual' })
        .expect(409);
      expect(res.body.error.code).toBe('COURSE_KIND_LOCKED');
      // Sending the same kind with other fields is not a change.
      await api('patch', `/courses/${course.id}`, owner())
        .send({ kind: 'group', name: 'Тип 2' })
        .expect(200);
    });

    it('archives a course without touching its groups', async () => {
      const course = await createCourse({ name: 'В архив' });
      const group = await createGroup(course.id);
      await api('post', `/courses/${course.id}/archive`, owner()).expect(200);
      const stored = await api('get', `/groups/${group.id}`, owner()).expect(200);
      expect(stored.body).toMatchObject({ archived: false, course: { archived: true } });
      const res = await api('post', '/groups', owner())
        .send({ courseId: course.id, name: 'Новая', teacherMembershipId: teacherOfA, capacity: 4 })
        .expect(409);
      expect(res.body.error.code).toBe('COURSE_ARCHIVED');
    });
  });

  describe('groups', () => {
    it('creates a group with its course, teacher and seats', async () => {
      const course = await createCourse({ name: 'Онлайн', format: 'online', icon: 'code' });
      const group = await createGroup(course.id, {
        name: ' Утро ',
        capacity: 12,
        meetingUrl: 'https://meet.example.com/abc',
        startsOn: '2026-12-01',
        endsOn: '2027-05-31',
      });
      expect(group).toMatchObject({
        name: 'Утро',
        capacity: 12,
        meetingUrl: 'https://meet.example.com/abc',
        startsOn: '2026-12-01',
        endsOn: '2027-05-31',
        archived: false,
        course: { id: course.id, name: 'Онлайн', icon: 'code', kind: 'group', format: 'online' },
        teacher: { id: teacherOfA, displayName: 'teacher A' },
        enrolledCount: 0,
        freeSeats: 12,
      });

      const listed = await api('get', '/courses', owner()).expect(200);
      const summary = (listed.body as CourseDto[]).find((c) => c.id === course.id)?.groups[0];
      expect(summary).toEqual({
        id: group.id,
        name: 'Утро',
        teacherName: 'teacher A',
        capacity: 12,
        enrolledCount: 0,
        freeSeats: 12,
        archived: false,
      });

      const byCourse = await api('get', `/groups?courseId=${course.id}`, owner()).expect(200);
      expect((byCourse.body as GroupDto[]).map((g) => g.id)).toEqual([group.id]);
    });

    it('keeps freeSeats equal to capacity minus enrolled', async () => {
      const res = await api('get', '/groups', owner()).expect(200);
      for (const group of res.body as GroupDto[]) {
        expect(group.freeSeats).toBe(group.capacity - group.enrolledCount);
      }
    });

    it('edits, archives and restores a group with an audit trail', async () => {
      const group = await createGroup(courseOfA.id, { name: 'Правка', startsOn: '2026-12-01' });
      const edited = await api('patch', `/groups/${group.id}`, owner())
        .send({ capacity: 10, startsOn: '', meetingUrl: 'https://zoom.us/j/1' })
        .expect(200);
      expect(edited.body).toMatchObject({
        capacity: 10,
        startsOn: null,
        meetingUrl: 'https://zoom.us/j/1',
      });
      await api('post', `/groups/${group.id}/archive`, owner()).expect(200);
      const archived = await api('get', `/groups/${group.id}`, owner()).expect(200);
      expect(archived.body.archived).toBe(true);
      await api('post', `/groups/${group.id}/unarchive`, owner()).expect(200);

      const logs = await prisma.auditLog.findMany({
        where: { entity: 'Group', entityId: group.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((log) => log.action)).toEqual(['create', 'update', 'archive', 'unarchive']);
      expect(logs[1]).toMatchObject({
        before: { capacity: 8, startsOn: '2026-12-01', meetingUrl: null },
        after: { capacity: 10, startsOn: null, meetingUrl: 'https://zoom.us/j/1' },
      });
    });

    it('validates the input', async () => {
      const base = { courseId: courseOfA.id, name: 'Г', teacherMembershipId: teacherOfA };
      const bad = [
        { ...base, capacity: 0 },
        { ...base, capacity: 501 },
        { ...base, capacity: 5, name: '' },
        { ...base, capacity: 5, meetingUrl: 'http://meet.example.com' },
        { ...base, capacity: 5, meetingUrl: 'meet.example.com' },
        { ...base, capacity: 5, startsOn: '2026-12-10', endsOn: '2026-12-01' },
        { ...base, capacity: 5, startsOn: '10.12.2026' },
        { ...base, capacity: 5, courseId: 'nope' },
      ];
      for (const body of bad) {
        await api('post', '/groups', owner()).send(body).expect(400);
      }
      // A group never moves to another course.
      await api('patch', `/groups/${groupOfA.id}`, owner())
        .send({ courseId: courseOfA.id })
        .expect(400);
      const group = await createGroup(courseOfA.id, { startsOn: '2026-12-10' });
      await api('patch', `/groups/${group.id}`, owner()).send({ endsOn: '2026-12-01' }).expect(400);
    });

    it('accepts an active or invited teacher of the school only', async () => {
      const parent = await prisma.membership.findFirstOrThrow({
        where: { schoolId: fixture.schoolA.id, role: 'parent' },
      });
      const deactivated = await prisma.membership.create({
        data: {
          schoolId: fixture.schoolA.id,
          role: 'teacher',
          displayName: 'Ушёл',
          status: 'deactivated',
        },
      });
      for (const id of [teacherOfB, parent.id, deactivated.id]) {
        const res = await api('post', '/groups', owner())
          .send({ courseId: courseOfA.id, name: 'Г', teacherMembershipId: id, capacity: 5 })
          .expect(422);
        expect(res.body.error.code).toBe('TEACHER_NOT_FOUND');
      }
      const patched = await api('patch', `/groups/${groupOfA.id}`, owner())
        .send({ teacherMembershipId: teacherOfB })
        .expect(422);
      expect(patched.body.error.code).toBe('TEACHER_NOT_FOUND');

      const invited = await api('post', '/staff', owner())
        .send({ displayName: 'Новый учитель', role: 'teacher' })
        .expect(201);
      const group = await createGroup(courseOfA.id, { teacherMembershipId: invited.body.id });
      expect(group.teacher).toEqual({ id: invited.body.id, displayName: 'Новый учитель' });
    });

    it('refuses a course of another school and an archived course', async () => {
      const foreign = await api('post', '/courses', fixture.schoolB.owner.auth, fixture.schoolB.id)
        .send(courseBody({ name: 'Курс Б' }))
        .expect(201);
      const res = await api('post', '/groups', owner())
        .send({
          courseId: foreign.body.id,
          name: 'Г',
          teacherMembershipId: teacherOfA,
          capacity: 5,
        })
        .expect(404);
      expect(res.body.error.code).toBe('COURSE_NOT_FOUND');

      const archived = await createCourse({ name: 'Архивный' });
      await api('post', `/courses/${archived.id}/archive`, owner()).expect(200);
      const closed = await api('post', '/groups', owner())
        .send({ courseId: archived.id, name: 'Г', teacherMembershipId: teacherOfA, capacity: 5 })
        .expect(409);
      expect(closed.body.error.code).toBe('COURSE_ARCHIVED');
    });

    it('gives an individual course one seat per group', async () => {
      const course = await createCourse({ name: 'Индивидуально', kind: 'individual' });
      const group = await createGroup(course.id, { capacity: 5 });
      expect(group).toMatchObject({ capacity: 1, freeSeats: 1, course: { kind: 'individual' } });
      const edited = await api('patch', `/groups/${group.id}`, owner())
        .send({ capacity: 5 })
        .expect(200);
      expect(edited.body.capacity).toBe(1);
    });
  });
});
