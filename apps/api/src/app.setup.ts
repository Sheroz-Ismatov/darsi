import type { INestApplication } from '@nestjs/common';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';

export const API_PREFIX = 'api/v1';

/** HTTP pipeline shared by main.ts and e2e tests. */
export function configureApp(app: INestApplication, corsOrigins: string[]): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
}
