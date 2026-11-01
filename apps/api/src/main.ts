import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { ENV } from './common/config/config.module';
import type { Env } from './common/config/env';
import { loadEnvFile } from './common/config/load-env-file';

async function bootstrap(): Promise<void> {
  loadEnvFile();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const env = app.get<Env>(ENV);
  configureApp(app, env.CORS_ORIGINS);
  await app.listen(env.API_PORT);
}

void bootstrap();
