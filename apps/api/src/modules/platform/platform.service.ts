import { randomBytes, randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  INVITE_START_PREFIX,
  OWNER_INVITE_TTL_HOURS,
  type CreatePlanRequest,
  type CreateSchoolRequest,
  type OwnerInviteResponse,
  type PlanDto,
  type PlatformSchoolDto,
  type UpdatePlanRequest,
  type UpdateSchoolRequest,
} from '@darsi/shared';
import { Prisma, type Plan } from '@prisma/client';
import { ENV } from '../../common/config/config.module';
import type { Env } from '../../common/config/env';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashToken } from '../auth/token.service';
import { countStaff, STAFF_ROLES } from './plan-limits.service';

const DEFAULT_BRANCH_NAME = 'Основной филиал';
const DEFAULT_OWNER_NAME = 'Владелец';
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_ATTEMPTS = 5;

const planNotFound = () => new AppError('PLAN_NOT_FOUND', 'Plan not found', 404);
const schoolNotFound = () => new AppError('SCHOOL_NOT_FOUND', 'School not found', 404);

const isPrismaError = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

const planFields = (plan: Plan) => ({
  name: plan.name,
  maxStudents: plan.maxStudents,
  maxStaff: plan.maxStaff,
  maxStorageMb: plan.maxStorageMb,
});

