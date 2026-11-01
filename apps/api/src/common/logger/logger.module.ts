import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

const LEVELS: Record<Env['NODE_ENV'], string> = {
  development: 'debug',
  test: 'silent',
  production: 'info',
};

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: LEVELS[env.NODE_ENV],
          genReqId: (req, res) => {
            const header = req.headers['x-request-id'];
            const id = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          // Logs must not contain tokens or personal data (TZ §10.3).
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
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
