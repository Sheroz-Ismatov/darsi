import { Global, Module } from '@nestjs/common';
import { parseEnv } from './env';

/** Injection token for the validated environment (`Env`). */
export const ENV = Symbol('ENV');

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => parseEnv(process.env) }],
  exports: [ENV],
})
export class ConfigModule {}
