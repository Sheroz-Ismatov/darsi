import { Module } from '@nestjs/common';
import { InvitesModule } from '../invites/invites.module';
import { PlanLimitsService } from './plan-limits.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [InvitesModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlanLimitsService],
  exports: [PlanLimitsService],
})
export class PlatformModule {}
