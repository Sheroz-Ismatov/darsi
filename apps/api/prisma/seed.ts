import { PrismaClient, type Plan, type School, type User } from '@prisma/client';

export const PILOT_PLAN_NAME = 'Пилот';
export const DEMO_SCHOOL_CODE = 'demo';

export interface SeedOptions {
  /** Telegram id of the Darsi team member who administers the platform. */
  superadminTelegramId?: bigint;
}

export interface SeedResult {
  plan: Plan;
  school: School;
  superadmin: User | null;
}

/** Idempotent: safe to run on every `migrate reset` and repeatedly in tests. */
export async function seed(prisma: PrismaClient, options: SeedOptions = {}): Promise<SeedResult> {
  const plan =
    (await prisma.plan.findFirst({ where: { name: PILOT_PLAN_NAME } })) ??
    (await prisma.plan.create({
      data: { name: PILOT_PLAN_NAME, maxStudents: 500, maxStaff: 30, maxStorageMb: 1024 },
    }));

  const school = await prisma.school.upsert({
    where: { code: DEMO_SCHOOL_CODE },
    update: {},
    create: {
      name: 'Демо-школа',
      code: DEMO_SCHOOL_CODE,
      currency: 'TJS',
      timezone: 'Asia/Dushanbe',
      defaultLocale: 'ru',
      planId: plan.id,
      branches: { create: { name: 'Основной филиал' } },
    },
  });

  const telegramId = options.superadminTelegramId;
  const superadmin = telegramId
    ? await prisma.user.upsert({
        where: { telegramId },
        update: { isSuperadmin: true },
        create: { telegramId, firstName: 'Darsi', isSuperadmin: true },
      })
    : null;

  return { plan, school, superadmin };
}

function parseTelegramId(value: string | undefined): bigint | undefined {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new Error('SEED_SUPERADMIN_TELEGRAM_ID must be a numeric Telegram user id');
  }
  return BigInt(value);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma, { superadminTelegramId: parseTelegramId(process.env.SEED_SUPERADMIN_TELEGRAM_ID) })
    .then(({ plan, school, superadmin }) => {
      console.log(`Seeded plan "${plan.name}", school "${school.code}"`);
      console.log(
        superadmin
          ? `Superadmin: telegram id ${superadmin.telegramId}`
          : 'No superadmin: set SEED_SUPERADMIN_TELEGRAM_ID to create one',
      );
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
