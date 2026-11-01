import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../common/prisma/prisma.service';
import { REDIS } from '../../common/redis/redis.module';

export type CheckStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  checks: { database: CheckStatus; redis: CheckStatus };
}

// Leaves room for a serverless database waking up from auto-suspend (Neon: ~0.5–1 s).
const PROBE_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(() => this.redis.ping()),
    ]);
    return {
      status: database === 'up' && redis === 'up' ? 'ok' : 'error',
      checks: { database, redis },
    };
  }
}

async function probe(run: () => Promise<unknown>): Promise<CheckStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS);
  });
  try {
    await Promise.race([run(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}
