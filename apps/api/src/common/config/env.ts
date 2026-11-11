import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/, 'must look like 123456:ABC-token from @BotFather'),
    BOT_USERNAME: z.string().regex(/^\w+bot$/i, 'must be the bot username without @'),
    // TODO(T-40): add `webhook` for production.
    BOT_MODE: z.enum(['polling', 'off']).default('off'),
    /** Public HTTPS URL of the Mini App; the bot's buttons open it. `TMA_URL=` counts as unset. */
    TMA_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .url()
        .refine(
          (url) => url.startsWith('https://'),
          'must be an https:// URL (Telegram requirement)',
        )
        .optional(),
    ),
    /** Admin panel address; the Mini App links owners and admins to it after an invite. `WEB_URL=` counts as unset. */
    WEB_URL: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),
    AUTH_DEV_BYPASS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.AUTH_DEV_BYPASS) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_DEV_BYPASS'],
        message: 'must be false in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Validates process environment; throws one error listing every invalid variable. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }
  return result.data;
}
