import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@darsi/shared';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { TokenService } from '../../src/modules/auth/token.service';

export interface TestMember {
  userId: string;
  /** Ready-to-use `Authorization` header value. */
  auth: string;
}

export interface TestSchool {
  id: string;
  owner: TestMember;
  admin: TestMember;
  teacher: TestMember;
  parent: TestMember;
}

export interface TenantFixture {
  schoolA: TestSchool;
  schoolB: TestSchool;
  /** Signed-in user without any membership. */
  outsider: TestMember;
  superadmin: TestMember;
}

const uniqueTelegramId = (): bigint => BigInt(6_000_000_000 + randomInt(0, 999_999_999));

/**
 * Two schools with one member per role each, plus an outsider and a superadmin.
 * Feature suites seed their own records on top (e.g. a course in school A) and check that
 * members of school B cannot reach them.
 */
export async function createTenantFixture(app: INestApplication): Promise<TenantFixture> {
  const prisma = app.get(PrismaService);
  const tokens = app.get(TokenService);

  const user = async (firstName: string, isSuperadmin = false): Promise<TestMember> => {
    const created = await prisma.user.create({
      data: { telegramId: uniqueTelegramId(), firstName, isSuperadmin },
    });
    return { userId: created.id, auth: `Bearer ${await tokens.issueAccessToken(created.id)}` };
  };

  const plan = await prisma.plan.create({
    data: { name: 'isolation', maxStudents: 100, maxStaff: 100, maxStorageMb: 100 },
  });

  const school = async (label: string): Promise<TestSchool> => {
    const created = await prisma.school.create({
      data: {
        name: `Изоляция ${label}`,
        code: `iso-${label.toLowerCase()}-${uniqueTelegramId()}`,
        currency: 'TJS',
        timezone: 'Asia/Dushanbe',
        planId: plan.id,
        branches: { create: { name: 'Основной' } },
      },
    });
    const member = async (role: Role): Promise<TestMember> => {
      const m = await user(`${role} ${label}`);
      await prisma.membership.create({
        data: {
          schoolId: created.id,
          userId: m.userId,
          role,
          displayName: `${role} ${label}`,
          status: 'active',
        },
      });
      return m;
    };
    const [owner, admin, teacher, parent] = await Promise.all(
      (['owner', 'admin', 'teacher', 'parent'] as const).map(member),
    );
    return { id: created.id, owner: owner!, admin: admin!, teacher: teacher!, parent: parent! };
  };

  // Independent records are created concurrently: each round trip to a remote test DB is slow.
  const [schoolA, schoolB, outsider, superadmin] = await Promise.all([
    school('A'),
    school('B'),
    user('outsider'),
    user('superadmin', true),
  ]);
  return { schoolA, schoolB, outsider, superadmin };
}
