import { Inject, Injectable } from '@nestjs/common';
import type { SchoolDto, UpdateSchoolSettingsRequest } from '@darsi/shared';
import type { Prisma } from '@prisma/client';
import { ENV } from '../../common/config/config.module';
import type { Env } from '../../common/config/env';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScheduleService } from '../lessons/schedule.service';

const settingsSelect = {
  id: true,
  name: true,
  code: true,
  currency: true,
  timezone: true,
  defaultLocale: true,
  address: true,
  phone: true,
  description: true,
  chargeAbsent: true,
  chargeExcused: true,
  reminderHoursBefore: true,
  debtRemindersEnabled: true,
} satisfies Prisma.SchoolSelect;

type SettingsRow = Prisma.SchoolGetPayload<{ select: typeof settingsSelect }>;
type SettingsField = keyof UpdateSchoolSettingsRequest;

const schoolNotFound = () => new AppError('SCHOOL_NOT_FOUND', 'School not found', 404);

/** Profile and rules of the current school (TZ FR-7…FR-9). */
@Injectable()
export class SchoolsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly schedule: ScheduleService,
  ) {}

  async get(schoolId: string): Promise<SchoolDto> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: settingsSelect,
    });
    if (!school) throw schoolNotFound();
    return this.toDto(school, await this.isCurrencyLocked(schoolId));
  }

  /**
   * Rule changes apply to new attendance marks only (FR-8): stored marks keep what was charged.
   * The audit entry holds just the fields whose value actually changed.
   */
  async update(
    schoolId: string,
    data: UpdateSchoolSettingsRequest,
    actorId: string,
  ): Promise<SchoolDto> {
    const before = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: settingsSelect,
    });
    if (!before) throw schoolNotFound();

    const locked = await this.isCurrencyLocked(schoolId);
    if (locked && data.currency !== undefined && data.currency !== before.currency) {
      throw new AppError(
        'CURRENCY_LOCKED',
        'The currency cannot change after the first payment',
        409,
      );
    }

    const changed: Prisma.JsonObject = {};
    const previous: Prisma.JsonObject = {};
    for (const field of Object.keys(data) as SettingsField[]) {
      const value = data[field];
      if (value === undefined || value === before[field]) continue;
      changed[field] = value;
      previous[field] = before[field];
    }
    if (Object.keys(changed).length === 0) return this.toDto(before, locked);

    const [after] = await this.prisma.$transaction([
      this.prisma.school.update({
        where: { id: schoolId },
        data: changed as Prisma.SchoolUpdateInput,
        select: settingsSelect,
      }),
      this.prisma.auditLog.create({
        data: {
          schoolId,
          actorUserId: actorId,
          entity: 'School',
          entityId: schoolId,
          action: 'update',
          before: previous,
          after: changed,
        },
      }),
    ]);
    if (changed.timezone !== undefined) await this.schedule.syncSchool(schoolId);
    return this.toDto(after, locked);
  }

  /** Whether the school already has a payment, after which the currency is fixed (TZ FR-7). */
  isCurrencyLocked(_schoolId: string): Promise<boolean> {
    // TODO(T-25): return true once the school has at least one payment.
    return Promise.resolve(false);
  }

  private toDto(school: SettingsRow, currencyLocked: boolean): SchoolDto {
    return {
      ...school,
      currencyLocked,
      joinUrl: `https://t.me/${this.env.BOT_USERNAME}?start=${school.code}`,
    };
  }
}
