import { PrismaClient } from '@prisma/client';
import { DEMO_SCHOOL_CODE, PILOT_PLAN_NAME, seed } from '../../prisma/seed';

// Runs against the real test database. Prepare it first: pnpm --filter @darsi/api db:test:prepare
const url = process.env.DATABASE_URL_TEST;

describe.skipIf(!url)('seed (integration, DATABASE_URL_TEST)', () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const superadminTelegramId = 900_000_000_001n;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates the pilot plan, demo school with a branch and the superadmin', async () => {
    const { school, superadmin } = await seed(prisma, { superadminTelegramId });

    expect(school).toMatchObject({
      code: DEMO_SCHOOL_CODE,
      currency: 'TJS',
      timezone: 'Asia/Dushanbe',
    });
    expect(await prisma.branch.count({ where: { schoolId: school.id } })).toBe(1);
    expect(superadmin?.isSuperadmin).toBe(true);
  });

  it('is idempotent', async () => {
    await seed(prisma, { superadminTelegramId });
    await seed(prisma, { superadminTelegramId });

    expect(await prisma.plan.count({ where: { name: PILOT_PLAN_NAME } })).toBe(1);
    expect(await prisma.school.count({ where: { code: DEMO_SCHOOL_CODE } })).toBe(1);
    expect(await prisma.user.count({ where: { telegramId: superadminTelegramId } })).toBe(1);
    const school = await prisma.school.findUniqueOrThrow({ where: { code: DEMO_SCHOOL_CODE } });
    expect(await prisma.branch.count({ where: { schoolId: school.id } })).toBe(1);
  });
});
