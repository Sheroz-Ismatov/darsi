import { Module } from '@nestjs/common';
import { PlanLimitsService } from './plan-limits.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PlanLimitsService],
  exports: [PlanLimitsService],
})
export class PlatformModule {}
