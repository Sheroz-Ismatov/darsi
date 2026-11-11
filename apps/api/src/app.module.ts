import { Module } from '@nestjs/common';
import { ConfigModule } from './common/config/config.module';
import { LoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { BotModule } from './modules/bot/bot.module';
import { HealthModule } from './modules/health/health.module';
import { InvitesModule } from './modules/invites/invites.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { StaffModule } from './modules/staff/staff.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    BotModule,
    HealthModule,
    InvitesModule,
    PlatformModule,
    SchoolsModule,
    StaffModule,
  ],
})
export class AppModule {}
