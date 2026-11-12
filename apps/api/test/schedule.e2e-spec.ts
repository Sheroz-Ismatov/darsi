import type { INestApplication } from '@nestjs/common';
import type {
  CourseDto,
  GroupDto,
  LessonConflictDto,
  LessonDto,
  PutScheduleRulesResponse,
  ScheduleRuleDto,
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
const HORIZON_DAYS = 56;

/**
 * Lessons a weekly rule set must give from now to the end of the 8-week horizon, counted
 * independently of the domain code for a zone with a fixed UTC offset.
 */
function expectedLessons(
  rules: { weekday: number; startTime: string }[],
  offsetHours: number,
  now: Date,
): Date[] {
  const today = new Date(now.getTime() + offsetHours * HOUR_MS).toISOString().slice(0, 10);
  const lessons: Date[] = [];
  for (let day = 0; day <= HORIZON_DAYS; day++) {
    const date = new Date(Date.parse(`${today}T00:00:00Z`) + day * DAY_MS);
    const weekday = ((date.getUTCDay() + 6) % 7) + 1;
    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;
      const [h, m] = rule.startTime.split(':').map(Number);
      const start = new Date(date.getTime() + (h! * 60 + m!) * 60_000 - offsetHours * HOUR_MS);
      if (start > now) lessons.push(start);
    }
  }
  return lessons.sort((a, b) => a.getTime() - b.getTime());
}

const MON_THU_15 = [
  { weekday: 1, startTime: '15:00', durationMin: 60 },
  { weekday: 4, startTime: '15:00', durationMin: 60 },
];

