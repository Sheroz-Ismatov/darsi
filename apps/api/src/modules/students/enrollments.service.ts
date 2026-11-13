import { Injectable } from '@nestjs/common';
import type {
  EnrollmentDto,
  EnrollStudentRequest,
  GroupFullDetails,
  LeaveEnrollmentRequest,
  TransferEnrollmentRequest,
} from '@darsi/shared';
import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  dateOnly,
  enrollmentInclude,
  schoolToday,
  studentNotFound,
  toEnrollmentDto,
  TX_OPTIONS,
} from './student-helpers';

type Db = Prisma.TransactionClient;

const groupNotFound = () => new AppError('GROUP_NOT_FOUND', 'Group not found', 404);
const enrollmentNotFound = () => new AppError('ENROLLMENT_NOT_FOUND', 'Enrollment not found', 404);
const enrollmentNotActive = () =>
  new AppError('ENROLLMENT_NOT_ACTIVE', 'The student has already left this group', 409);
const alreadyEnrolled = () =>
  new AppError('ALREADY_ENROLLED', 'The student is already in this group', 409);

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const toDay = (value: Date): string => value.toISOString().slice(0, 10);

const dateOrderError = (path: string) =>
  new AppError('VALIDATION_ERROR', 'Request validation failed', 400, {
    issues: [{ path, message: 'The end date must not precede the enrollment date' }],
  });

