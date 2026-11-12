import type { INestApplication } from '@nestjs/common';
import type {
  CourseDto,
  GroupDto,
  LessonChangeResponse,
  LessonDetailDto,
  LessonDto,
} from '@darsi/shared';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ScheduleService } from '../src/modules/lessons/schedule.service';
import { createTestApp, hasTestDb } from './helpers/test-app';
import { describeSchoolIsolation } from './isolation/describe-school-isolation';
import { createTenantFixture, type TenantFixture } from './isolation/tenant-fixture';

type Method = 'get' | 'post' | 'put' | 'patch';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Asia/Dushanbe has no daylight saving time: always UTC+5. */
const DUSHANBE_OFFSET_MS = 5 * HOUR_MS;
/** Soft bound of T-17, decision 7: catches only gross mistakes on a remote database. */
const LIST_SOFT_LIMIT_MS = 3_000;

/** A date in Dushanbe `offset` days from today. */
const day = (offset: number): string =>
  new Date(Date.now() + DUSHANBE_OFFSET_MS + offset * DAY_MS).toISOString().slice(0, 10);

/** Dushanbe date and time of an instant. */
const local = (instant: Date) => {
  const iso = new Date(instant.getTime() + DUSHANBE_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};

describe.skipIf(!hasTestDb)('lessons calendar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: TenantFixture;
  let course: CourseDto;
  let otherCourse: CourseDto;
  let teacherOfA: string;
  /** An invited teacher of school A: a substitute and a second teacher for the filters. */
  let substitute: string;
  let groupOfA: GroupDto;
  let lessonOfA: LessonDetailDto;

  const api = (method: Method, path: string, auth: string, schoolId = fixture.schoolA.id) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', auth)
      .set('X-School-Id', schoolId);

  const owner = () => fixture.schoolA.owner.auth;

  const createGroup = async (overrides: object = {}): Promise<GroupDto> => {
    const res = await api('post', '/groups', owner())
      .send({
        courseId: course.id,
        name: `Группа ${Math.random().toString(36).slice(2, 7)}`,
        teacherMembershipId: teacherOfA,
        capacity: 8,
        ...overrides,
      })
      .expect(201);
    return res.body as GroupDto;
  };

  const createLesson = async (body: object, auth = owner()): Promise<LessonChangeResponse> => {
    const res = await api('post', '/lessons', auth)
      .send({ durationMin: 60, ...body })
      .expect(201);
    return res.body as LessonChangeResponse;
  };

  const futureLessons = (groupId: string) =>
    prisma.lesson.findMany({
      where: { groupId, startsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
    });

  const MONDAY_15 = [{ weekday: 1, startTime: '15:00', durationMin: 60 }];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    fixture = await createTenantFixture(app);
    const body = { format: 'offline', kind: 'group', color: 'mint', icon: 'music' };
    const [teacher, invited, a, b] = await Promise.all([
      prisma.membership.findFirstOrThrow({
        where: { schoolId: fixture.schoolA.id, userId: fixture.schoolA.teacher.userId },
      }),
      api('post', '/staff', fixture.schoolA.owner.auth)
        .send({ displayName: 'Замена', role: 'teacher' })
        .expect(201),
      api('post', '/courses', fixture.schoolA.owner.auth)
        .send({ ...body, name: 'Музыка' })
        .expect(201),
      api('post', '/courses', fixture.schoolA.owner.auth)
        .send({ ...body, name: 'Шахматы', color: 'peach', icon: 'trophy' })
        .expect(201),
    ]);
    teacherOfA = teacher.id;
    substitute = (invited.body as { id: string }).id;
    course = a.body as CourseDto;
    otherCourse = b.body as CourseDto;
    groupOfA = await createGroup({ name: 'Изоляция' });
    lessonOfA = (await createLesson({ groupId: groupOfA.id, date: day(2), time: '09:00' })).lesson;
  });

  afterAll(async () => {
    // Later runs of the daily job on this database should not walk through these groups again.
    await prisma.school.updateMany({
      where: { id: { in: [fixture.schoolA.id, fixture.schoolB.id] } },
      data: { status: 'blocked' },
    });
    await app.close();
  });

  describeSchoolIsolation('lessons', () => ({ app, fixture }), [
    { method: 'get', path: '/lessons?from=2026-11-01&to=2026-11-30' },
    {
      method: 'get',
      path: () => `/lessons/${lessonOfA.id}`,
      label: 'GET /lessons/:id',
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: '/lessons',
      body: () => ({ groupId: groupOfA.id, date: day(3), time: '10:00', durationMin: 60 }),
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/lessons/${lessonOfA.id}/cancel`,
      label: 'POST /lessons/:id/cancel',
      body: () => ({ reason: 'Болеет преподаватель' }),
      targetsSchoolARecord: true,
    },
    {
      method: 'post',
      path: () => `/lessons/${lessonOfA.id}/reschedule`,
      label: 'POST /lessons/:id/reschedule',
      body: () => ({ date: day(4), time: '10:00' }),
      targetsSchoolARecord: true,
    },
    {
      method: 'patch',
      path: () => `/lessons/${lessonOfA.id}`,
      label: 'PATCH /lessons/:id',
      body: () => ({ meetingUrl: 'https://meet.example.com/iso' }),
      targetsSchoolARecord: true,
    },
  ]);

  describe('access', () => {
    it('lets the admin work with the calendar', async () => {
      const { admin } = fixture.schoolA;
      const group = await createGroup();
      const { lesson } = await createLesson(
        { groupId: group.id, date: day(3), time: '11:00' },
        admin.auth,
      );
      await api('get', `/lessons/${lesson.id}`, admin.auth).expect(200);
      await api('patch', `/lessons/${lesson.id}`, admin.auth)
        .send({ meetingUrl: 'https://meet.example.com/admin' })
        .expect(200);
      await api('post', `/lessons/${lesson.id}/reschedule`, admin.auth)
        .send({ date: day(3), time: '12:00' })
        .expect(200);
      await api('post', `/lessons/${lesson.id}/cancel`, admin.auth)
        .send({ reason: 'Праздник' })
        .expect(200);
    });

    it.each(['teacher', 'parent'] as const)('closes every endpoint to a %s', async (role) => {
      const { auth } = fixture.schoolA[role];
      const attempts = [
        api('get', '/lessons?from=2026-11-01&to=2026-11-30', auth),
        api('get', `/lessons/${lessonOfA.id}`, auth),
        api('post', '/lessons', auth).send({
          groupId: groupOfA.id,
          date: day(3),
          time: '10:00',
          durationMin: 60,
        }),
        api('post', `/lessons/${lessonOfA.id}/cancel`, auth).send({ reason: 'Нет' }),
        api('post', `/lessons/${lessonOfA.id}/reschedule`, auth).send({
          date: day(4),
          time: '10:00',
        }),
        api('patch', `/lessons/${lessonOfA.id}`, auth).send({ teacherMembershipId: substitute }),
      ];
      for (const res of await Promise.all(attempts)) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
      }
    });
  });

  describe('list and card', () => {
    it('filters by teacher, course and group', async () => {
      const [music, chess] = await Promise.all([
        createGroup(),
        createGroup({ courseId: otherCourse.id, teacherMembershipId: substitute }),
      ]);
      const [first, second] = await Promise.all([
        createLesson({ groupId: music.id, date: day(6), time: '14:00' }),
        createLesson({ groupId: chess.id, date: day(6), time: '14:00' }),
      ]);
      const list = async (filter: string) => {
        const res = await api('get', `/lessons?from=${day(6)}&to=${day(6)}&${filter}`, owner());
        expect(res.status).toBe(200);
        return res.body as LessonDto[];
      };

      const byTeacher = await list(`teacherId=${substitute}`);
      expect(byTeacher.every((l) => l.teacher.id === substitute)).toBe(true);
      expect(byTeacher.map((l) => l.id)).toContain(second.lesson.id);
      expect(byTeacher.map((l) => l.id)).not.toContain(first.lesson.id);

      const byCourse = await list(`courseId=${otherCourse.id}`);
      expect(byCourse.every((l) => l.course.id === otherCourse.id)).toBe(true);
      expect(byCourse.map((l) => l.id)).toContain(second.lesson.id);
      expect(byCourse.map((l) => l.id)).not.toContain(first.lesson.id);

      const byGroup = await list(`groupId=${music.id}`);
      expect(byGroup.map((l) => l.id)).toEqual([first.lesson.id]);

      const all = await list(`courseId=${course.id}&teacherId=${substitute}`);
      expect(all).toEqual([]);
    });

    it('rejects a range of more than 62 days and bad filters', async () => {
      await api('get', '/lessons?from=2026-11-01&to=2027-01-02', owner()).expect(400);
      await api('get', '/lessons?from=2026-11-01&to=2026-11-02&teacherId=nope', owner()).expect(
        400,
      );
      await api('get', '/lessons?from=2026-11-01&to=2026-11-02&courseId=nope', owner()).expect(400);
    });

    it('opens the lesson card with the seats of the group', async () => {
      const res = await api('get', `/lessons/${lessonOfA.id}`, owner()).expect(200);
      expect(res.body).toMatchObject({
        id: lessonOfA.id,
        groupId: groupOfA.id,
        groupName: 'Изоляция',
        group: { capacity: 8, enrolledCount: 0 },
      });
      const missing = await api(
        'get',
        `/lessons/${lessonOfA.id}`,
        fixture.schoolB.owner.auth,
        fixture.schoolB.id,
      ).expect(404);
      expect(missing.body.error.code).toBe('LESSON_NOT_FOUND');
      await api('get', '/lessons/not-a-uuid', owner()).expect(400);
    });

    it('answers 100 lessons of a week in one call within the soft limit', async () => {
      const group = await createGroup();
      const weekStart = Date.parse(`${day(14)}T00:00:00Z`) - DUSHANBE_OFFSET_MS;
      await prisma.lesson.createMany({
        data: Array.from({ length: 100 }, (_, i) => ({
          schoolId: fixture.schoolA.id,
          groupId: group.id,
          teacherMembershipId: teacherOfA,
          // 100 lessons 90 minutes apart fit into 7 days.
          startsAt: new Date(weekStart + i * 90 * 60_000),
          durationMin: 60,
        })),
      });
      // The first request pays for waking the connection up; the second one is measured.
      await api('get', `/lessons?from=${day(14)}&to=${day(20)}`, owner()).expect(200);
      const started = performance.now();
      const res = await api('get', `/lessons?from=${day(14)}&to=${day(20)}`, owner()).expect(200);
      const elapsed = performance.now() - started;
      expect((res.body as LessonDto[]).filter((l) => l.groupId === group.id)).toHaveLength(100);
      expect(elapsed).toBeLessThan(LIST_SOFT_LIMIT_MS);
    });
  });

  describe('one-off lessons', () => {
    it('creates a one-off lesson at the school wall-clock time', async () => {
      const group = await createGroup({ meetingUrl: 'https://meet.example.com/g' });
      const result = await createLesson({
        groupId: group.id,
        date: day(5),
        time: '15:30',
        durationMin: 45,
      });
      expect(result.conflicts).toEqual([]);
      expect(result.lesson).toMatchObject({
        groupId: group.id,
        isOneOff: true,
        status: 'planned',
        durationMin: 45,
        // 15:30 in Dushanbe is 10:30 UTC.
        startsAt: `${day(5)}T10:30:00.000Z`,
        teacher: { id: teacherOfA },
        meetingUrl: 'https://meet.example.com/g',
        group: { capacity: 8, enrolledCount: 0 },
      });
      const log = await prisma.auditLog.findFirst({
        where: { entity: 'Lesson', entityId: result.lesson.id, action: 'create' },
      });
      expect(log).toMatchObject({
        actorUserId: fixture.schoolA.owner.userId,
        before: null,
        after: { groupId: group.id, startsAt: `${day(5)}T10:30:00.000Z`, durationMin: 45 },
      });

      const again = await api('post', '/lessons', owner())
        .send({ groupId: group.id, date: day(5), time: '15:30', durationMin: 60 })
        .expect(409);
      expect(again.body.error.code).toBe('LESSON_SLOT_TAKEN');
    });

    it('takes the given teacher and link instead of the group ones', async () => {
      const group = await createGroup();
      const { lesson } = await createLesson({
        groupId: group.id,
        date: day(5),
        time: '08:00',
        teacherMembershipId: substitute,
        meetingUrl: 'https://meet.example.com/own',
      });
      expect(lesson.teacher.id).toBe(substitute);
      expect(lesson.meetingUrl).toBe('https://meet.example.com/own');
    });

    it('refuses an archived group or course and a teacher of another school', async () => {
      const archived = await createGroup();
      await api('post', `/groups/${archived.id}/archive`, owner()).expect(200);
      const res = await api('post', '/lessons', owner())
        .send({ groupId: archived.id, date: day(5), time: '12:00', durationMin: 60 })
        .expect(409);
      expect(res.body.error.code).toBe('GROUP_ARCHIVED');

      const temp = await api('post', '/courses', owner())
        .send({ name: 'Временный', format: 'offline', kind: 'group', color: 'lime', icon: 'bot' })
        .expect(201);
      const inArchivedCourse = await createGroup({ courseId: temp.body.id });
      await api('post', `/courses/${temp.body.id}/archive`, owner()).expect(200);
      const courseRes = await api('post', '/lessons', owner())
        .send({ groupId: inArchivedCourse.id, date: day(5), time: '12:00', durationMin: 60 })
        .expect(409);
      expect(courseRes.body.error.code).toBe('COURSE_ARCHIVED');

      const teacherOfB = await prisma.membership.findFirstOrThrow({
        where: { schoolId: fixture.schoolB.id, role: 'teacher' },
      });
      const foreign = await api('post', '/lessons', owner())
        .send({
          groupId: groupOfA.id,
          date: day(5),
          time: '12:00',
          durationMin: 60,
          teacherMembershipId: teacherOfB.id,
        })
        .expect(422);
      expect(foreign.body.error.code).toBe('TEACHER_NOT_FOUND');
    });

    it('validates the request', async () => {
      const valid = { groupId: groupOfA.id, date: day(5), time: '12:00', durationMin: 60 };
      for (const body of [
        { ...valid, durationMin: 10 },
        { ...valid, durationMin: 481 },
        { ...valid, time: '25:00' },
        { ...valid, time: '9:00' },
        { ...valid, date: '01.12.2026' },
        { ...valid, groupId: 'nope' },
        { ...valid, meetingUrl: 'http://meet.example.com' },
        {},
      ]) {
        const res = await api('post', '/lessons', owner()).send(body).expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('cancel', () => {
    it('cancels with a reason once', async () => {
      const group = await createGroup();
      const { lesson } = await createLesson({ groupId: group.id, date: day(8), time: '10:00' });

      for (const reason of ['', '   ', 'x'.repeat(301)]) {
        await api('post', `/lessons/${lesson.id}/cancel`, owner()).send({ reason }).expect(400);
      }
      const res = await api('post', `/lessons/${lesson.id}/cancel`, owner())
        .send({ reason: '  Праздник  ' })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'cancelled', cancelReason: 'Праздник' });

      const again = await api('post', `/lessons/${lesson.id}/cancel`, owner())
        .send({ reason: 'Ещё раз' })
        .expect(409);
      expect(again.body.error.code).toBe('LESSON_NOT_PLANNED');
      const moved = await api('post', `/lessons/${lesson.id}/reschedule`, owner())
        .send({ date: day(9), time: '10:00' })
        .expect(409);
      expect(moved.body.error.code).toBe('LESSON_NOT_PLANNED');

      const log = await prisma.auditLog.findFirst({
        where: { entity: 'Lesson', entityId: lesson.id, action: 'cancel' },
      });
      expect(log).toMatchObject({
        before: { status: 'planned' },
        after: { status: 'cancelled', cancelReason: 'Праздник' },
      });
    });

    it('keeps a cancelled generated lesson cancelled after a sync, without a duplicate', async () => {
      const group = await createGroup();
      await api('put', `/groups/${group.id}/schedule-rules`, owner())
        .send({ rules: MONDAY_15 })
        .expect(200);
      const [first] = await futureLessons(group.id);
      await api('post', `/lessons/${first!.id}/cancel`, owner())
        .send({ reason: 'Каникулы' })
        .expect(200);

      await app.get(ScheduleService).syncGroup(group.id);
      const atSlot = await prisma.lesson.findMany({
        where: { groupId: group.id, startsAt: first!.startsAt },
      });
      expect(atSlot).toHaveLength(1);
      expect(atSlot[0]).toMatchObject({ id: first!.id, status: 'cancelled' });
    });
  });

  describe('reschedule', () => {
    it('remembers the first time across moves and leaves the old slot empty', async () => {
      const group = await createGroup();
      await api('put', `/groups/${group.id}/schedule-rules`, owner())
        .send({ rules: MONDAY_15 })
        .expect(200);
      const [first] = await futureLessons(group.id);
      const original = first!.startsAt;
      const { date } = local(original);

      const once = await api('post', `/lessons/${first!.id}/reschedule`, owner())
        .send({ date, time: '17:00', durationMin: 90 })
        .expect(200);
      const moved = (once.body as LessonChangeResponse).lesson;
      expect(moved.originalStartsAt).toBe(original.toISOString());
      expect(moved.durationMin).toBe(90);
      expect(local(new Date(moved.startsAt)).time).toBe('17:00');

      const twice = await api('post', `/lessons/${first!.id}/reschedule`, owner())
        .send({ date, time: '18:00' })
        .expect(200);
      const movedAgain = (twice.body as LessonChangeResponse).lesson;
      expect(movedAgain.originalStartsAt).toBe(original.toISOString());
      expect(movedAgain.durationMin).toBe(90);
      expect(movedAgain.isOneOff).toBe(false);

      await app.get(ScheduleService).syncGroup(group.id);
      const after = await futureLessons(group.id);
      expect(after.filter((l) => l.startsAt.getTime() === original.getTime())).toEqual([]);
      expect(after.find((l) => l.id === first!.id)?.startsAt.toISOString()).toBe(
        movedAgain.startsAt,
      );

      const logs = await prisma.auditLog.findMany({
        where: { entity: 'Lesson', entityId: first!.id, action: 'reschedule' },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs).toHaveLength(2);
      expect(logs[0]).toMatchObject({
        before: { startsAt: original.toISOString(), durationMin: 60 },
        after: { originalStartsAt: original.toISOString(), durationMin: 90 },
      });
    });

    it('moves the lesson and warns about an overlap of the teacher', async () => {
      const [busy, free] = await Promise.all([
        createGroup({ name: 'Занятая' }),
        createGroup({ name: 'Свободная' }),
      ]);
      await createLesson({ groupId: busy.id, date: day(10), time: '18:00' });
      const { lesson } = await createLesson({ groupId: free.id, date: day(10), time: '10:00' });

      const res = await api('post', `/lessons/${lesson.id}/reschedule`, owner())
        .send({ date: day(10), time: '18:30' })
        .expect(200);
      const body = res.body as LessonChangeResponse;
      expect(body.lesson.startsAt).toBe(`${day(10)}T13:30:00.000Z`);
      expect(body.conflicts).toHaveLength(1);
      expect(body.conflicts[0]).toMatchObject({
        startsAt: `${day(10)}T13:30:00.000Z`,
        otherGroupName: 'Занятая',
        otherStartsAt: `${day(10)}T13:00:00.000Z`,
        otherDurationMin: 60,
      });
    });

    it('refuses a time the group already has a lesson at', async () => {
      const group = await createGroup();
      await createLesson({ groupId: group.id, date: day(11), time: '10:00' });
      const { lesson } = await createLesson({ groupId: group.id, date: day(11), time: '12:00' });
      const res = await api('post', `/lessons/${lesson.id}/reschedule`, owner())
        .send({ date: day(11), time: '10:00' })
        .expect(409);
      expect(res.body.error.code).toBe('LESSON_SLOT_TAKEN');
    });
  });

  describe('single lesson changes', () => {
    it('gives one lesson to a substitute and leaves the group and other lessons alone', async () => {
      const group = await createGroup();
      await api('put', `/groups/${group.id}/schedule-rules`, owner())
        .send({ rules: MONDAY_15 })
        .expect(200);
      const [first, second] = await futureLessons(group.id);

      const res = await api('patch', `/lessons/${first!.id}`, owner())
        .send({ teacherMembershipId: substitute })
        .expect(200);
      const body = res.body as LessonChangeResponse;
      expect(body.lesson.teacher).toEqual({ id: substitute, displayName: 'Замена' });
      expect(body.conflicts).toEqual([]);

      const groupNow = await api('get', `/groups/${group.id}`, owner()).expect(200);
      expect((groupNow.body as GroupDto).teacher.id).toBe(teacherOfA);
      const other = await prisma.lesson.findUniqueOrThrow({ where: { id: second!.id } });
      expect(other.teacherMembershipId).toBe(teacherOfA);

      const log = await prisma.auditLog.findFirst({
        where: { entity: 'Lesson', entityId: first!.id, action: 'update' },
      });
      expect(log).toMatchObject({
        before: { teacherMembershipId: teacherOfA },
        after: { teacherMembershipId: substitute },
      });

      // A new teacher of the group takes the generated lessons, not the substitute's one.
      const next = await api('post', '/staff', owner())
        .send({ displayName: 'Новый', role: 'teacher' })
        .expect(201);
      await api('patch', `/groups/${group.id}`, owner())
        .send({ teacherMembershipId: next.body.id })
        .expect(200);
      const [kept, taken] = await Promise.all([
        prisma.lesson.findUniqueOrThrow({ where: { id: first!.id } }),
        prisma.lesson.findUniqueOrThrow({ where: { id: second!.id } }),
      ]);
      expect(kept.teacherMembershipId).toBe(substitute);
      expect(taken.teacherMembershipId).toBe(next.body.id);
    });

    it('sets and clears the lesson link', async () => {
      const group = await createGroup({ meetingUrl: 'https://meet.example.com/group' });
      const { lesson } = await createLesson({ groupId: group.id, date: day(12), time: '10:00' });

      const set = await api('patch', `/lessons/${lesson.id}`, owner())
        .send({ meetingUrl: 'https://meet.example.com/lesson' })
        .expect(200);
      expect((set.body as LessonChangeResponse).lesson.meetingUrl).toBe(
        'https://meet.example.com/lesson',
      );
      const cleared = await api('patch', `/lessons/${lesson.id}`, owner())
        .send({ meetingUrl: '' })
        .expect(200);
      expect((cleared.body as LessonChangeResponse).lesson.meetingUrl).toBe(
        'https://meet.example.com/group',
      );

      for (const body of [{}, { meetingUrl: 'ftp://x' }, { teacherMembershipId: 'nope' }]) {
        await api('patch', `/lessons/${lesson.id}`, owner()).send(body).expect(400);
      }
    });

    it('keeps the teacher of a cancelled lesson', async () => {
      const group = await createGroup();
      const { lesson } = await createLesson({ groupId: group.id, date: day(12), time: '12:00' });
      await api('post', `/lessons/${lesson.id}/cancel`, owner())
        .send({ reason: 'Ремонт' })
        .expect(200);
      const res = await api('patch', `/lessons/${lesson.id}`, owner())
        .send({ teacherMembershipId: substitute })
        .expect(409);
      expect(res.body.error.code).toBe('LESSON_NOT_PLANNED');
    });

    it('warns when the substitute is busy at that time', async () => {
      const [mine, theirs] = await Promise.all([
        createGroup(),
        createGroup({ name: 'Группа замены', teacherMembershipId: substitute }),
      ]);
      await createLesson({ groupId: theirs.id, date: day(13), time: '16:00' });
      const { lesson } = await createLesson({ groupId: mine.id, date: day(13), time: '16:30' });
      const res = await api('patch', `/lessons/${lesson.id}`, owner())
        .send({ teacherMembershipId: substitute })
        .expect(200);
      const body = res.body as LessonChangeResponse;
      expect(body.lesson.teacher.id).toBe(substitute);
      expect(body.conflicts.map((c) => c.otherGroupName)).toEqual(['Группа замены']);
    });
  });
});
