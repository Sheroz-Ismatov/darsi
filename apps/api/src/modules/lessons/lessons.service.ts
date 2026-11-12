import { Injectable } from '@nestjs/common';
import {
  addDays,
  zonedDateTimeToUtc,
  type CourseIcon,
  type LessonDto,
  type ListLessonsQuery,
} from '@darsi/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const lessonInclude = {
  group: {
    select: {
      name: true,
      meetingUrl: true,
      course: { select: { id: true, name: true, color: true, icon: true } },
    },
  },
  teacher: { select: { id: true, displayName: true } },
} satisfies Prisma.LessonInclude;

type LessonRow = Prisma.LessonGetPayload<{ include: typeof lessonInclude }>;

/** Reading lessons. Cancelling, moving and one-off lessons come in T-17. */
@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lessons whose start falls on the dates `from…to` of the school's calendar. */
  async list(schoolId: string, query: ListLessonsQuery): Promise<LessonDto[]> {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { timezone: true },
    });
    const rows = await this.prisma.lesson.findMany({
      where: {
        schoolId,
        ...(query.groupId && { groupId: query.groupId }),
        startsAt: {
          gte: zonedDateTimeToUtc(query.from, '00:00', school.timezone),
          lt: zonedDateTimeToUtc(addDays(query.to, 1), '00:00', school.timezone),
        },
      },
      include: lessonInclude,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toLessonDto);
  }
}

export const toLessonDto = (row: LessonRow): LessonDto => ({
  id: row.id,
  groupId: row.groupId,
  groupName: row.group.name,
  course: {
    id: row.group.course.id,
    name: row.group.course.name,
    color: row.group.course.color,
    icon: row.group.course.icon as CourseIcon,
  },
  teacher: { id: row.teacher.id, displayName: row.teacher.displayName },
  startsAt: row.startsAt.toISOString(),
  durationMin: row.durationMin,
  status: row.status,
  originalStartsAt: row.originalStartsAt?.toISOString() ?? null,
  cancelReason: row.cancelReason,
  meetingUrl: row.meetingUrl ?? row.group.meetingUrl,
  isOneOff: row.scheduleRuleId === null,
});