/** Enrollment into groups, leaving and transfers (TZ FR-21). Nothing here deletes history. */
@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async enroll(
    schoolId: string,
    studentId: string,
    data: EnrollStudentRequest,
    actorId: string,
  ): Promise<EnrollmentDto> {
    const enrolledOn = data.enrolledOn ?? (await schoolToday(this.prisma, schoolId));
    const created = await this.guard(() =>
      this.prisma.$transaction(async (tx) => {
        await this.assertStudentActive(tx, schoolId, studentId);
        await this.assertCanJoin(tx, schoolId, studentId, data.groupId, data.force);
        const enrollment = await tx.enrollment.create({
          data: {
            schoolId,
            studentId,
            groupId: data.groupId,
            enrolledOn: dateOnly(enrolledOn),
          },
          include: enrollmentInclude,
        });
        await this.audit(tx, schoolId, actorId, enrollment.id, 'create', null, {
          studentId,
          groupId: data.groupId,
          enrolledOn,
          force: Boolean(data.force),
        });
        return enrollment;
      }, TX_OPTIONS),
    );
    return toEnrollmentDto(created);
  }

  async leave(
    schoolId: string,
    id: string,
    data: LeaveEnrollmentRequest,
    actorId: string,
  ): Promise<EnrollmentDto> {
    const before = await this.findActive(this.prisma, schoolId, id);
    const leftOn = data.leftOn ?? (await schoolToday(this.prisma, schoolId));
    if (leftOn < toDay(before.enrolledOn)) throw dateOrderError('leftOn');
    const updated = await this.prisma.$transaction(async (tx) => {
      const closed = await this.close(tx, id, leftOn);
      await this.audit(
        tx,
        schoolId,
        actorId,
        id,
        'leave',
        { status: 'active', leftOn: null },
        { status: 'left', leftOn },
      );
      return closed;
    }, TX_OPTIONS);
    return toEnrollmentDto(updated);
  }

  /** The old enrollment ends and the new one starts on the same date, in one transaction. */
  async transfer(
    schoolId: string,
    id: string,
    data: TransferEnrollmentRequest,
    actorId: string,
  ): Promise<EnrollmentDto> {
    const before = await this.findActive(this.prisma, schoolId, id);
    if (before.groupId === data.groupId) throw alreadyEnrolled();
    const date = data.date ?? (await schoolToday(this.prisma, schoolId));
    if (date < toDay(before.enrolledOn)) throw dateOrderError('date');

    const created = await this.guard(() =>
      this.prisma.$transaction(async (tx) => {
        await this.assertStudentActive(tx, schoolId, before.studentId);
        await this.assertCanJoin(tx, schoolId, before.studentId, data.groupId, data.force);
        const closed = await tx.enrollment.updateMany({
          where: { id, status: 'active' },
          data: { status: 'left', leftOn: dateOnly(date) },
        });
        // A parallel leave or transfer got there first.
        if (closed.count === 0) throw enrollmentNotActive();
        const next = await tx.enrollment.create({
          data: {
            schoolId,
            studentId: before.studentId,
            groupId: data.groupId,
            enrolledOn: dateOnly(date),
          },
          include: enrollmentInclude,
        });
        await this.audit(
          tx,
          schoolId,
          actorId,
          id,
          'transfer',
          { groupId: before.groupId, status: 'active' },
          { status: 'left', leftOn: date, toEnrollmentId: next.id, toGroupId: data.groupId },
        );
        await this.audit(tx, schoolId, actorId, next.id, 'create', null, {
          studentId: before.studentId,
          groupId: data.groupId,
          enrolledOn: date,
          fromEnrollmentId: id,
          force: Boolean(data.force),
        });
        return next;
      }, TX_OPTIONS),
    );
    return toEnrollmentDto(created);
  }

  private async assertStudentActive(db: Db, schoolId: string, studentId: string): Promise<void> {
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId },
      select: { archivedAt: true },
    });
    if (!student) throw studentNotFound();
    if (student.archivedAt) {
      throw new AppError('STUDENT_ARCHIVED', 'The student is archived', 409);
    }
  }

  /** Over capacity is allowed only on purpose (T-18, decision 6). */
  private async assertCanJoin(
    db: Db,
    schoolId: string,
    studentId: string,
    groupId: string,
    force: boolean | undefined,
  ): Promise<void> {
    const group = await db.group.findFirst({
      where: { id: groupId, schoolId },
      select: { capacity: true, archivedAt: true },
    });
    if (!group) throw groupNotFound();
    if (group.archivedAt) throw new AppError('GROUP_ARCHIVED', 'The group is archived', 409);
    const already = await db.enrollment.findFirst({
      where: { studentId, groupId, status: 'active' },
      select: { id: true },
    });
    if (already) throw alreadyEnrolled();
    if (force) return;
    const enrolled = await db.enrollment.count({ where: { groupId, status: 'active' } });
    if (enrolled >= group.capacity) {
      const details: GroupFullDetails = { capacity: group.capacity, enrolled };
      throw new AppError('GROUP_FULL', 'The group has no free seats', 409, { ...details });
    }
  }

  private async findActive(db: Db, schoolId: string, id: string) {
    const enrollment = await db.enrollment.findFirst({
      where: { id, schoolId },
      select: { id: true, studentId: true, groupId: true, enrolledOn: true, status: true },
    });
    if (!enrollment) throw enrollmentNotFound();
    if (enrollment.status !== 'active') throw enrollmentNotActive();
    return enrollment;
  }

  private async close(tx: Db, id: string, leftOn: string) {
    const closed = await tx.enrollment.updateMany({
      where: { id, status: 'active' },
      data: { status: 'left', leftOn: dateOnly(leftOn) },
    });
    if (closed.count === 0) throw enrollmentNotActive();
    return tx.enrollment.findUniqueOrThrow({ where: { id }, include: enrollmentInclude });
  }

  /** Two simultaneous enrollments meet at the partial unique index; the loser gets a 409. */
  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (isUniqueViolation(error)) throw alreadyEnrolled();
      throw error;
    }
  }

  private async audit(
    tx: Db,
    schoolId: string,
    actorUserId: string,
    entityId: string,
    action: string,
    before: Prisma.InputJsonObject | null,
    after: Prisma.InputJsonObject,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        schoolId,
        actorUserId,
        entity: 'Enrollment',
        entityId,
        action,
        before: before ?? undefined,
        after,
      },
    });
  }
}
