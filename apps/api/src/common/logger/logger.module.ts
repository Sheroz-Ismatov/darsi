import { randomUUID } from 'node:crypto';
import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

const LEVELS: Record<Env['NODE_ENV'], string> = {
  development: 'debug',
  test: 'silent',
  production: 'info',
};

interface LoggedRequest {
  id?: unknown;
  method?: string;
  url?: string;
}

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        // Named wildcard: Nest 11 / path-to-regexp v8 reject the bare "*".
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: LEVELS[env.NODE_ENV],
          genReqId: (req, res) => {
            const header = req.headers['x-request-id'];
            const id = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          // Logs must not contain tokens or personal data (TZ §10.3): no headers at all,
          // since proxies add the client IP (cf-connecting-ip, x-forwarded-for).
          serializers: {
            req: (req: LoggedRequest) => ({ id: req.id, method: req.method, url: req.url }),
            res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
          },
          autoLogging: { ignore: (req) => req.url?.endsWith('/health') ?? false },
          transport:
            env.NODE_ENV === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
})
export class LoggerModule {}
