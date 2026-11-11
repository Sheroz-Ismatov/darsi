import { Injectable } from '@nestjs/common';
import {
  STAFF_INVITE_TTL_HOURS,
  type CreateStaffRequest,
  type InviteLinkResponse,
  type ListStaffQuery,
  type StaffListResponse,
  type StaffMemberDto,
  type UpdateStaffRequest,
} from '@darsi/shared';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InvitesService } from '../invites/invites.service';
import { PlanLimitsService, STAFF_ROLES } from '../platform/plan-limits.service';

const staffNotFound = () => new AppError('STAFF_NOT_FOUND', 'Staff member not found', 404);
const ownerImmutable = () =>
  new AppError('OWNER_IMMUTABLE', 'The school owner cannot be changed here', 409);

const staffSelect = (now: Date) =>
  ({
    id: true,
    userId: true,
    displayName: true,
    phone: true,
    role: true,
    status: true,
    createdAt: true,
    inviteTokens: {
      where: { usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      select: { expiresAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1,
    },
  }) satisfies Prisma.MembershipSelect;

type StaffRow = Prisma.MembershipGetPayload<{ select: ReturnType<typeof staffSelect> }>;

const byOwnerThenName = (a: StaffMemberDto, b: StaffMemberDto): number =>
  Number(b.role === 'owner') - Number(a.role === 'owner') ||
  a.displayName.localeCompare(b.displayName, 'ru');

/** School staff: owners, admins and teachers as memberships (TZ FR-10). Nothing is deleted. */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: PlanLimitsService,
    private readonly invites: InvitesService,
  ) {}

  async list(schoolId: string, userId: string, query: ListStaffQuery): Promise<StaffListResponse> {
    const [rows, limit] = await Promise.all([
      this.prisma.membership.findMany({
        where: {
          schoolId,
          role: query.role ?? { in: STAFF_ROLES },
          ...(query.status && { status: query.status }),
        },
        select: staffSelect(new Date()),
      }),
      this.limits.staffUsage(schoolId),
    ]);
    return { items: rows.map((row) => this.toDto(row, userId)).sort(byOwnerThenName), limit };
  }

  async create(
    schoolId: string,
    data: CreateStaffRequest,
    actorId: string,
  ): Promise<StaffMemberDto> {
    await this.limits.assertCanAddStaff(schoolId);
    const created = await this.prisma.membership.create({
      data: {
        schoolId,
        role: data.role,
        displayName: data.displayName,
        phone: data.phone ?? null,
      },
      select: staffSelect(new Date()),
    });
    await this.audit(schoolId, actorId, created.id, 'create', null, {
      role: created.role,
      displayName: created.displayName,
      phone: created.phone,
    });
    return this.toDto(created, actorId);
  }

  /**
   * Deactivation cuts access on the next request (SchoolGuard checks the status) and revokes
   * live invite links. Reactivation takes a plan seat again; a membership nobody has accepted
   * goes back to `invited`.
   */
  async update(
    schoolId: string,
    id: string,
    data: UpdateStaffRequest,
    actorId: string,
  ): Promise<StaffMemberDto> {
    const before = await this.find(schoolId, id);
    const changes: Prisma.MembershipUpdateInput = {};
    if (data.displayName !== undefined && data.displayName !== before.displayName) {
      changes.displayName = data.displayName;
    }
    if (data.phone !== undefined && data.phone !== before.phone) {
      changes.phone = data.phone;
    }

    let revoke = false;
    if (data.status === 'deactivated' && before.status !== 'deactivated') {
      if (before.role === 'owner') throw ownerImmutable();
      changes.status = 'deactivated';
      revoke = true;
    } else if (data.status === 'active' && before.status === 'deactivated') {
      if (before.role === 'owner') throw ownerImmutable();
      await this.limits.assertCanAddStaff(schoolId, before.userId);
      changes.status = before.userId ? 'active' : 'invited';
    }

    const fields = Object.keys(changes) as (keyof typeof changes & keyof StaffRow)[];
    if (fields.length === 0) return this.toDto(before, actorId);

    const previous: Prisma.JsonObject = {};
    const next: Prisma.JsonObject = {};
    for (const field of fields) {
      previous[field] = before[field] as Prisma.JsonValue;
      next[field] = changes[field] as Prisma.JsonValue;
    }

    const now = new Date();
    const after = await this.prisma.$transaction(async (tx) => {
      if (revoke) {
        await tx.inviteToken.updateMany({
          where: { membershipId: id, usedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      const updated = await tx.membership.update({
        where: { id },
        data: changes,
        select: staffSelect(now),
      });
      await tx.auditLog.create({
        data: {
          schoolId,
          actorUserId: actorId,
          entity: 'Membership',
          entityId: id,
          action: 'update',
          before: previous,
          after: next,
        },
      });
      return updated;
    });
    return this.toDto(after, actorId);
  }

  /** A 7-day link for someone who has not joined yet; a new link replaces the previous one. */
  async issueInvite(schoolId: string, id: string, actorId: string): Promise<InviteLinkResponse> {
    const member = await this.find(schoolId, id);
    if (member.role === 'owner') throw ownerImmutable();
    if (member.status === 'active') {
      throw new AppError('STAFF_ALREADY_JOINED', 'This person has already joined', 409);
    }
    if (member.status === 'deactivated') {
      throw new AppError('STAFF_DEACTIVATED', 'This staff member is deactivated', 409);
    }
    const link = await this.invites.issue({
      schoolId,
      membershipId: id,
      ttlHours: STAFF_INVITE_TTL_HOURS,
      actorId,
    });
    await this.audit(schoolId, actorId, id, 'issue_invite', null, { expiresAt: link.expiresAt });
    return link;
  }

  private async find(schoolId: string, id: string): Promise<StaffRow> {
    const member = await this.prisma.membership.findFirst({
      where: { id, schoolId, role: { in: STAFF_ROLES } },
      select: staffSelect(new Date()),
    });
    if (!member) throw staffNotFound();
    return member;
  }

  private toDto(row: StaffRow, userId: string): StaffMemberDto {
    return {
      id: row.id,
      displayName: row.displayName,
      phone: row.phone,
      role: row.role as StaffMemberDto['role'],
      status: row.status,
      isSelf: row.userId === userId,
      inviteExpiresAt:
        row.status === 'invited' ? (row.inviteTokens[0]?.expiresAt.toISOString() ?? null) : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async audit(
    schoolId: string,
    actorUserId: string,
    entityId: string,
    action: string,
    before: Prisma.InputJsonObject | null,
    after: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        schoolId,
        actorUserId,
        entity: 'Membership',
        entityId,
        action,
        before: before ?? undefined,
        after,
      },
    });
  }
}