function generateSchoolCode(): string {
  let code = 's-';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

const schoolInclude = (now: Date) =>
  ({
    plan: true,
    memberships: {
      where: { role: { in: STAFF_ROLES }, status: { not: 'deactivated' } },
      select: { id: true, userId: true, role: true, status: true, displayName: true },
      orderBy: { createdAt: 'asc' },
    },
    inviteTokens: {
      where: {
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        membership: { role: 'owner' },
      },
      select: { expiresAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1,
    },
  }) satisfies Prisma.SchoolInclude;

type SchoolRow = Prisma.SchoolGetPayload<{ include: ReturnType<typeof schoolInclude> }>;

function toSchoolDto(school: SchoolRow): PlatformSchoolDto {
  const owners = school.memberships.filter((m) => m.role === 'owner');
  const owner = owners.find((m) => m.status === 'active') ?? owners[0];
  return {
    id: school.id,
    name: school.name,
    code: school.code,
    currency: school.currency,
    timezone: school.timezone,
    defaultLocale: school.defaultLocale,
    status: school.status,
    createdAt: school.createdAt.toISOString(),
    plan: {
      id: school.plan.id,
      name: school.plan.name,
      maxStudents: school.plan.maxStudents,
      maxStaff: school.plan.maxStaff,
    },
    staffCount: countStaff(school.memberships),
    owner: owner
      ? { displayName: owner.displayName, status: owner.status === 'active' ? 'active' : 'invited' }
      : null,
    ownerInviteExpiresAt:
      owner?.status === 'active' ? null : (school.inviteTokens[0]?.expiresAt.toISOString() ?? null),
  };
}

/** Superadmin operations: schools, plans and owner invites (TZ FR-1, FR-6). */
@Injectable()
export class PlatformService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  async listPlans(): Promise<PlanDto[]> {
    const plans = await this.prisma.plan.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { schools: true } } },
    });
    return plans.map((plan) => ({
      id: plan.id,
      ...planFields(plan),
      schoolsCount: plan._count.schools,
    }));
  }

  async createPlan(data: CreatePlanRequest): Promise<PlanDto> {
    const plan = await this.prisma.plan.create({ data });
    return this.planDto(plan.id);
  }

  async updatePlan(id: string, data: UpdatePlanRequest, actorId: string): Promise<PlanDto> {
    const before = await this.prisma.plan.findUnique({ where: { id } });
    if (!before) throw planNotFound();
    const after = await this.prisma.plan.update({ where: { id }, data });
    await this.audit(null, actorId, 'Plan', id, 'update', planFields(before), planFields(after));
    return this.planDto(id);
  }

  async listSchools(): Promise<PlatformSchoolDto[]> {
    const schools = await this.prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
      include: schoolInclude(new Date()),
    });
    return schools.map(toSchoolDto);
  }

  /** The school starts with one branch and an invited owner; the invite link is issued separately. */
  async createSchool(data: CreateSchoolRequest, actorId: string): Promise<PlatformSchoolDto> {
    const plan = await this.prisma.plan.findUnique({ where: { id: data.planId } });
    if (!plan) throw planNotFound();

    const { ownerName, code, ...fields } = data;
    for (let attempt = 1; ; attempt += 1) {
      try {
        const school = await this.prisma.school.create({
          data: {
            ...fields,
            code: code ?? generateSchoolCode(),
            branches: { create: { name: DEFAULT_BRANCH_NAME } },
            memberships: { create: { role: 'owner', displayName: ownerName } },
          },
        });
        await this.audit(school.id, actorId, 'School', school.id, 'create', null, {
          name: school.name,
          code: school.code,
          planId: school.planId,
        });
        return this.schoolDto(school.id);
      } catch (error) {
        if (!isPrismaError(error, 'P2002')) throw error;
        if (code) {
          throw new AppError('SCHOOL_CODE_TAKEN', 'This school code is already in use', 409);
        }
        if (attempt >= CODE_ATTEMPTS) throw error;
      }
    }
  }

  async updateSchool(
    id: string,
    data: UpdateSchoolRequest,
    actorId: string,
  ): Promise<PlatformSchoolDto> {
    const before = await this.prisma.school.findUnique({
      where: { id },
      select: { name: true, planId: true, status: true },
    });
    if (!before) throw schoolNotFound();
    if (data.planId && data.planId !== before.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: data.planId } });
      if (!plan) throw planNotFound();
    }

    const after = await this.prisma.school.update({
      where: { id },
      data,
      select: { name: true, planId: true, status: true },
    });
    const action =
      after.status === before.status ? 'update' : after.status === 'blocked' ? 'block' : 'unblock';
    await this.audit(id, actorId, 'School', id, action, before, after);
    return this.schoolDto(id);
  }

  /**
   * One-time link for the school owner, valid for 72 hours (TZ FR-1).
   * A new link replaces the previous one; accepting it is T-12.
   */
  async issueOwnerInvite(schoolId: string, actorId: string): Promise<OwnerInviteResponse> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        memberships: {
          where: { role: 'owner', status: { not: 'deactivated' } },
          select: { id: true, status: true },
        },
      },
    });
    if (!school) throw schoolNotFound();
    if (school.memberships.some((m) => m.status === 'active')) {
      throw new AppError('OWNER_ALREADY_JOINED', 'The school already has an active owner', 409);
    }

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + OWNER_INVITE_TTL_HOURS * 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      // Schools created outside the platform API (seed) have no owner placeholder yet.
      const membership =
        school.memberships[0] ??
        (await tx.membership.create({
          data: { schoolId, role: 'owner', displayName: DEFAULT_OWNER_NAME },
          select: { id: true },
        }));
      await tx.inviteToken.updateMany({
        where: { membershipId: membership.id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const invite = await tx.inviteToken.create({
        data: {
          schoolId,
          membershipId: membership.id,
          tokenHash: hashToken(token),
          expiresAt,
          createdByUserId: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId,
          actorUserId: actorId,
          entity: 'InviteToken',
          entityId: invite.id,
          action: 'create',
          after: { role: 'owner', expiresAt: expiresAt.toISOString() },
        },
      });
    });

    return {
      url: `https://t.me/${this.env.BOT_USERNAME}?start=${INVITE_START_PREFIX}${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async planDto(id: string): Promise<PlanDto> {
    const plan = (await this.listPlans()).find((p) => p.id === id);
    if (!plan) throw planNotFound();
    return plan;
  }

  private async schoolDto(id: string): Promise<PlatformSchoolDto> {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: schoolInclude(new Date()),
    });
    if (!school) throw schoolNotFound();
    return toSchoolDto(school);
  }

  private async audit(
    schoolId: string | null,
    actorUserId: string,
    entity: string,
    entityId: string,
    action: string,
    before: Prisma.InputJsonObject | null,
    after: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { schoolId, actorUserId, entity, entityId, action, before: before ?? undefined, after },
    });
  }
}
