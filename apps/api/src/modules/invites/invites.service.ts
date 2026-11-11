import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  INVITE_START_PREFIX,
  type AcceptInviteResponse,
  type InviteLinkResponse,
  type JoinSchoolResponse,
  type JoinedMembership,
} from '@darsi/shared';
import { Prisma, type Membership } from '@prisma/client';
import { ENV } from '../../common/config/config.module';
import type { Env } from '../../common/config/env';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashToken } from '../auth/token.service';

const HOUR_MS = 60 * 60 * 1000;
// Several round trips to a remote database; the 5 s default is too tight for Neon.
const TX_OPTIONS = { timeout: 20_000 };

const inviteUsed = () => new AppError('INVITE_USED', 'This invite has already been used', 409);
const schoolBlocked = () => new AppError('SCHOOL_BLOCKED', 'The school is blocked', 403);

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Moves everything attached to an invite placeholder onto the membership the user already has,
 * so the placeholder can be deleted. T-18 adds the parent–student links here.
 */
export async function mergeMembership(
  tx: Prisma.TransactionClient,
  from: string,
  into: string,
): Promise<void> {
  await tx.inviteToken.updateMany({ where: { membershipId: from }, data: { membershipId: into } });
}

export interface IssueInviteParams {
  schoolId: string;
  membershipId: string;
  ttlHours: number;
  actorId: string;
}

/** One-time invite links for any role (TZ FR-1, FR-10, FR-17) and joining a school by its code (FR-9). */
@Injectable()
export class InvitesService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  /** Issues a new link for an invited membership; earlier unused links of it stop working. */
  async issue({
    schoolId,
    membershipId,
    ttlHours,
    actorId,
  }: IssueInviteParams): Promise<InviteLinkResponse> {
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlHours * HOUR_MS);

    await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { id: membershipId, schoolId },
        select: { role: true },
      });
      if (!membership) {
        throw new Error(`Membership ${membershipId} does not belong to school ${schoolId}`);
      }
      await tx.inviteToken.updateMany({
        where: { membershipId, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const invite = await tx.inviteToken.create({
        data: {
          schoolId,
          membershipId,
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
          after: { role: membership.role, expiresAt: expiresAt.toISOString() },
        },
      });
    }, TX_OPTIONS);

    return {
      url: `https://t.me/${this.env.BOT_USERNAME}?start=${INVITE_START_PREFIX}${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async accept(userId: string, token: string): Promise<AcceptInviteResponse> {
    const membership = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.inviteToken.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { membership: true, school: { select: { status: true } } },
      });
      if (!invite) {
        throw new AppError('INVITE_NOT_FOUND', 'Invite not found', 404);
      }
      const placeholder = invite.membership;

      if (invite.usedAt) {
        // Opening one's own link twice is harmless. After a merge the token points at the
        // membership the user kept, so this check also holds then.
        if (placeholder.userId === userId && placeholder.status === 'active') return placeholder;
        throw inviteUsed();
      }
      if (invite.revokedAt || placeholder.status === 'deactivated') throw inviteUsed();
      if (placeholder.userId && placeholder.userId !== userId) throw inviteUsed();
      if (invite.expiresAt <= new Date()) {
        throw new AppError('INVITE_EXPIRED', 'This invite has expired', 410);
      }
      if (invite.school.status === 'blocked') throw schoolBlocked();

      // Atomic claim: of two concurrent acceptances only one wins.
      const claimed = await tx.inviteToken.updateMany({
        where: { id: invite.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw inviteUsed();

      const existing = await tx.membership.findFirst({
        where: {
          schoolId: placeholder.schoolId,
          userId,
          role: placeholder.role,
          id: { not: placeholder.id },
        },
      });
      let joined: Membership;
      if (existing) {
        await mergeMembership(tx, placeholder.id, existing.id);
        await tx.membership.delete({ where: { id: placeholder.id } });
        joined = await tx.membership.update({
          where: { id: existing.id },
          data: { status: 'active' },
        });
      } else {
        joined = await tx.membership.update({
          where: { id: placeholder.id },
          data: { userId, status: 'active' },
        });
      }

      await tx.auditLog.create({
        data: {
          schoolId: joined.schoolId,
          actorUserId: userId,
          entity: 'Membership',
          entityId: joined.id,
          action: 'accept_invite',
          after: { role: joined.role },
        },
      });
      return joined;
    }, TX_OPTIONS);

    const isStaffWeb = membership.role === 'owner' || membership.role === 'admin';
    return {
      membership: await this.toJoined(membership),
      webUrl: isStaffWeb ? (this.env.WEB_URL ?? null) : null,
    };
  }

  /** Parents without a personal link enter through the school's public code (TZ FR-9). */
  async joinByCode(userId: string, code: string): Promise<JoinSchoolResponse> {
    const school = await this.prisma.school.findUnique({
      where: { code },
      select: { id: true, status: true },
    });
    if (!school) {
      throw new AppError('SCHOOL_NOT_FOUND', 'School not found', 404);
    }
    if (school.status === 'blocked') throw schoolBlocked();

    const current = await this.findParent(school.id, userId);
    if (current) return this.rejoin(current);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    let created: Membership;
    try {
      created = await this.prisma.membership.create({
        data: {
          schoolId: school.id,
          userId,
          role: 'parent',
          status: 'active',
          displayName: [user.firstName, user.lastName].filter(Boolean).join(' '),
        },
      });
    } catch (error) {
      // A parallel request created it first: the unique (school, user, role) index decides.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findParent(school.id, userId);
      if (!winner) throw error;
      return this.rejoin(winner);
    }

    await this.prisma.auditLog.create({
      data: {
        schoolId: school.id,
        actorUserId: userId,
        entity: 'Membership',
        entityId: created.id,
        action: 'join_by_code',
        after: { role: 'parent' },
      },
    });
    return { membership: await this.toJoined(created), created: true };
  }

  private findParent(schoolId: string, userId: string): Promise<Membership | null> {
    return this.prisma.membership.findFirst({ where: { schoolId, userId, role: 'parent' } });
  }

  private async rejoin(membership: Membership): Promise<JoinSchoolResponse> {
    if (membership.status === 'deactivated') {
      throw new AppError('MEMBERSHIP_DEACTIVATED', 'The school has turned off this access', 403);
    }
    return { membership: await this.toJoined(membership), created: false };
  }

  private async toJoined(membership: Membership): Promise<JoinedMembership> {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: membership.schoolId },
      select: { name: true },
    });
    return {
      id: membership.id,
      schoolId: membership.schoolId,
      schoolName: school.name,
      role: membership.role,
    };
  }
}