describe.skipIf(!hasTestDb)('schedule and lesson generation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: TenantFixture;
  let course: CourseDto;
  let courseOfB: CourseDto;
  /** A group of school A for the isolation suite. */
  let groupOfA: GroupDto;
  let teacherOfA: string;
  let teacherOfB: string;

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

  const putRules = async (
    groupId: string,
    rules: object[],
    auth = owner(),
    schoolId = fixture.schoolA.id,
  ): Promise<PutScheduleRulesResponse> => {
    const res = await api('put', `/groups/${groupId}/schedule-rules`, auth, schoolId)
      .send({ rules })
      .expect(200);
    return res.body as PutScheduleRulesResponse;
  };

  const futureLessons = (groupId: string) =>
    prisma.lesson.findMany({
      where: { groupId, startsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
    });

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
      prisma.school.update({
        where: { id: fixture.schoolB.id },
        data: { timezone: 'Europe/Moscow' },
      }),
    ]);
    const body = { format: 'offline', kind: 'group', color: 'mint', icon: 'music' };
    const [a, b] = await Promise.all([
      api('post', '/courses', owner())
        .send({ ...body, name: 'Музыка' })
        .expect(201),
      api('post', '/courses', fixture.schoolB.owner.auth, fixture.schoolB.id)
        .send({ ...body, name: 'Музыка Б' })
        .expect(201),
    ]);
    course = a.body as CourseDto;
    courseOfB = b.body as CourseDto;
    groupOfA = await createGroup({ name: 'Изоляция' });
  });

  afterAll(async () => {
    // Later runs of the daily job on this database should not walk through these groups again.
    await prisma.school.updateMany({
      where: { id: { in: [fixture.schoolA.id, fixture.schoolB.id] } },
      data: { status: 'blocked' },
    });
    await app.close();
  });

  describeSchoolIsolation('schedule', () => ({ app, fixture }), [
    {
      method: 'get',
      path: () => `/groups/${groupOfA.id}/schedule-rules`,
      label: 'GET /groups/:id/schedule-rules',
      targetsSchoolARecord: true,
    },
    {
      method: 'put',
      path: () => `/groups/${groupOfA.id}/schedule-rules`,
      label: 'PUT /groups/:id/schedule-rules',
      body: () => ({ rules: MON_THU_15 }),
      targetsSchoolARecord: true,
    },
    {
      method: 'get',
      path: () => `/groups/${groupOfA.id}/conflicts`,
      label: 'GET /groups/:id/conflicts',
      targetsSchoolARecord: true,
    },
    { method: 'get', path: '/lessons?from=2026-11-01&to=2026-11-30' },
  ]);

  it('hides lessons of school A from school B', async () => {
    const group = await createGroup();
    await putRules(group.id, MON_THU_15);
    const today = new Date().toISOString().slice(0, 10);
    const until = new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10);
    const res = await api(
      'get',
      `/lessons?from=${today}&to=${until}&groupId=${group.id}`,
      fixture.schoolB.owner.auth,
      fixture.schoolB.id,
    ).expect(200);
    expect(res.body).toEqual([]);
  });

  describe('access', () => {
    it('lets the admin manage the schedule', async () => {
      const { admin } = fixture.schoolA;
      const group = await createGroup();
      await putRules(group.id, MON_THU_15, admin.auth);
      await api('get', `/groups/${group.id}/schedule-rules`, admin.auth).expect(200);
      await api('get', `/groups/${group.id}/conflicts`, admin.auth).expect(200);
      await api('get', '/lessons?from=2026-11-01&to=2026-11-30', admin.auth).expect(200);
    });

    it.each(['teacher', 'parent'] as const)('closes every endpoint to a %s', async (role) => {
      const { auth } = fixture.schoolA[role];
      const attempts = [
        api('get', `/groups/${groupOfA.id}/schedule-rules`, auth),
        api('put', `/groups/${groupOfA.id}/schedule-rules`, auth).send({ rules: MON_THU_15 }),
        api('get', `/groups/${groupOfA.id}/conflicts`, auth),
        api('get', '/lessons?from=2026-11-01&to=2026-11-30', auth),
      ];
      for (const res of await Promise.all(attempts)) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
      }
    });
  });

  describe('generation', () => {
    it('creates 8 weeks of Monday and Thursday 15:00 lessons for Dushanbe at 10:00 UTC', async () => {
      const group = await createGroup({ meetingUrl: 'https://meet.example.com/a' });
      const expected = expectedLessons(MON_THU_15, 5, new Date());
      expect([16, 17]).toContain(expected.length);

      const result = await putRules(group.id, MON_THU_15);
      expect(result).toMatchObject({ created: expected.length, deleted: 0 });
      expect(result.rules.map((r) => [r.weekday, r.startTime, r.durationMin])).toEqual([
        [1, '15:00', 60],
        [4, '15:00', 60],
      ]);

      const stored = await futureLessons(group.id);
      expect(stored.map((l) => l.startsAt.toISOString())).toEqual(
        expected.map((d) => d.toISOString()),
      );
      expect(stored[0]!.startsAt.getUTCHours()).toBe(10);
      expect(stored.every((l) => l.teacherMembershipId === teacherOfA)).toBe(true);

      const from = expected[0]!.toISOString().slice(0, 10);
      const to = expected[2]!.toISOString().slice(0, 10);
      const listed = await api(
        'get',
        `/lessons?from=${from}&to=${to}&groupId=${group.id}`,
        owner(),
      ).expect(200);
      const lessons = listed.body as LessonDto[];
      expect(lessons).toHaveLength(3);
      expect(lessons[0]).toEqual({
        id: stored[0]!.id,
        groupId: group.id,
        groupName: group.name,
        course: { id: course.id, name: 'Музыка', color: 'mint', icon: 'music' },
        teacher: { id: teacherOfA, displayName: 'teacher A' },
        startsAt: expected[0]!.toISOString(),
        durationMin: 60,
        status: 'planned',
        originalStartsAt: null,
        cancelReason: null,
        meetingUrl: 'https://meet.example.com/a',
        isOneOff: false,
      });

      const log = await prisma.auditLog.findFirst({
        where: { entity: 'Group', entityId: group.id, action: 'schedule_update' },
      });
      expect(log).toMatchObject({
        actorUserId: fixture.schoolA.owner.userId,
        before: { rules: [] },
        after: { rules: MON_THU_15, created: expected.length, deleted: 0 },
      });
    });

    it('places the same rule at 12:00 UTC for a school in Moscow', async () => {
      const { schoolB } = fixture;
      const res = await api('post', '/groups', schoolB.owner.auth, schoolB.id)
        .send({
          courseId: courseOfB.id,
          name: 'Москва',
          teacherMembershipId: teacherOfB,
          capacity: 5,
        })
        .expect(201);
      const expected = expectedLessons(MON_THU_15, 3, new Date());
      const result = await putRules(res.body.id, MON_THU_15, schoolB.owner.auth, schoolB.id);
      expect(result.created).toBe(expected.length);
      const stored = await futureLessons(res.body.id);
      expect(stored.map((l) => l.startsAt.toISOString())).toEqual(
        expected.map((d) => d.toISOString()),
      );
      expect(stored[0]!.startsAt.getUTCHours()).toBe(12);
    });

    it('keeps rules and lessons when the same rules are saved again', async () => {
      const group = await createGroup();
      const first = await putRules(group.id, MON_THU_15);
      const before = await futureLessons(group.id);
      const again = await putRules(group.id, [...MON_THU_15].reverse());
      expect(again).toMatchObject({ created: 0, deleted: 0 });
      expect(again.rules.map((r) => r.id)).toEqual(first.rules.map((r) => r.id));
      expect((await futureLessons(group.id)).map((l) => l.id)).toEqual(before.map((l) => l.id));
      const logs = await prisma.auditLog.count({
        where: { entityId: group.id, action: 'schedule_update' },
      });
      expect(logs).toBe(1);
    });

    it('replaces future lessons on a change, keeping cancelled and moved ones in their slots', async () => {
      const group = await createGroup();
      const monday = [{ weekday: 1, startTime: '15:00', durationMin: 60 }];
      await putRules(group.id, monday);
      const original = await futureLessons(group.id);

      const at17Rule = { weekday: 1, startTime: '17:00', durationMin: 60 };
      const expected = expectedLessons([at17Rule], 5, new Date()).length;
      const moved = await putRules(group.id, [at17Rule]);
      expect(moved).toMatchObject({ created: expected, deleted: original.length });
      const at17 = await futureLessons(group.id);
      expect(at17.every((l) => l.startsAt.getUTCHours() === 12)).toBe(true);

      // Stand-ins for T-17: one lesson cancelled, another moved to Wednesday.
      const [cancelled, rescheduled] = at17;
      await prisma.lesson.update({ where: { id: cancelled!.id }, data: { status: 'cancelled' } });
      await prisma.lesson.update({
        where: { id: rescheduled!.id },
        data: {
          originalStartsAt: rescheduled!.startsAt,
          startsAt: new Date(rescheduled!.startsAt.getTime() + 2 * DAY_MS),
        },
      });

      // A longer lesson at the same time: every slot is the same, the rule is a new one.
      const longer = await putRules(group.id, [
        { weekday: 1, startTime: '17:00', durationMin: 90 },
      ]);
      expect(longer).toMatchObject({ created: at17.length - 2, deleted: at17.length - 2 });
      const after = await futureLessons(group.id);
      expect(after.find((l) => l.id === cancelled!.id)).toMatchObject({ status: 'cancelled' });
      expect(after.find((l) => l.id === rescheduled!.id)?.originalStartsAt).toEqual(
        rescheduled!.startsAt,
      );
      // The original slot of the moved lesson stays empty.
      expect(after.filter((l) => l.startsAt.getTime() === rescheduled!.startsAt.getTime())).toEqual(
        [],
      );
      expect(after.filter((l) => l.durationMin === 90)).toHaveLength(at17.length - 2);
    });

    it('drops future lessons for an empty set and closes rules that have past lessons', async () => {
      const group = await createGroup();
      const saved = await putRules(group.id, MON_THU_15);
      const monday = saved.rules.find((r) => r.weekday === 1)!;
      // A lesson given a week ago under the Monday rule.
      await prisma.lesson.create({
        data: {
          schoolId: fixture.schoolA.id,
          groupId: group.id,
          teacherMembershipId: teacherOfA,
          startsAt: new Date(Date.now() - 7 * DAY_MS),
          durationMin: 60,
          status: 'done',
          scheduleRuleId: monday.id,
        },
      });

      const result = await putRules(group.id, []);
      expect(result.rules).toEqual([]);
      expect(result.deleted).toBe(expectedLessons(MON_THU_15, 5, new Date()).length);
      expect(await futureLessons(group.id)).toEqual([]);
      expect(await prisma.lesson.count({ where: { groupId: group.id } })).toBe(1);

      const rules = await prisma.scheduleRule.findMany({ where: { groupId: group.id } });
      expect(rules).toHaveLength(1);
      expect(rules[0]!.id).toBe(monday.id);
      const yesterday = new Date(Date.now() + 5 * HOUR_MS - DAY_MS).toISOString().slice(0, 10);
      expect(rules[0]!.validTo?.toISOString().slice(0, 10)).toBe(yesterday);
      const listed = await api('get', `/groups/${group.id}/schedule-rules`, owner()).expect(200);
      expect(listed.body as ScheduleRuleDto[]).toEqual([]);
    });

    it('keeps lessons within the group dates, also after the dates change', async () => {
      const day = (offset: number) =>
        new Date(Date.now() + 5 * HOUR_MS + offset * DAY_MS).toISOString().slice(0, 10);
      const everyDay = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        startTime: '23:30',
        durationMin: 30,
      }));
      const group = await createGroup({ startsOn: day(10), endsOn: day(19) });
      const result = await putRules(group.id, everyDay);
      expect(result.created).toBe(10);
      const dates = (await futureLessons(group.id)).map((l) =>
        new Date(l.startsAt.getTime() + 5 * HOUR_MS).toISOString().slice(0, 10),
      );
      expect(dates[0]).toBe(day(10));
      expect(dates.at(-1)).toBe(day(19));

      await api('patch', `/groups/${group.id}`, owner())
        .send({ startsOn: day(12), endsOn: day(14) })
        .expect(200);
      const narrowed = (await futureLessons(group.id)).map((l) =>
        new Date(l.startsAt.getTime() + 5 * HOUR_MS).toISOString().slice(0, 10),
      );
      expect(narrowed).toEqual([day(12), day(13), day(14)]);
    });

    it('warns about overlapping lessons of the same teacher and saves anyway', async () => {
      const first = await createGroup({ name: 'Группа А1' });
      const second = await createGroup({ name: 'Группа Б1' });
      await putRules(first.id, [{ weekday: 2, startTime: '18:30', durationMin: 60 }]);
      const result = await putRules(second.id, [
        { weekday: 2, startTime: '18:00', durationMin: 60 },
      ]);
      expect(result.created).toBeGreaterThan(0);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0]).toMatchObject({
        durationMin: 60,
        otherGroupName: 'Группа А1',
        otherDurationMin: 60,
      });
      const { startsAt, otherStartsAt } = result.conflicts[0]!;
      expect(Date.parse(otherStartsAt) - Date.parse(startsAt)).toBe(30 * 60_000);

      const listed = await api('get', `/groups/${second.id}/conflicts`, owner()).expect(200);
      expect((listed.body as LessonConflictDto[]).length).toBe(result.conflicts.length);
      expect(result.conflicts.length).toBeLessThanOrEqual(20);
    });

    it('archiving drops future lessons and keeps past ones; restoring brings them back', async () => {
      const group = await createGroup();
      await putRules(group.id, MON_THU_15);
      const count = (await futureLessons(group.id)).length;
      const rule = await prisma.scheduleRule.findFirstOrThrow({ where: { groupId: group.id } });
      const past = await prisma.lesson.create({
        data: {
          schoolId: fixture.schoolA.id,
          groupId: group.id,
          teacherMembershipId: teacherOfA,
          startsAt: new Date(Date.now() - 3 * DAY_MS),
          durationMin: 60,
          scheduleRuleId: rule.id,
        },
      });

      await api('post', `/groups/${group.id}/archive`, owner()).expect(200);
      expect(await futureLessons(group.id)).toEqual([]);
      await prisma.lesson.findUniqueOrThrow({ where: { id: past.id } });

      await api('post', `/groups/${group.id}/unarchive`, owner()).expect(200);
      expect(await futureLessons(group.id)).toHaveLength(count);
    });

    it('gives future generated lessons to the new teacher of the group', async () => {
      const group = await createGroup();
      await putRules(group.id, MON_THU_15);
      const rule = await prisma.scheduleRule.findFirstOrThrow({ where: { groupId: group.id } });
      const past = await prisma.lesson.create({
        data: {
          schoolId: fixture.schoolA.id,
          groupId: group.id,
          teacherMembershipId: teacherOfA,
          startsAt: new Date(Date.now() - 3 * DAY_MS),
          durationMin: 60,
          status: 'done',
          scheduleRuleId: rule.id,
        },
      });
      const invited = await api('post', '/staff', owner())
        .send({ displayName: 'Замена', role: 'teacher' })
        .expect(201);
      await api('patch', `/groups/${group.id}`, owner())
        .send({ teacherMembershipId: invited.body.id })
        .expect(200);

      const future = await futureLessons(group.id);
      expect(future.length).toBeGreaterThan(0);
      expect(future.every((l) => l.teacherMembershipId === invited.body.id)).toBe(true);
      const kept = await prisma.lesson.findUniqueOrThrow({ where: { id: past.id } });
      expect(kept.teacherMembershipId).toBe(teacherOfA);
    });

    it('drops future lessons when the course is archived', async () => {
      const res = await api('post', '/courses', owner())
        .send({ name: 'Временный', format: 'offline', kind: 'group', color: 'lime', icon: 'bot' })
        .expect(201);
      const group = await createGroup({ courseId: res.body.id });
      await putRules(group.id, MON_THU_15);
      await api('post', `/courses/${res.body.id}/archive`, owner()).expect(200);
      expect(await futureLessons(group.id)).toEqual([]);
    });
  });

  describe('school time zone', () => {
    it('keeps the wall-clock time of lessons when the school moves to another zone', async () => {
      const group = await createGroup();
      await putRules(group.id, [{ weekday: 3, startTime: '15:00', durationMin: 60 }]);
      expect((await futureLessons(group.id)).every((l) => l.startsAt.getUTCHours() === 10)).toBe(
        true,
      );
      try {
        await api('patch', '/school', owner()).send({ timezone: 'Europe/Moscow' }).expect(200);
        const moved = await futureLessons(group.id);
        expect(moved.length).toBeGreaterThan(0);
        expect(moved.every((l) => l.startsAt.getUTCHours() === 12)).toBe(true);
        const rules = await api('get', `/groups/${group.id}/schedule-rules`, owner()).expect(200);
        expect((rules.body as ScheduleRuleDto[])[0]?.startTime).toBe('15:00');
      } finally {
        await api('patch', '/school', owner()).send({ timezone: 'Asia/Dushanbe' }).expect(200);
      }
    }, 120_000);
  });

  describe('validation', () => {
    it('rejects bad rule sets', async () => {
      const rule = (overrides: object = {}) => ({
        weekday: 1,
        startTime: '15:00',
        durationMin: 60,
        ...overrides,
      });
      const fifteen = Array.from({ length: 15 }, (_, i) =>
        rule({ weekday: (i % 7) + 1, startTime: `1${Math.floor(i / 7)}:00` }),
      );
      const bad = [
        { rules: fifteen },
        { rules: [rule(), rule({ durationMin: 90 })] },
        { rules: [rule({ startTime: '25:00' })] },
        { rules: [rule({ durationMin: 10 })] },
        { rules: [rule({ durationMin: 481 })] },
        { rules: [rule({ weekday: 0 })] },
        { rules: [rule({ weekday: 8 })] },
        { rules: [rule({ startTime: '9:00' })] },
        {},
      ];
      for (const body of bad) {
        const res = await api('put', `/groups/${groupOfA.id}/schedule-rules`, owner())
          .send(body)
          .expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
      await api('get', `/groups/not-a-uuid/schedule-rules`, owner()).expect(400);
    });

    it('rejects bad lesson ranges', async () => {
      for (const query of [
        'from=2026-11-10&to=2026-11-01',
        'from=2026-11-01&to=2027-01-02',
        'from=2026-11-01',
        'from=01.11.2026&to=2026-11-10',
        'from=2026-11-01&to=2026-11-10&groupId=nope',
      ]) {
        await api('get', `/lessons?${query}`, owner()).expect(400);
      }
      // 62 days inclusive is the longest range.
      await api('get', '/lessons?from=2026-11-01&to=2027-01-01', owner()).expect(200);
    });

    it('answers 404 for a group of another school', async () => {
      const res = await api(
        'put',
        `/groups/${groupOfA.id}/schedule-rules`,
        fixture.schoolB.owner.auth,
        fixture.schoolB.id,
      )
        .send({ rules: MON_THU_15 })
        .expect(404);
      expect(res.body.error.code).toBe('GROUP_NOT_FOUND');
    });
  });

  describe('daily horizon', () => {
    it('extends the horizon as days pass and does nothing on a repeated run', async () => {
      const group = await createGroup();
      const everyDay = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        startTime: '12:00',
        durationMin: 45,
      }));
      await putRules(group.id, everyDay);
      const before = await prisma.lesson.count({ where: { groupId: group.id } });

      const schedule = app.get(ScheduleService);
      const inAWeek = new Date(Date.now() + 7 * DAY_MS);
      const first = await schedule.extendHorizon(inAWeek);
      expect(first.failed).toBe(0);
      expect(await prisma.lesson.count({ where: { groupId: group.id } })).toBe(before + 7);

      const second = await schedule.extendHorizon(inAWeek);
      expect(second).toMatchObject({ created: 0, deleted: 0, failed: 0 });
      // Two passes over every group of this suite, one transaction each, on a remote database.
    }, 180_000);
  });
});
